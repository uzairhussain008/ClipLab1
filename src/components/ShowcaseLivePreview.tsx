import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TEMPLATE_SPLIT_LAYOUT, type LookTemplate } from '../config/templates';
import { CAPTION_PRESET_DEFAULTS, layoutCaptionRows } from '../utils/captions';
import { HYPE_POP_CYCLE_COLORS } from '../utils/captionStyleMix';
import {
  buildSampleDemoCaptionLines,
  drawSampleSceneFrame,
  getSceneFocusNormalized,
  SAMPLE_CLIP_DURATION_SEC,
} from '../utils/sampleScenes';
import {
  findShowcaseVideoAsset,
  shouldDrawShowcaseFrame,
  shouldRunShowcaseAnimation,
  SHOWCASE_TARGET_FPS,
} from '../utils/showcaseScheduler';

const STATIC_STILL_PROGRESS = 0.34;

interface ShowcaseLivePreviewProps {
  template: LookTemplate;
}

/**
 * Lazy-loaded live side-by-side preview renderer:
 * - Left: original 16:9 browser-generated scene
 * - Right: reframed output matching template rules (or 16:9 fast cut) with Sample caption styling
 * - Respects IntersectionObserver, tab visibility, prefers-reduced-motion, and <= 24 fps cap.
 */
