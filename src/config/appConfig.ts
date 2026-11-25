import type { AspectPreset, OverlayFontId, PlatformPreset } from '../types/editor';

const metaEnv: Record<string, string | undefined> =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};

export interface HeroImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ShowcaseVideoAsset {
  templateId: string;
  videoUrl: string;
  posterUrl: string;
  alt: string;
}

const APP_NAME = 'ClipLab1';
export const DEFAULT_SITE_URL = 'https://cliplab1.ai.studio';

export function resolveEnableAutoCaptions(rawValue?: string): boolean {
  const cleaned = (rawValue ?? '').trim().toLowerCase();
  return cleaned !== 'false' && cleaned !== '0';
}

export const ENABLE_AUTO_CAPTIONS = resolveEnableAutoCaptions(metaEnv.VITE_ENABLE_AUTO_CAPTIONS);

export function resolveSiteUrl(rawUrl?: string): string {
  const cleaned = (rawUrl ?? '').trim().replace(/\/+$/, '');
  return cleaned || DEFAULT_SITE_URL;
}

export function resolveFfmpegCoreBaseUrl(rawUrl?: string): string {
  const cleaned = (rawUrl ?? '').trim().replace(/\/+$/, '');
  return cleaned || '/ffmpeg';
}

export function resolveVerificationToken(rawValue?: string): string {
  const trimmed = (rawValue ?? '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower === 'placeholder' || lower === 'none') {
    return '';
  }
  return trimmed;
}

export function isValidIndexNowKey(rawValue?: string): boolean {
  const token = resolveVerificationToken(rawValue);
  return Boolean(token && /^[a-zA-Z0-9-]+$/.test(token));
}

export const APP_CONFIG = {
  /** Change the brand name here to rebrand the entire site */
  appName: APP_NAME,
  /** Feature flag for on-device Whisper auto captions (default true; set VITE_ENABLE_AUTO_CAPTIONS=false to disable) */
  ENABLE_AUTO_CAPTIONS,
  tagline: 'In-browser video clipper for gamers & short-form creators.',
  entitySentence: `${APP_NAME} is a free, browser-based video clipper that processes files locally on your device.`,
  contactEmail: 'hello@cliplab1.example',
  /** Canonical public site URL (override with VITE_SITE_URL in production builds) */
  SITE_URL: resolveSiteUrl(metaEnv.VITE_SITE_URL),
  /** Base path or CORS-enabled origin URL for self-hosted ffmpeg-core.js + ffmpeg-core.wasm */
  FFMPEG_CORE_BASE_URL: resolveFfmpegCoreBaseUrl(metaEnv.VITE_FFMPEG_CORE_BASE_URL),
  /** Control AI crawler allowance in robots.txt (set VITE_ALLOW_AI_CRAWLERS=false to block) */
  allowAiCrawlers: metaEnv.VITE_ALLOW_AI_CRAWLERS !== 'false',
  /** Optional owner-added webmaster verification IDs via env vars (never hardcode fake IDs) */
  siteVerification: {
    google: resolveVerificationToken(metaEnv.VITE_GSC_VERIFICATION),
    bing: resolveVerificationToken(metaEnv.VITE_BING_VERIFICATION),
    indexNowKey: resolveVerificationToken(metaEnv.VITE_INDEXNOW_KEY),
  },
  /** Optional owner-added CC0 or self-created hero images under /public/hero (empty by default) */
  HERO_IMAGES: [] as readonly HeroImageAsset[],
  /** Optional owner-licensed muted looping showcase videos under /public/showcase (empty by default) */
  SHOWCASE_VIDEOS: [] as readonly ShowcaseVideoAsset[],
  /** Large file warning threshold in megabytes */
  largeFileWarningMB: 300,
  /** Approximate mobile/low-memory warning threshold in MB */
  mobileFileWarningMB: 120,
  /** Monetization toggle — disabled by default. Set true via VITE_ADS_ENABLED=true when ready. */
  adsEnabled: metaEnv.VITE_ADS_ENABLED === 'true',
  adConfig: {
    network: metaEnv.VITE_AD_NETWORK || 'placeholder',
    publisherId: metaEnv.VITE_AD_PUBLISHER_ID || '',
    slots: {
      sidebar: metaEnv.VITE_AD_SLOT_SIDEBAR || '',
      belowEditor: metaEnv.VITE_AD_SLOT_BELOW_EDITOR || '',
      footer: metaEnv.VITE_AD_SLOT_FOOTER || '',
    },
  },
  platformLimits: {
    /** Check Facebook's current Reel limit before posting, as platform limits change */
    facebookReelMaxDurationSec: 90,
  },
  smartFeatures: {
    /** Toggle smart audio/motion analysis and reframing */
    enabled: metaEnv.VITE_SMART_ENABLED !== 'false',
    /** Warn user when analyzing videos longer than this threshold (in minutes) */
    longVideoWarningMinutes: 10,
    /** Low-resolution sampling width in pixels for motion/scene analysis */
    analysisSampleWidth: 192,
    /** Frame sampling rate (fps) for motion/scene analysis */
    analysisFps: 3,
    /** Low audio sample rate for RMS energy spike analysis */
    audioAnalysisSampleRate: 8000,
    /** Default number of candidate moments to suggest */
    maxCandidateMoments: 5,
    /** Minimum gap in seconds between suggested non-overlapping moments */
    minMomentGapSec: 4,
    /** Keyframe interval in seconds for Smart follow crop path */
    cropKeyframeIntervalSec: 0.5,
    /** Editable default keywords for speech-aware moment boost */
    defaultBoostKeywords: ['no way', 'clutch', 'watch this'] as readonly string[],
  },
  captions: {
    /** Toggle on-device Whisper captioning (controlled by ENABLE_AUTO_CAPTIONS) */
    enabled: ENABLE_AUTO_CAPTIONS,
    /** Configurable host for model downloads so the owner can self-host */
    MODEL_BASE_URL: metaEnv.VITE_MODEL_BASE_URL || 'https://huggingface.co/',
    /** Default Whisper model ID (exported with cross-attentions for word timestamps) */
    MODEL_ID: metaEnv.VITE_WHISPER_MODEL_ID || 'onnx-community/whisper-tiny_timestamped',
    /** Optional English-only timestamped model ID (used only when user selects English) */
    ENGLISH_MODEL_ID:
      metaEnv.VITE_WHISPER_ENGLISH_MODEL_ID || 'onnx-community/whisper-tiny.en_timestamped',
    /** Alias for backward compatibility */
    modelId: metaEnv.VITE_WHISPER_MODEL_ID || 'onnx-community/whisper-tiny_timestamped',
    /** Measured CPU quantized (q8) download size in MB (~45.2 MB / 43.1 MiB) */
    estimatedModelSizeMB: 45,
    /** Measured WebGPU fp32 download size in MB (~156.0 MB / 148.7 MiB) */
    estimatedGpuModelSizeMB: 156,
    /** Audio sample rate expected by Whisper */
    whisperSampleRate: 16000,
  },
  legalDisclaimer: 'Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive.',
  platformDisclaimer: `${APP_NAME} is not affiliated with, endorsed by, or connected to YouTube, Instagram, Facebook, TikTok, or their owners.`,
  ownershipNotice:
    'You are responsible for having the rights or permission to edit and share any video you load.',
} as const;

