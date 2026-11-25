import type {
  ActivityLevel,
  ActivitySample,
  CaptionLine,
  CropKeyframe,
  MomentReasonTag,
  SmartMomentCandidate,
} from '../types/editor';
import { clampTime } from './timecode';

export interface RmsWindow {
  time: number;
  rms: number;
  spike: number;
}

export interface MotionWindow {
  time: number;
  motion: number;
  sceneChange: number;
  focusX: number;
  focusY: number;
}

export type CaptionTextWindow = Pick<CaptionLine, 'startTime' | 'endTime'> & { text?: string };

export function parseBoostKeywords(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

export interface WindowSpeechSignals {
  speechScore: number;
  denseSpeech: boolean;
  hasExclamation: boolean;
  matchedKeywords: string[];
}

export function evaluateSpeechInWindow(
  startTime: number,
  endTime: number,
  captionLines?: CaptionTextWindow[],
  keywords: readonly string[] = []
): WindowSpeechSignals {
  if (!captionLines || captionLines.length === 0) {
    return { speechScore: 0, denseSpeech: false, hasExclamation: false, matchedKeywords: [] };
  }

  const overlapping = captionLines.filter(
    (c) => c.endTime >= startTime - 0.15 && c.startTime <= endTime + 0.15
  );
  if (overlapping.length === 0) {
    return { speechScore: 0, denseSpeech: false, hasExclamation: false, matchedKeywords: [] };
  }

  const combinedText = overlapping
    .map((c) => c.text || '')
    .join(' ')
    .trim();
  const wordCount = combinedText ? combinedText.split(/\s+/).filter(Boolean).length : 0;
  const span = Math.max(0.5, endTime - startTime);
  const wordsPerSec = wordCount / span;
  const denseSpeech = overlapping.length >= 2 || wordsPerSec >= 2.1;
  const hasExclamation = /[!?!]{1,}/.test(combinedText);

  const lower = combinedText.toLowerCase();
  const normalizedKeywords = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const matchedKeywords = normalizedKeywords.filter((kw) => lower.includes(kw));

  let speechScore = 0.08;
  if (denseSpeech) speechScore += 0.08;
  if (hasExclamation) speechScore += 0.07;
  if (matchedKeywords.length > 0) {
    speechScore += Math.min(0.22, 0.12 + (matchedKeywords.length - 1) * 0.05);
  }

  return {
    speechScore: Math.min(0.32, Number(speechScore.toFixed(4))),
    denseSpeech,
    hasExclamation,
    matchedKeywords,
  };
}

/**
 * Picks the most intense spoken line inside [startTime, endTime] as an editable hook candidate.
 * Never auto-applied; caller shows it in an editable field.
 */
export function extractHookSuggestion(
  startTime: number,
  endTime: number,
  captionLines?: CaptionTextWindow[],
  keywords: readonly string[] = [],
  samples: ActivitySample[] = []
): string | undefined {
  if (!captionLines || captionLines.length === 0) return undefined;
  const overlapping = captionLines.filter(
    (c) => (c.text || '').trim().length > 0 && c.endTime >= startTime && c.startTime <= endTime
  );
  if (overlapping.length === 0) return undefined;

  const normalizedKw = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  let bestLine = overlapping[0];
  let bestIntensity = -1;

  for (const line of overlapping) {
    const txt = (line.text || '').trim();
    const lower = txt.toLowerCase();
    const mid = (line.startTime + line.endTime) / 2;

    let localActivity = 0;
    if (samples.length > 0) {
      let nearest = samples[0];
      let minDist = Math.abs(nearest.time - mid);
      for (let i = 1; i < samples.length; i++) {
        const d = Math.abs(samples[i].time - mid);
        if (d < minDist) {
          nearest = samples[i];
          minDist = d;
        }
      }
      localActivity = nearest.score;
    }

    const kwMatches = normalizedKw.filter((kw) => lower.includes(kw)).length;
    const exclamBoost = (txt.match(/[!?]/g)?.length ?? 0) * 0.28;
    const wordCount = txt.split(/\s+/).filter(Boolean).length;
    const conciseBonus = wordCount >= 2 && wordCount <= 10 ? 0.15 : 0;
    const intensity = localActivity + kwMatches * 0.45 + exclamBoost + conciseBonus;

    if (intensity > bestIntensity) {
      bestIntensity = intensity;
      bestLine = line;
    }
  }

  const candidate = (bestLine.text || '').trim();
  if (!candidate) return undefined;
  return candidate.length > 72 ? `${candidate.slice(0, 69).trim()}...` : candidate;
}

export function computeRmsWindows(
  pcm: Float32Array,
  sampleRate: number,
  windowSec = 0.5
): RmsWindow[] {
  if (!pcm.length || sampleRate <= 0) return [];
  const samplesPerWin = Math.max(1, Math.floor(sampleRate * windowSec));
  const raw: { time: number; rms: number }[] = [];

  for (let offset = 0; offset < pcm.length; offset += samplesPerWin) {
    const end = Math.min(pcm.length, offset + samplesPerWin);
    let sumSq = 0;
    for (let i = offset; i < end; i++) {
      const s = pcm[i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, end - offset));
    raw.push({
      time: Number((offset / sampleRate).toFixed(3)),
      rms,
    });
  }

  // Local baseline spike detection (+/- 8 windows = +/- 4 seconds)
  const radius = 8;
  return raw.map((item, idx) => {
    const lo = Math.max(0, idx - radius);
    const hi = Math.min(raw.length - 1, idx + radius);
    let sum = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      sum += raw[j].rms;
      count++;
    }
    const baseline = sum / Math.max(1, count);
    const spike = baseline > 1e-4 ? Math.max(0, (item.rms - baseline) / baseline) : 0;
    return {
      time: item.time,
      rms: item.rms,
      spike,
    };
  });
}

