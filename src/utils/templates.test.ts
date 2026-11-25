import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_CONFIG } from '../config/appConfig';
import {
  applyTemplateToEditorState,
  cloneTemplateSnapshot,
  getTemplateById,
  LOOK_TEMPLATES,
} from '../config/templates';
import type {
  CaptionConfig,
  ClipSegment,
  ExportSettings,
  LogoOverlayConfig,
  TextOverlayConfig,
} from '../types/editor';
import { CAPTION_PRESET_DEFAULTS } from './captions';
import { buildFfmpegArgs, getProcessingMode } from './ffmpegArgs';
import { buildSampleDemoCaptionLines } from './sampleScenes';
import {
  findShowcaseVideoAsset,
  shouldDrawShowcaseFrame,
  shouldRunShowcaseAnimation,
} from './showcaseScheduler';

const BASE_SEGMENTS: ClipSegment[] = [
  { id: 'seg-1', name: 'Highlight 1', startTime: 3.5, endTime: 18.2 },
  { id: 'seg-2', name: 'Highlight 2', startTime: 24.0, endTime: 33.5 },
];

const BASE_SETTINGS: ExportSettings = {
  aspect: '16:9',
  keepOriginalFraming: true,
  verticalMode: 'fill-crop',
  reframeMode: 'manual',
  lockPosition: false,
  ignoreHudEdges: true,
  foregroundSizePercent: 100,
  cropX: 0.5,
  cropY: 0.5,
  zoom: { punchZoom: 1, slowZoom: false, pulseOnPeaks: false },
  splitLayout: {
    gameplayRatioPercent: 65,
    backgroundMode: 'fill',
    gameplayBox: { x: 0.05, y: 0.05, w: 0.9, h: 0.75 },
    facecamBox: { x: 0.7, y: 0.65, w: 0.25, h: 0.3 },
  },
  speed: 1,
  muted: false,
  volume: 1,
  quality: 'balanced',
  format: 'mp4',
};

const BASE_CAPTIONS: CaptionConfig = {
  enabled: false,
  preset: 'bold-pop',
  styleMode: 'single',
  autoMixIntensity: 'balanced',
  position: 'bottom',
  offsetPercent: CAPTION_PRESET_DEFAULTS['bold-pop'].offsetPercent,
  font: 'display-bold',
  fontSize: 64,
  textColor: '#ffffff',
  highlightColor: '#e59a24',
  outlineWidth: 5,
  backgroundBox: false,
  wordsPerLine: 3,
  uppercase: true,
  popIn: true,
  showSafeZoneGuide: false,
};

const BASE_TEXT: TextOverlayConfig = {
  enabled: false,
  text: '',
  position: 'top',
  font: 'sans-bold',
  fontSize: 44,
  color: '#ffffff',
  outlineColor: '#000000',
  outlineWidth: 4,
  startTime: 0,
  endTime: 3,
  hookFade: true,
};

const USER_LOGO: LogoOverlayConfig = {
  enabled: true,
  fileName: 'channel-watermark.png',
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  corner: 'bottom-right',
  sizePercent: 16,
  opacity: 0.9,
};

test('LOOK_TEMPLATES contains all 4 looks and unknown template IDs fail gracefully', () => {
  assert.deepEqual(
    LOOK_TEMPLATES.map((t) => t.id),
    ['blur-fill-classic', 'action-follow', 'gameplay-facecam', 'quick-cut']
  );

  assert.equal(getTemplateById('unknown-look'), null);
  assert.equal(getTemplateById(''), null);
  assert.equal(getTemplateById(null), null);
  assert.equal(getTemplateById(undefined), null);
  assert.equal(getTemplateById('ACTION-FOLLOW')?.id, 'action-follow');
});

