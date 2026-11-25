import type { CaptionLine } from '../types/editor';

export type SampleSceneId = 'night-city' | 'arcade-shapes' | 'avatar-split';

export const SAMPLE_CLIP_DURATION_SEC = 4.2;

/**
 * Computes the normalized horizontal focal target (0..1) for a sample scene at time progress t (0..1).
 * Used by both live showcase previews and optional crop-path testing.
 */
export function getSceneFocusNormalized(sceneId: SampleSceneId, t: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, t));
  if (sceneId === 'arcade-shapes') {
    const x = 0.5 + Math.sin(clamped * Math.PI * 2) * 0.28;
    const y = 0.48 + Math.cos(clamped * Math.PI * 4) * 0.1;
    return { x, y };
  }
  if (sceneId === 'avatar-split') {
    const x = 0.38 + Math.sin(clamped * Math.PI * 2) * 0.14;
    const y = 0.46;
    return { x, y };
  }
  // night-city
  const targetPxX = 240 + Math.sin(clamped * Math.PI * 2) * 320 + 400;
  const targetPxY = 340 + Math.cos(clamped * Math.PI * 2) * 70;
  return { x: targetPxX / 1280, y: targetPxY / 720 };
}

const NIGHT_BUILDINGS = [
  { x: 40, w: 120, h: 320 },
  { x: 170, w: 90, h: 240 },
  { x: 270, w: 150, h: 420 },
  { x: 430, w: 110, h: 290 },
  { x: 550, w: 180, h: 470 },
  { x: 745, w: 120, h: 340 },
  { x: 880, w: 160, h: 400 },
  { x: 1055, w: 185, h: 300 },
];

/**
 * Draws any of the 3 original browser-generated scenes onto an arbitrary Canvas 2D surface
 * by scaling normalized 1280x720 coordinates. Contains zero external images, game assets, or real faces.
 */
export function drawSampleSceneFrame(
  ctx: CanvasRenderingContext2D,
  sceneId: SampleSceneId,
  width: number,
  height: number,
  t: number,
  elapsedMs: number
): void {
  const sx = width / 1280;
  const sy = height / 720;
  ctx.save();
  ctx.scale(sx, sy);

  if (sceneId === 'arcade-shapes') {
    drawArcadeShapesScene(ctx, t, elapsedMs);
  } else if (sceneId === 'avatar-split') {
    drawAvatarSplitScene(ctx, t, elapsedMs);
  } else {
    drawNightCityScene(ctx, t, elapsedMs);
  }

  ctx.restore();
}