export function computeFrameDiffAndScene(
  prevLuma: Uint8Array | null,
  currLuma: Uint8Array,
  width: number,
  height: number,
  ignoreHudMargin = true
): { motion: number; sceneChange: number; focusX: number; focusY: number } {
  if (!prevLuma || prevLuma.length !== currLuma.length || width <= 0 || height <= 0) {
    return { motion: 0, sceneChange: 0, focusX: 0.5, focusY: 0.5 };
  }

  const marginX = ignoreHudMargin ? Math.floor(width * 0.12) : 0;
  const marginY = ignoreHudMargin ? Math.floor(height * 0.12) : 0;

  let totalDiff = 0;
  let significantPixels = 0;
  let weightedSum = 0;
  let sumX = 0;
  let sumY = 0;
  let pixelCount = 0;

  for (let y = 0; y < height; y++) {
    const insideFocus = y >= marginY && y < height - marginY;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const d = Math.abs(currLuma[idx] - prevLuma[idx]);
      totalDiff += d;
      pixelCount++;
      if (d > 28) significantPixels++;

      if (insideFocus && x >= marginX && x < width - marginX && d > 12) {
        const w = d * d;
        weightedSum += w;
        sumX += (x / Math.max(1, width - 1)) * w;
        sumY += (y / Math.max(1, height - 1)) * w;
      }
    }
  }

  const motion = Math.min(1, totalDiff / Math.max(1, pixelCount * 42));
  const changedRatio = significantPixels / Math.max(1, pixelCount);
  const sceneChange = changedRatio > 0.38 ? Math.min(1, (changedRatio - 0.3) * 2.2) : 0;

  const focusX = weightedSum > 100 ? clampTime(sumX / weightedSum, 0.05, 0.95) : 0.5;
  const focusY = weightedSum > 100 ? clampTime(sumY / weightedSum, 0.05, 0.95) : 0.5;

  return { motion, sceneChange, focusX, focusY };
}