test('applying templates preserves trim ranges, clip list, logo overlay, and snapshots reset cleanly', () => {
  const initialSegmentsSnapshot = structuredClone(BASE_SEGMENTS);
  const initialLogoSnapshot = structuredClone(USER_LOGO);
  const beforeSnapshot = cloneTemplateSnapshot(
    null,
    BASE_SETTINGS,
    BASE_CAPTIONS,
    BASE_TEXT,
    null
  );

  const actionTpl = getTemplateById('action-follow');
  assert.ok(actionTpl);

  const applied = applyTemplateToEditorState(actionTpl, {
    settings: BASE_SETTINGS,
    captionConfig: BASE_CAPTIONS,
    textOverlay: BASE_TEXT,
  });

  // Assert exact styling changes
  assert.equal(applied.nextSettings.aspect, '9:16');
  assert.equal(applied.nextSettings.keepOriginalFraming, false);
  assert.equal(applied.nextSettings.reframeMode, 'smart-follow');
  assert.equal(applied.nextSettings.zoom.punchZoom, 1.15);
  assert.equal(applied.nextSettings.zoom.pulseOnPeaks, true);
  assert.equal(applied.nextCaptions.enabled, true);
  assert.equal(applied.nextCaptions.preset, 'hype-pop');
  assert.equal(applied.nextTextOverlay.enabled, true);
  assert.equal(applied.nextTextOverlay.text, 'Wait for it...');
  assert.equal(applied.nextTextOverlay.startTime, 0);
  assert.equal(applied.nextTextOverlay.endTime, 3);

  // Assert summary clearly lists turned-on overlays & settings including editable hook
  assert.ok(
    applied.changedSummary.some((s) => s.includes('Hook title overlay ON: "Wait for it..."')),
    'Summary must explicitly list the hook title overlay'
  );
  assert.ok(applied.changedSummary.some((s) => s.includes('1.15×')));
  assert.ok(applied.changedSummary.some((s) => s.includes('hype-pop')));

  // Pure helper never alters segments, logo, or original input snapshot
  assert.deepEqual(BASE_SEGMENTS, initialSegmentsSnapshot);
  assert.deepEqual(USER_LOGO, initialLogoSnapshot);
  assert.deepEqual(beforeSnapshot.settings, BASE_SETTINGS);
  assert.deepEqual(beforeSnapshot.captionConfig, BASE_CAPTIONS);
  assert.deepEqual(beforeSnapshot.textOverlay, BASE_TEXT);
});

