import { APP_CONFIG } from '../config/appConfig';

export interface VideoValidationResult {
  valid: boolean;
  error?: string;
  warnings: string[];
}

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const ACCEPTED_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

export function isLowMemoryOrMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const lowRam = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const narrowScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  return isMobileUA || lowRam || narrowScreen;
}

export function validateVideoFile(file: File): VideoValidationResult {
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = !file.type || ACCEPTED_MIMES.includes(file.type) || file.type.startsWith('video/');

  if (!hasValidExt && !hasValidMime) {
    return {
      valid: false,
      error: `Unsupported file format ("${file.name}"). Please choose an MP4, MOV, or WebM video.`,
      warnings: [],
    };
  }

  const sizeMB = file.size / (1024 * 1024);
  const warnings: string[] = [];

  if (sizeMB > APP_CONFIG.largeFileWarningMB) {
    warnings.push(
      `This file is ${Math.round(sizeMB)} MB (over ${APP_CONFIG.largeFileWarningMB} MB). Browser memory limits may fail on long re-encodes—try trimming shorter clips or using Fast Copy.`
    );
  } else if (isLowMemoryOrMobileDevice() && sizeMB > APP_CONFIG.mobileFileWarningMB) {
    warnings.push(
      `Mobile or lower-memory device detected (${Math.round(sizeMB)} MB file). Shorter clips under 60 seconds export most reliably.`
    );
  }

  return { valid: true, warnings };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapFfmpegErrorMessage(rawError: unknown): string {
  const msg = rawError instanceof Error ? rawError.message : String(rawError);
  const lower = msg.toLowerCase();
  if (lower.includes('abort') || lower.includes('terminate') || lower.includes('cancel')) {
    return 'Export cancelled.';
  }
  if (lower.includes('out of memory') || lower.includes('oom') || lower.includes('cannot enlarge memory')) {
    return 'Browser ran out of memory while encoding. Try a shorter clip, "Small file" quality, or Fast Copy mode.';
  }
  if (lower.includes('invalid data') || lower.includes('moov atom') || lower.includes('codec') || lower.includes('decoder')) {
    return 'Unsupported codec or corrupted video container. Try converting to standard H.264 MP4 or WebM.';
  }
  return `Processing failed: ${msg}`;
}