export function combineActivityTimeline(
  audioWindows: RmsWindow[],
  motionWindows: MotionWindow[],
  captionLines?: CaptionTextWindow[],
  keywords: readonly string[] = []
): {
  samples: ActivitySample[];
  hasAudio: boolean;
  hasStrongMoments: boolean;
} {
  if (motionWindows.length === 0) {
    return { samples: [], hasAudio: false, hasStrongMoments: false };
  }

  const maxRms = audioWindows.reduce((m, w) => Math.max(m, w.rms), 0);
  const maxSpike = audioWindows.reduce((m, w) => Math.max(m, w.spike), 0);
  const hasAudio = audioWindows.length > 0 && maxRms > 0.0025;

  const maxMotion = motionWindows.reduce((m, w) => Math.max(m, w.motion), 0);
  const hasSpeechInput = Boolean(captionLines && captionLines.length > 0);
  const hasStrongMoments =
    (hasAudio && maxRms > 0.008) || maxMotion > 0.035 || hasSpeechInput;

  const samples: ActivitySample[] = motionWindows.map((mw) => {
    // Find nearest audio window
    let audioNorm = 0;
    let rawRms = 0;
    if (hasAudio && audioWindows.length > 0) {
      let best = audioWindows[0];
      let bestDist = Math.abs(mw.time - best.time);
      for (let i = 1; i < audioWindows.length; i++) {
        const d = Math.abs(mw.time - audioWindows[i].time);
        if (d < bestDist) {
          best = audioWindows[i];
          bestDist = d;
        }
      }
      rawRms = best.rms;
      const rmsNorm = maxRms > 0 ? best.rms / maxRms : 0;
      const spikeNorm = maxSpike > 0 ? Math.min(1, best.spike / Math.max(0.8, maxSpike)) : 0;
      audioNorm = Math.min(1, rmsNorm * 0.55 + spikeNorm * 0.45);
    }

    const motionNorm = maxMotion > 0.01 ? Math.min(1, mw.motion / Math.max(0.18, maxMotion)) : 0;
    const sceneNorm = mw.sceneChange;

    const speechSignals = evaluateSpeechInWindow(
      mw.time - 0.5,
      mw.time + 0.5,
      captionLines,
      keywords
    );

    const baseScore = hasAudio
      ? audioNorm * 0.5 + motionNorm * 0.35 + sceneNorm * 0.15
      : motionNorm * 0.78 + sceneNorm * 0.22;

    return {
      time: mw.time,
      audioRms: rawRms,
      motion: mw.motion,
      sceneChange: mw.sceneChange,
      score: Math.min(1, Number((baseScore + speechSignals.speechScore).toFixed(4))),
      focusX: mw.focusX,
      focusY: mw.focusY,
    };
  });

  return { samples, hasAudio, hasStrongMoments };
}

function classifyActivityLevel(score: number): ActivityLevel {
  if (score >= 0.7) return 'High';
  if (score >= 0.42) return 'Medium';
  return 'Low';
}

function buildMomentReasonMeta(params: {
  hasAudio: boolean;
  audioRms: number;
  motion: number;
  sceneChange: number;
  speechSignals: WindowSpeechSignals;
}): { reason: string; reasonTags: MomentReasonTag[] } {
  const { hasAudio, audioRms, motion, sceneChange, speechSignals } = params;
  const reasons: string[] = [];
  const tags: MomentReasonTag[] = [];

  if (hasAudio && audioRms > 0.01) {
    reasons.push('loudness peak');
    tags.push('loud');
  }
  if (motion > 0.06 || sceneChange > 0.2) {
    reasons.push(sceneChange > 0.2 ? 'high motion & scene shift' : 'high motion');
    tags.push('motion');
  }
  if (speechSignals.speechScore > 0) {
    if (speechSignals.denseSpeech || speechSignals.hasExclamation) {
      reasons.push(speechSignals.hasExclamation ? 'excited speech' : 'dense speech');
    } else {
      reasons.push('spoken moment');
    }
    tags.push('speech');
  }
  if (speechSignals.matchedKeywords.length > 0) {
    reasons.push(`keyword: "${speechSignals.matchedKeywords[0]}"`);
    tags.push('keyword');
  }

  return {
    reason: reasons.length > 0 ? reasons.join(' + ') : 'activity spike',
    reasonTags: tags.length > 0 ? tags : ['motion'],
  };
}

