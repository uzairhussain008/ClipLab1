import { isLowMemoryOrMobileDevice } from './deviceCheck';
import {
  drawSampleSceneFrame,
  SAMPLE_CLIP_DURATION_SEC,
  type SampleSceneId,
} from './sampleScenes';

const SCENE_FILENAMES: Record<SampleSceneId, string> = {
  'night-city': 'night-city-sample',
  'arcade-shapes': 'arcade-targets-sample',
  'avatar-split': 'avatar-split-sample',
};

/**
 * Generates a real, playable local video clip using Canvas + MediaRecorder
 * (plus a subtle Web Audio synth tone when AudioContext is active) so users can
 * test trimming, 9:16 framing, templates, text overlays, and exports without
 * supplying their own file.
 * Uses lighter 960x540 @ 24fps resolution on mobile / low-memory devices.
 */
export async function generateSampleClipFile(
  sceneId: SampleSceneId = 'night-city',
  signal?: AbortSignal
): Promise<File> {
  if (signal?.aborted) {
    throw new Error('Sample generation cancelled.');
  }

  const isLightDevice = typeof window !== 'undefined' && isLowMemoryOrMobileDevice();
  const width = isLightDevice ? 960 : 1280;
  const height = isLightDevice ? 540 : 720;
  const durationMs = Math.round(SAMPLE_CLIP_DURATION_SEC * 1000);
  const fps = isLightDevice ? 24 : 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable in this browser.');
  }

  // Paint initial frame immediately so captureStream emits frame 0 cleanly
  drawSampleSceneFrame(ctx, sceneId, width, height, 0, 0);

  const canvasStream = canvas.captureStream(fps);
  let audioCtx: AudioContext | null = null;
  let combinedStream: MediaStream = canvasStream;
  let hasLiveAudioTrack = false;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await Promise.race([
          audioCtx.resume().catch(() => {}),
          new Promise<void>((r) => setTimeout(r, 80)),
        ]);
      }

      // Only attach synthesized Web Audio track if AudioContext actually resumed/running;
      // a suspended AudioContext stalls MediaRecorder opus muxing and creates invalid blobs.
      if (audioCtx.state === 'running') {
        const dest = audioCtx.createMediaStreamDestination();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 2.0);
        osc.frequency.exponentialRampToValueAtTime(146.83, audioCtx.currentTime + 4.0);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 4.1);
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        osc.stop(audioCtx.currentTime + SAMPLE_CLIP_DURATION_SEC);

        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
        hasLiveAudioTrack = true;
      } else {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    }
  } catch {
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    combinedStream = canvasStream;
    hasLiveAudioTrack = false;
  }

  const codecCandidates = hasLiveAudioTrack
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    : ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

  const preferredMime =
    codecCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) ?? '';

  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      'MediaRecorder is unavailable in this browser. Please upload an MP4 or WebM file.'
    );
  }

  const recorder = preferredMime
    ? new MediaRecorder(combinedStream, {
        mimeType: preferredMime,
        videoBitsPerSecond: isLightDevice ? 1_600_000 : 2_500_000,
      })
    : new MediaRecorder(combinedStream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const cleanupStreams = () => {
    combinedStream.getTracks().forEach((tr) => tr.stop());
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  };

  const baseName = SCENE_FILENAMES[sceneId] ?? SCENE_FILENAMES['night-city'];
  let settleResolve!: (f: File) => void;
  let settleReject!: (e: Error) => void;
  const stopPromise = new Promise<File>((resolve, reject) => {
    settleResolve = resolve;
    settleReject = reject;
  });
  // Prevent unhandledRejection if StrictMode aborts before return stopPromise is reached
  stopPromise.catch(() => {});

  recorder.onerror = () => {
    cleanupStreams();
    settleReject(new Error('Failed to record local sample clip.'));
  };
  recorder.onstop = () => {
    cleanupStreams();
    if (signal?.aborted) {
      settleReject(new Error('Sample generation cancelled.'));
      return;
    }
    const ext = preferredMime.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: preferredMime || 'video/webm' });
    if (blob.size === 0) {
      settleReject(new Error('Recorded sample clip was empty. Please try uploading a local video.'));
      return;
    }
    settleResolve(new File([blob], `${baseName}.${ext}`, { type: blob.type }));
  };

  let rafId = 0;
  const onAbort = () => {
    cancelAnimationFrame(rafId);
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupStreams();
        settleReject(new Error('Sample generation cancelled.'));
      }
    } else {
      cleanupStreams();
      settleReject(new Error('Sample generation cancelled.'));
    }
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  recorder.start(100);

  const startMs = performance.now();
  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      const elapsed = performance.now() - startMs;
      const t = Math.min(1, elapsed / durationMs);
      drawSampleSceneFrame(ctx, sceneId, width, height, t, Math.min(durationMs, elapsed));

      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        resolve();
      }
    };
    rafId = requestAnimationFrame(drawFrame);
  });

  signal?.removeEventListener('abort', onAbort);
  if (signal?.aborted) {
    throw new Error('Sample generation cancelled.');
  }
  if (recorder.state !== 'inactive') {
    recorder.stop();
  }
  return stopPromise;
}
