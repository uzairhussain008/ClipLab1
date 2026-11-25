import type {
  ActivitySample,
  AutoMixIntensity,
  CaptionConfig,
  CaptionInputMode,
  CaptionLine,
  CaptionStylePresetId,
} from '../types/editor';

export const AUTO_MIX_SIMPLE_STYLES: readonly CaptionStylePresetId[] = ['classic', 'minimal'];
export const AUTO_MIX_FUNKY_STYLES: readonly CaptionStylePresetId[] = [
  'hype-pop',
  'neon-glow',
  'comic-burst',
];

export const HYPE_POP_CYCLE_COLORS = ['#FFB800', '#00E5FF', '#FF2E93'] as const;
export const STICKER_BOX_CYCLE_COLORS = ['#E59A24', '#00B4D8', '#E11D8B', '#16A34A'] as const;

export const AUTO_MIX_INTENSITY_THRESHOLDS: Record<AutoMixIntensity, number> = {
  calm: 0.62,
  balanced: 0.36,
  hype: 0.16,
};

export const CAPTION_STYLE_LABELS: Record<CaptionStylePresetId, string> = {
  classic: 'Classic',
  'bold-pop': 'Bold Pop',
  boxed: 'Boxed',
  minimal: 'Minimal',
  'hype-pop': 'Hype Pop',
  'neon-glow': 'Neon Glow',
  'comic-burst': 'Comic Burst',
  'sticker-box': 'Sticker Box',
};

export function getAvailableCaptionInputModes(enableAutoCaptions: boolean): CaptionInputMode[] {
  return enableAutoCaptions ? ['auto', 'manual', 'import'] : ['manual', 'import'];
}

export interface LineEnergyEvaluation {
  energyScore: number;
  normalizedLoudness: number;
  hasExclamation: boolean;
  hasAllCapsWord: boolean;
  isShortPunchy: boolean;
  wordCount: number;
  matchedKeywords: string[];
  reasons: string[];
}

export interface AutoMixDecision {
  lineId: string;
  pickedPreset: CaptionStylePresetId;
  resolvedPreset: CaptionStylePresetId;
  isOverridden: boolean;
  isEnergetic: boolean;
  energy: LineEnergyEvaluation;
}

export function getMaxAudioRms(samples?: ActivitySample[]): number {
  if (!samples || samples.length === 0) return 0;
  let max = 0;
  for (const s of samples) {
    if (s.audioRms > max) max = s.audioRms;
  }
  return max;
}

export function evaluateLineEnergy(params: {
  line: Pick<CaptionLine, 'text' | 'startTime' | 'endTime'>;
  audioSamples?: ActivitySample[];
  maxVideoRms?: number;
  keywords?: readonly string[];
  globalUppercaseForced?: boolean;
}): LineEnergyEvaluation {
  const {
    line,
    audioSamples,
    maxVideoRms = getMaxAudioRms(audioSamples),
    keywords = [],
    globalUppercaseForced = false,
  } = params;

  const trimmed = (line.text || '').trim();
  const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const wordCount = tokens.length;
  const isShortPunchy = wordCount >= 1 && wordCount <= 3;

  const hasExclamation = /!+/.test(trimmed);
  const hasDoubleExclamation = /[!?]{2,}/.test(trimmed);

  // Check ALL-CAPS alphabetic words (len >= 2) only when global uppercase is not forcing every line to uppercase
  const hasAllCapsWord =
    !globalUppercaseForced &&
    tokens.some((tok) => {
      const letters = tok.replace(/[^a-zA-Z]/g, '');
      return letters.length >= 2 && letters === letters.toUpperCase();
    });

  const lower = trimmed.toLowerCase();
  const matchedKeywords = keywords
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .filter((kw) => lower.includes(kw));

  // Reuse Smart Moments 8 kHz RMS windows overlapping this caption line
  let normalizedLoudness = 0;
  if (audioSamples && audioSamples.length > 0 && maxVideoRms > 0.002) {
    let peakLineRms = 0;
    for (const s of audioSamples) {
      if (s.time >= line.startTime - 0.3 && s.time <= line.endTime + 0.3) {
        if (s.audioRms > peakLineRms) peakLineRms = s.audioRms;
      }
    }
    normalizedLoudness = Math.min(1, peakLineRms / maxVideoRms);
  }

  let score = 0;
  const reasons: string[] = [];

  if (normalizedLoudness >= 0.45) {
    const loudPoints = Math.min(0.42, (normalizedLoudness - 0.25) * 0.56);
    score += loudPoints;
    if (normalizedLoudness >= 0.68) reasons.push('loud peak');
  }

  if (hasExclamation) {
    score += hasDoubleExclamation ? 0.34 : 0.28;
    reasons.push('exclamation');
  }

  if (hasAllCapsWord) {
    score += 0.22;
    reasons.push('ALL-CAPS');
  }

  if (isShortPunchy) {
    score += 0.18;
    reasons.push('<=3 words');
  }

  if (matchedKeywords.length > 0) {
    score += Math.min(0.4, 0.32 + (matchedKeywords.length - 1) * 0.08);
    reasons.push(`keyword: ${matchedKeywords[0]}`);
  }

  return {
    energyScore: Math.min(1, Number(score.toFixed(4))),
    normalizedLoudness: Number(normalizedLoudness.toFixed(3)),
    hasExclamation,
    hasAllCapsWord,
    isShortPunchy,
    wordCount,
    matchedKeywords,
    reasons,
  };
}

