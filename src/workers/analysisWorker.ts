import type { ActivitySample, CaptionLine, CropKeyframe, SmartMomentCandidate } from '../types/editor';
import {
  combineActivityTimeline,
  computeFrameDiffAndScene,
  computeRmsWindows,
  computeSmartCropPath,
  pickTopMoments,
  type MotionWindow,
} from '../utils/smartAnalysis';

export interface AnalysisWorkerRequest {
  id: string;
  type: 'analyze';
  pcmBuffer: ArrayBuffer | null;
  sampleRate: number;
  startOffsetSec: number;
  frames: { time: number; luma: Uint8Array }[];
  width: number;
  height: number;
  ignoreHudEdges: boolean;
  totalDuration: number;
  targetClipSec: number;
  maxCandidateMoments: number;
  minMomentGapSec: number;
  cropKeyframeIntervalSec: number;
  captionLines?: (Pick<CaptionLine, 'startTime' | 'endTime'> & { text?: string })[];
  boostKeywords?: string[];
  faceCenters?: { time: number; focusX: number; focusY: number }[];
}

export type AnalysisWorkerResponse =
  | { id: string; type: 'progress'; percent: number; message: string }
  | {
      id: string;
      type: 'result';
      samples: ActivitySample[];
      cropPath: CropKeyframe[];
      moments: Omit<SmartMomentCandidate, 'thumbnailDataUrl'>[];
      peakTimes: number[];
      hasAudio: boolean;
      hasStrongMoments: boolean;
    }
  | { id: string; type: 'error'; error: string };

self.onmessage = (ev: MessageEvent<AnalysisWorkerRequest>) => {
  const req = ev.data;
  if (!req || req.type !== 'analyze') return;

  try {
    self.postMessage({
      id: req.id,
      type: 'progress',
      percent: 10,
      message: 'Computing audio energy spikes...',
    } satisfies AnalysisWorkerResponse);

    const pcm = req.pcmBuffer ? new Float32Array(req.pcmBuffer) : null;
    const rawAudioWindows =
      pcm && pcm.length > 0 ? computeRmsWindows(pcm, req.sampleRate, 0.5) : [];
    const audioWindows = rawAudioWindows.map((w) => ({
      ...w,
      time: Number((w.time + req.startOffsetSec).toFixed(3)),
    }));

    const motionWindows: MotionWindow[] = [];
    let prevLuma: Uint8Array | null = null;
    const totalFrames = req.frames.length;

    for (let i = 0; i < totalFrames; i++) {
      const frame = req.frames[i];
      const diff = computeFrameDiffAndScene(
        prevLuma,
        frame.luma,
        req.width,
        req.height,
        req.ignoreHudEdges
      );
      prevLuma = frame.luma;

      let focusX = diff.focusX;
      let focusY = diff.focusY;
      if (req.faceCenters && req.faceCenters.length > 0) {
        const nearestFace = req.faceCenters.find((f) => Math.abs(f.time - frame.time) <= 0.6);
        if (nearestFace) {
          focusX = nearestFace.focusX;
          focusY = nearestFace.focusY;
        }
      }

      motionWindows.push({
        time: frame.time,
        motion: diff.motion,
        sceneChange: diff.sceneChange,
        focusX,
        focusY,
      });

      if (i % 15 === 0 || i === totalFrames - 1) {
        const pct = Math.min(85, Math.round(15 + (i / Math.max(1, totalFrames)) * 70));
        self.postMessage({
          id: req.id,
          type: 'progress',
          percent: pct,
          message: `Scoring motion & scene shifts (${i + 1}/${totalFrames} frames)...`,
        } satisfies AnalysisWorkerResponse);
      }
    }

    const keywords = req.boostKeywords ?? [];
    const combined = combineActivityTimeline(audioWindows, motionWindows, req.captionLines, keywords);
    const moments = combined.hasStrongMoments
      ? pickTopMoments(combined.samples, req.totalDuration, {
          maxCount: req.maxCandidateMoments,
          targetClipSec: req.targetClipSec,
          minGapSec: req.minMomentGapSec,
          hasAudio: combined.hasAudio,
          captionLines: req.captionLines,
          keywords,
        })
      : [];

    const cropPath = computeSmartCropPath(combined.samples, req.cropKeyframeIntervalSec);
    const peakTimes = combined.samples
      .filter((s) => s.score >= 0.68)
      .map((s) => s.time);

    self.postMessage({
      id: req.id,
      type: 'result',
      samples: combined.samples,
      cropPath,
      moments,
      peakTimes,
      hasAudio: combined.hasAudio,
      hasStrongMoments: combined.hasStrongMoments,
    } satisfies AnalysisWorkerResponse);
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: 'error',
      error: err instanceof Error ? err.message : 'Smart analysis worker failed.',
    } satisfies AnalysisWorkerResponse);
  }
};