export function pickTopMoments(
  samples: ActivitySample[],
  totalDuration: number,
  options?: {
    maxCount?: number;
    targetClipSec?: number;
    minGapSec?: number;
    hasAudio?: boolean;
    captionLines?: CaptionTextWindow[];
    keywords?: readonly string[];
  }
): Omit<SmartMomentCandidate, 'thumbnailDataUrl'>[] {
  if (samples.length === 0 || totalDuration <= 0.5) return [];

  const maxCount = options?.maxCount ?? 5;
  const minGap = options?.minGapSec ?? 4;
  const hasAudio = options?.hasAudio ?? true;
  const captionLines = options?.captionLines;
  const keywords = options?.keywords ?? [];

  // Target 15-45s on long videos, scaled proportionally on short clips
  const rawTarget = clampTime(options?.targetClipSec ?? 25, 15, 45);
  const clipLen =
    totalDuration < 18
      ? clampTime(totalDuration * 0.42, Math.min(2, totalDuration), Math.max(2, totalDuration - 0.5))
      : Math.min(rawTarget, totalDuration);

  // Rank peaks descending by smoothed local score
  const ranked = samples
    .map((s, idx) => {
      const prev = samples[Math.max(0, idx - 1)].score;
      const next = samples[Math.min(samples.length - 1, idx + 1)].score;
      const smoothed = prev * 0.25 + s.score * 0.5 + next * 0.25;
      return { sample: s, smoothed };
    })
    .sort((a, b) => b.smoothed - a.smoothed);

  const chosen: Omit<SmartMomentCandidate, 'thumbnailDataUrl'>[] = [];

  for (const item of ranked) {
    if (chosen.length >= maxCount) break;
    const peakTime = item.sample.time;

    // Start ~2s before peak (or 25% into short clip) and extend after it settles
    const leadIn = totalDuration < 18 ? Math.min(1.0, clipLen * 0.3) : 2.0;
    let startTime = clampTime(peakTime - leadIn, 0, Math.max(0, totalDuration - clipLen));
    let endTime = clampTime(startTime + clipLen, Math.min(totalDuration, 0.5), totalDuration);
    if (endTime - startTime < Math.min(1, totalDuration)) {
      startTime = Math.max(0, endTime - Math.min(clipLen, totalDuration));
    }

    const overlaps = chosen.some(
      (c) => startTime < c.endTime + minGap && endTime + minGap > c.startTime
    );
    if (overlaps) continue;

    const speechSignals = evaluateSpeechInWindow(startTime, endTime, captionLines, keywords);
    const boostedScore = Math.min(1, Number((item.smoothed + speechSignals.speechScore * 0.55).toFixed(3)));
    const { reason, reasonTags } = buildMomentReasonMeta({
      hasAudio,
      audioRms: item.sample.audioRms,
      motion: item.sample.motion,
      sceneChange: item.sample.sceneChange,
      speechSignals,
    });
    const hookSuggestion = extractHookSuggestion(
      startTime,
      endTime,
      captionLines,
      keywords,
      samples
    );

    chosen.push({
      id: `moment-${chosen.length + 1}-${Math.round(peakTime * 10)}`,
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(endTime.toFixed(2)),
      peakTime: Number(peakTime.toFixed(2)),
      score: boostedScore,
      activityLevel: classifyActivityLevel(boostedScore),
      reason,
      reasonTags,
      hookSuggestion,
    });
  }

  return chosen.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Re-applies speech-aware boost and editable hook suggestions on existing moments
 * whenever captions are generated/edited or keywords change.
 */
export function enrichMomentsWithSpeechAndHooks(
  moments: SmartMomentCandidate[],
  samples: ActivitySample[],
  hasAudio: boolean,
  captionLines: CaptionTextWindow[],
  keywords: readonly string[]
): SmartMomentCandidate[] {
  return moments.map((m) => {
    const windowSamples = samples.filter(
      (s) => s.time >= m.startTime && s.time <= m.endTime
    );
    const maxAudio = windowSamples.reduce((acc, s) => Math.max(acc, s.audioRms), 0);
    const maxMotion = windowSamples.reduce((acc, s) => Math.max(acc, s.motion), 0);
    const maxScene = windowSamples.reduce((acc, s) => Math.max(acc, s.sceneChange), 0);
    const basePeak = windowSamples.reduce((acc, s) => Math.max(acc, s.score), m.score);

    const speechSignals = evaluateSpeechInWindow(m.startTime, m.endTime, captionLines, keywords);
    const boostedScore = Math.min(1, Number((basePeak + speechSignals.speechScore * 0.55).toFixed(3)));
    const { reason, reasonTags } = buildMomentReasonMeta({
      hasAudio,
      audioRms: maxAudio,
      motion: maxMotion,
      sceneChange: maxScene,
      speechSignals,
    });
    const hookSuggestion = extractHookSuggestion(
      m.startTime,
      m.endTime,
      captionLines,
      keywords,
      samples
    );

    return {
      ...m,
      score: boostedScore,
      activityLevel: classifyActivityLevel(boostedScore),
      reason,
      reasonTags,
      hookSuggestion,
    };
  });
}

export function computeSmartCropPath(
  samples: ActivitySample[],
  keyframeIntervalSec = 0.5
): CropKeyframe[] {
  if (samples.length === 0) {
    return [{ time: 0, cropX: 0.5, cropY: 0.5 }];
  }

  const alpha = 0.28;
  const deadZone = 0.035;
  const maxPanPerSec = 0.22;

  let curX = 0.5;
  let curY = 0.5;
  let lastTime = samples[0].time;
  let lastEmitTime = -Infinity;
  const keyframes: CropKeyframe[] = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dt = Math.max(0.05, s.time - lastTime);
    lastTime = s.time;

    // Mild bias toward center (0.5) when motion is low
    const motionConfidence = Math.min(1, s.motion * 4.5);
    const targetX = 0.5 * (1 - 0.72 * motionConfidence) + s.focusX * (0.72 * motionConfidence);
    const targetY = 0.5 * (1 - 0.65 * motionConfidence) + s.focusY * (0.65 * motionConfidence);

    const dx = targetX - curX;
    const dy = targetY - curY;

    const desiredX = Math.abs(dx) > deadZone ? curX + dx * alpha : curX;
    const desiredY = Math.abs(dy) > deadZone ? curY + dy * alpha : curY;

    const maxStep = maxPanPerSec * dt;
    curX = clampTime(curX + clampTime(desiredX - curX, -maxStep, maxStep), 0, 1);
    curY = clampTime(curY + clampTime(desiredY - curY, -maxStep, maxStep), 0, 1);

    if (s.time - lastEmitTime >= keyframeIntervalSec - 0.02 || i === samples.length - 1) {
      keyframes.push({
        time: Number(s.time.toFixed(2)),
        cropX: Number(curX.toFixed(3)),
        cropY: Number(curY.toFixed(3)),
      });
      lastEmitTime = s.time;
    }
  }

  return keyframes.length > 0 ? keyframes : [{ time: 0, cropX: 0.5, cropY: 0.5 }];
}