test('all 4 templates produce valid FFmpeg arguments matching their processing guarantees', () => {
  const sampleLines = buildSampleDemoCaptionLines();
  const emptyLogo: LogoOverlayConfig = { ...USER_LOGO, enabled: false, dataUrl: '' };

  // 1. Blur Fill Classic -> 9:16 blurred background fill at 110% foreground, classic captions, no zoom
  const blurTpl = getTemplateById('blur-fill-classic')!;
  const blurState = applyTemplateToEditorState(blurTpl, {
    settings: BASE_SETTINGS,
    captionConfig: BASE_CAPTIONS,
    textOverlay: BASE_TEXT,
  });
  const blurArgs = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: BASE_SEGMENTS[0],
    settings: blurState.nextSettings,
    textOverlay: blurState.nextTextOverlay,
    logoOverlay: emptyLogo,
    captions: {
      config: blurState.nextCaptions,
      lines: sampleLines,
      assVirtualPath: 'captions.ass',
    },
    hasAudio: true,
    fontVirtualPath: 'font.ttf',
  });
  assert.equal(blurArgs.mode, 're-encode');
  const blurFilter = blurArgs.args[blurArgs.args.indexOf('-filter_complex') + 1];
  assert.match(blurFilter, /boxblur=/);
  assert.match(blurFilter, /ass=filename='captions\.ass'/);
  assert.equal(/zoompan/.test(blurFilter), false);

  // 2. Action Follow -> Smart follow + 1.15x punch zoom + peak pulse + Wait for it hook + Hype Pop captions
  const actionTpl = getTemplateById('action-follow')!;
  const actionState = applyTemplateToEditorState(actionTpl, {
    settings: BASE_SETTINGS,
    captionConfig: BASE_CAPTIONS,
    textOverlay: BASE_TEXT,
  });
  const actionArgs = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: BASE_SEGMENTS[0],
    settings: actionState.nextSettings,
    textOverlay: actionState.nextTextOverlay,
    logoOverlay: emptyLogo,
    captions: {
      config: actionState.nextCaptions,
      lines: sampleLines,
      assVirtualPath: 'captions.ass',
    },
    cropPath: [
      { time: 3.5, cropX: 0.35, cropY: 0.5 },
      { time: 10.0, cropX: 0.65, cropY: 0.5 },
    ],
    peakTimes: [5.5],
    hasAudio: true,
    fontVirtualPath: 'font.ttf',
  });
  assert.equal(actionArgs.mode, 're-encode');
  const actionFilter = actionArgs.args[actionArgs.args.indexOf('-filter_complex') + 1];
  assert.match(actionFilter, /crop=/);
  assert.match(actionFilter, /zoompan=.*1\.15/);
  assert.match(actionFilter, /drawtext=.*Wait for it\.\.\./);
  assert.match(actionFilter, /ass=filename='captions\.ass'/);

  // 3. Gameplay + Facecam -> 65/35 split layout + blurred background + Boxed captions
  const splitTpl = getTemplateById('gameplay-facecam')!;
  const splitState = applyTemplateToEditorState(splitTpl, {
    settings: BASE_SETTINGS,
    captionConfig: BASE_CAPTIONS,
    textOverlay: BASE_TEXT,
  });
  const splitArgs = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: BASE_SEGMENTS[0],
    settings: splitState.nextSettings,
    textOverlay: splitState.nextTextOverlay,
    logoOverlay: emptyLogo,
    captions: {
      config: splitState.nextCaptions,
      lines: sampleLines,
      assVirtualPath: 'captions.ass',
    },
    hasAudio: true,
    fontVirtualPath: 'font.ttf',
  });
  assert.equal(splitArgs.mode, 're-encode');
  const splitFilter = splitArgs.args[splitArgs.args.indexOf('-filter_complex') + 1];
  assert.match(splitFilter, /boxblur=/);
  assert.match(splitFilter, /overlay=/);
  assert.match(splitFilter, /ass=filename='captions\.ass'/);

  // 4. Quick Cut -> Original aspect, fast stream copy (-c copy), no captions, no re-encode
  const quickTpl = getTemplateById('quick-cut')!;
  const quickState = applyTemplateToEditorState(quickTpl, {
    settings: { ...actionState.nextSettings, zoom: { punchZoom: 1.25, slowZoom: true, pulseOnPeaks: true } },
    captionConfig: actionState.nextCaptions,
    textOverlay: actionState.nextTextOverlay,
  });
  assert.equal(
    getProcessingMode(quickState.nextSettings, quickState.nextTextOverlay, emptyLogo, false),
    'fast-copy'
  );
  const quickArgs = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: BASE_SEGMENTS[0],
    settings: quickState.nextSettings,
    textOverlay: quickState.nextTextOverlay,
    logoOverlay: emptyLogo,
    hasAudio: true,
  });
  assert.equal(quickArgs.mode, 'fast-copy');
  assert.ok(quickArgs.args.includes('-c'));
  assert.ok(quickArgs.args.includes('copy'));
  assert.equal(quickArgs.args.includes('libx264'), false);
});

test('showcaseScheduler stops on hidden, background tab, or reduced motion and caps at 24fps', () => {
  assert.equal(
    shouldRunShowcaseAnimation({ isVisible: true, isTabVisible: true, prefersReducedMotion: false }),
    true
  );
  assert.equal(
    shouldRunShowcaseAnimation({ isVisible: false, isTabVisible: true, prefersReducedMotion: false }),
    false
  );
  assert.equal(
    shouldRunShowcaseAnimation({ isVisible: true, isTabVisible: false, prefersReducedMotion: false }),
    false
  );
  assert.equal(
    shouldRunShowcaseAnimation({ isVisible: true, isTabVisible: true, prefersReducedMotion: true }),
    false
  );

  // 24 fps -> 41.66ms min interval
  assert.equal(shouldDrawShowcaseFrame(100, -1, 24), true);
  assert.equal(shouldDrawShowcaseFrame(116, 100, 24), false);
  assert.equal(shouldDrawShowcaseFrame(142, 100, 24), true);
});

test('SHOWCASE_VIDEOS config stays empty by default and fallback lookup works cleanly', () => {
  assert.deepEqual(APP_CONFIG.SHOWCASE_VIDEOS, []);
  assert.equal(findShowcaseVideoAsset('blur-fill-classic'), null);

  const customAsset = {
    templateId: 'action-follow' as const,
    videoUrl: '/showcase/action-follow.mp4',
    posterUrl: '/showcase/action-follow-poster.jpg',
    alt: 'Licensed showcase clip',
  };
  assert.deepEqual(findShowcaseVideoAsset('action-follow', [customAsset]), customAsset);
  assert.equal(findShowcaseVideoAsset('quick-cut', [customAsset]), null);
});
