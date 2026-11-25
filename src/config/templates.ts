import type {
  CaptionConfig,
  ExportSettings,
  PlatformPreset,
  SplitLayoutConfig,
  TextOverlayConfig,
} from '../types/editor';
import { CAPTION_PRESET_DEFAULTS } from '../utils/captions';
import type { SampleSceneId } from '../utils/sampleScenes';

export type LookTemplateId =
  | 'blur-fill-classic'
  | 'action-follow'
  | 'gameplay-facecam'
  | 'quick-cut';

export interface LookTemplate {
  id: LookTemplateId;
  name: string;
  tagline: string;
  description: string;
  sampleScene: SampleSceneId;
  includesSampleCaptions: boolean;
  settingsPatch: Partial<ExportSettings>;
  captionPatch: Partial<CaptionConfig>;
  textOverlayPatch: Partial<TextOverlayConfig>;
  summaryNotes: string[];
}

export interface TemplateAppliedSnapshot {
  templateId: LookTemplateId | null;
  settings: ExportSettings;
  captionConfig: CaptionConfig;
  textOverlay: TextOverlayConfig;
  activePlatform: PlatformPreset | null;
}

export const DEFAULT_TEMPLATE_SPLIT_LAYOUT: SplitLayoutConfig = {
  gameplayRatioPercent: 65,
  backgroundMode: 'blur',
  gameplayBox: { x: 0.05, y: 0.05, w: 0.9, h: 0.85 },
  facecamBox: { x: 0.72, y: 0.65, w: 0.25, h: 0.3 },
};

const CLASSIC_META = CAPTION_PRESET_DEFAULTS.classic;
const HYPE_META = CAPTION_PRESET_DEFAULTS['hype-pop'];
const BOXED_META = CAPTION_PRESET_DEFAULTS.boxed;

