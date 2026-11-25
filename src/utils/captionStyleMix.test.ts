import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_MIX_FUNKY_STYLES,
  AUTO_MIX_SIMPLE_STYLES,
  evaluateLineEnergy,
  getAvailableCaptionInputModes,
  pickDeterministicAutoStyle,
  resolveCaptionMixDecisions,
} from './captionStyleMix';
import type { ActivitySample, CaptionConfig, CaptionLine } from '../types/editor';

const samples: ActivitySample[] = [
  { time: 0.5, audioRms: 0.04, motion: 0.05, sceneChange: 0, score: 0.05, focusX: 0.5, focusY: 0.5 },
  { time: 1.5, audioRms: 0.05, motion: 0.06, sceneChange: 0, score: 0.06, focusX: 0.5, focusY: 0.5 },
  { time: 3.5, audioRms: 0.42, motion: 0.4, sceneChange: 0.5, score: 0.85, focusX: 0.5, focusY: 0.5 },
];

const calmLine: CaptionLine = {
  id: 'line-1',
  startTime: 0.2,
  endTime: 1.8,
  text: 'Walking around the corner slowly toward mid site.',
};

const hypeLine: CaptionLine = {
  id: 'line-2',
  startTime: 3.0,
  endTime: 4.2,
  text: 'NO WAY CLUTCH!',
};

test('getAvailableCaptionInputModes returns 3-way selector when enabled and 2-way kill switch when false', () => {
  assert.deepEqual(getAvailableCaptionInputModes(true), ['auto', 'manual', 'import']);
  assert.deepEqual(getAvailableCaptionInputModes(false), ['manual', 'import']);
});

test('evaluateLineEnergy scores audio spikes, exclamations, ALL-CAPS, short punchy lines, and keywords', () => {
  const calmEnergy = evaluateLineEnergy({
    line: calmLine,
    audioSamples: samples,
    keywords: ['clutch', 'no way'],
  });
  const hypeEnergy = evaluateLineEnergy({
    line: hypeLine,
    audioSamples: samples,
    keywords: ['clutch', 'no way'],
  });

  assert.ok(hypeEnergy.energyScore > calmEnergy.energyScore);
  assert.equal(hypeEnergy.hasExclamation, true);
  assert.equal(hypeEnergy.hasAllCapsWord, true);
  assert.equal(hypeEnergy.isShortPunchy, true);
  assert.ok(hypeEnergy.matchedKeywords.includes('clutch'));
  assert.ok(hypeEnergy.normalizedLoudness > 0.8);

  const forcedUpper = evaluateLineEnergy({
    line: { startTime: 0.2, endTime: 1.8, text: 'WALKING SLOWLY AROUND MID SITE' },
    audioSamples: samples,
    globalUppercaseForced: true,
  });
  assert.equal(forcedUpper.hasAllCapsWord, false);
});

test('pickDeterministicAutoStyle chooses simple styles for calm lines and funky styles for energetic lines deterministically', () => {
  const calmDecision = pickDeterministicAutoStyle({
    line: calmLine,
    lineIndex: 0,
    intensity: 'balanced',
    audioSamples: samples,
    keywords: ['clutch'],
  });
  assert.equal(calmDecision.isEnergetic, false);
  assert.ok(AUTO_MIX_SIMPLE_STYLES.includes(calmDecision.pickedPreset));

  const hypeDecisionA = pickDeterministicAutoStyle({
    line: hypeLine,
    lineIndex: 1,
    intensity: 'balanced',
    audioSamples: samples,
    keywords: ['clutch'],
  });
  const hypeDecisionB = pickDeterministicAutoStyle({
    line: hypeLine,
    lineIndex: 1,
    intensity: 'balanced',
    audioSamples: samples,
    keywords: ['clutch'],
  });

  assert.equal(hypeDecisionA.isEnergetic, true);
  assert.ok(AUTO_MIX_FUNKY_STYLES.includes(hypeDecisionA.pickedPreset));
  assert.equal(hypeDecisionA.pickedPreset, hypeDecisionB.pickedPreset);
});

test('Auto mix intensity thresholds (calm / balanced / hype) modulate funky selection', () => {
  const borderLine: CaptionLine = {
    id: 'border',
    startTime: 1.0,
    endTime: 1.9,
    text: 'Look out!',
  };

  const underCalm = pickDeterministicAutoStyle({
    line: borderLine,
    lineIndex: 0,
    intensity: 'calm',
    audioSamples: samples,
  });
  const underBalanced = pickDeterministicAutoStyle({
    line: borderLine,
    lineIndex: 0,
    intensity: 'balanced',
    audioSamples: samples,
  });

  assert.equal(underCalm.isEnergetic, false);
  assert.equal(underBalanced.isEnergetic, true);
});

test('resolveCaptionMixDecisions respects per-line styleOverride and single-style locking', () => {
  const configMix: Pick<CaptionConfig, 'preset' | 'styleMode' | 'autoMixIntensity' | 'uppercase'> = {
    preset: 'classic',
    styleMode: 'auto-mix',
    autoMixIntensity: 'balanced',
    uppercase: false,
  };

  const linesWithOverride: CaptionLine[] = [
    { ...calmLine, styleOverride: 'sticker-box' },
    hypeLine,
  ];

  const mixMap = resolveCaptionMixDecisions({
    lines: linesWithOverride,
    config: configMix,
    audioSamples: samples,
    keywords: ['clutch'],
  });

  assert.equal(mixMap[calmLine.id].isOverridden, true);
  assert.equal(mixMap[calmLine.id].resolvedPreset, 'sticker-box');
  assert.equal(mixMap[hypeLine.id].isOverridden, false);
  assert.ok(AUTO_MIX_FUNKY_STYLES.includes(mixMap[hypeLine.id].resolvedPreset));

  const lockedSingle = resolveCaptionMixDecisions({
    lines: [calmLine, hypeLine],
    config: { ...configMix, styleMode: 'single', preset: 'bold-pop' },
    audioSamples: samples,
    keywords: ['clutch'],
  });
  assert.equal(lockedSingle[calmLine.id].resolvedPreset, 'bold-pop');
  assert.equal(lockedSingle[hypeLine.id].resolvedPreset, 'bold-pop');
});
