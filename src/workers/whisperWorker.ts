import type { CaptionWord, WhisperBackend, WhisperStage } from '../types/editor';
import {
  classifyWhisperError,
  distributeSegmentWordsProportionally,
  shouldFallbackToSegmentTimestamps,
} from '../utils/whisperFallback';

export interface WhisperWorkerRequest {
  id: string;
  type: 'transcribe';
  pcmBuffer: ArrayBuffer;
  sampleRate: number;
  startOffsetSec: number;
  modelId: string;
  modelBaseUrl: string;
  language: string;
  backend: WhisperBackend;
  dtype: 'fp32' | 'q8';
}

export type WhisperWorkerResponse =
  | {
      id: string;
      type: 'progress';
      percent: number;
      message: string;
      phase: WhisperStage;
    }
  | {
      id: string;
      type: 'result';
      words: CaptionWord[];
      backend: WhisperBackend;
      modelId: string;
      approximateWordTiming: boolean;
    }
  | {
      id: string;
      type: 'error';
      error: string;
      rawError: string;
      stage: WhisperStage;
      backend: WhisperBackend;
      weightsCached: boolean;
    };

type PipelineOutput = {
  text?: string;
  chunks?: { text?: string; timestamp?: [number | null, number | null] }[];
};

type PipelineFn = ((
  audio: Float32Array,
  options?: Record<string, unknown>
) => Promise<PipelineOutput>) & {
  dispose?: () => Promise<void>;
};

let cachedKey = '';
let cachedPipeline: PipelineFn | null = null;

async function disposeCachedPipeline(): Promise<void> {
  if (!cachedPipeline) return;
  try {
    await cachedPipeline.dispose?.();
  } catch {
    // Ignore disposal errors if WebGPU device was already lost
  } finally {
    cachedPipeline = null;
    cachedKey = '';
  }
}