export const LOOK_TEMPLATES: readonly LookTemplate[] = [
  {
    id: 'blur-fill-classic',
    name: 'Blur Fill Classic',
    tagline: '9:16 · 110% Blur Fill · Classic Captions',
    description:
      'Places your full widescreen frame at 110% scale over a soft blurred backdrop with clean bottom Classic captions and zero zoom.',
    sampleScene: 'night-city',
    includesSampleCaptions: true,
    settingsPatch: {
      aspect: '9:16',
      keepOriginalFraming: false,
      verticalMode: 'blur-bg',
      reframeMode: 'blur-bg',
      foregroundSizePercent: 110,
      zoom: { punchZoom: 1, slowZoom: false, pulseOnPeaks: false },
    },
    captionPatch: {
      enabled: true,
      preset: 'classic',
      styleMode: 'single',
      position: 'bottom',
      offsetPercent: CLASSIC_META.offsetPercent,
      font: CLASSIC_META.font,
      fontSize: CLASSIC_META.fontSize,
      textColor: CLASSIC_META.textColor,
      highlightColor: CLASSIC_META.highlightColor,
      outlineWidth: CLASSIC_META.outlineWidth,
      backgroundBox: CLASSIC_META.backgroundBox,
      uppercase: CLASSIC_META.uppercase,
      popIn: CLASSIC_META.popIn,
    },
    textOverlayPatch: {
      enabled: false,
    },
    summaryNotes: [
      'Aspect 9:16 with Blurred background fill (110% foreground)',
      'Zoom turned off (1.00×)',
      'Captions enabled: Classic preset at bottom',
      'Hook title overlay turned off',
    ],
  },
  {
    id: 'action-follow',
    name: 'Action Follow',
    tagline: '9:16 Smart Follow · 1.15× Zoom · Hype Pop + Hook',
    description:
      'Reframes to 9:16 Smart follow with 1.15× punch-in zoom, loud-peak pulses, Hype Pop captions, and an editable 3-second opening hook title.',
    sampleScene: 'arcade-shapes',
    includesSampleCaptions: true,
    settingsPatch: {
      aspect: '9:16',
      keepOriginalFraming: false,
      verticalMode: 'fill-crop',
      reframeMode: 'smart-follow',
      lockPosition: false,
      zoom: { punchZoom: 1.15, slowZoom: false, pulseOnPeaks: true },
    },
    captionPatch: {
      enabled: true,
      preset: 'hype-pop',
      styleMode: 'single',
      position: HYPE_META.position,
      offsetPercent: HYPE_META.offsetPercent,
      font: HYPE_META.font,
      fontSize: HYPE_META.fontSize,
      textColor: HYPE_META.textColor,
      highlightColor: HYPE_META.highlightColor,
      outlineWidth: HYPE_META.outlineWidth,
      backgroundBox: HYPE_META.backgroundBox,
      wordsPerLine: HYPE_META.wordsPerLine ?? 2,
      uppercase: HYPE_META.uppercase,
      popIn: HYPE_META.popIn,
    },
    textOverlayPatch: {
      enabled: true,
      text: 'Wait for it...',
      position: 'top',
      startTime: 0,
      endTime: 3,
      hookFade: true,
    },
    summaryNotes: [
      'Aspect 9:16 with Smart follow reframe',
      'Zoom: 1.15× punch-in + Pulse on loud peaks enabled',
      'Captions enabled: Hype Pop preset',
      'Hook title overlay ON: "Wait for it..." (0–3s, editable in Hook tab)',
    ],
  },
  {
    id: 'gameplay-facecam',
    name: 'Gameplay + Facecam',
    tagline: '9:16 Split (65/35) · Blurred BG · Boxed Captions',
    description:
      'Stacks main action (65% top) above a corner camera crop (35% bottom) with a blurred backdrop and crisp Boxed captions.',
    sampleScene: 'avatar-split',
    includesSampleCaptions: true,
    settingsPatch: {
      aspect: '9:16',
      keepOriginalFraming: false,
      verticalMode: 'fill-crop',
      reframeMode: 'split-layout',
      zoom: { punchZoom: 1, slowZoom: false, pulseOnPeaks: false },
      splitLayout: {
        gameplayRatioPercent: DEFAULT_TEMPLATE_SPLIT_LAYOUT.gameplayRatioPercent,
        backgroundMode: DEFAULT_TEMPLATE_SPLIT_LAYOUT.backgroundMode,
        gameplayBox: { ...DEFAULT_TEMPLATE_SPLIT_LAYOUT.gameplayBox },
        facecamBox: { ...DEFAULT_TEMPLATE_SPLIT_LAYOUT.facecamBox },
      },
    },
    captionPatch: {
      enabled: true,
      preset: 'boxed',
      styleMode: 'single',
      position: BOXED_META.position,
      offsetPercent: BOXED_META.offsetPercent,
      font: BOXED_META.font,
      fontSize: BOXED_META.fontSize,
      textColor: BOXED_META.textColor,
      highlightColor: BOXED_META.highlightColor,
      outlineWidth: BOXED_META.outlineWidth,
      backgroundBox: BOXED_META.backgroundBox,
      uppercase: BOXED_META.uppercase,
      popIn: BOXED_META.popIn,
    },
    textOverlayPatch: {
      enabled: false,
    },
    summaryNotes: [
      'Aspect 9:16 with Split layout (65% top / 35% facecam bottom, blurred background)',
      'Zoom turned off (1.00×)',
      'Captions enabled: Boxed preset',
      'Hook title overlay turned off',
    ],
  },
  {
    id: 'quick-cut',
    name: 'Quick Cut',
    tagline: 'Original Aspect · Fast Stream Copy (-c copy)',
    description:
      'Keeps your original video dimensions with zero captions, overlays, or re-encoding so trims copy in seconds via -c copy.',
    sampleScene: 'night-city',
    includesSampleCaptions: false,
    settingsPatch: {
      keepOriginalFraming: true,
      zoom: { punchZoom: 1, slowZoom: false, pulseOnPeaks: false },
      speed: 1,
      muted: false,
      volume: 1,
      quality: 'balanced',
      format: 'mp4',
    },
    captionPatch: {
      enabled: false,
    },
    textOverlayPatch: {
      enabled: false,
    },
    summaryNotes: [
      'Original aspect ratio kept (Fast Mode -c copy, zero re-encode)',
      'Zoom, speed & volume reset to default (1.00×)',
      'Captions turned off',
      'Hook title overlay turned off',
    ],
  },
];

export function getTemplateById(id?: string | null): LookTemplate | null {
  if (!id) return null;
  const clean = id.trim().toLowerCase();
  return LOOK_TEMPLATES.find((t) => t.id === clean) ?? null;
}