export const BUNDLED_FONTS: Record<
  OverlayFontId,
  { label: string; publicUrl: string; assFamily: string; cssFamily: string }
> = {
  'sans-bold': {
    label: 'Liberation Sans Bold',
    publicUrl: '/fonts/caption-sans-bold.ttf',
    assFamily: 'Liberation Sans',
    cssFamily: '"Liberation Sans", "DM Sans", sans-serif',
  },
  'display-bold': {
    label: 'DejaVu Sans Bold',
    publicUrl: '/fonts/caption-display-bold.ttf',
    assFamily: 'DejaVu Sans',
    cssFamily: '"DejaVu Sans", "Oswald", sans-serif',
  },
  'mono-bold': {
    label: 'JetBrains Mono Bold',
    publicUrl: '/fonts/caption-mono-bold.ttf',
    assFamily: 'JetBrains Mono',
    cssFamily: '"JetBrains Mono", monospace',
  },
  'montserrat-extrabold': {
    label: 'Montserrat ExtraBold',
    publicUrl: '/fonts/caption-montserrat-extrabold.ttf',
    assFamily: 'Montserrat ExtraBold',
    cssFamily: '"Montserrat ExtraBold", "DM Sans", sans-serif',
  },
  anton: {
    label: 'Anton (Impact)',
    publicUrl: '/fonts/caption-anton.ttf',
    assFamily: 'Anton',
    cssFamily: '"Anton", Impact, sans-serif',
  },
  bangers: {
    label: 'Bangers (Comic)',
    publicUrl: '/fonts/caption-bangers.ttf',
    assFamily: 'Bangers',
    cssFamily: '"Bangers", Impact, sans-serif',
  },
  'luckiest-guy': {
    label: 'Luckiest Guy (Chunky)',
    publicUrl: '/fonts/caption-luckiest-guy.ttf',
    assFamily: 'Luckiest Guy',
    cssFamily: '"Luckiest Guy", Impact, sans-serif',
  },
};

export const WHISPER_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English (best accuracy)' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
] as const;

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: '9:16', label: '9:16 Vertical', width: 1080, height: 1920, description: 'Shorts, TikTok, Reels' },
  { id: '1:1', label: '1:1 Square', width: 1080, height: 1080, description: 'Feed & community posts' },
  { id: '4:5', label: '4:5 Portrait', width: 1080, height: 1350, description: 'Instagram & X feed' },
  { id: '16:9', label: '16:9 Widescreen', width: 1920, height: 1080, description: 'Standard landscape' },
];

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    aspect: '9:16',
    verticalMode: 'blur-bg',
    quality: 'shorts',
    maxDurationSec: 60,
    targetClipSec: 30,
    note: '9:16 · 1080×1920 · 60s max recommended',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    aspect: '9:16',
    verticalMode: 'blur-bg',
    quality: 'shorts',
    maxDurationSec: 60,
    targetClipSec: 25,
    note: '9:16 · 1080×1920 · 60s quick hook target',
  },
  {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    aspect: '9:16',
    verticalMode: 'fill-crop',
    quality: 'shorts',
    maxDurationSec: 90,
    targetClipSec: 35,
    note: '9:16 · 1080×1920 · 90s max recommended',
  },
  {
    id: 'facebook-reel',
    name: 'Facebook Reel',
    aspect: '9:16',
    verticalMode: 'fill-crop',
    quality: 'shorts',
    maxDurationSec: APP_CONFIG.platformLimits.facebookReelMaxDurationSec,
    targetClipSec: 35,
    note: `9:16 · 1080×1920 · ${APP_CONFIG.platformLimits.facebookReelMaxDurationSec}s target — check Facebook's current limit`,
  },
];
