export type AspectRatioId = '9:16' | '1:1' | '4:5' | '16:9';

export type VerticalMode = 'fill-crop' | 'blur-bg';

export type ReframeMode =
  | 'manual'
  | 'smart-follow'
  | 'face-aware'
  | 'blur-bg'
  | 'split-layout';

export type ExportQuality = 'shorts' | 'balanced' | 'small';

export type ExportFormat = 'mp4' | 'gif';

export type OverlayFontId =
  | 'sans-bold'
  | 'display-bold'
  | 'mono-bold'
  | 'bangers'
  | 'luckiest-guy'
  | 'anton'
  | 'montserrat-extrabold';

export type LogoCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type ProcessingMode = 'fast-copy' | 're-encode';

export interface AspectPreset {
  id: AspectRatioId;
  label: string;
  width: number;
  height: number;
  description: string;
}

export interface PlatformPreset {
  id: 'youtube-shorts' | 'tiktok' | 'instagram-reel' | 'facebook-reel';
  name: string;
  aspect: AspectRatioId;
  verticalMode: VerticalMode;
  quality: ExportQuality;
  maxDurationSec: number;
  targetClipSec: number;
  note: string;
}

export interface ClipSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SplitLayoutConfig {
  /** Percentage of vertical 9:16 frame height given to gameplay (top), 50..80 (default 65) */
  gameplayRatioPercent: number;
  backgroundMode: 'blur' | 'fill';
  gameplayBox: NormalizedRect;
  facecamBox: NormalizedRect;
}

export interface ZoomConfig {
  /** 1.0 to 1.5 */
  punchZoom: number;
  slowZoom: boolean;
  pulseOnPeaks: boolean;
}

export interface CropKeyframe {
  time: number;
  cropX: number;
  cropY: number;
}

export interface ActivitySample {
  time: number;
  audioRms: number;
  motion: number;
  sceneChange: number;
  score: number;
  focusX: number;
  focusY: number;
}

export type ActivityLevel = 'High' | 'Medium' | 'Low';

export type MomentReasonTag = 'loud' | 'motion' | 'speech' | 'keyword';

export interface SmartMomentCandidate {
  id: string;
  startTime: number;
  endTime: number;
  peakTime: number;
  score: number;
  activityLevel: ActivityLevel;
  reason: string;
  reasonTags?: MomentReasonTag[];
  hookSuggestion?: string;
  thumbnailDataUrl: string;
}

export interface SmartAnalysisResult {
  samples: ActivitySample[];
  cropPath: CropKeyframe[];
  moments: SmartMomentCandidate[];
  peakTimes: number[];
  hasAudio: boolean;
  hasStrongMoments: boolean;
  faceDetectionUsed: boolean;
  analyzedRange: { start: number; end: number };
}

export interface CaptionWord {
  text: string;
  start: number;
  end: number;
}

export interface CaptionLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  words?: CaptionWord[];
  /** Optional explicit per-line style override (used with Auto mix or mixed clips) */
  styleOverride?: CaptionStylePresetId;
}

export type CaptionStylePresetId =
  | 'classic'
  | 'bold-pop'
  | 'boxed'
  | 'minimal'
  | 'hype-pop'
  | 'neon-glow'
  | 'comic-burst'
  | 'sticker-box';

export type CaptionInputMode = 'auto' | 'manual' | 'import';

export type CaptionStyleMode = 'single' | 'auto-mix';

export type AutoMixIntensity = 'calm' | 'balanced' | 'hype';

export type ComputeMode = 'auto' | 'gpu' | 'cpu';

export type WhisperBackend = 'webgpu' | 'wasm';

export type WhisperStage = 'download' | 'init' | 'transcribe';

export interface CaptionConfig {
  enabled: boolean;
  preset: CaptionStylePresetId;
  styleMode?: CaptionStyleMode;
  autoMixIntensity?: AutoMixIntensity;
  position: 'top' | 'middle' | 'bottom';
  offsetPercent: number;
  font: OverlayFontId;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  outlineWidth: number;
  backgroundBox: boolean;
  wordsPerLine: number;
  uppercase: boolean;
  popIn: boolean;
  showSafeZoneGuide: boolean;
}

export interface TextOverlayConfig {
  enabled: boolean;
  text: string;
  position: 'top' | 'bottom';
  font: OverlayFontId;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  startTime: number;
  endTime: number;
  /** Optional 3-second hook mode with fade-in/fade-out */
  hookFade?: boolean;
}

export interface LogoOverlayConfig {
  enabled: boolean;
  fileName: string;
  dataUrl: string;
  corner: LogoCorner;
  sizePercent: number;
  opacity: number;
}

export interface ExportSettings {
  aspect: AspectRatioId;
  /** If true, keep original aspect ratio and skip crop/scale unless another filter requires re-encode */
  keepOriginalFraming: boolean;
  verticalMode: VerticalMode;
  reframeMode: ReframeMode;
  lockPosition: boolean;
  ignoreHudEdges: boolean;
  foregroundSizePercent: number;
  /** Normalized horizontal framing offset (0 = left, 0.5 = center, 1 = right) for fill-crop */
  cropX: number;
  /** Normalized vertical framing offset (0 = top, 0.5 = center, 1 = bottom) for fill-crop */
  cropY: number;
  zoom: ZoomConfig;
  splitLayout: SplitLayoutConfig;
  speed: number;
  muted: boolean;
  volume: number;
  quality: ExportQuality;
  format: ExportFormat;
}

export interface WatermarkMakerConfig {
  text: string;
  fontStyle: 'condensed' | 'stencil' | 'mono';
  fontSize: number;
  textColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  uppercase: boolean;
  letterSpacing: number;
}

export interface TransferredLogo {
  dataUrl: string;
  fileName: string;
}
