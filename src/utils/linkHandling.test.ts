import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPastedLink, detectPlatformHost } from './linkHandling';

test('classifyPastedLink detects YouTube, Instagram, Facebook, TikTok and similar platforms', () => {
  const cases = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YouTube'],
    ['https://youtu.be/dQw4w9WgXcQ?t=12', 'YouTube'],
    ['studio.youtube.com/video/abc/edit', 'YouTube'],
    ['https://www.instagram.com/reel/Cx12345/', 'Instagram'],
    ['https://www.facebook.com/watch/?v=123456', 'Facebook'],
    ['https://fb.watch/abc123/', 'Facebook'],
    ['https://www.tiktok.com/@creator/video/1234567890', 'TikTok'],
    ['vm.tiktok.com/ZM8xyz/', 'TikTok'],
    ['https://clips.twitch.tv/FunClipName', 'Twitch'],
    ['https://kick.com/streamer/clips/123', 'Kick'],
    ['https://x.com/user/status/123', 'X'],
    ['https://vimeo.com/123456', 'Vimeo'],
  ] as const;

  for (const [url, expectedPlatform] of cases) {
    const res = classifyPastedLink(url);
    assert.equal(res.kind, 'platform', `Expected platform for ${url}`);
    assert.equal(res.platformName, expectedPlatform);
  }
});

test('classifyPastedLink does not get tricked by .mp4 in platform query params', () => {
  const res = classifyPastedLink('https://www.youtube.com/watch?v=abc&file=video.mp4');
  assert.equal(res.kind, 'platform');
  if (res.kind === 'platform') {
    assert.equal(res.platformName, 'YouTube');
  }
});

test('classifyPastedLink allows direct .mp4, .webm, and .mov file URLs with query strings', () => {
  const mp4 = classifyPastedLink('https://cdn.example.com/clips/clutch%20shot.mp4?token=123');
  assert.equal(mp4.kind, 'direct-video');
  if (mp4.kind === 'direct-video') {
    assert.equal(mp4.extension, 'mp4');
    assert.equal(mp4.fileName, 'clutch_shot.mp4');
  }

  const webm = classifyPastedLink('https://media.example.org/demo/test.WEBM#t=2');
  assert.equal(webm.kind, 'direct-video');
  if (webm.kind === 'direct-video') {
    assert.equal(webm.extension, 'webm');
  }

  const mov = classifyPastedLink('media.example.net/raw/clip.mov');
  assert.equal(mov.kind, 'direct-video');
  if (mov.kind === 'direct-video') {
    assert.equal(mov.extension, 'mov');
  }
});

test('classifyPastedLink flags non-video webpages and invalid/unsafe schemes cleanly', () => {
  const page = classifyPastedLink('https://example.com/articles/video-clip');
  assert.equal(page.kind, 'unsupported-webpage');

  const jsUrl = classifyPastedLink('javascript:alert(1)');
  assert.equal(jsUrl.kind, 'invalid');

  const empty = classifyPastedLink('   ');
  assert.equal(empty.kind, 'invalid');

  // Substring spoof guard: domain suffix must match cleanly
  assert.equal(detectPlatformHost('notyoutube.com'), null);
  assert.equal(detectPlatformHost('m.youtube.com'), 'YouTube');
});
