import type {
  CaptionWord,
  ComputeMode,
  WhisperBackend,
  WhisperStage,
} from '../types/editor';

export const WHISPER_GPU_FAILURE_STORAGE_KEY = 'cliplab_whisper_gpu_failed_v1';
export const WHISPER_COMPUTE_MODE_STORAGE_KEY = 'cliplab_whisper_compute_mode_v1';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;
type StorageRemover = Pick<Storage, 'removeItem'>;

function extractErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '');
  }
  return String(err ?? '');
}

export function getRememberedGpuFailure(storage?: StorageReader | null): boolean {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return false;
    return Boolean(store.getItem(WHISPER_GPU_FAILURE_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function rememberGpuFailure(reason: string, storage?: StorageWriter | null): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    store.setItem(
      WHISPER_GPU_FAILURE_STORAGE_KEY,
      JSON.stringify({ failedAt: Date.now(), reason: reason.slice(0, 240) })
    );
  } catch {
    // Ignore storage errors (private mode, SSR, blocked cookies/storage)
  }
}

export function clearRememberedGpuFailure(storage?: StorageRemover | null): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    store.removeItem(WHISPER_GPU_FAILURE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getSavedComputeMode(storage?: StorageReader | null): ComputeMode {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return 'cpu';
    const raw = store.getItem(WHISPER_COMPUTE_MODE_STORAGE_KEY);
    if (raw === 'gpu' || raw === 'cpu') {
      return raw;
    }
    return 'cpu';
  } catch {
    return 'cpu';
  }
}

export function saveComputeMode(mode: ComputeMode, storage?: StorageWriter | null): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    store.setItem(WHISPER_COMPUTE_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function resolveWhisperModelId(params: {
  defaultModelId: string;
  englishModelId: string;
  language: string;
  useEnglishOnlyModel: boolean;
}): string {
  if (params.language === 'en' && params.useEnglishOnlyModel && params.englishModelId) {
    return params.englishModelId;
  }
  return params.defaultModelId;
}

export function resolveInitialExecutionPlan(params: {
  computeMode: ComputeMode;
  webGpuAvailable: boolean;
  rememberedGpuFailure: boolean;
}): {
  backend: WhisperBackend;
  dtype: 'fp32' | 'q8';
  skippedGpuDueToHistory: boolean;
  gpuUnsupported: boolean;
} {
  const { computeMode, webGpuAvailable, rememberedGpuFailure } = params;

  if (computeMode === 'cpu') {
    return {
      backend: 'wasm',
      dtype: 'q8',
      skippedGpuDueToHistory: false,
      gpuUnsupported: false,
    };
  }

  if (computeMode === 'gpu') {
    if (webGpuAvailable) {
      return {
        backend: 'webgpu',
        dtype: 'fp32',
        skippedGpuDueToHistory: false,
        gpuUnsupported: false,
      };
    }
    return {
      backend: 'wasm',
      dtype: 'q8',
      skippedGpuDueToHistory: false,
      gpuUnsupported: true,
    };
  }

  // computeMode === 'auto'
  if (rememberedGpuFailure) {
    return {
      backend: 'wasm',
      dtype: 'q8',
      skippedGpuDueToHistory: true,
      gpuUnsupported: false,
    };
  }

  if (webGpuAvailable) {
    return {
      backend: 'webgpu',
      dtype: 'fp32',
      skippedGpuDueToHistory: false,
      gpuUnsupported: false,
    };
  }

  return {
    backend: 'wasm',
    dtype: 'q8',
    skippedGpuDueToHistory: false,
    gpuUnsupported: true,
  };
}

export function isGpuOrRuntimeError(err: unknown): boolean {
  const lower = extractErrorText(err).toLowerCase();
  return (
    lower.includes('webgpu') ||
    lower.includes('dxgi_error_device_removed') ||
    lower.includes('0x887a0005') ||
    lower.includes('d3d12') ||
    lower.includes('compute pipeline') ||
    lower.includes('pipeline state') ||
    lower.includes('device lost') ||
    lower.includes('device-lost') ||
    lower.includes('gpudevice') ||
    lower.includes('gpu adapter') ||
    lower.includes('createsession') ||
    lower.includes('onnxruntime') ||
    lower.includes('ort')
  );
}

export function isTimestampAttentionsError(err: unknown): boolean {
  const lower = extractErrorText(err).toLowerCase();
  return (
    lower.includes('cross attentions') ||
    lower.includes('cross_attentions') ||
    lower.includes('output_attentions') ||
    lower.includes('alignment_heads') ||
    lower.includes('token_timestamps') ||
    lower.includes('return_timestamps')
  );
}

export function isOutOfMemoryError(err: unknown): boolean {
  const lower = extractErrorText(err).toLowerCase();
  return (
    lower.includes('out of memory') ||
    lower.includes('oom') ||
    lower.includes('bad_alloc') ||
    lower.includes('bad allocation') ||
    lower.includes('allocation failed') ||
    lower.includes('not enough memory')
  );
}

export function isNetworkDownloadError(err: unknown): boolean {
  const lower = extractErrorText(err).toLowerCase();
  // Never misclassify WebGPU, ONNX, or model-output errors as network download errors
  if (isGpuOrRuntimeError(err) || isTimestampAttentionsError(err) || isOutOfMemoryError(err)) {
    return false;
  }
  return (
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('err_network') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('err_name_not_resolved') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('http error') ||
    lower.includes('404 not found') ||
    lower.includes('status 404') ||
    lower.includes('status 403') ||
    lower.includes('status 500') ||
    lower.includes('status 502') ||
    lower.includes('status 503') ||
    lower.includes('could not locate file') ||
    lower.includes('manifest check failed')
  );
}

export function shouldFallbackToCpu(params: {
  stage: WhisperStage;
  error: unknown;
  currentBackend: WhisperBackend;
  hasRetriedCpu: boolean;
}): boolean {
  const { stage, error, currentBackend, hasRetriedCpu } = params;
  if (currentBackend !== 'webgpu' || hasRetriedCpu) {
    return false;
  }
  // If WebGPU failed because the user is offline during download, CPU won't fix an offline network
  if (stage === 'download' && isNetworkDownloadError(error)) {
    return false;
  }
  // Any WebGPU init or inference failure (device lost, pipeline failure, OOM, etc.) retries on CPU
  return true;
}

export function shouldFallbackToSegmentTimestamps(params: {
  error: unknown;
  currentBackend: WhisperBackend;
  alreadySegmentMode: boolean;
}): boolean {
  const { error, currentBackend, alreadySegmentMode } = params;
  if (alreadySegmentMode) return false;
  if (isTimestampAttentionsError(error)) {
    return true;
  }
  // Never mask a GPU/OOM/network failure on WebGPU as a timestamp error; let GPU->CPU retry run first
  if (
    currentBackend === 'webgpu' &&
    (isGpuOrRuntimeError(error) || isOutOfMemoryError(error) || isNetworkDownloadError(error))
  ) {
    return false;
  }
  if (isOutOfMemoryError(error) || isNetworkDownloadError(error)) {
    return false;
  }
  // On WASM CPU (or non-GPU inference), fall back cleanly from 'word' to segment timestamps if 'word' fails
  return currentBackend === 'wasm';
}

export function classifyWhisperError(params: {
  stage: WhisperStage;
  error: unknown;
  backend: WhisperBackend;
  modelId: string;
  modelBaseUrl: string;
}): string {
  const { stage, error, backend, modelId, modelBaseUrl } = params;
  const rawMsg = extractErrorText(error) || 'Speech processing failed.';
  const backendLabel = backend === 'webgpu' ? 'WebGPU' : 'CPU (WASM)';

  if (stage === 'download' && isNetworkDownloadError(error)) {
    return `Speech model download failed for ${modelId} from ${modelBaseUrl} (${rawMsg}). Check your connection or import an .srt subtitle file instead.`;
  }

  if (isNetworkDownloadError(error)) {
    return `Could not fetch speech model files for ${modelId} from ${modelBaseUrl} (${rawMsg}). Check your connection or import an .srt subtitle file instead.`;
  }

  if (isOutOfMemoryError(error)) {
    return `Out of memory while ${stage === 'init' ? 'loading' : 'running'} speech model (${modelId}) on ${backendLabel}. Try a shorter clip or CPU mode.`;
  }

  if (stage === 'init') {
    return `Speech model failed to initialize on ${backendLabel} (${rawMsg}).`;
  }

  if (stage === 'transcribe') {
    return `Speech transcription failed on ${backendLabel} (${rawMsg}).`;
  }

  return `Could not load speech model ${modelId} (${rawMsg}).`;
}

export interface SegmentTimingInput {
  text: string;
  start: number;
  end: number;
}

export function distributeSegmentWordsProportionally(
  segments: SegmentTimingInput[],
  chunkOffsetSec: number,
  fallbackDurationSec = 1.5
): CaptionWord[] {
  const allWords: CaptionWord[] = [];

  for (const seg of segments) {
    const tokens = (seg.text || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const rawStart = Math.max(0, Number.isFinite(seg.start) ? seg.start : 0);
    const minSpan = Math.max(0.18, tokens.length * 0.08);
    const rawEnd =
      Number.isFinite(seg.end) && seg.end > rawStart
        ? seg.end
        : rawStart + Math.max(minSpan, fallbackDurationSec);
    const segSpan = Math.max(minSpan, rawEnd - rawStart);

    const weights = tokens.map((tok) => {
      const cleanLen = tok.replace(/[^\p{L}\p{N}]/gu, '').length;
      return Math.max(1, cleanLen || tok.length);
    });
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);

    let cursor = rawStart;
    tokens.forEach((tok, idx) => {
      const share = (weights[idx] / Math.max(1, totalWeight)) * segSpan;
      const wStart = idx === 0 ? rawStart : cursor;
      const wEnd = idx === tokens.length - 1 ? rawStart + segSpan : Math.min(rawStart + segSpan, wStart + share);
      cursor = wEnd;

      allWords.push({
        text: tok,
        start: Number((chunkOffsetSec + wStart).toFixed(2)),
        end: Number((chunkOffsetSec + Math.max(wStart + 0.04, wEnd)).toFixed(2)),
      });
    });
  }

  return allWords;
}