export function cloneTemplateSnapshot(
  templateId: LookTemplateId | null,
  settings: ExportSettings,
  captionConfig: CaptionConfig,
  textOverlay: TextOverlayConfig,
  activePlatform: PlatformPreset | null
): TemplateAppliedSnapshot {
  return {
    templateId,
    settings: {
      ...settings,
      zoom: { ...settings.zoom },
      splitLayout: {
        ...settings.splitLayout,
        gameplayBox: { ...settings.splitLayout.gameplayBox },
        facecamBox: { ...settings.splitLayout.facecamBox },
      },
    },
    captionConfig: { ...captionConfig },
    textOverlay: { ...textOverlay },
    activePlatform: activePlatform ? { ...activePlatform } : null,
  };
}

/**
 * Pure helper applying ONLY styling & framing settings from a template.
 * Never mutates trim ranges, clip segments, source video, caption lines, or user logo overlays.
 */
export function applyTemplateToEditorState(
  template: LookTemplate,
  current: {
    settings: ExportSettings;
    captionConfig: CaptionConfig;
    textOverlay: TextOverlayConfig;
  }
): {
  nextSettings: ExportSettings;
  nextCaptions: CaptionConfig;
  nextTextOverlay: TextOverlayConfig;
  changedSummary: string[];
} {
  const nextSettings: ExportSettings = {
    ...current.settings,
    ...template.settingsPatch,
    zoom: template.settingsPatch.zoom
      ? { ...template.settingsPatch.zoom }
      : { ...current.settings.zoom },
    splitLayout: template.settingsPatch.splitLayout
      ? {
          ...template.settingsPatch.splitLayout,
          gameplayBox: { ...template.settingsPatch.splitLayout.gameplayBox },
          facecamBox: { ...template.settingsPatch.splitLayout.facecamBox },
        }
      : {
          ...current.settings.splitLayout,
          gameplayBox: { ...current.settings.splitLayout.gameplayBox },
          facecamBox: { ...current.settings.splitLayout.facecamBox },
        },
  };

  const nextCaptions: CaptionConfig = {
    ...current.captionConfig,
    ...template.captionPatch,
  };

  const nextTextOverlay: TextOverlayConfig = {
    ...current.textOverlay,
    ...template.textOverlayPatch,
  };

  const changedSummary: string[] = [];

  if (nextSettings.keepOriginalFraming) {
    changedSummary.push('Framing: Original aspect (Fast Mode -c copy, no re-encode)');
  } else if (nextSettings.reframeMode === 'split-layout') {
    changedSummary.push(
      `Framing: ${nextSettings.aspect} Split layout (${nextSettings.splitLayout.gameplayRatioPercent}/${
        100 - nextSettings.splitLayout.gameplayRatioPercent
      }, blurred background)`
    );
  } else if (nextSettings.reframeMode === 'blur-bg' || nextSettings.verticalMode === 'blur-bg') {
    changedSummary.push(
      `Framing: ${nextSettings.aspect} Blurred background fill (${nextSettings.foregroundSizePercent}% foreground)`
    );
  } else {
    changedSummary.push(`Framing: ${nextSettings.aspect} Smart follow`);
  }

  if (nextSettings.zoom.punchZoom > 1.01 || nextSettings.zoom.pulseOnPeaks || nextSettings.zoom.slowZoom) {
    const parts: string[] = [];
    if (nextSettings.zoom.punchZoom > 1.01) parts.push(`${nextSettings.zoom.punchZoom.toFixed(2)}× punch-in`);
    if (nextSettings.zoom.pulseOnPeaks) parts.push('pulse on loud peaks');
    if (nextSettings.zoom.slowZoom) parts.push('slow zoom in');
    changedSummary.push(`Zoom: ${parts.join(' + ')}`);
  } else {
    changedSummary.push('Zoom: Off (1.00×)');
  }

  if (nextCaptions.enabled) {
    changedSummary.push(`Captions: Enabled (${nextCaptions.preset}, ${nextCaptions.position})`);
  } else {
    changedSummary.push('Captions: Off');
  }

  if (nextTextOverlay.enabled && nextTextOverlay.text.trim()) {
    changedSummary.push(
      `Hook title overlay ON: "${nextTextOverlay.text}" (${nextTextOverlay.startTime}–${nextTextOverlay.endTime}s, editable)`
    );
  } else {
    changedSummary.push('Hook title overlay: Off');
  }

  return {
    nextSettings,
    nextCaptions,
    nextTextOverlay,
    changedSummary,
  };
}
