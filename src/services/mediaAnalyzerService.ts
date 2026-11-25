import { APP_CONFIG } from '../config/appConfig';
import type { CaptionLine, SmartAnalysisResult, SmartMomentCandidate } from '../types/editor';
import type { AnalysisWorkerResponse } from '../workers/analysisWorker';
import { ffmpegService } from './ffmpegService';

export interface AnalyzeMediaOptions {
  file: File;
  totalDuration: number;
  range: { start: number; end: number };
  ignoreHudEdges: boolean;
  targetClipSec: number;
  preferFaceDetection?: boolean;
  captionLines?: CaptionLine[];
  boostKeywords?: string[];
  signal: AbortSignal;
  onProgress: (percent: number, message: string) => void;
}

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface BrowserFaceDetector {
  detect(image: HTMLCanvasElement): Promise<DetectedFace[]>;
}

function createFaceDetectorIfSupported(): BrowserFaceDetector | null {
  try {
    const win = window as unknown as {
      FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector;
    };
    if (typeof win.FaceDetector === 'function') {
      return new win.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
    }
  } catch {
    // Experimental API unavailable
  }
  return null;
}

async function seekVideo(video: HTMLVideoElement, time: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error('Analysis cancelled.');
  return new Promise((resolve, reject) => {
    const target = Math.max(0, Math.min(video.duration || time, time));
    if (Math.abs(video.currentTime - target) < 0.02 && video.readyState >= 2) {
      resolve();
      return;
    }

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Browser video seek failed during frame sampling.'));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('Analysis cancelled.'));
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    video.currentTime = target;
  });
}

function rgbaToLuma(rgba: Uint8ClampedArray, pixelCount: number): Uint8Array {
  const luma = new Uint8Array(pixelCount);
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    luma[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }
  return luma;
}

