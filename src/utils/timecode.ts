export const MIN_CLIP_DURATION = 0.2;
export const DEFAULT_FRAME_STEP = 1 / 30;

export function clampTime(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00.00';
  }
  const totalHundredths = Math.round(seconds * 100);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const hs = String(hundredths).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}.${hs}`;
  }
  return `${mm}:${ss}.${hs}`;
}

export function normalizeTrimRange(
  start: number,
  end: number,
  duration: number
): { startTime: number; endTime: number } {
  const safeDuration = Math.max(duration, MIN_CLIP_DURATION);
  let s = clampTime(start, 0, safeDuration - MIN_CLIP_DURATION);
  let e = clampTime(end, MIN_CLIP_DURATION, safeDuration);

  if (e - s < MIN_CLIP_DURATION) {
    if (s + MIN_CLIP_DURATION <= safeDuration) {
      e = s + MIN_CLIP_DURATION;
    } else {
      s = Math.max(0, safeDuration - MIN_CLIP_DURATION);
      e = safeDuration;
    }
  }
  return {
    startTime: Number(s.toFixed(3)),
    endTime: Number(e.toFixed(3)),
  };
}

export function stepFrame(
  currentTime: number,
  direction: -1 | 1,
  duration: number,
  fps = 30
): number {
  const step = 1 / Math.max(fps, 1);
  return clampTime(Number((currentTime + direction * step).toFixed(4)), 0, Math.max(duration, 0));
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'clip';
}