function drawNightCityScene(ctx: CanvasRenderingContext2D, t: number, elapsedMs: number): void {
  const width = 1280;
  const height = 720;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0d131b');
  grad.addColorStop(0.7, '#1a2430');
  grad.addColorStop(1, '#10161d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Moving amber radar sweep
  const beamX = 160 + t * (width - 320);
  ctx.save();
  ctx.fillStyle = 'rgba(229, 154, 36, 0.14)';
  ctx.beginPath();
  ctx.moveTo(beamX, 60);
  ctx.lineTo(beamX - 180, height);
  ctx.lineTo(beamX + 180, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // City blocks & lit windows
  for (let i = 0; i < NIGHT_BUILDINGS.length; i++) {
    const b = NIGHT_BUILDINGS[i];
    const topY = height - 90 - b.h;
    ctx.fillStyle = '#0b1016';
    ctx.fillRect(b.x, topY, b.w, b.h + 90);
    for (let wy = topY + 20; wy < height - 110; wy += 26) {
      for (let wx = b.x + 14; wx < b.x + b.w - 20; wx += 22) {
        const lit = ((wx * 7 + wy * 13 + i) % 11) < 3;
        ctx.fillStyle = lit ? '#e59a24' : '#1b2430';
        ctx.fillRect(wx, wy, 10, 14);
      }
    }
  }

  // Moving action target reticle
  const targetX = 240 + Math.sin(t * Math.PI * 2) * 320 + 400;
  const targetY = 340 + Math.cos(t * Math.PI * 2) * 70;
  ctx.strokeStyle = '#e59a24';
  ctx.lineWidth = 4;
  ctx.strokeRect(targetX - 48, targetY - 48, 96, 96);

  drawSceneWatermarkHeader(ctx, 'NIGHT CITY · SAMPLE SCENE', elapsedMs);
}

function drawArcadeShapesScene(ctx: CanvasRenderingContext2D, t: number, elapsedMs: number): void {
  const width = 1280;
  const height = 720;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#09101a');
  bg.addColorStop(0.5, '#121d2d');
  bg.addColorStop(1, '#0b131e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Perspective arena grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= width; gx += 80) {
    ctx.beginPath();
    ctx.moveTo(gx, 180);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 200; gy <= height; gy += 65) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  // Moving geometric targets
  const focus = getSceneFocusNormalized('arcade-shapes', t);
  const cx = focus.x * width;
  const cy = focus.y * height;

  const orb1X = cx;
  const orb1Y = cy;
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(orb1X, orb1Y, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e59a24';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(t * Math.PI * 4) * 140, cy - 110);
  ctx.lineTo(cx + Math.cos(t * Math.PI * 4) * 140 + 44, cy - 42);
  ctx.lineTo(cx + Math.cos(t * Math.PI * 4) * 140 - 44, cy - 42);
  ctx.closePath();
  ctx.fill();

  // Secondary floating diamond shape
  const dX = 640 - Math.sin(t * Math.PI * 2) * 260;
  const dY = 470 + Math.sin(t * Math.PI * 4) * 50;
  ctx.save();
  ctx.translate(dX, dY);
  ctx.rotate(t * Math.PI * 2);
  ctx.strokeStyle = '#ff2e93';
  ctx.lineWidth = 5;
  ctx.strokeRect(-32, -32, 64, 64);
  ctx.restore();

  // Tracking crosshair reticle
  ctx.strokeStyle = '#e59a24';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 72, 0, Math.PI * 2);
  ctx.moveTo(cx - 96, cy);
  ctx.lineTo(cx - 48, cy);
  ctx.moveTo(cx + 48, cy);
  ctx.lineTo(cx + 96, cy);
  ctx.moveTo(cx, cy - 96);
  ctx.lineTo(cx, cy - 48);
  ctx.moveTo(cx, cy + 48);
  ctx.lineTo(cx, cy + 96);
  ctx.stroke();

  // Corner HUD bars (abstract, zero game logos)
  ctx.fillStyle = 'rgba(15, 23, 34, 0.85)';
  ctx.fillRect(48, 596, 280, 68);
  ctx.strokeStyle = '#2a3544';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 596, 280, 68);
  ctx.fillStyle = '#2ea043';
  ctx.fillRect(64, 616, 180 + Math.round(Math.sin(t * Math.PI * 2) * 35), 14);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(64, 638, 140, 10);

  ctx.fillStyle = 'rgba(15, 23, 34, 0.85)';
  ctx.fillRect(996, 48, 236, 72);
  ctx.strokeRect(996, 48, 236, 72);
  ctx.fillStyle = '#eef2f6';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`PTS ${String(1200 + Math.round(t * 450)).padStart(4, '0')}`, 1018, 94);

  drawSceneWatermarkHeader(ctx, 'ARCADE TARGETS · SAMPLE SCENE', elapsedMs);
}