export default function ShowcaseLivePreview({ template }: ShowcaseLivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);
  const srcBufferRef = useRef<HTMLCanvasElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(() =>
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const licensedVideo = useMemo(() => findShowcaseVideoAsset(template.id), [template.id]);

  // Subscribe to prefers-reduced-motion & document visibility
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setPrefersReducedMotion(Boolean(mq?.matches));
    syncMotion();
    mq?.addEventListener?.('change', syncMotion);

    const onVis = () => setIsTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mq?.removeEventListener?.('change', syncMotion);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Observe card visibility so off-screen canvases never consume CPU
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (licensedVideo) return;

    const beforeCanvas = beforeCanvasRef.current;
    const afterCanvas = afterCanvasRef.current;
    if (!beforeCanvas || !afterCanvas) return;

    const beforeCtx = beforeCanvas.getContext('2d');
    const afterCtx = afterCanvas.getContext('2d');
    if (!beforeCtx || !afterCtx) return;

    if (!srcBufferRef.current) {
      const buf = document.createElement('canvas');
      buf.width = 480;
      buf.height = 270;
      srcBufferRef.current = buf;
    }
    const bufCanvas = srcBufferRef.current;
    const bufCtx = bufCanvas.getContext('2d');
    if (!bufCtx) return;

    const sampleCaptions = buildSampleDemoCaptionLines();

    const renderAtProgress = (t: number) => {
      const elapsedMs = t * SAMPLE_CLIP_DURATION_SEC * 1000;
      const currentTimeSec = t * SAMPLE_CLIP_DURATION_SEC;

      // 1. Render shared source 16:9 scene
      drawSampleSceneFrame(
        bufCtx,
        template.sampleScene,
        bufCanvas.width,
        bufCanvas.height,
        t,
        elapsedMs
      );

      // Copy into Left ("Before" 16:9) canvas
      beforeCtx.clearRect(0, 0, beforeCanvas.width, beforeCanvas.height);
      beforeCtx.drawImage(bufCanvas, 0, 0, beforeCanvas.width, beforeCanvas.height);

      // Draw subtle crop guide box on Before when 9:16 fill-crop or split-layout is active
      if (template.id === 'action-follow') {
        const focus = getSceneFocusNormalized(template.sampleScene, t);
        const boxW = beforeCanvas.height * (9 / 16) * (beforeCanvas.width / beforeCanvas.width);
        const bw = (beforeCanvas.height * 9) / 16;
        const bx = Math.max(0, Math.min(beforeCanvas.width - bw, focus.x * beforeCanvas.width - bw / 2));
        beforeCtx.strokeStyle = 'rgba(229, 154, 36, 0.9)';
        beforeCtx.lineWidth = 2;
        beforeCtx.strokeRect(bx, 2, bw, beforeCanvas.height - 4);
      } else if (template.id === 'gameplay-facecam') {
        const gp = DEFAULT_TEMPLATE_SPLIT_LAYOUT.gameplayBox;
        const fc = DEFAULT_TEMPLATE_SPLIT_LAYOUT.facecamBox;
        beforeCtx.strokeStyle = '#e59a24';
        beforeCtx.lineWidth = 1.5;
        beforeCtx.strokeRect(
          gp.x * beforeCanvas.width,
          gp.y * beforeCanvas.height,
          gp.w * beforeCanvas.width,
          gp.h * beforeCanvas.height
        );
        beforeCtx.strokeStyle = '#2ea043';
        beforeCtx.strokeRect(
          fc.x * beforeCanvas.width,
          fc.y * beforeCanvas.height,
          fc.w * beforeCanvas.width,
          fc.h * beforeCanvas.height
        );
      } else if (template.id === 'quick-cut') {
        // Highlight trim segment bar on Quick Cut Before preview
        beforeCtx.fillStyle = 'rgba(229, 154, 36, 0.85)';
        beforeCtx.fillRect(beforeCanvas.width * 0.14, beforeCanvas.height - 8, beforeCanvas.width * 0.7, 4);
      }

      // 2. Render Right ("After") canvas matching template output settings
      const aw = afterCanvas.width;
      const ah = afterCanvas.height;
      afterCtx.clearRect(0, 0, aw, ah);
      afterCtx.fillStyle = '#000';
      afterCtx.fillRect(0, 0, aw, ah);

      if (template.id === 'quick-cut') {
        // Quick Cut: original 16:9 aspect centered cleanly with "-c copy" trim badge
        afterCtx.drawImage(bufCanvas, 0, 0, aw, ah);
        afterCtx.fillStyle = 'rgba(14, 18, 23, 0.86)';
        afterCtx.fillRect(8, ah - 30, 132, 22);
        afterCtx.strokeStyle = 'rgba(46, 160, 67, 0.75)';
        afterCtx.lineWidth = 1;
        afterCtx.strokeRect(8, ah - 30, 132, 22);
        afterCtx.fillStyle = '#7ee787';
        afterCtx.font = 'bold 11px monospace';
        afterCtx.fillText('Fast Copy (-c copy)', 14, ah - 15);
        return;
      }

      if (template.id === 'blur-fill-classic') {
        // Blur Fill Classic: blurred cover background + 110% foreground center
        const bgScale = Math.max(aw / bufCanvas.width, ah / bufCanvas.height);
        const bw = bufCanvas.width * bgScale;
        const bh = bufCanvas.height * bgScale;
        afterCtx.save();
        afterCtx.filter = 'blur(8px) brightness(0.75)';
        afterCtx.drawImage(bufCanvas, (aw - bw) / 2, (ah - bh) / 2, bw, bh);
        afterCtx.restore();

        const fgW = aw * 1.1;
        const fgH = (fgW * bufCanvas.height) / bufCanvas.width;
        afterCtx.drawImage(bufCanvas, (aw - fgW) / 2, (ah - fgH) / 2, fgW, fgH);
      } else if (template.id === 'action-follow') {
        // Action Follow: Smart follow pan + 1.15x punch zoom
        const focus = getSceneFocusNormalized(template.sampleScene, t);
        const srcAspect = bufCanvas.width / bufCanvas.height;
        const dstAspect = aw / ah;
        const baseSw = bufCanvas.height * dstAspect;
        const zoom = 1.15 + Math.max(0, Math.sin(t * Math.PI * 4)) * 0.05;
        const sw = Math.min(bufCanvas.width, baseSw / zoom);
        const sh = Math.min(bufCanvas.height, bufCanvas.height / zoom);
        const sx = Math.max(0, Math.min(bufCanvas.width - sw, focus.x * bufCanvas.width - sw / 2));
        const sy = Math.max(0, Math.min(bufCanvas.height - sh, (bufCanvas.height - sh) / 2));
        void srcAspect;
        afterCtx.drawImage(bufCanvas, sx, sy, sw, sh, 0, 0, aw, ah);
      } else if (template.id === 'gameplay-facecam') {
        // Gameplay + Facecam: 65/35 vertical split + blurred backdrop
        const bgScale = Math.max(aw / bufCanvas.width, ah / bufCanvas.height);
        const bw = bufCanvas.width * bgScale;
        const bh = bufCanvas.height * bgScale;
        afterCtx.save();
        afterCtx.filter = 'blur(8px) brightness(0.75)';
        afterCtx.drawImage(bufCanvas, (aw - bw) / 2, (ah - bh) / 2, bw, bh);
        afterCtx.restore();

        const topH = Math.round(ah * 0.65);
        const botH = ah - topH;

        const drawBoxFit = (
          box: { x: number; y: number; w: number; h: number },
          destY: number,
          destH: number
        ) => {
          const sx = box.x * bufCanvas.width;
          const sy = box.y * bufCanvas.height;
          const sw = box.w * bufCanvas.width;
          const sh = box.h * bufCanvas.height;
          const scale = Math.min(aw / sw, destH / sh);
          const dw = sw * scale;
          const dh = sh * scale;
          afterCtx.drawImage(
            bufCanvas,
            sx,
            sy,
            sw,
            sh,
            (aw - dw) / 2,
            destY + (destH - dh) / 2,
            dw,
            dh
          );
        };

        drawBoxFit(DEFAULT_TEMPLATE_SPLIT_LAYOUT.gameplayBox, 0, topH);
        drawBoxFit(DEFAULT_TEMPLATE_SPLIT_LAYOUT.facecamBox, topH, botH);
      }

      // Draw Hook title overlay ("Wait for it...") for Action Follow during first 3s
      if (template.textOverlayPatch.enabled && template.textOverlayPatch.text && currentTimeSec <= 3.0) {
        const hookText = template.textOverlayPatch.text;
        afterCtx.save();
        afterCtx.font = 'bold 15px sans-serif';
        afterCtx.textAlign = 'center';
        afterCtx.lineWidth = 3;
        afterCtx.strokeStyle = '#000000';
        afterCtx.strokeText(hookText, aw / 2, Math.round(ah * 0.13));
        afterCtx.fillStyle = '#ffffff';
        afterCtx.fillText(hookText, aw / 2, Math.round(ah * 0.13));
        afterCtx.restore();
      }

      // Draw Sample caption overlay matching the template's caption preset
      if (template.captionPatch.enabled && template.captionPatch.preset) {
        const presetId = template.captionPatch.preset;
        const meta = CAPTION_PRESET_DEFAULTS[presetId] ?? CAPTION_PRESET_DEFAULTS.classic;
        const activeLine =
          sampleCaptions.find((l) => currentTimeSec >= l.startTime && currentTimeSec <= l.endTime) ??
          sampleCaptions[0];
        const wordsPerLine = template.captionPatch.wordsPerLine ?? meta.wordsPerLine ?? 3;
        const { rows } = layoutCaptionRows({
          line: activeLine,
          wordsPerLine,
          uppercase: meta.uppercase,
          maxCharsPerRow: presetId === 'hype-pop' ? 12 : 20,
        });

        afterCtx.save();
        const fontPx = presetId === 'hype-pop' ? 15 : 12;
        afterCtx.font = `bold ${fontPx}px sans-serif`;
        afterCtx.textAlign = 'center';
        const lineHeight = fontPx + 4;
        const bottomPad = Math.round(ah * ((template.captionPatch.offsetPercent ?? meta.offsetPercent) / 100));
        const blockHeight = rows.length * lineHeight;
        const startY = ah - bottomPad - blockHeight + fontPx;

        if (meta.backgroundBox) {
          const widest = Math.max(
            ...rows.map((r) => afterCtx.measureText(r.map((w) => w.text).join(' ')).width),
            40
          );
          afterCtx.fillStyle = 'rgba(0, 0, 0, 0.76)';
          afterCtx.fillRect(aw / 2 - widest / 2 - 8, startY - fontPx - 2, widest + 16, blockHeight + 8);
        }

        let wordCounter = 0;
        rows.forEach((rowWords, rIdx) => {
          const y = startY + rIdx * lineHeight;
          const textStr = rowWords.map((w) => w.text).join(' ');
          afterCtx.lineWidth = presetId === 'hype-pop' ? 3.5 : 2.5;
          afterCtx.strokeStyle = '#000000';

          if (presetId === 'hype-pop') {
            // Render word-by-word highlight matching Hype Pop
            const gap = 4;
            const widths = rowWords.map((w) => afterCtx.measureText(w.text).width);
            const totalW = widths.reduce((a, b) => a + b, 0) + gap * (rowWords.length - 1);
            let cursorX = aw / 2 - totalW / 2;
            rowWords.forEach((w, wIdx) => {
              const isActive = currentTimeSec >= w.start && currentTimeSec <= w.end;
              const color = isActive
                ? HYPE_POP_CYCLE_COLORS[wordCounter % HYPE_POP_CYCLE_COLORS.length]
                : meta.textColor;
              const wordCenterX = cursorX + widths[wIdx] / 2;
              afterCtx.strokeText(w.text, wordCenterX, y);
              afterCtx.fillStyle = color;
              afterCtx.fillText(w.text, wordCenterX, y);
              cursorX += widths[wIdx] + gap;
              wordCounter++;
            });
          } else {
            afterCtx.strokeText(textStr, aw / 2, y);
            afterCtx.fillStyle = meta.textColor;
            afterCtx.fillText(textStr, aw / 2, y);
          }
        });
        afterCtx.restore();
      }
    };

    // Draw initial still frame immediately (and stay static under prefers-reduced-motion)
    renderAtProgress(STATIC_STILL_PROGRESS);

    if (!shouldRunShowcaseAnimation({ isVisible, isTabVisible, prefersReducedMotion })) {
      return;
    }

    let rafId = 0;
    let lastDrawMs = -1;
    const loopStartMs = performance.now() - STATIC_STILL_PROGRESS * SAMPLE_CLIP_DURATION_SEC * 1000;

    const tick = (nowMs: number) => {
      if (shouldDrawShowcaseFrame(nowMs, lastDrawMs, SHOWCASE_TARGET_FPS)) {
        lastDrawMs = nowMs;
        const cycleMs = SAMPLE_CLIP_DURATION_SEC * 1000;
        const progress = ((nowMs - loopStartMs) % cycleMs) / cycleMs;
        renderAtProgress(progress);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [licensedVideo, isVisible, isTabVisible, prefersReducedMotion, template]);

  if (licensedVideo) {
    return (
      <div
        ref={containerRef}
        data-testid={`showcase-preview-${template.id}`}
        data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
        className="w-full"
      >
        <div className="aspect-[9/16] max-h-[260px] mx-auto rounded border border-[#2a3544] bg-black overflow-hidden">
          <video
            src={licensedVideo.videoUrl}
            poster={licensedVideo.posterUrl}
            aria-label={licensedVideo.alt}
            muted
            loop
            playsInline
            preload="none"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  }

  const isQuickCut = template.id === 'quick-cut';

  return (
    <div
      ref={containerRef}
      data-testid={`showcase-preview-${template.id}`}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      data-animating={
        shouldRunShowcaseAnimation({ isVisible, isTabVisible, prefersReducedMotion })
          ? 'true'
          : 'false'
      }
      className="grid grid-cols-12 gap-3 items-center"
    >
      {/* Left: Before (16:9 original browser-drawn scene) */}
      <div className={isQuickCut ? 'col-span-6 space-y-1' : 'col-span-7 space-y-1'}>
        <div className="flex items-center justify-between text-[11px] text-[#9aa7b8]">
          <span>Before (16:9)</span>
        </div>
        <div className="w-full aspect-video rounded border border-[#2a3544] bg-[#090c10] overflow-hidden">
          <canvas
            ref={beforeCanvasRef}
            width={320}
            height={180}
            aria-label={`Before 16:9 original sample scene for ${template.name}`}
            className="w-full h-full block"
          />
        </div>
      </div>

      {/* Right: After (9:16 output or 16:9 fast trim) */}
      <div className={isQuickCut ? 'col-span-6 space-y-1' : 'col-span-5 space-y-1'}>
        <div className="flex items-center justify-between text-[11px] text-[#e59a24]">
          <span>{isQuickCut ? 'After (Trimmed)' : 'After (9:16)'}</span>
        </div>
        <div
          className={`mx-auto rounded border border-[#39475a] bg-[#090c10] overflow-hidden ${
            isQuickCut ? 'w-full aspect-video' : 'w-full max-w-[146px] aspect-[9/16]'
          }`}
        >
          <canvas
            ref={afterCanvasRef}
            width={isQuickCut ? 320 : 180}
            height={isQuickCut ? 180 : 320}
            aria-label={`After preview for ${template.name}`}
            className="w-full h-full block"
          />
        </div>
      </div>
    </div>
  );
}
