import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAssSubtitles,
  CAPTION_PRESET_DEFAULTS,
  exportSrt,
  exportVtt,
  getMaxCharsPerRow,
  groupWordsIntoLines,
  layoutCaptionRows,
  mergeCaptionLines,
  parseSrt,
  splitCaptionLine,
} from './captions';
import type { CaptionConfig, CaptionLine, CaptionStylePresetId } from '../types/editor';

const sampleConfig: CaptionConfig = {
  enabled: true,
  preset: 'bold-pop',
  styleMode: 'single',
  autoMixIntensity: 'balanced',
  position: 'bottom',
  offsetPercent: 16,
  font: 'display-bold',
  fontSize: 64,
  textColor: '#ffffff',
  highlightColor: '#e59a24',
  outlineWidth: 5,
  backgroundBox: false,
  wordsPerLine: 3,
  uppercase: true,
  popIn: true,
  showSafeZoneGuide: true,
};

test('groupWordsIntoLines respects wordsPerLine and uppercase', () => {
  const words = [
    { text: 'watch', start: 0.2, end: 0.5 },
    { text: 'this', start: 0.5, end: 0.7 },
    { text: 'final', start: 0.7, end: 1.0 },
    { text: 'shot', start: 1.0, end: 1.4 },
  ];
  const lines = groupWordsIntoLines(words, 2, true);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, 'WATCH THIS');
  assert.equal(lines[1].text, 'FINAL SHOT');
});

test('layoutCaptionRows wraps long words cleanly inside safe character budget without dropping words', () => {
  const line: CaptionLine = {
    id: 'wrap-1',
    startTime: 0,
    endTime: 3,
    text: 'Supercalifragilistic shot across the entire dusty valley now',
  };
  const maxChars = getMaxCharsPerRow(74, '9:16', true);
  const { rows, flatWords } = layoutCaptionRows({
    line,
    wordsPerLine: 3,
    uppercase: true,
    maxCharsPerRow: maxChars,
  });

  assert.ok(rows.length >= 3);
  for (const row of rows) {
    assert.ok(row.length <= 3, `Row exceeded wordsPerLine limit: ${row.length}`);
  }
  const flattenedFromRows = rows.flat().map((w) => w.text);
  assert.deepEqual(
    flattenedFromRows,
    flatWords.map((w) => w.text)
  );
  assert.equal(flattenedFromRows.length, 8);
});

test('splitCaptionLine and mergeCaptionLines preserve timing and text', () => {
  const words = [
    { text: 'one', start: 0, end: 0.5 },
    { text: 'two', start: 0.5, end: 1.0 },
    { text: 'three', start: 1.0, end: 1.5 },
    { text: 'four', start: 1.5, end: 2.0 },
  ];
  const [line] = groupWordsIntoLines(words, 4, false);
  const split = splitCaptionLine(line);
  assert.ok(split);
  assert.equal(split[0].text, 'one two');
  assert.equal(split[1].text, 'three four');

  const merged = mergeCaptionLines([split[0], split[1]], 0);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, 'one two three four');
});

test('SRT and VTT round-trip accurately', () => {
  const lines = [
    { id: '1', startTime: 1.2, endTime: 3.4, text: 'First line' },
    { id: '2', startTime: 4.0, endTime: 5.5, text: 'Second line' },
  ];
  const srt = exportSrt(lines);
  const parsed = parseSrt(srt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'First line');
  assert.ok(Math.abs(parsed[0].startTime - 1.2) < 0.02);

  const vtt = exportVtt(lines);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:01\.200 --> 00:00:03\.400/);
});

test('buildAssSubtitles generates valid ASS styles, fonts, and word highlight tags', () => {
  const words = [
    { text: 'clean', start: 1.0, end: 1.4 },
    { text: 'clutch', start: 1.4, end: 1.9 },
  ];
  const lines = groupWordsIntoLines(words, 3, true);
  const ass = buildAssSubtitles(lines, sampleConfig, 0, 5, 1, 1080, 1920);
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /DejaVu Sans/);
  assert.match(ass, /\\fscx86\\fscy86/);
  assert.match(ass, /\\c&H00249AE5/); // #e59a24 -> BGR 249AE5
});

