import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFfmpegArgs, getProcessingMode, escapeDrawtext } from './ffmpegArgs';
import type { ExportSettings, LogoOverlayConfig, TextOverlayConfig, ClipSegment } from '../types/editor';

const baseSegment: ClipSegment = {
  id: 'seg-1',
  name: 'Opening Clutch',
  startTime: 2,
  endTime: 10,
};

const baseSettings: ExportSettings = {
  aspect: '16:9',
  keepOriginalFraming: true,
  verticalMode: 'fill-crop',
  reframeMode: 'manual',
  lockPosition: false,
  ignoreHudEdges: true,
  foregroundSizePercent: 100,
  cropX: 0.5,
  cropY: 0.5,
  zoom: { punchZoom: 1, slowZoom: false, pulseOnPeaks: false },
  splitLayout: {
    gameplayRatioPercent: 65,
    backgroundMode: 'fill',
    gameplayBox: { x: 0.05, y: 0.05, w: 0.9, h: 0.75 },
    facecamBox: { x: 0.7, y: 0.65, w: 0.25, h: 0.3 },
  },
  speed: 1,
  muted: false,
  volume: 1,
  quality: 'balanced',
  format: 'mp4',
};

const disabledText: TextOverlayConfig = {
  enabled: false,
  text: '',
  position: 'bottom',
  font: 'sans-bold',
  fontSize: 48,
  color: '#ffffff',
  outlineColor: '#000000',
  outlineWidth: 3,
  startTime: 2,
  endTime: 10,
};

const disabledLogo: LogoOverlayConfig = {
  enabled: false,
  fileName: '',
  dataUrl: '',
  corner: 'top-right',
  sizePercent: 18,
  opacity: 0.85,
};

test('uses fast-copy (-c copy) when no crop, text, logo, captions, zoom, speed, or audio edits are applied', () => {
  const mode = getProcessingMode(baseSettings, disabledText, disabledLogo);
  assert.equal(mode, 'fast-copy');

  const result = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: baseSegment,
    settings: baseSettings,
    textOverlay: disabledText,
    logoOverlay: disabledLogo,
  });

  assert.equal(result.mode, 'fast-copy');
  assert.ok(result.args.includes('-c'));
  assert.ok(result.args.includes('copy'));
  assert.equal(result.args.includes('libx264'), false);
});

test('uses re-encode with boxblur split graph and foreground size for 9:16 blurred background mode', () => {
  const settings: ExportSettings = {
    ...baseSettings,
    aspect: '9:16',
    keepOriginalFraming: false,
    verticalMode: 'blur-bg',
    reframeMode: 'blur-bg',
    foregroundSizePercent: 120,
    quality: 'shorts',
  };
  const result = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: baseSegment,
    settings,
    textOverlay: disabledText,
    logoOverlay: disabledLogo,
  });

  assert.equal(result.mode, 're-encode');
  const filterIdx = result.args.indexOf('-filter_complex');
  assert.ok(filterIdx !== -1);
  const graph = result.args[filterIdx + 1];
  assert.match(graph, /split=2\[bg\]\[fg\]/);
  assert.match(graph, /boxblur=20:2/);
  assert.match(graph, /scale=1296:-2/);
  assert.ok(result.args.includes('libx264'));
});

test('builds smart-follow piecewise crop, zoompan, and ass caption filter in one pass', () => {
  const settings: ExportSettings = {
    ...baseSettings,
    aspect: '9:16',
    keepOriginalFraming: false,
    verticalMode: 'fill-crop',
    reframeMode: 'smart-follow',
    zoom: { punchZoom: 1.15, slowZoom: true, pulseOnPeaks: true },
  };
  const result = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: baseSegment,
    settings,
    textOverlay: disabledText,
    logoOverlay: disabledLogo,
    cropPath: [
      { time: 2, cropX: 0.3, cropY: 0.5 },
      { time: 4, cropX: 0.7, cropY: 0.5 },
    ],
    peakTimes: [5.5],
    captions: {
      config: {
        enabled: true,
        preset: 'bold-pop',
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
      },
      lines: [{ id: '1', startTime: 3, endTime: 6, text: 'LOOK AT THIS' }],
      assVirtualPath: 'captions.ass',
    },
  });

  const graph = result.args[result.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /if\(lt\(t,/);
  assert.match(graph, /zoompan=/);
  assert.match(graph, /ass=filename='captions\.ass':fontsdir='\/fonts'/);
});

test('builds split-layout gameplay + facecam vstack graph', () => {
  const settings: ExportSettings = {
    ...baseSettings,
    aspect: '9:16',
    keepOriginalFraming: false,
    reframeMode: 'split-layout',
  };
  const result = buildFfmpegArgs({
    inputFileName: 'input.mp4',
    outputFileName: 'out.mp4',
    segment: baseSegment,
    settings,
    textOverlay: disabledText,
    logoOverlay: disabledLogo,
  });
  const graph = result.args[result.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /vstack=inputs=2/);
});

test('escapeDrawtext escapes colons, quotes, and percent signs', () => {
  assert.equal(escapeDrawtext("50% win: Let's go"), "50\\% win\\: Let\\'s go");
});
