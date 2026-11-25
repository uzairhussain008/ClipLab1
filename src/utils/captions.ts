import { ASPECT_PRESETS, BUNDLED_FONTS } from '../config/appConfig';
import type {
  AspectRatioId,
  CaptionConfig,
  CaptionLine,
  CaptionStylePresetId,
  CaptionWord,
  OverlayFontId,
} from '../types/editor';
import { HYPE_POP_CYCLE_COLORS, STICKER_BOX_CYCLE_COLORS } from './captionStyleMix';
import { clampTime } from './timecode';
import { distributeSegmentWordsProportionally } from './whisperFallback';

export interface CaptionPresetMeta {
  preset: CaptionStylePresetId;
  font: OverlayFontId;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  outlineWidth: number;
  backgroundBox: boolean;
  uppercase: boolean;
  popIn: boolean;
  wordsPerLine?: number;
  position: 'top' | 'middle' | 'bottom';
  offsetPercent: number;
}

export const CAPTION_PRESET_DEFAULTS: Record<CaptionStylePresetId, CaptionPresetMeta> = {
  classic: {
    preset: 'classic',
    position: 'bottom',
    offsetPercent: 10,
    font: 'sans-bold',
    fontSize: 52,
    textColor: '#ffffff',
    highlightColor: '#ffffff',
    outlineWidth: 4,
    backgroundBox: false,
    uppercase: false,
    popIn: false,
  },
  'bold-pop': {
    preset: 'bold-pop',
    position: 'bottom',
    offsetPercent: 16,
    font: 'display-bold',
    fontSize: 64,
    textColor: '#ffffff',
    highlightColor: '#e59a24',
    outlineWidth: 5,
    backgroundBox: false,
    uppercase: true,
    popIn: true,
  },
  boxed: {
    preset: 'boxed',
    position: 'bottom',
    offsetPercent: 12,
    font: 'sans-bold',
    fontSize: 48,
    textColor: '#ffffff',
    highlightColor: '#e59a24',
    outlineWidth: 2,
    backgroundBox: true,
    uppercase: false,
    popIn: false,
  },
  minimal: {
    preset: 'minimal',
    position: 'bottom',
    offsetPercent: 10,
    font: 'sans-bold',
    fontSize: 40,
    textColor: '#eef2f6',
    highlightColor: '#eef2f6',
    outlineWidth: 2,
    backgroundBox: false,
    uppercase: false,
    popIn: false,
  },
  'hype-pop': {
    preset: 'hype-pop',
    position: 'bottom',
    offsetPercent: 18,
    font: 'montserrat-extrabold',
    fontSize: 74,
    textColor: '#ffffff',
    highlightColor: '#FFB800',
    outlineWidth: 7,
    backgroundBox: false,
    uppercase: true,
    popIn: true,
    wordsPerLine: 2,
  },
  'neon-glow': {
    preset: 'neon-glow',
    position: 'bottom',
    offsetPercent: 16,
    font: 'anton',
    fontSize: 66,
    textColor: '#E0FFFF',
    highlightColor: '#00E5FF',
    outlineWidth: 3,
    backgroundBox: false,
    uppercase: true,
    popIn: false,
  },
  'comic-burst': {
    preset: 'comic-burst',
    position: 'bottom',
    offsetPercent: 16,
    font: 'bangers',
    fontSize: 74,
    textColor: '#FFE600',
    highlightColor: '#FFFFFF',
    outlineWidth: 7,
    backgroundBox: false,
    uppercase: true,
    popIn: true,
  },
  'sticker-box': {
    preset: 'sticker-box',
    position: 'bottom',
    offsetPercent: 16,
    font: 'luckiest-guy',
    fontSize: 60,
    textColor: '#FFFFFF',
    highlightColor: '#111827',
    outlineWidth: 4,
    backgroundBox: true,
    uppercase: true,
    popIn: true,
  },
};

