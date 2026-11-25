import { APP_CONFIG, type ShowcaseVideoAsset } from '../config/appConfig';

export const SHOWCASE_TARGET_FPS = 24;
export const SHOWCASE_FRAME_INTERVAL_MS = 1000 / SHOWCASE_TARGET_FPS;

export interface ShowcaseScheduleState {
  isVisible: boolean;
  isTabVisible: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Pure animation scheduling check for home page live canvas previews.
 * Pauses completely when off-screen, when tab is hidden, or under prefers-reduced-motion.
 */
export function shouldRunShowcaseAnimation(state: ShowcaseScheduleState): boolean {
  return state.isVisible && state.isTabVisible && !state.prefersReducedMotion;
}

/**
 * Throttles requestAnimationFrame callbacks cleanly to ~24 fps max.
 */
export function shouldDrawShowcaseFrame(
  nowMs: number,
  lastDrawMs: number,
  targetFps = SHOWCASE_TARGET_FPS
): boolean {
  if (lastDrawMs < 0) return true;
  const minInterval = 1000 / Math.max(1, targetFps);
  return nowMs - lastDrawMs >= minInterval - 0.5;
}

/**
 * Resolves an optional owner-supplied showcase video asset from config.
 * Returns null when SHOWCASE_VIDEOS is empty so Home renders browser-drawn live canvas scenes.
 */
export function findShowcaseVideoAsset(
  templateId: string,
  assets: readonly ShowcaseVideoAsset[] = APP_CONFIG.SHOWCASE_VIDEOS
): ShowcaseVideoAsset | null {
  return assets.find((v) => v.templateId === templateId) ?? null;
}