self.onmessage = async (ev: MessageEvent<WhisperWorkerRequest>) => {
  const req = ev.data;
  if (!req || req.type !== 'transcribe') return;

  const backend = req.backend;
  const dtype = req.dtype;
  const backendLabel = backend === 'webgpu' ? 'WebGPU' : 'CPU (WASM)';
  let stage: WhisperStage = 'download';
  let weightsCached = false;

  try {
    const cacheKey = `${req.modelId}::${backend}::${dtype}`;

    if (!cachedPipeline || cachedKey !== cacheKey) {
      await disposeCachedPipeline();

      self.postMessage({
        id: req.id,
        type: 'progress',
        phase: 'download',
        percent: 4,
        message: `Checking speech model cache (${req.modelId})...`,
      } satisfies WhisperWorkerResponse);

      const transformers = await import('@huggingface/transformers');
      const { env, pipeline } = transformers;

      env.allowLocalModels = false;
      if (req.modelBaseUrl) {
        env.remoteHost = req.modelBaseUrl.endsWith('/')
          ? req.modelBaseUrl
          : `${req.modelBaseUrl}/`;
      }
      if (env.backends?.onnx?.wasm) {
        // Keep single-threaded WASM so no COOP/COEP headers are required
        env.backends.onnx.wasm.numThreads = 1;
      }

      const onnxInitiated = new Set<string>();
      const onnxDone = new Set<string>();

      const pipe = (await pipeline('automatic-speech-recognition', req.modelId, {
        device: backend,
        dtype,
        progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
          const fileName = info.file || '';
          const shortName = fileName.split('/').pop() || 'model file';

          if (info.status === 'initiate' && fileName.endsWith('.onnx')) {
            onnxInitiated.add(fileName);
            self.postMessage({
              id: req.id,
              type: 'progress',
              phase: 'download',
              percent: 6,
              message: `Checking/downloading ${shortName}...`,
            } satisfies WhisperWorkerResponse);
          } else if (info.status === 'progress' && typeof info.progress === 'number') {
            stage = 'download';
            const pct = Math.min(58, Math.max(6, Math.round(info.progress * 0.58)));
            self.postMessage({
              id: req.id,
              type: 'progress',
              phase: 'download',
              percent: pct,
              message: `Downloading speech model (${Math.round(info.progress)}%)...`,
            } satisfies WhisperWorkerResponse);
          } else if (info.status === 'done' && fileName.endsWith('.onnx')) {
            onnxDone.add(fileName);
            if (onnxDone.size >= 2 || (onnxInitiated.size > 0 && onnxDone.size >= onnxInitiated.size)) {
              weightsCached = true;
              stage = 'init';
              self.postMessage({
                id: req.id,
                type: 'progress',
                phase: 'init',
                percent: 60,
                message: `Initializing speech model on ${backendLabel}...`,
              } satisfies WhisperWorkerResponse);
            }
          } else if (info.status === 'ready') {
            weightsCached = true;
            stage = 'init';
            self.postMessage({
              id: req.id,
              type: 'progress',
              phase: 'init',
              percent: 62,
              message: `Speech model ready on ${backendLabel}. Starting transcription...`,
            } satisfies WhisperWorkerResponse);
          }
        },
      })) as unknown as PipelineFn;

      weightsCached = true;
      cachedPipeline = pipe;
      cachedKey = cacheKey;
    } else {
      weightsCached = true;
      stage = 'init';
      self.postMessage({
        id: req.id,
        type: 'progress',
        phase: 'init',
        percent: 60,
        message: `Using loaded speech model on ${backendLabel}...`,
      } satisfies WhisperWorkerResponse);
    }

    const pipe = cachedPipeline;
    if (!pipe) {
      throw new Error('Speech pipeline did not initialize.');
    }

    stage = 'transcribe';
    const pcm = new Float32Array(req.pcmBuffer);
    const totalSec = pcm.length / Math.max(1, req.sampleRate);
    // Use shorter chunks on CPU WASM so progress updates smoothly and Cancel stays responsive
    const chunkSec = backend === 'wasm' ? 15 : 30;
    const strideSec = backend === 'wasm' ? 3 : 5;
    const chunkSamples = chunkSec * req.sampleRate;
    const totalChunks = Math.max(1, Math.ceil(pcm.length / chunkSamples));

    const allWords: CaptionWord[] = [];
    let forceSegmentMode = false;
    let approximateWordTiming = false;

    for (let c = 0; c < totalChunks; c++) {
      const startSample = c * chunkSamples;
      const endSample = Math.min(pcm.length, startSample + chunkSamples);
      const slice = pcm.subarray(startSample, endSample);
      if (slice.length < req.sampleRate * 0.15) continue;

      const chunkOffsetSec = req.startOffsetSec + startSample / req.sampleRate;
      const sliceDurationSec = slice.length / req.sampleRate;
      const pct = Math.min(95, Math.round(64 + (c / totalChunks) * 31));

      self.postMessage({
        id: req.id,
        type: 'progress',
        phase: 'transcribe',
        percent: pct,
        message:
          backend === 'wasm'
            ? `Transcribing on CPU (slower) · chunk ${c + 1}/${totalChunks}...`
            : `Transcribing on WebGPU · chunk ${c + 1}/${totalChunks}...`,
      } satisfies WhisperWorkerResponse);

      const baseOpts: Record<string, unknown> = {
        chunk_length_s: chunkSec,
        stride_length_s: strideSec,
      };
      if (req.language && req.language !== 'auto') {
        baseOpts.language = req.language;
        baseOpts.task = 'transcribe';
      }

      let out: PipelineOutput;
      if (forceSegmentMode) {
        out = await pipe(slice, { ...baseOpts, return_timestamps: true });
      } else {
        try {
          out = await pipe(slice, { ...baseOpts, return_timestamps: 'word' });
        } catch (wordErr) {
          if (
            shouldFallbackToSegmentTimestamps({
              error: wordErr,
              currentBackend: backend,
              alreadySegmentMode: forceSegmentMode,
            })
          ) {
            forceSegmentMode = true;
            approximateWordTiming = true;
            self.postMessage({
              id: req.id,
              type: 'progress',
              phase: 'transcribe',
              percent: pct,
              message: `Word timestamps unavailable — switching to segment timing (approximate)...`,
            } satisfies WhisperWorkerResponse);
            out = await pipe(slice, { ...baseOpts, return_timestamps: true });
          } else {
            throw wordErr;
          }
        }
      }

      const chunks = out.chunks ?? [];
      if (chunks.length > 0) {
        if (forceSegmentMode) {
          const segments = chunks
            .filter((ch) => Boolean(ch.text && ch.text.trim()))
            .map((ch) => {
              const s = ch.timestamp?.[0] ?? 0;
              const e = ch.timestamp?.[1] ?? Math.min(sliceDurationSec, s + 2.0);
              return { text: (ch.text || '').trim(), start: s, end: e };
            });
          allWords.push(
            ...distributeSegmentWordsProportionally(segments, chunkOffsetSec, sliceDurationSec)
          );
        } else {
          for (const ch of chunks) {
            const text = (ch.text || '').trim();
            if (!text) continue;
            const ts0 = ch.timestamp?.[0] ?? 0;
            const ts1 = ch.timestamp?.[1] ?? ts0 + 0.3;
            const tokens = text.split(/\s+/).filter(Boolean);
            if (tokens.length <= 1) {
              allWords.push({
                text,
                start: Number((chunkOffsetSec + ts0).toFixed(2)),
                end: Number((chunkOffsetSec + Math.max(ts0 + 0.08, ts1)).toFixed(2)),
              });
            } else {
              approximateWordTiming = true;
              allWords.push(
                ...distributeSegmentWordsProportionally(
                  [{ text, start: ts0, end: ts1 }],
                  chunkOffsetSec
                )
              );
            }
          }
        }
      } else if (out.text && out.text.trim()) {
        approximateWordTiming = true;
        const span = Math.min(sliceDurationSec, Math.max(0.5, totalSec - c * chunkSec));
        allWords.push(
          ...distributeSegmentWordsProportionally(
            [{ text: out.text.trim(), start: 0, end: span }],
            chunkOffsetSec,
            span
          )
        );
      }
    }

    self.postMessage({
      id: req.id,
      type: 'result',
      words: allWords,
      backend,
      modelId: req.modelId,
      approximateWordTiming,
    } satisfies WhisperWorkerResponse);
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err ?? 'Whisper transcription failed.');
    await disposeCachedPipeline();
    const friendly = classifyWhisperError({
      stage,
      error: err,
      backend,
      modelId: req.modelId,
      modelBaseUrl: req.modelBaseUrl,
    });
    self.postMessage({
      id: req.id,
      type: 'error',
      error: friendly,
      rawError: rawMsg,
      stage,
      backend,
      weightsCached,
    } satisfies WhisperWorkerResponse);
  }
};
