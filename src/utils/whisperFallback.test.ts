import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWhisperError,
  clearRememberedGpuFailure,
  distributeSegmentWordsProportionally,
  getRememberedGpuFailure,
  getSavedComputeMode,
  isNetworkDownloadError,
  isTimestampAttentionsError,
  rememberGpuFailure,
  resolveInitialExecutionPlan,
  resolveWhisperModelId,
  saveComputeMode,
  shouldFallbackToCpu,
  shouldFallbackToSegmentTimestamps,
  WHISPER_COMPUTE_MODE_STORAGE_KEY,
  WHISPER_GPU_FAILURE_STORAGE_KEY,
} from './whisperFallback';

const WEBGPU_DEVICE_REMOVED_ERR =
  'Failed to create a WebGPU compute pipeline: D3D12 creating pipeline state failed with DXGI_ERROR_DEVICE_REMOVED (0x887A0005)';

const MISSING_CROSS_ATTENTIONS_ERR =
  'Model outputs must contain cross attentions to extract timestamps. This is most likely because the model was not exported with output_attentions=True.';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(idx: number) {
      return Array.from(map.keys())[idx] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('GPU failure fallback triggers on WebGPU DXGI_ERROR_DEVICE_REMOVED during init or inference and never treats it as download failure', () => {
  const err = new Error(WEBGPU_DEVICE_REMOVED_ERR);

  assert.equal(isNetworkDownloadError(err), false);
  assert.equal(
    shouldFallbackToCpu({
      stage: 'init',
      error: err,
      currentBackend: 'webgpu',
      hasRetriedCpu: false,
    }),
    true
  );
  assert.equal(
    shouldFallbackToCpu({
      stage: 'transcribe',
      error: err,
      currentBackend: 'webgpu',
      hasRetriedCpu: false,
    }),
    true
  );
  // Only retry once on CPU
  assert.equal(
    shouldFallbackToCpu({
      stage: 'transcribe',
      error: err,
      currentBackend: 'webgpu',
      hasRetriedCpu: true,
    }),
    false
  );

  const classified = classifyWhisperError({
    stage: 'init',
    error: err,
    backend: 'webgpu',
    modelId: 'onnx-community/whisper-tiny_timestamped',
    modelBaseUrl: 'https://huggingface.co/',
  });
  assert.doesNotMatch(classified.toLowerCase(), /download failed/);
  assert.match(classified, /failed to initialize on WebGPU/i);
});

test('only true network fetch failures are labeled as download failed', () => {
  const netErr = new Error('TypeError: Failed to fetch');
  assert.equal(isNetworkDownloadError(netErr), true);
  assert.equal(
    shouldFallbackToCpu({
      stage: 'download',
      error: netErr,
      currentBackend: 'webgpu',
      hasRetriedCpu: false,
    }),
    false
  );

  const msg = classifyWhisperError({
    stage: 'download',
    error: netErr,
    backend: 'webgpu',
    modelId: 'onnx-community/whisper-tiny_timestamped',
    modelBaseUrl: 'https://huggingface.co/',
  });
  assert.match(msg, /download failed/i);
  assert.match(msg, /Check your connection/i);
});

test('Default Speech mode is Light (cpu), remembers user choice, and preserves GPU failure CPU fallback', () => {
  const storage = createMemoryStorage();
  assert.equal(getRememberedGpuFailure(storage), false);

  // Fresh storage defaults to Light (cpu) so GPU is never used unless picked
  assert.equal(getSavedComputeMode(storage), 'cpu');
  const defaultPlan = resolveInitialExecutionPlan({
    computeMode: getSavedComputeMode(storage),
    webGpuAvailable: true,
    rememberedGpuFailure: false,
  });
  assert.equal(defaultPlan.backend, 'wasm');
  assert.equal(defaultPlan.dtype, 'q8');

  // Legacy saved 'auto' also maps to 'cpu'
  storage.setItem(WHISPER_COMPUTE_MODE_STORAGE_KEY, 'auto');
  assert.equal(getSavedComputeMode(storage), 'cpu');

  // User picks Fast (gpu) -> saved & remembered; attempts WebGPU when supported
  saveComputeMode('gpu', storage);
  assert.equal(getSavedComputeMode(storage), 'gpu');
  assert.equal(storage.getItem(WHISPER_COMPUTE_MODE_STORAGE_KEY), 'gpu');

  rememberGpuFailure(WEBGPU_DEVICE_REMOVED_ERR, storage);
  assert.equal(getRememberedGpuFailure(storage), true);
  assert.ok(storage.getItem(WHISPER_GPU_FAILURE_STORAGE_KEY)?.includes('DXGI_ERROR_DEVICE_REMOVED'));

  // Explicit GPU mode attempts WebGPU even if remembered (and falls back on runtime/init error)
  const gpuPlan = resolveInitialExecutionPlan({
    computeMode: getSavedComputeMode(storage),
    webGpuAvailable: true,
    rememberedGpuFailure: getRememberedGpuFailure(storage),
  });
  assert.equal(gpuPlan.backend, 'webgpu');

  // When WebGPU is unavailable on device, even 'gpu' choice falls back cleanly to CPU WASM q8
  const gpuUnsupportedPlan = resolveInitialExecutionPlan({
    computeMode: 'gpu',
    webGpuAvailable: false,
    rememberedGpuFailure: false,
  });
  assert.equal(gpuUnsupportedPlan.backend, 'wasm');
  assert.equal(gpuUnsupportedPlan.dtype, 'q8');

  // Explicit CPU mode forces WASM quantized q8
  saveComputeMode('cpu', storage);
  assert.equal(getSavedComputeMode(storage), 'cpu');
  assert.equal(storage.getItem(WHISPER_COMPUTE_MODE_STORAGE_KEY), 'cpu');
  const cpuPlan = resolveInitialExecutionPlan({
    computeMode: getSavedComputeMode(storage),
    webGpuAvailable: true,
    rememberedGpuFailure: false,
  });
  assert.equal(cpuPlan.backend, 'wasm');
  assert.equal(cpuPlan.dtype, 'q8');

  clearRememberedGpuFailure(storage);
  assert.equal(getRememberedGpuFailure(storage), false);
});

test('timestamp fallback detects missing cross attentions without confusing it with GPU or network error', () => {
  const err = new Error(MISSING_CROSS_ATTENTIONS_ERR);
  assert.equal(isTimestampAttentionsError(err), true);
  assert.equal(isNetworkDownloadError(err), false);
  assert.equal(
    shouldFallbackToSegmentTimestamps({
      error: err,
      currentBackend: 'webgpu',
      alreadySegmentMode: false,
    }),
    true
  );
  assert.equal(
    shouldFallbackToSegmentTimestamps({
      error: err,
      currentBackend: 'wasm',
      alreadySegmentMode: true,
    }),
    false
  );

  // GPU device lost error must NOT trigger timestamp fallback on WebGPU (let GPU->CPU retry run first)
  assert.equal(
    shouldFallbackToSegmentTimestamps({
      error: new Error(WEBGPU_DEVICE_REMOVED_ERR),
      currentBackend: 'webgpu',
      alreadySegmentMode: false,
    }),
    false
  );
});

test('distributeSegmentWordsProportionally distributes words proportionally within segment bounds', () => {
  const words = distributeSegmentWordsProportionally(
    [
      { text: 'I clutched', start: 1.0, end: 3.0 },
      { text: 'no way', start: 3.5, end: 5.0 },
    ],
    10.0
  );

  assert.equal(words.length, 4);
  assert.equal(words[0].text, 'I');
  assert.equal(words[0].start, 11.0);
  assert.equal(words[1].text, 'clutched');
  assert.equal(words[1].end, 13.0);
  // Longer word "clutched" (8 chars) gets strictly longer duration than "I" (1 char)
  assert.ok(words[1].end - words[1].start > words[0].end - words[0].start);

  assert.equal(words[2].start, 13.5);
  assert.equal(words[3].end, 15.0);
});

test('resolveWhisperModelId selects English-only timestamped model only when English and option enabled', () => {
  const defaultId = 'onnx-community/whisper-tiny_timestamped';
  const enId = 'onnx-community/whisper-tiny.en_timestamped';

  assert.equal(
    resolveWhisperModelId({
      defaultModelId: defaultId,
      englishModelId: enId,
      language: 'en',
      useEnglishOnlyModel: true,
    }),
    enId
  );
  assert.equal(
    resolveWhisperModelId({
      defaultModelId: defaultId,
      englishModelId: enId,
      language: 'auto',
      useEnglishOnlyModel: true,
    }),
    defaultId
  );
  assert.equal(
    resolveWhisperModelId({
      defaultModelId: defaultId,
      englishModelId: enId,
      language: 'en',
      useEnglishOnlyModel: false,
    }),
    defaultId
  );
});