export async function analyzeMediaOnDevice(
  options: AnalyzeMediaOptions
): Promise<SmartAnalysisResult> {
  const {
    file,
    totalDuration,
    range,
    ignoreHudEdges,
    targetClipSec,
    preferFaceDetection = false,
    captionLines,
    boostKeywords,
    signal,
    onProgress,
  } = options;

  const startSec = Math.max(0, Math.min(range.start, totalDuration));
  const endSec = Math.max(startSec + 0.5, Math.min(range.end, totalDuration));
  const spanSec = endSec - startSec;

  const throwIfAborted = () => {
    if (signal.aborted) {
      ffmpegService.cancel();
      throw new Error('Analysis cancelled.');
    }
  };

  throwIfAborted();

  // 1. Extract low-rate mono audio via ffmpeg.wasm (8 kHz)
  onProgress(6, 'Extracting 8 kHz mono audio locally...');
  let pcm: Float32Array | null = null;
  try {
    pcm = await ffmpegService.extractMonoAudioPcm({
      file,
      startTime: startSec,
      endTime: endSec,
      sampleRate: APP_CONFIG.smartFeatures.audioAnalysisSampleRate,
      onStatus: (msg) => onProgress(10, msg),
    });
  } catch (err) {
    throwIfAborted();
    // If extraction fails unexpectedly, continue with motion-only analysis
    console.warn('Audio extraction fallback to motion-only:', err);
    pcm = null;
  }

  throwIfAborted();

  // 2. Sample low-resolution frames using an offscreen <video> + <canvas>
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  const sampleCanvas = document.createElement('canvas');
  const thumbCanvas = document.createElement('canvas');
  let worker: Worker | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error('Could not decode video for frame sampling.'));
      };
      const onAbort = () => {
        cleanup();
        reject(new Error('Analysis cancelled.'));
      };
      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onErr);
        signal.removeEventListener('abort', onAbort);
      };
      video.addEventListener('loadeddata', onLoaded, { once: true });
      video.addEventListener('error', onErr, { once: true });
      signal.addEventListener('abort', onAbort, { once: true });
      video.load();
    });

    throwIfAborted();

    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 180;
    const sampleW = APP_CONFIG.smartFeatures.analysisSampleWidth;
    const sampleH = Math.max(2, Math.round((sampleW * vh) / Math.max(1, vw)));
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) throw new Error('Canvas 2D context unavailable.');

    const fps = APP_CONFIG.smartFeatures.analysisFps;
    // Cap max frames around 420 on very long ranges so loop finishes smoothly
    const maxFrames = 420;
    const stepSec = Math.max(1 / fps, spanSec / maxFrames);
    const sampleTimes: number[] = [];
    for (let t = startSec; t <= endSec; t += stepSec) {
      sampleTimes.push(Number(t.toFixed(3)));
    }
    if (sampleTimes.length === 0) {
      sampleTimes.push(startSec);
    }

    const faceDetector = preferFaceDetection ? createFaceDetectorIfSupported() : null;
    let faceDetectionUsed = false;
    const faceCenters: { time: number; focusX: number; focusY: number }[] = [];
    const frames: { time: number; luma: Uint8Array }[] = [];

    for (let i = 0; i < sampleTimes.length; i++) {
      throwIfAborted();
      const t = sampleTimes[i];
      await seekVideo(video, t, signal);
      sampleCtx.drawImage(video, 0, 0, sampleW, sampleH);
      const imgData = sampleCtx.getImageData(0, 0, sampleW, sampleH);
      frames.push({
        time: t,
        luma: rgbaToLuma(imgData.data, sampleW * sampleH),
      });

      if (faceDetector && i % 2 === 0) {
        try {
          const faces = await faceDetector.detect(sampleCanvas);
          if (faces.length > 0) {
            faceDetectionUsed = true;
            const b = faces[0].boundingBox;
            faceCenters.push({
              time: t,
              focusX: Math.min(0.95, Math.max(0.05, (b.x + b.width / 2) / sampleW)),
              focusY: Math.min(0.95, Math.max(0.05, (b.y + b.height / 2) / sampleH)),
            });
          }
        } catch {
          // FaceDetector threw on frame; ignore gracefully
        }
      }

      if (i % 5 === 0 || i === sampleTimes.length - 1) {
        const pct = Math.min(58, Math.round(16 + (i / Math.max(1, sampleTimes.length)) * 42));
        onProgress(pct, `Sampling low-res frames (${i + 1}/${sampleTimes.length})...`);
      }
    }

    throwIfAborted();

    // 3. Run scoring & smart crop path inside Web Worker
    onProgress(62, 'Analyzing loudness spikes and motion inside Worker...');
    const workerResult = await new Promise<
      Extract<AnalysisWorkerResponse, { type: 'result' }>
    >((resolve, reject) => {
      worker = new Worker(new URL('../workers/analysisWorker.ts', import.meta.url), {
        type: 'module',
      });
      const reqId = `job-${Date.now()}`;

      const onAbort = () => {
        worker?.terminate();
        worker = null;
        reject(new Error('Analysis cancelled.'));
      };
      signal.addEventListener('abort', onAbort, { once: true });

      worker.onmessage = (ev: MessageEvent<AnalysisWorkerResponse>) => {
        const msg = ev.data;
        if (!msg || msg.id !== reqId) return;
        if (msg.type === 'progress') {
          const scaled = Math.min(88, Math.round(62 + (msg.percent / 100) * 26));
          onProgress(scaled, msg.message);
        } else if (msg.type === 'result') {
          signal.removeEventListener('abort', onAbort);
          worker?.terminate();
          worker = null;
          resolve(msg);
        } else if (msg.type === 'error') {
          signal.removeEventListener('abort', onAbort);
          worker?.terminate();
          worker = null;
          reject(new Error(msg.error));
        }
      };

      worker.onerror = (err) => {
        signal.removeEventListener('abort', onAbort);
        worker?.terminate();
        worker = null;
        reject(new Error(err.message || 'Analysis worker error.'));
      };

      const pcmCopy = pcm ? pcm.slice().buffer : null;
      const transfer: Transferable[] = pcmCopy ? [pcmCopy] : [];

      worker.postMessage(
        {
          id: reqId,
          type: 'analyze',
          pcmBuffer: pcmCopy,
          sampleRate: APP_CONFIG.smartFeatures.audioAnalysisSampleRate,
          startOffsetSec: startSec,
          frames,
          width: sampleW,
          height: sampleH,
          ignoreHudEdges,
          totalDuration,
          targetClipSec,
          maxCandidateMoments: APP_CONFIG.smartFeatures.maxCandidateMoments,
          minMomentGapSec: APP_CONFIG.smartFeatures.minMomentGapSec,
          cropKeyframeIntervalSec: APP_CONFIG.smartFeatures.cropKeyframeIntervalSec,
          captionLines: captionLines?.map((c) => ({
            startTime: c.startTime,
            endTime: c.endTime,
            text: c.text,
          })),
          boostKeywords: boostKeywords ?? [...APP_CONFIG.smartFeatures.defaultBoostKeywords],
          faceCenters: faceCenters.length > 0 ? faceCenters : undefined,
        },
        transfer
      );
    });

    throwIfAborted();

    // 4. Capture small candidate thumbnails for suggested moments
    thumbCanvas.width = 240;
    thumbCanvas.height = Math.max(2, Math.round((240 * vh) / Math.max(1, vw)));
    const thumbCtx = thumbCanvas.getContext('2d');

    const momentsWithThumbs: SmartMomentCandidate[] = [];
    for (let i = 0; i < workerResult.moments.length; i++) {
      throwIfAborted();
      const m = workerResult.moments[i];
      let thumbnailDataUrl = '';
      if (thumbCtx) {
        try {
          await seekVideo(video, m.peakTime, signal);
          thumbCtx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);
          thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
        } catch {
          thumbnailDataUrl = '';
        }
      }
      momentsWithThumbs.push({ ...m, thumbnailDataUrl });
      onProgress(
        Math.min(99, 89 + Math.round(((i + 1) / Math.max(1, workerResult.moments.length)) * 10)),
        'Capturing moment previews...'
      );
    }

    onProgress(100, 'Analysis complete.');
    return {
      samples: workerResult.samples,
      cropPath: workerResult.cropPath,
      moments: momentsWithThumbs,
      peakTimes: workerResult.peakTimes,
      hasAudio: workerResult.hasAudio,
      hasStrongMoments: workerResult.hasStrongMoments,
      faceDetectionUsed,
      analyzedRange: { start: startSec, end: endSec },
    };
  } finally {
    if (worker) {
      (worker as Worker).terminate();
    }
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