export function groupWordsIntoLines(
  words: CaptionWord[],
  wordsPerLine = 3,
  uppercase = false
): CaptionLine[] {
  const cleanWords = words
    .map((w) => ({
      text: (uppercase ? w.text.toUpperCase() : w.text).trim(),
      start: Math.max(0, w.start),
      end: Math.max(w.start + 0.08, w.end),
    }))
    .filter((w) => w.text.length > 0);

  if (cleanWords.length === 0) return [];

  const maxWords = Math.max(1, Math.min(5, Math.round(wordsPerLine)));
  const lines: CaptionLine[] = [];

  for (let i = 0; i < cleanWords.length; i += maxWords) {
    const chunk = cleanWords.slice(i, i + maxWords);
    lines.push({
      id: `cap-${lines.length + 1}-${Math.round(chunk[0].start * 100)}`,
      startTime: Number(chunk[0].start.toFixed(2)),
      endTime: Number(chunk[chunk.length - 1].end.toFixed(2)),
      text: chunk.map((w) => w.text).join(' '),
      words: chunk,
    });
  }

  return lines;
}

export function splitCaptionLine(line: CaptionLine): [CaptionLine, CaptionLine] | null {
  const words =
    line.words && line.words.length >= 2
      ? line.words
      : line.text
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((t, idx, arr) => {
            const span = Math.max(0.2, line.endTime - line.startTime);
            const step = span / arr.length;
            return {
              text: t,
              start: line.startTime + idx * step,
              end: line.startTime + (idx + 1) * step,
            };
          });

  if (words.length < 2) return null;
  const mid = Math.ceil(words.length / 2);
  const leftWords = words.slice(0, mid);
  const rightWords = words.slice(mid);

  const left: CaptionLine = {
    id: `${line.id}-a`,
    startTime: Number(leftWords[0].start.toFixed(2)),
    endTime: Number(leftWords[leftWords.length - 1].end.toFixed(2)),
    text: leftWords.map((w) => w.text).join(' '),
    words: leftWords,
    styleOverride: line.styleOverride,
  };
  const right: CaptionLine = {
    id: `${line.id}-b`,
    startTime: Number(rightWords[0].start.toFixed(2)),
    endTime: Number(rightWords[rightWords.length - 1].end.toFixed(2)),
    text: rightWords.map((w) => w.text).join(' '),
    words: rightWords,
    styleOverride: line.styleOverride,
  };
  return [left, right];
}

export function mergeCaptionLines(lines: CaptionLine[], index: number): CaptionLine[] {
  if (index < 0 || index >= lines.length - 1) return lines;
  const a = lines[index];
  const b = lines[index + 1];
  const mergedWords = a.words && b.words ? [...a.words, ...b.words] : undefined;
  const merged: CaptionLine = {
    id: a.id,
    startTime: Math.min(a.startTime, b.startTime),
    endTime: Math.max(a.endTime, b.endTime),
    text: `${a.text.trim()} ${b.text.trim()}`.trim(),
    words: mergedWords,
    styleOverride: a.styleOverride ?? b.styleOverride,
  };
  return [...lines.slice(0, index), merged, ...lines.slice(index + 2)];
}

/**
 * Normalizes any CaptionLine (manual, .srt, or Whisper) into timed word tokens.
 */
export function buildWordTimingList(line: CaptionLine, uppercase: boolean): CaptionWord[] {
  if (line.words && line.words.length > 0) {
    return line.words
      .map((w) => ({
        text: (uppercase ? w.text.toUpperCase() : w.text).trim(),
        start: Math.max(0, w.start),
        end: Math.max(w.start + 0.04, w.end),
      }))
      .filter((w) => w.text.length > 0);
  }

  const rawText = (uppercase ? line.text.toUpperCase() : line.text).trim();
  if (!rawText) return [];
  const start = Math.max(0, line.startTime);
  const span = Math.max(0.2, line.endTime - start);
  return distributeSegmentWordsProportionally(
    [{ text: rawText, start: 0, end: span }],
    start,
    span
  );
}

/**
 * Estimates safe maximum characters per visual line based on frame aspect ratio, font size, and safe-zone margin.
 * Shared identically between VideoPreview and FFmpeg ASS export so line wraps never diverge.
 */
export function getMaxCharsPerRow(
  fontSize: number,
  aspect: AspectRatioId = '9:16',
  showSafeZoneGuide = false
): number {
  const preset = ASPECT_PRESETS.find((p) => p.id === aspect) ?? ASPECT_PRESETS[0];
  const widthFactor = preset.width / 1080;
  const safeRatio = showSafeZoneGuide ? 0.78 : 0.86;
  const effectiveWidthPx = 1080 * widthFactor * safeRatio;
  const avgGlyphPx = Math.max(16, fontSize * 0.56);
  return Math.max(10, Math.min(44, Math.floor(effectiveWidthPx / avgGlyphPx)));
}