export function pickDeterministicAutoStyle(params: {
  line: CaptionLine;
  lineIndex: number;
  intensity: AutoMixIntensity;
  audioSamples?: ActivitySample[];
  maxVideoRms?: number;
  keywords?: readonly string[];
  globalUppercaseForced?: boolean;
}): AutoMixDecision {
  const {
    line,
    lineIndex,
    intensity,
    audioSamples,
    maxVideoRms,
    keywords,
    globalUppercaseForced,
  } = params;

  const energy = evaluateLineEnergy({
    line,
    audioSamples,
    maxVideoRms,
    keywords,
    globalUppercaseForced,
  });

  const threshold = AUTO_MIX_INTENSITY_THRESHOLDS[intensity] ?? AUTO_MIX_INTENSITY_THRESHOLDS.balanced;
  const isEnergetic = energy.energyScore >= threshold;

  let pickedPreset: CaptionStylePresetId;
  if (!isEnergetic) {
    pickedPreset =
      lineIndex % 3 === 2 && energy.wordCount >= 4 ? 'minimal' : 'classic';
  } else if (energy.hasExclamation && (energy.hasAllCapsWord || energy.isShortPunchy)) {
    pickedPreset = lineIndex % 3 === 0 ? 'comic-burst' : lineIndex % 3 === 1 ? 'hype-pop' : 'neon-glow';
  } else if (energy.normalizedLoudness >= 0.72 || energy.matchedKeywords.length > 0) {
    pickedPreset = lineIndex % 2 === 0 ? 'hype-pop' : 'neon-glow';
  } else {
    pickedPreset = AUTO_MIX_FUNKY_STYLES[Math.abs(lineIndex) % AUTO_MIX_FUNKY_STYLES.length];
  }

  const isOverridden = Boolean(line.styleOverride);
  const resolvedPreset = line.styleOverride ?? pickedPreset;

  return {
    lineId: line.id,
    pickedPreset,
    resolvedPreset,
    isOverridden,
    isEnergetic,
    energy,
  };
}

export function resolveCaptionMixDecisions(params: {
  lines: CaptionLine[];
  config: Pick<CaptionConfig, 'preset' | 'styleMode' | 'autoMixIntensity' | 'uppercase'>;
  audioSamples?: ActivitySample[];
  keywords?: readonly string[];
}): Record<string, AutoMixDecision> {
  const { lines, config, audioSamples, keywords } = params;
  const maxVideoRms = getMaxAudioRms(audioSamples);
  const intensity = config.autoMixIntensity ?? 'balanced';
  const styleMode = config.styleMode ?? 'single';
  const map: Record<string, AutoMixDecision> = {};

  lines.forEach((line, idx) => {
    const baseDecision = pickDeterministicAutoStyle({
      line,
      lineIndex: idx,
      intensity,
      audioSamples,
      maxVideoRms,
      keywords,
      globalUppercaseForced: config.uppercase,
    });

    if (styleMode === 'auto-mix') {
      map[line.id] = baseDecision;
    } else {
      const effective = line.styleOverride ?? config.preset;
      map[line.id] = {
        ...baseDecision,
        pickedPreset: config.preset,
        resolvedPreset: effective,
        isOverridden: Boolean(line.styleOverride),
      };
    }
  });

  return map;
}
