import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimecode,
  normalizeTrimRange,
  stepFrame,
  sanitizeFilename,
} from './timecode';

test('formatTimecode renders MM:SS.hs and H:MM:SS.hs accurately', () => {
  assert.equal(formatTimecode(0), '00:00.00');
  assert.equal(formatTimecode(12.345), '00:12.35');
  assert.equal(formatTimecode(75.5), '01:15.50');
  assert.equal(formatTimecode(3661.2), '1:01:01.20');
  assert.equal(formatTimecode(-4), '00:00.00');
});

test('normalizeTrimRange enforces minimum duration and bounds', () => {
  assert.deepEqual(normalizeTrimRange(-2, 5, 20), { startTime: 0, endTime: 5 });
  assert.deepEqual(normalizeTrimRange(10, 10.05, 20), { startTime: 10, endTime: 10.2 });
  assert.deepEqual(normalizeTrimRange(19.95, 20, 20), { startTime: 19.8, endTime: 20 });
});

test('stepFrame advances and rewinds by 1/30s within duration', () => {
  const next = stepFrame(1.0, 1, 10, 30);
  assert.ok(Math.abs(next - 1.0333) < 0.001);
  assert.equal(stepFrame(0.01, -1, 10, 30), 0);
  assert.equal(stepFrame(9.99, 1, 10, 30), 10);
});

test('sanitizeFilename strips unsafe characters cleanly', () => {
  assert.equal(sanitizeFilename('Clutch Ace!! #1'), 'clutch-ace-1');
  assert.equal(sanitizeFilename('   '), 'clip');
});
