import { APP_CONFIG } from '../config/appConfig';
import type {
  CaptionWord,
  ComputeMode,
  WhisperBackend,
  WhisperStage,
} from '../types/editor';
import {
  getRememberedGpuFailure,
  rememberGpuFailure,
  resolveInitialExecutionPlan,
  resolveWhisperModelId,
  shouldFallbackToCpu,
} from '../utils/whisperFallback';
import type { WhisperWorkerResponse } from '../workers/whisperWorker';
import { ffmpegService } from './ffmpegService';

export interface TranscribeVideoResult {
  words: CaptionWord[];
  hasAudio: boolean;
  backend: WhisperBackend;
  modelId: string;
  approximateWordTiming: boolean;
  switchedFromGpu: boolean;
  skippedGpuDueToHistory: boolean;
}

interface WorkerAttemptFailure {
  message: string;
  rawError: string;
  stage: WhisperStage;
  backend: WhisperBackend;
  weightsCached: boolean;
}

class WhisperService {
  private worker: Worker | null = null;
  private modelReady = false;
  private cancelled = false;

  isModelReady(): boolean {
    return this.modelReady;
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  cancel(): void {
    this.cancelled = true;
    ffmpegService.cancel();
    this.terminateWorker();
  }

  async detectWebGpuSupport(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined') return false;
      const nav = navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } };
      if (!nav.gpu) return false;
      const adapter = await nav.gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  }

  private runWorkerAttempt(params: {
    pcm: Float32Array;
    startTime: number;
    language: string;
    modelId: string;
    backend: WhisperBackend;
    dtype: 'fp32' | 'q8';
    onProgress: (percent: number, message: string) => void;
  }): Promise<{ words: CaptionWord[]; backend: WhisperBackend; modelId: string; approximateWordTiming: boolean }> {
    const { pcm, startTime, language, modelId, backend, dtype, onProgress } = params;

    return new Promise((resolve, reject) => {
      this.terminateWorker();
      const worker = new Worker(new URL('../workers/whisperWorker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker = worker;
      const reqId = `asr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      worker.onmessage = (ev: MessageEvent<WhisperWorkerResponse>) => {
        const msg = ev.data;
        if (!msg || msg.id !== reqId) return;
        if (this.cancelled) return;

        if (msg.type === 'progress') {
          const scaled = Math.min(98, Math.max(12, msg.percent));
          onProgress(scaled, msg.message);
        } else if (msg.type === 'result') {
          this.modelReady = true;
          resolve({
            words: msg.words,
            backend: msg.backend,
            modelId: msg.modelId,
            approximateWordTiming: msg.approximateWordTiming,
          });
        } else if (msg.type === 'error') {
          reject({
            message: msg.error,
            rawError: msg.rawError,
            stage: msg.stage,
            backend: msg.backend,
            weightsCached: msg.weightsCached,
          } satisfies WorkerAttemptFailure);
        }
      };

      worker.onerror = (err) => {
        reject({
          message: err.message || 'Speech worker encountered an unexpected error.',
          rawError: err.message || 'Speech worker error',
          stage: 'init',
          backend,
          weightsCached: false,
        } satisfies WorkerAttemptFailure);
      };

      const pcmCopy = pcm.slice().buffer;
      worker.postMessage(
        {
          id: reqId,
          type: 'transcribe',
          pcmBuffer: pcmCopy,
          sampleRate: APP_CONFIG.captions.whisperSampleRate,
          startOffsetSec: startTime,
          modelId,
          modelBaseUrl: APP_CONFIG.captions.MODEL_BASE_URL,
          language,
          backend,
          dtype,
        },
        [pcmCopy]
      );
    });
  }

  async transcribeVideoRange(params: {
    file: File;
    startTime: number;
    endTime: number;
    language: string;
    computeMode?: ComputeMode;
    useEnglishOnlyModel?: boolean;
    onProgress: (percent: number, message: string) => void;
  }): Promise<TranscribeVideoResult> {
    this.cancelled = false;
    const {
      file,
      startTime,
      endTime,
      language,
      computeMode = 'cpu',
      useEnglishOnlyModel = false,
      onProgress,
    } = params;

    const modelId = resolveWhisperModelId({
      defaultModelId: APP_CONFIG.captions.MODEL_ID,
      englishModelId: APP_CONFIG.captions.ENGLISH_MODEL_ID,
      language,
      useEnglishOnlyModel,
    });

    onProgress(5, 'Extracting 16 kHz mono audio locally...');
    const pcm = await ffmpegService.extractMonoAudioPcm({
      file,
      startTime,
      endTime,
      sampleRate: APP_CONFIG.captions.whisperSampleRate,
      onStatus: (msg) => onProgress(8, msg),
    });

    if (this.cancelled) {
      throw new Error('Caption generation cancelled.');
    }

    if (!pcm || pcm.length === 0) {
      return {
        words: [],
        hasAudio: false,
        backend: 'wasm',
        modelId,
        approximateWordTiming: false,
        switchedFromGpu: false,
        skippedGpuDueToHistory: false,
      };
    }

    // Check if audio is completely silent before downloading/running model
    let maxAmp = 0;
    for (let i = 0; i < pcm.length; i += 4) {
      const v = Math.abs(pcm[i]);
      if (v > maxAmp) maxAmp = v;
    }
    if (maxAmp < 0.002) {
      return {
        words: [],
        hasAudio: true,
        backend: 'wasm',
        modelId,
        approximateWordTiming: false,
        switchedFromGpu: false,
        skippedGpuDueToHistory: false,
      };
    }

    const webGpuAvailable = await this.detectWebGpuSupport();
    const rememberedGpuFailure = getRememberedGpuFailure();
    const plan = resolveInitialExecutionPlan({
      computeMode,
      webGpuAvailable,
      rememberedGpuFailure,
    });

    let lastPct = 10;
    const trackProgress = (pct: number, message: string) => {
      lastPct = pct;
      onProgress(pct, message);
    };

    if (plan.skippedGpuDueToHistory) {
      trackProgress(10, 'Previous GPU failure remembered — using CPU mode (slower)...');
    } else if (plan.gpuUnsupported && computeMode === 'gpu') {
      trackProgress(10, 'WebGPU unsupported in this browser — using CPU mode (slower)...');
    }

    try {
      const res = await this.runWorkerAttempt({
        pcm,
        startTime,
        language,
        modelId,
        backend: plan.backend,
        dtype: plan.dtype,
        onProgress: trackProgress,
      });
      return {
        ...res,
        hasAudio: true,
        switchedFromGpu: false,
        skippedGpuDueToHistory: plan.skippedGpuDueToHistory,
      };
    } catch (firstErr) {
      if (this.cancelled) {
        throw new Error('Caption generation cancelled.');
      }

      const failure = firstErr as WorkerAttemptFailure;
      const canFallback = shouldFallbackToCpu({
        stage: failure.stage ?? 'init',
        error: failure.rawError ?? failure.message,
        currentBackend: failure.backend ?? plan.backend,
        hasRetriedCpu: false,
      });

      if (!canFallback) {
        throw new Error(failure.message || 'Caption generation failed.');
      }

      // Persist GPU failure so subsequent runs go straight to CPU
      rememberGpuFailure(failure.rawError || failure.message);
      // Terminate failed WebGPU worker cleanly and launch a fresh CPU WASM worker
      this.terminateWorker();
      trackProgress(Math.max(15, lastPct), 'GPU unavailable, switching to CPU (slower)...');

      // Reuse already-cached fp32 files if weights finished downloading before GPU failed, avoiding a second download
      const fallbackDtype: 'fp32' | 'q8' = failure.weightsCached ? plan.dtype : 'q8';

      try {
        const retryRes = await this.runWorkerAttempt({
          pcm,
          startTime,
          language,
          modelId,
          backend: 'wasm',
          dtype: fallbackDtype,
          onProgress: trackProgress,
        });
        return {
          ...retryRes,
          hasAudio: true,
          switchedFromGpu: true,
          skippedGpuDueToHistory: false,
        };
      } catch (retryErr) {
        if (this.cancelled) {
          throw new Error('Caption generation cancelled.');
        }
        const retryFailure = retryErr as WorkerAttemptFailure;
        throw new Error(retryFailure.message || 'CPU caption fallback failed.');
      }
    }
  }
}

export const whisperService = new WhisperService();