export function interpolateCropAtTime(
  keyframes: CropKeyframe[],
  time: number
): { cropX: number; cropY: number } {
  if (!keyframes.length) return { cropX: 0.5, cropY: 0.5 };
  if (time <= keyframes[0].time) return { cropX: keyframes[0].cropX, cropY: keyframes[0].cropY };
  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return { cropX: last.cropX, cropY: last.cropY };

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = Math.max(1e-4, b.time - a.time);
      const frac = (time - a.time) / span;
      return {
        cropX: Number((a.cropX + (b.cropX - a.cropX) * frac).toFixed(3)),
        cropY: Number((a.cropY + (b.cropY - a.cropY) * frac).toFixed(3)),
      };
    }
  }
  return { cropX: last.cropX, cropY: last.cropY };
}

/**
 * Builds an FFmpeg piecewise-linear expression for crop x or y over output timestamp `t`.
 * Thin-samples to at most 20 segments so filtergraph expressions remain compact in ffmpeg.wasm.
 */
export function buildPiecewiseCropExpr(
  keyframes: CropKeyframe[],
  clipStartTime: number,
  clipEndTime: number,
  axis: 'x' | 'y',
  maxOffsetExpr: string
): string {
  const inRange = keyframes.filter(
    (k) => k.time >= clipStartTime - 0.5 && k.time <= clipEndTime + 0.5
  );
  const source = inRange.length >= 2 ? inRange : keyframes;
  if (source.length === 0) return `(${maxOffsetExpr})*0.500`;
  if (source.length === 1) {
    const val = axis === 'x' ? source[0].cropX : source[0].cropY;
    return `(${maxOffsetExpr})*${val.toFixed(3)}`;
  }

  // Downsample to <= 20 points to keep FFmpeg expression depth safe
  const maxPoints = 20;
  const pts: { t: number; v: number }[] = [];
  const step = Math.max(1, Math.floor(source.length / maxPoints));
  for (let i = 0; i < source.length; i += step) {
    const k = source[i];
    pts.push({
      t: Number(Math.max(0, k.time - clipStartTime).toFixed(2)),
      v: axis === 'x' ? k.cropX : k.cropY,
    });
  }
  const lastK = source[source.length - 1];
  const lastRelT = Number(Math.max(0, lastK.time - clipStartTime).toFixed(2));
  if (pts[pts.length - 1].t < lastRelT) {
    pts.push({ t: lastRelT, v: axis === 'x' ? lastK.cropX : lastK.cropY });
  }

  if (pts.length === 1) {
    return `(${maxOffsetExpr})*${pts[0].v.toFixed(3)}`;
  }

  let expr = pts[pts.length - 1].v.toFixed(3);
  for (let i = pts.length - 2; i >= 0; i--) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dt = Math.max(0.05, Number((p1.t - p0.t).toFixed(2)));
    const dv = Number((p1.v - p0.v).toFixed(3));
    const segExpr =
      Math.abs(dv) < 0.002
        ? p0.v.toFixed(3)
        : `(${p0.v.toFixed(3)}+(${dv.toFixed(3)})*max(0,min(1,(t-${p0.t.toFixed(2)})/${dt.toFixed(2)})))`;
    expr = `if(lt(t,${p1.t.toFixed(2)}),${segExpr},${expr})`;
  }

  return `(${maxOffsetExpr})*(${expr})`;
}
