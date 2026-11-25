import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPiecewiseCropExpr,
  combineActivityTimeline,
  computeFrameDiffAndScene,
  computeRmsWindows,
  computeSmartCropPath,
  enrichMomentsWithSpeechAndHooks,
  extractHookSuggestion,
  interpolateCropAtTime,
  parseBoostKeywords,
  pickTopMoments,
} from './smartAnalysis';

test('computeRmsWindows detects loud spike relative to quiet baseline', () => {
  const sr = 8000;
  const pcm = new Float32Array(sr * 5); // 5 seconds
  // Quiet background
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = 0.02 * Math.sin(i * 0.1);
  }
  // Loud burst from 2.0s to 2.5s
  for (let i = sr * 2; i < sr * 2.5; i++) {
    pcm[i] = 0.7 * Math.sin(i * 0.3);
  }
  const windows = computeRmsWindows(pcm, sr, 0.5);
  assert.equal(windows.length, 10);
  const peakWin = windows[4]; // t = 2.0s
  assert.ok(peakWin.rms > 0.4);
  assert.ok(peakWin.spike > 2.0);
});

test('computeFrameDiffAndScene computes weighted motion centroid ignoring HUD margin', () => {
  const w = 100;
  const h = 100;
  const prev = new Uint8Array(w * h).fill(20);
  const curr = new Uint8Array(w * h).fill(20);
  // Put intense motion in right side (x ~ 75, y ~ 50)
  for (let y = 40; y < 60; y++) {
    for (let x = 70; x < 82; x++) {
      curr[y * w + x] = 220;
    }
  }
  // Put fake HUD flash in top-left corner edge (x=2..8, y=2..8)
  for (let y = 2; y < 8; y++) {
    for (let x = 2; x < 8; x++) {
      curr[y * w + x] = 250;
    }
  }
  const res = computeFrameDiffAndScene(prev, curr, w, h, true);
  assert.ok(res.motion > 0.05);
  assert.ok(res.focusX > 0.65, `Expected focusX > 0.65, got ${res.focusX}`);
});

test('combineActivityTimeline flags silent static video as no strong moments', () => {
  const motion = [
    { time: 0, motion: 0.001, sceneChange: 0, focusX: 0.5, focusY: 0.5 },
    { time: 0.5, motion: 0.002, sceneChange: 0, focusX: 0.5, focusY: 0.5 },
  ];
  const combined = combineActivityTimeline([], motion);
  assert.equal(combined.hasAudio, false);
  assert.equal(combined.hasStrongMoments, false);
});

test('pickTopMoments selects non-overlapping candidates sorted chronologically', () => {
  const samples = Array.from({ length: 120 }, (_, i) => {
    const isPeak1 = i >= 19 && i <= 21;
    const isPeak2 = i >= 89 && i <= 91;
    return {
      time: i * 0.5,
      audioRms: isPeak1 || isPeak2 ? 0.8 : 0.05,
      motion: isPeak1 || isPeak2 ? 0.5 : 0.02,
      sceneChange: 0,
      score: isPeak1 ? 0.92 : isPeak2 ? 0.85 : 0.1,
      focusX: 0.5,
      focusY: 0.5,
    };
  });
  const moments = pickTopMoments(samples, 60, { maxCount: 5, targetClipSec: 16, minGapSec: 4 });
  assert.ok(moments.length >= 2);
  for (let i = 1; i < moments.length; i++) {
    assert.ok(moments[i].startTime >= moments[i - 1].endTime + 3.9);
  }
  assert.equal(moments[0].activityLevel, 'High');
  assert.ok(moments[0].reasonTags?.includes('loud'));
});

test('computeSmartCropPath smooths jitter and buildPiecewiseCropExpr produces valid FFmpeg expression', () => {
  const samples = [
    { time: 0, audioRms: 0, motion: 0.5, sceneChange: 0, score: 0.6, focusX: 0.2, focusY: 0.5 },
    { time: 0.5, audioRms: 0, motion: 0.5, sceneChange: 0, score: 0.6, focusX: 0.9, focusY: 0.5 },
    { time: 1.0, audioRms: 0, motion: 0.5, sceneChange: 0, score: 0.6, focusX: 0.85, focusY: 0.5 },
  ];
  const path = computeSmartCropPath(samples, 0.5);
  assert.ok(path.length >= 2);
  // Max pan speed prevents instant jump from 0.5 to 0.9 in 0.5s
  assert.ok(path[1].cropX < 0.75);

  const interp = interpolateCropAtTime(path, 0.25);
  assert.ok(interp.cropX >= 0 && interp.cropX <= 1);

  const expr = buildPiecewiseCropExpr(path, 0, 1.0, 'x', 'iw-ow');
  assert.match(expr, /if\(lt\(t,/);
});

test('speech-aware boost scores keywords, exclamations, reason tags, and hook suggestion accurately', () => {
  const keywords = parseBoostKeywords('no way, clutch, watch this');
  assert.deepEqual(keywords, ['no way', 'clutch', 'watch this']);

  const motion = Array.from({ length: 20 }, (_, i) => ({
    time: i * 0.5,
    motion: 0.12,
    sceneChange: 0,
    focusX: 0.5,
    focusY: 0.5,
  }));

  const captions = [
    { startTime: 1.0, endTime: 2.0, text: 'Walking down the street' },
    { startTime: 6.0, endTime: 7.2, text: 'No way, watch this clutch shot!' },
    { startTime: 7.3, endTime: 8.5, text: 'Unbelievable finish!' },
  ];

  const combined = combineActivityTimeline([], motion, captions, keywords);
  const quietSample = combined.samples.find((s) => Math.abs(s.time - 4.0) < 0.1)!;
  const keywordSample = combined.samples.find((s) => Math.abs(s.time - 6.5) < 0.1)!;
  assert.ok(keywordSample.score > quietSample.score);

  const moments = pickTopMoments(combined.samples, 10, {
    maxCount: 2,
    targetClipSec: 4,
    hasAudio: false,
    captionLines: captions,
    keywords,
  });
  assert.ok(moments.length >= 1);
  assert.ok(moments[0].reasonTags?.includes('speech'));
  assert.ok(moments[0].reasonTags?.includes('keyword'));
  assert.equal(moments[0].hookSuggestion, 'No way, watch this clutch shot!');

  const hookNone = extractHookSuggestion(2.5, 4.0, captions, keywords, combined.samples);
  assert.equal(hookNone, undefined);

  const enriched = enrichMomentsWithSpeechAndHooks(
    [{ ...moments[0], reasonTags: ['motion'], hookSuggestion: undefined, thumbnailDataUrl: '' }],
    combined.samples,
    false,
    captions,
    keywords
  );
  assert.ok(enriched[0].reasonTags?.includes('keyword'));
  assert.equal(enriched[0].hookSuggestion, 'No way, watch this clutch shot!');
});