/**
 * Splits a CaptionLine's words into explicit wrapped visual rows honoring `wordsPerLine` (1..5)
 * AND safe-margin width budget so preview layers and ASS burn-in match with zero text overlap.
 */
export function layoutCaptionRows(params: {
  line: CaptionLine;
  wordsPerLine: number;
  uppercase: boolean;
  maxCharsPerRow?: number;
}): { rows: CaptionWord[][]; flatWords: CaptionWord[] } {
  const { line, wordsPerLine, uppercase, maxCharsPerRow = 26 } = params;
  const flatWords = buildWordTimingList(line, uppercase);
  if (flatWords.length === 0) {
    return { rows: [], flatWords: [] };
  }

  const maxWords = Math.max(1, Math.min(5, Math.round(wordsPerLine || 3)));
  const charLimit = Math.max(8, Math.round(maxCharsPerRow));
  const rows: CaptionWord[][] = [];
  let currentRow: CaptionWord[] = [];
  let currentChars = 0;

  for (const word of flatWords) {
    const wordLen = word.text.length;
    const projectedChars = currentRow.length === 0 ? wordLen : currentChars + 1 + wordLen;

    if (
      currentRow.length > 0 &&
      (currentRow.length >= maxWords || projectedChars > charLimit)
    ) {
      rows.push(currentRow);
      currentRow = [word];
      currentChars = wordLen;
    } else {
      currentRow.push(word);
      currentChars = projectedChars;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return { rows, flatWords };
}

function formatSubTimestamp(sec: number, sep: ',' | '.'): string {
  const safe = Math.max(0, sec);
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const h = Math.floor(totalS / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms).padStart(3, '0')}`;
}

function parseSubTimestamp(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  return 0;
}

export function exportSrt(lines: CaptionLine[]): string {
  return lines
    .map(
      (line, idx) =>
        `${idx + 1}\n${formatSubTimestamp(line.startTime, ',')} --> ${formatSubTimestamp(
          line.endTime,
          ','
        )}\n${line.text.trim()}`
    )
    .join('\n\n');
}

export function exportVtt(lines: CaptionLine[]): string {
  const body = lines
    .map(
      (line) =>
        `${formatSubTimestamp(line.startTime, '.')} --> ${formatSubTimestamp(
          line.endTime,
          '.'
        )}\n${line.text.trim()}`
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}`;
}

export function parseSrt(srtText: string): CaptionLine[] {
  const blocks = srtText.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  const lines: CaptionLine[] = [];

  for (const block of blocks) {
    const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length < 2) continue;
    const timingLineIdx = rawLines[0].includes('-->') ? 0 : 1;
    const timingLine = rawLines[timingLineIdx];
    if (!timingLine || !timingLine.includes('-->')) continue;
    const [rawStart, rawEnd] = timingLine.split('-->');
    const startTime = parseSubTimestamp(rawStart);
    const endTime = Math.max(startTime + 0.1, parseSubTimestamp(rawEnd));
    const text = rawLines.slice(timingLineIdx + 1).join(' ').trim();
    if (!text) continue;
    lines.push({
      id: `srt-${lines.length + 1}-${Math.round(startTime * 100)}`,
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(endTime.toFixed(2)),
      text,
    });
  }

  return lines;
}

export function hexToAssColor(hex: string, alphaHex = '00'): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return `&H${alphaHex}FFFFFF`;
  const r = clean.slice(0, 2).toUpperCase();
  const g = clean.slice(2, 4).toUpperCase();
  const b = clean.slice(4, 6).toUpperCase();
  return `&H${alphaHex}${b}${g}${r}`;
}

function formatAssTime(sec: number): string {
  const safe = Math.max(0, sec);
  const totalCs = Math.round(safe * 100);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const h = Math.floor(totalS / 3600);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N');
}

function getEffectiveStyleParams(presetId: CaptionStylePresetId, config: CaptionConfig) {
  const isSingleSelected = (config.styleMode ?? 'single') === 'single' && presetId === config.preset;
  const base = CAPTION_PRESET_DEFAULTS[presetId] ?? CAPTION_PRESET_DEFAULTS.classic;

  if (isSingleSelected) {
    return {
      preset: presetId,
      font: config.font,
      fontSize: config.fontSize,
      textColor: config.textColor,
      highlightColor: config.highlightColor,
      outlineWidth: config.outlineWidth,
      backgroundBox: config.backgroundBox,
      uppercase: config.uppercase,
      popIn: config.popIn,
    };
  }

  return {
    preset: presetId,
    font: base.font,
    fontSize: base.fontSize,
    textColor: base.textColor,
    highlightColor: base.highlightColor,
    outlineWidth: base.outlineWidth,
    backgroundBox: base.backgroundBox,
    uppercase: presetId === 'minimal' || presetId === 'classic' ? config.uppercase : base.uppercase,
    popIn: base.popIn,
  };
}