function drawAvatarSplitScene(ctx: CanvasRenderingContext2D, t: number, elapsedMs: number): void {
  const width = 1280;
  const height = 720;

  // Main action stage background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0f1722');
  grad.addColorStop(1, '#1a2634');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Horizon & geometric track bars
  ctx.fillStyle = '#0b1118';
  ctx.fillRect(0, 440, width, 280);
  ctx.strokeStyle = '#334459';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 440);
  ctx.lineTo(width, 440);
  ctx.stroke();

  // Animated racing blocks in main play area
  const carX = 240 + (0.5 + Math.sin(t * Math.PI * 2) * 0.35) * 620;
  const carY = 360 + Math.cos(t * Math.PI * 4) * 28;
  ctx.fillStyle = '#e59a24';
  ctx.fillRect(carX - 70, carY - 28, 140, 56);
  ctx.fillStyle = '#0e1217';
  ctx.fillRect(carX - 36, carY - 18, 72, 24);
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(carX - 88, carY - 46, 176, 92);

  // Corner stand-in facecam box (aligned to DEFAULT_SPLIT_LAYOUT.facecamBox: x=0.72, y=0.65, w=0.25, h=0.30)
  const camX = Math.round(0.72 * width);
  const camY = Math.round(0.65 * height);
  const camW = Math.round(0.25 * width);
  const camH = Math.round(0.3 * height);

  ctx.fillStyle = '#15202e';
  ctx.fillRect(camX, camY, camW, camH);
  ctx.strokeStyle = '#2ea043';
  ctx.lineWidth = 4;
  ctx.strokeRect(camX, camY, camW, camH);

  // Simple cartoon avatar head & shoulders inside stand-in cam box
  const avatarCx = camX + camW / 2;
  const avatarCy = camY + camH * 0.48 + Math.sin(t * Math.PI * 4) * 4;
  // Shoulders
  ctx.fillStyle = '#e59a24';
  ctx.beginPath();
  ctx.ellipse(avatarCx, camY + camH * 0.94, 72, 42, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#f3d2b3';
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, 44, 0, Math.PI * 2);
  ctx.fill();
  // Headset band + earcups
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy - 4, 48, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.fillStyle = '#232d3a';
  ctx.fillRect(avatarCx - 54, avatarCy - 14, 14, 28);
  ctx.fillRect(avatarCx + 40, avatarCy - 14, 14, 28);
  // Eyes + smile
  ctx.fillStyle = '#0e1217';
  ctx.beginPath();
  ctx.arc(avatarCx - 15, avatarCy - 6, 5, 0, Math.PI * 2);
  ctx.arc(avatarCx + 15, avatarCy - 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e1217';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy + 8, 16, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Small label inside cam frame
  ctx.fillStyle = '#9aa7b8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('AVATAR CAM', camX + 14, camY + 26);

  drawSceneWatermarkHeader(ctx, 'SPLIT ACTION · SAMPLE SCENE', elapsedMs);
}

function drawSceneWatermarkHeader(
  ctx: CanvasRenderingContext2D,
  headline: string,
  elapsedMs: number
): void {
  ctx.fillStyle = '#eef2f6';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(headline, 56, 78);

  ctx.fillStyle = '#9aa7b8';
  ctx.font = '600 20px sans-serif';
  ctx.fillText('Sample scene generated in your browser', 56, 112);

  ctx.fillStyle = '#e59a24';
  ctx.font = 'bold 28px monospace';
  const sec = Math.floor(elapsedMs / 1000);
  const cs = String(Math.floor((elapsedMs % 1000) / 10)).padStart(2, '0');
  ctx.fillText(`00:0${sec}.${cs}`, 56, 152);
}

/**
 * Generates clearly labeled demo caption lines ONLY for generated sample clips & home showcase previews.
 * Never attached to a user's own video.
 */
export function buildSampleDemoCaptionLines(): CaptionLine[] {
  return [
    {
      id: 'sample-cap-1',
      startTime: 0,
      endTime: 2.1,
      text: 'Sample caption style preview',
      words: [
        { text: 'Sample', start: 0, end: 0.55 },
        { text: 'caption', start: 0.55, end: 1.05 },
        { text: 'style', start: 1.05, end: 1.55 },
        { text: 'preview', start: 1.55, end: 2.1 },
      ],
    },
    {
      id: 'sample-cap-2',
      startTime: 2.2,
      endTime: 4.1,
      text: 'Sample caption edit anytime',
      words: [
        { text: 'Sample', start: 2.2, end: 2.65 },
        { text: 'caption', start: 2.65, end: 3.15 },
        { text: 'edit', start: 3.15, end: 3.6 },
        { text: 'anytime', start: 3.6, end: 4.1 },
      ],
    },
  ];
}