test('buildAssSubtitles emits distinct ASS tags for hype-pop, neon-glow, comic-burst, and sticker-box', () => {
  const lines: CaptionLine[] = [
    {
      id: 'l1',
      startTime: 0.2,
      endTime: 2.2,
      text: 'NO WAY CLUTCH BRO',
    },
  ];

  const hypeCfg: CaptionConfig = {
    ...sampleConfig,
    ...CAPTION_PRESET_DEFAULTS['hype-pop'],
    styleMode: 'single',
  };
  const hypeAss = buildAssSubtitles(lines, hypeCfg, 0, 5, 1, 1080, 1920);
  assert.match(hypeAss, /Style: StyleHypePop,Montserrat ExtraBold/);
  assert.match(hypeAss, /\\fscx124\\fscy124/);
  assert.match(hypeAss, /\\frz-2\.5/);
  assert.match(hypeAss, /\\N/);

  const neonCfg: CaptionConfig = {
    ...sampleConfig,
    ...CAPTION_PRESET_DEFAULTS['neon-glow'],
    styleMode: 'single',
  };
  const neonAss = buildAssSubtitles(lines, neonCfg, 0, 5, 1, 1080, 1920);
  assert.match(neonAss, /Style: StyleNeonGlow,Anton/);
  assert.match(neonAss, /Style: StyleNeonGlowBack,Anton/);
  assert.match(neonAss, /\\blur6\\be2/);

  const comicCfg: CaptionConfig = {
    ...sampleConfig,
    ...CAPTION_PRESET_DEFAULTS['comic-burst'],
    styleMode: 'single',
  };
  const comicAss = buildAssSubtitles(lines, comicCfg, 0, 5, 1, 1080, 1920);
  assert.match(comicAss, /Style: StyleComicBurst,Bangers/);
  assert.match(comicAss, /\\fscx120\\fscy120/);

  const stickerCfg: CaptionConfig = {
    ...sampleConfig,
    ...CAPTION_PRESET_DEFAULTS['sticker-box'],
    styleMode: 'single',
  };
  const stickerAss = buildAssSubtitles(lines, stickerCfg, 0, 5, 1, 1080, 1920);
  assert.match(stickerAss, /Style: StyleStickerBox,Luckiest Guy/);
  assert.match(stickerAss, /\\3c&H00/); // per-word box background cycling
});

test('buildAssSubtitles supports single-pass mixed per-line styles (Auto mix + override)', () => {
  const lines: CaptionLine[] = [
    { id: 'c1', startTime: 0.2, endTime: 1.5, text: 'Setting up the round carefully.' },
    { id: 'c2', startTime: 1.6, endTime: 2.8, text: 'WAIT WHAT?!' },
    { id: 'c3', startTime: 2.9, endTime: 4.0, text: 'FINAL BOSS DOWN', styleOverride: 'comic-burst' },
  ];
  const resolvedStyleMap: Record<string, CaptionStylePresetId> = {
    c1: 'classic',
    c2: 'neon-glow',
    c3: 'comic-burst',
  };
  const ass = buildAssSubtitles(
    lines,
    { ...sampleConfig, preset: 'classic', styleMode: 'auto-mix', uppercase: false },
    0,
    5,
    1,
    1080,
    1920,
    resolvedStyleMap
  );

  assert.match(ass, /Style: StyleClassic,Liberation Sans/);
  assert.match(ass, /Style: StyleNeonGlow,Anton/);
  assert.match(ass, /Style: StyleComicBurst,Bangers/);
  assert.match(ass, /Dialogue: 0,.*,StyleClassic,/);
  assert.match(ass, /Dialogue: 1,.*,StyleNeonGlow,/);
  assert.match(ass, /Dialogue: 0,.*,StyleComicBurst,/);
});