function assStyleNameForPreset(presetId: CaptionStylePresetId): string {
  switch (presetId) {
    case 'classic':
      return 'StyleClassic';
    case 'bold-pop':
      return 'StyleBoldPop';
    case 'boxed':
      return 'StyleBoxed';
    case 'minimal':
      return 'StyleMinimal';
    case 'hype-pop':
      return 'StyleHypePop';
    case 'neon-glow':
      return 'StyleNeonGlow';
    case 'comic-burst':
      return 'StyleComicBurst';
    case 'sticker-box':
      return 'StyleStickerBox';
  }
}

export function buildAssSubtitles(
  lines: CaptionLine[],
  config: CaptionConfig,
  clipStartTime: number,
  clipEndTime: number,
  speed: number,
  videoWidth: number,
  videoHeight: number,
  resolvedStyleMap?: Record<string, CaptionStylePresetId>
): string {
  const alignment = config.position === 'top' ? 8 : config.position === 'middle' ? 5 : 2;
  const marginV =
    config.position === 'middle'
      ? 0
      : Math.round((clampTime(config.offsetPercent, 2, 40) / 100) * videoHeight);
  const marginR = config.showSafeZoneGuide ? Math.round(videoWidth * 0.14) : Math.round(videoWidth * 0.06);
  const marginL = Math.round(videoWidth * 0.06);
  const aspectEstimate: AspectRatioId =
    videoWidth === videoHeight ? '1:1' : videoWidth > videoHeight ? '16:9' : '9:16';

  const usedPresets = new Set<CaptionStylePresetId>();
  usedPresets.add(config.preset);
  for (const line of lines) {
    const resolved =
      line.styleOverride ?? resolvedStyleMap?.[line.id] ?? config.preset;
    usedPresets.add(resolved);
  }

  const styleLines: string[] = [];
  for (const presetId of usedPresets) {
    const st = getEffectiveStyleParams(presetId, config);
    const fontMeta = BUNDLED_FONTS[st.font] ?? BUNDLED_FONTS['sans-bold'];
    const primaryAss = hexToAssColor(st.textColor, '00');
    const outlineAss =
      presetId === 'neon-glow'
        ? hexToAssColor('#00E5FF', '22')
        : presetId === 'sticker-box'
          ? hexToAssColor(STICKER_BOX_CYCLE_COLORS[0], '00')
          : hexToAssColor('#000000', '00');
    const backAss =
      presetId === 'sticker-box'
        ? hexToAssColor('#000000', '00')
        : st.backgroundBox
          ? '&H78000000'
          : '&H00000000';
    const borderStyle = presetId === 'sticker-box' || st.backgroundBox ? 3 : 1;
    const borderSize = presetId === 'sticker-box' ? Math.max(8, st.outlineWidth * 2) : st.outlineWidth;
    const shadow =
      presetId === 'comic-burst'
        ? 5
        : presetId === 'hype-pop'
          ? 2
          : presetId === 'minimal'
            ? 2
            : 1;

    styleLines.push(
      `Style: ${assStyleNameForPreset(presetId)},${fontMeta.assFamily},${Math.round(st.fontSize)},${primaryAss},${primaryAss},${outlineAss},${backAss},-1,0,0,0,100,100,0,0,${borderStyle},${borderSize},${shadow},${alignment},${marginL},${marginR},${marginV},1`
    );

    if (presetId === 'neon-glow') {
      const glowColor = hexToAssColor('#00E5FF', '55');
      styleLines.push(
        `Style: StyleNeonGlowBack,${fontMeta.assFamily},${Math.round(st.fontSize)},${glowColor},${glowColor},${glowColor},&H00000000,-1,0,0,0,100,100,0,0,1,${Math.max(4, st.outlineWidth + 2)},0,${alignment},${marginL},${marginR},${marginV},1`
      );
    }
  }

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLines.join('\n')}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events: string[] = [];
  const safeSpeed = Math.max(0.5, speed);

  lines.forEach((line, lineIdx) => {
    if (line.endTime <= clipStartTime || line.startTime >= clipEndTime) return;
    const clippedStart = Math.max(line.startTime, clipStartTime);
    const clippedEnd = Math.min(line.endTime, clipEndTime);
    if (clippedEnd - clippedStart < 0.08) return;

    const presetId = line.styleOverride ?? resolvedStyleMap?.[line.id] ?? config.preset;
    const st = getEffectiveStyleParams(presetId, config);
    const styleName = assStyleNameForPreset(presetId);
    const relStart = (clippedStart - clipStartTime) / safeSpeed;
    const relEnd = (clippedEnd - clipStartTime) / safeSpeed;

    const maxCharsPerRow = getMaxCharsPerRow(st.fontSize, aspectEstimate, config.showSafeZoneGuide);
    const { rows, flatWords } = layoutCaptionRows({
      line,
      wordsPerLine: config.wordsPerLine,
      uppercase: st.uppercase,
      maxCharsPerRow,
    });
    if (rows.length === 0) return;

    const primaryAss = hexToAssColor(st.textColor, '00');
    const highlightAss = hexToAssColor(st.highlightColor, '00');

    // Sticker Box emits timed color-changing solid box intervals per active word
    if (presetId === 'sticker-box') {
      const boxWordSlices = flatWords.length > 0 ? flatWords : [{ text: line.text, start: clippedStart, end: clippedEnd }];
      boxWordSlices.forEach((activeW, activeWordIdx) => {
        const sliceStart = Math.max(clippedStart, activeW.start);
        const sliceEnd =
          activeWordIdx === boxWordSlices.length - 1
            ? clippedEnd
            : Math.min(clippedEnd, Math.max(sliceStart + 0.06, boxWordSlices[activeWordIdx + 1].start));
        if (sliceEnd - sliceStart < 0.04) return;

        const rStart = (sliceStart - clipStartTime) / safeSpeed;
        const rEnd = (sliceEnd - clipStartTime) / safeSpeed;
        const stickerColor = STICKER_BOX_CYCLE_COLORS[(lineIdx + activeWordIdx) % STICKER_BOX_CYCLE_COLORS.length];
        const boxAss = hexToAssColor(stickerColor, '00');
        const activeTxtAss = hexToAssColor('#0E1217', '00');
        const normalTxtAss = hexToAssColor('#FFFFFF', '00');
        const popTag = activeWordIdx === 0 && st.popIn ? '\\fscx88\\fscy88\\t(0,95,\\fscx100\\fscy100)' : '';

        let globalIdx = 0;
        const formattedRows = rows.map((row) =>
          row
            .map((w) => {
              const isCur = globalIdx === activeWordIdx;
              globalIdx++;
              const txt = escapeAssText(w.text);
              return `{\\1c${isCur ? activeTxtAss : normalTxtAss}}${txt}`;
            })
            .join(' ')
        );

        events.push(
          `Dialogue: 0,${formatAssTime(rStart)},${formatAssTime(rEnd)},${styleName},,0,0,0,,{\\3c${boxAss}${popTag}}${formattedRows.join('\\N')}`
        );
      });
      return;
    }

    // Neon Glow emits blurred cyan halo backing on Layer 0 + sharp bright foreground on Layer 1
    if (presetId === 'neon-glow') {
      const backRows = rows
        .map((row) => row.map((w) => escapeAssText(w.text)).join(' '))
        .join('\\N');
      events.push(
        `Dialogue: 0,${formatAssTime(relStart)},${formatAssTime(relEnd)},StyleNeonGlowBack,,0,0,0,,{\\blur6\\be2}${backRows}`
      );

      let wCounter = 0;
      const fgRows = rows
        .map((row) =>
          row
            .map((w) => {
              const msStart = Math.max(0, Math.round(((w.start - clippedStart) / safeSpeed) * 1000));
              const msEnd = Math.max(msStart + 40, Math.round(((w.end - clippedStart) / safeSpeed) * 1000));
              const wText = escapeAssText(w.text);
              wCounter++;
              return `{\\1c${primaryAss}\\3c&HFFFF00&\\blur1\\t(${msStart},${msStart + 1},\\1c&HFFFFFF&\\3c&HFFFFFF&\\blur3)\\t(${msEnd},${msEnd + 1},\\1c${primaryAss}\\3c&HFFFF00&\\blur1)}${wText}`;
            })
            .join(' ')
        )
        .join('\\N');

      if (wCounter > 0) {
        events.push(
          `Dialogue: 1,${formatAssTime(relStart)},${formatAssTime(relEnd)},${styleName},,0,0,0,,${fgRows}`
        );
      }
      return;
    }

    // Hype Pop: overshoot scale + amber/cyan/magenta color cycle + subtle line tilt
    if (presetId === 'hype-pop') {
      const tilts = [-2.5, 2.2, -1.8, 2.5];
      const tilt = tilts[lineIdx % tilts.length];
      let wIdx = 0;
      const hypeRows = rows
        .map((row) =>
          row
            .map((w) => {
              const cycleHex = HYPE_POP_CYCLE_COLORS[(lineIdx + wIdx) % HYPE_POP_CYCLE_COLORS.length];
              const cycleAss = hexToAssColor(cycleHex, '00');
              const msStart = Math.max(0, Math.round(((w.start - clippedStart) / safeSpeed) * 1000));
              const msMid = msStart + 70;
              const msSettle = msStart + 145;
              const msEnd = Math.max(msSettle + 30, Math.round(((w.end - clippedStart) / safeSpeed) * 1000));
              wIdx++;
              return `{\\1c${primaryAss}\\fscx100\\fscy100\\t(${msStart},${msMid},\\1c${cycleAss}\\fscx124\\fscy124)\\t(${msMid},${msSettle},\\fscx112\\fscy112)\\t(${msEnd},${msEnd + 60},\\1c${primaryAss}\\fscx100\\fscy100)}${escapeAssText(w.text)}`;
            })
            .join(' ')
        )
        .join('\\N');

      events.push(
        `Dialogue: 0,${formatAssTime(relStart)},${formatAssTime(relEnd)},${styleName},,0,0,0,,{\\frz${tilt}}${hypeRows}`
      );
      return;
    }

    // Comic Burst: yellow text, heavy black outline/shadow, slight tilt, word scale pop
    if (presetId === 'comic-burst') {
      const comicRows = rows
        .map((row) =>
          row
            .map((w) => {
              const msStart = Math.max(0, Math.round(((w.start - clippedStart) / safeSpeed) * 1000));
              const msPeak = msStart + 65;
              const msEnd = Math.max(msPeak + 35, Math.round(((w.end - clippedStart) / safeSpeed) * 1000));
              return `{\\1c${primaryAss}\\fscx100\\fscy100\\t(${msStart},${msPeak},\\1c${highlightAss}\\fscx120\\fscy120)\\t(${msEnd},${msEnd + 55},\\1c${primaryAss}\\fscx100\\fscy100)}${escapeAssText(w.text)}`;
            })
            .join(' ')
        )
        .join('\\N');

      events.push(
        `Dialogue: 0,${formatAssTime(relStart)},${formatAssTime(relEnd)},${styleName},,0,0,0,,{\\frz-2.5}${comicRows}`
      );
      return;
    }

    // Standard styles (Classic, Bold Pop, Boxed, Minimal) using identical wrapped layoutCaptionRows breaks
    const popPrefix = st.popIn
      ? '{\\fscx86\\fscy86\\t(0,110,\\fscx100\\fscy100)}'
      : '';
    const useWordHighlight =
      st.highlightColor.toLowerCase() !== st.textColor.toLowerCase() &&
      flatWords.length > 0;

    const standardBody = rows
      .map((row) =>
        row
          .map((w) => {
            const wText = escapeAssText(w.text);
            if (!useWordHighlight) return wText;
            const msStart = Math.max(0, Math.round(((w.start - clippedStart) / safeSpeed) * 1000));
            const msEnd = Math.max(msStart + 40, Math.round(((w.end - clippedStart) / safeSpeed) * 1000));
            return `{\\c${primaryAss}\\t(${msStart},${msStart + 1},\\c${highlightAss})\\t(${msEnd},${msEnd + 1},\\c${primaryAss})}${wText}`;
          })
          .join(' ')
      )
      .join('\\N');

    events.push(
      `Dialogue: 0,${formatAssTime(relStart)},${formatAssTime(relEnd)},${styleName},,0,0,0,,${popPrefix}${standardBody}`
    );
  });

  return `${header}\n${events.join('\n')}\n`;
}
