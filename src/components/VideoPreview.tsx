import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Columns2, Lock, Move, Sparkles } from 'lucide-react';
import { BUNDLED_FONTS } from '../config/appConfig';
import type {
  CaptionConfig,
  CaptionLine,
  CaptionStylePresetId,
  CropKeyframe,
  ExportSettings,
  LogoCorner,
  LogoOverlayConfig,
  NormalizedRect,
  SplitLayoutConfig,
  TextOverlayConfig,
} from '../types/editor';
import { CAPTION_PRESET_DEFAULTS, getMaxCharsPerRow, layoutCaptionRows } from '../utils/captions';
import { HYPE_POP_CYCLE_COLORS, STICKER_BOX_CYCLE_COLORS } from '../utils/captionStyleMix';
import { interpolateCropAtTime } from '../utils/smartAnalysis';
import { clampTime } from '../utils/timecode';

interface VideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  currentTime: number;
  segmentStart: number;
  segmentEnd: number;
  settings: ExportSettings;
  textOverlay: TextOverlayConfig;
  logoOverlay: LogoOverlayConfig;
  captions?: {
    config: CaptionConfig;
    lines: CaptionLine[];
    resolvedStyleMap?: Record<string, CaptionStylePresetId>;
  };
  cropPath?: CropKeyframe[];
  peakTimes?: number[];
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onEnded: () => void;
  onVideoError: () => void;
  onChangeCrop: (cropX: number, cropY: number) => void;
  onChangeSplitLayout?: (next: SplitLayoutConfig) => void;
}

const ASPECT_RATIO_CSS: Record<ExportSettings['aspect'], string> = {
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '4:5': '4 / 5',
  '16:9': '16 / 9',
};

function getLogoCornerClasses(corner: LogoCorner): string {
  switch (corner) {
    case 'top-left':
      return 'top-[4%] left-[4%]';
    case 'top-right':
      return 'top-[4%] right-[4%]';
    case 'bottom-left':
      return 'bottom-[4%] left-[4%]';
    case 'bottom-right':
    default:
      return 'bottom-[4%] right-[4%]';
  }
}

type SplitDragState = {
  target: 'gameplay' | 'facecam';
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
  origRect: NormalizedRect;
} | null;

export function VideoPreview({
  videoRef,
  videoUrl,
  currentTime,
  segmentStart,
  segmentEnd,
  settings,
  textOverlay,
  logoOverlay,
  captions,
  cropPath = [],
  peakTimes = [],
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  onVideoError,
  onChangeCrop,
  onChangeSplitLayout,
}: VideoPreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceBoxStageRef = useRef<HTMLDivElement>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement>(null);
  const splitCanvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const [editingSplitBoxes, setEditingSplitBoxes] = useState(false);
  const [splitDrag, setSplitDrag] = useState<SplitDragState>(null);

  const isSplitLayout =
    !settings.keepOriginalFraming &&
    settings.aspect === '9:16' &&
    settings.reframeMode === 'split-layout';

  const isBlurBg =
    !settings.keepOriginalFraming &&
    !isSplitLayout &&
    ((settings.aspect === '9:16' && settings.verticalMode === 'blur-bg') ||
      settings.reframeMode === 'blur-bg');

  const isFillCrop = !settings.keepOriginalFraming && !isBlurBg && !isSplitLayout;

  const isSmartActive =
    isFillCrop &&
    !settings.lockPosition &&
    (settings.reframeMode === 'smart-follow' || settings.reframeMode === 'face-aware') &&
    cropPath.length > 0;

  const liveCrop = useMemo(() => {
    if (isSmartActive) {
      return interpolateCropAtTime(cropPath, currentTime);
    }
    return { cropX: settings.cropX, cropY: settings.cropY };
  }, [isSmartActive, cropPath, currentTime, settings.cropX, settings.cropY]);

  // Live Zoom factor synced to ExportSettings.zoom
  const liveZoomScale = useMemo(() => {
    if (settings.keepOriginalFraming) return 1;
    let z = settings.zoom.punchZoom || 1;
    const span = Math.max(0.2, segmentEnd - segmentStart);
    const rel = clampTime(currentTime - segmentStart, 0, span);
    if (settings.zoom.slowZoom) {
      z += 0.1 * (rel / span);
    }
    if (settings.zoom.pulseOnPeaks && peakTimes.length > 0) {
      let bestPulse = 0;
      for (const pt of peakTimes) {
        const dist = Math.abs(currentTime - pt);
        if (dist < 0.18) {
          bestPulse = Math.max(bestPulse, 0.09 * (1 - dist / 0.18));
        }
      }
      z += bestPulse;
    }
    return Math.min(1.5, Math.max(1.0, z));
  }, [
    settings.keepOriginalFraming,
    settings.zoom,
    segmentStart,
    segmentEnd,
    currentTime,
    peakTimes,
  ]);

  // Sync blurred background canvas OR Split Layout composite canvas
  useEffect(() => {
    if (!isBlurBg && (!isSplitLayout || editingSplitBoxes)) return;
    let rafId = 0;

    const drawFrame = () => {
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (isBlurBg && blurCanvasRef.current) {
          const canvas = blurCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = Math.max(cw / vw, ch / vh);
            const dw = vw * scale;
            const dh = vh * scale;
            const dx = (cw - dw) / 2;
            const dy = (ch - dh) / 2;
            ctx.filter = 'blur(14px) brightness(0.92)';
            ctx.drawImage(video, dx, dy, dw, dh);
          }
        }

        if (isSplitLayout && !editingSplitBoxes && splitCanvasRef.current) {
          const canvas = splitCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const cw = canvas.width;
            const ch = canvas.height;
            ctx.clearRect(0, 0, cw, ch);

            const { gameplayRatioPercent, backgroundMode, gameplayBox, facecamBox } =
              settings.splitLayout;
            const topH = Math.round((ch * clampTime(gameplayRatioPercent, 50, 80)) / 100);
            const botH = ch - topH;

            if (backgroundMode === 'blur') {
              const bgScale = Math.max(cw / vw, ch / vh);
              const bw = vw * bgScale;
              const bh = vh * bgScale;
              ctx.save();
              ctx.filter = 'blur(14px) brightness(0.9)';
              ctx.drawImage(video, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
              ctx.restore();
            } else {
              ctx.fillStyle = '#000';
              ctx.fillRect(0, 0, cw, ch);
            }

            const drawSubBox = (box: NormalizedRect, destY: number, destH: number) => {
              const sx = clampTime(box.x, 0, 0.95) * vw;
              const sy = clampTime(box.y, 0, 0.95) * vh;
              const sw = Math.max(8, clampTime(box.w, 0.05, 1 - box.x) * vw);
              const sh = Math.max(8, clampTime(box.h, 0.05, 1 - box.y) * vh);

              if (backgroundMode === 'fill') {
                const scale = Math.max(cw / sw, destH / sh);
                const dw = sw * scale;
                const dh = sh * scale;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, destY, cw, destH);
                ctx.clip();
                ctx.drawImage(video, sx, sy, sw, sh, (cw - dw) / 2, destY + (destH - dh) / 2, dw, dh);
                ctx.restore();
              } else {
                const scale = Math.min(cw / sw, destH / sh);
                const dw = sw * scale;
                const dh = sh * scale;
                ctx.drawImage(video, sx, sy, sw, sh, (cw - dw) / 2, destY + (destH - dh) / 2, dw, dh);
              }
            };

            drawSubBox(gameplayBox, 0, topH);
            drawSubBox(facecamBox, topH, botH);
          }
        }
      }

      if (video && !video.paused && !video.ended) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    const videoEl = videoRef.current;
    const onPlay = () => {
      rafId = requestAnimationFrame(drawFrame);
    };
    const onSeeked = () => drawFrame();

    videoEl?.addEventListener('play', onPlay);
    videoEl?.addEventListener('seeked', onSeeked);
    videoEl?.addEventListener('loadeddata', onSeeked);

    return () => {
      cancelAnimationFrame(rafId);
      videoEl?.removeEventListener('play', onPlay);
      videoEl?.removeEventListener('seeked', onSeeked);
      videoEl?.removeEventListener('loadeddata', onSeeked);
    };
  }, [
    isBlurBg,
    isSplitLayout,
    editingSplitBoxes,
    settings.splitLayout,
    videoRef,
    videoUrl,
    currentTime,
  ]);

  const handleCropPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!isFillCrop) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setDraggingCrop(true);
    updateCropFromPointer(ev.clientX, ev.clientY);
  };

  const handleCropPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingCrop || !isFillCrop) return;
    updateCropFromPointer(ev.clientX, ev.clientY);
  };

  const handleCropPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (draggingCrop) {
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      setDraggingCrop(false);
    }
  };

  const updateCropFromPointer = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nx = clampTime((clientX - rect.left) / rect.width, 0, 1);
    const ny = clampTime((clientY - rect.top) / rect.height, 0, 1);
    onChangeCrop(Number(nx.toFixed(2)), Number(ny.toFixed(2)));
  };

  // Split box interactive dragging
  const handleSplitPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!splitDrag || !onChangeSplitLayout) return;
    const container = sourceBoxStageRef.current?.getBoundingClientRect();
    if (!container || container.width <= 0 || container.height <= 0) return;

    const dx = (ev.clientX - splitDrag.startClientX) / container.width;
    const dy = (ev.clientY - splitDrag.startClientY) / container.height;
    const orig = splitDrag.origRect;

    let nextRect: NormalizedRect;
    if (splitDrag.mode === 'move') {
      const nx = clampTime(orig.x + dx, 0, 1 - orig.w);
      const ny = clampTime(orig.y + dy, 0, 1 - orig.h);
      nextRect = { x: Number(nx.toFixed(3)), y: Number(ny.toFixed(3)), w: orig.w, h: orig.h };
    } else {
      const nw = clampTime(orig.w + dx, 0.12, 1 - orig.x);
      const nh = clampTime(orig.h + dy, 0.12, 1 - orig.y);
      nextRect = { x: orig.x, y: orig.y, w: Number(nw.toFixed(3)), h: Number(nh.toFixed(3)) };
    }

    onChangeSplitLayout({
      ...settings.splitLayout,
      gameplayBox: splitDrag.target === 'gameplay' ? nextRect : settings.splitLayout.gameplayBox,
      facecamBox: splitDrag.target === 'facecam' ? nextRect : settings.splitLayout.facecamBox,
    });
  };

  const showText =
    textOverlay.enabled &&
    textOverlay.text.trim().length > 0 &&
    currentTime >= textOverlay.startTime - 0.05 &&
    currentTime <= textOverlay.endTime + 0.05;

  const hookTextOpacity = useMemo(() => {
    if (!showText || !textOverlay.hookFade) return 1;
    const tIn = currentTime - textOverlay.startTime;
    const tOut = textOverlay.endTime - currentTime;
    if (tIn < 0.3) return Math.max(0, tIn / 0.3);
    if (tOut < 0.3) return Math.max(0, tOut / 0.3);
    return 1;
  }, [showText, textOverlay.hookFade, textOverlay.startTime, textOverlay.endTime, currentTime]);

  const activeCaptionLine = useMemo(() => {
    if (!captions?.config.enabled || captions.lines.length === 0) return null;
    return (
      captions.lines.find(
        (l) => currentTime >= l.startTime - 0.03 && currentTime <= l.endTime + 0.03
      ) ?? null
    );
  }, [captions, currentTime]);

  const stageAspect =
    isSplitLayout && editingSplitBoxes
      ? '16 / 9'
      : settings.keepOriginalFraming
        ? '16 / 9'
        : ASPECT_RATIO_CSS[settings.aspect];
  const isPortraitStage =
    !(isSplitLayout && editingSplitBoxes) &&
    !settings.keepOriginalFraming &&
    (settings.aspect === '9:16' || settings.aspect === '4:5');

  const fgScaleFraction =
    isBlurBg && settings.foregroundSizePercent > 100 ? settings.foregroundSizePercent / 100 : 1;

  return (
    <div className="relative w-full rounded-md border border-[#2a3544] bg-[#090c10] flex flex-col items-center justify-center p-3 sm:p-4 overflow-hidden gap-2.5">
      {isSplitLayout && (
        <div className="w-full flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[#9aa7b8]">
            <Columns2 className="w-3.5 h-3.5 text-[#e59a24]" />
            <span>
              {editingSplitBoxes
                ? 'Drag or resize Gameplay (amber) & Facecam (green) regions'
                : 'Live 9:16 Split Preview (Gameplay + Facecam)'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setEditingSplitBoxes((v) => !v)}
            className="px-2.5 py-1 rounded border border-[#39475a] bg-[#151b22] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {editingSplitBoxes ? 'Done Editing Boxes' : 'Edit Crop Boxes'}
          </button>
        </div>
      )}

      <div
        ref={isSplitLayout && editingSplitBoxes ? sourceBoxStageRef : stageRef}
        onPointerDown={isSplitLayout && editingSplitBoxes ? undefined : handleCropPointerDown}
        onPointerMove={
          isSplitLayout && editingSplitBoxes ? handleSplitPointerMove : handleCropPointerMove
        }
        onPointerUp={
          isSplitLayout && editingSplitBoxes ? () => setSplitDrag(null) : handleCropPointerUp
        }
        onPointerCancel={
          isSplitLayout && editingSplitBoxes ? () => setSplitDrag(null) : handleCropPointerUp
        }
        style={{ aspectRatio: stageAspect }}
        className={`relative overflow-hidden rounded bg-black border border-[#2a3544] shadow-lg ${
          isPortraitStage ? 'h-[360px] sm:h-[420px] max-w-full' : 'w-full max-w-[680px]'
        } ${isFillCrop ? 'cursor-move touch-none' : ''}`}
      >
        {isBlurBg && (
          <canvas
            ref={blurCanvasRef}
            width={180}
            height={320}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {isSplitLayout && !editingSplitBoxes && (
          <canvas
            ref={splitCanvasRef}
            width={270}
            height={480}
            aria-hidden="true"
            style={{
              transform: liveZoomScale > 1.005 ? `scale(${liveZoomScale.toFixed(3)})` : undefined,
            }}
            className="relative z-10 w-full h-full object-contain pointer-events-none"
          />
        )}

        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onError={onVideoError}
          style={{
            objectPosition: isFillCrop
              ? `${Math.round(liveCrop.cropX * 100)}% ${Math.round(liveCrop.cropY * 100)}%`
              : undefined,
            transform:
              isBlurBg && (fgScaleFraction > 1 || liveZoomScale > 1)
                ? `scale(${(fgScaleFraction * liveZoomScale).toFixed(3)})`
                : !isSplitLayout && liveZoomScale > 1.005
                  ? `scale(${liveZoomScale.toFixed(3)})`
                  : undefined,
          }}
          className={`w-full h-full ${
            isSplitLayout && !editingSplitBoxes
              ? 'sr-only'
              : 'relative z-10 ' +
                (isFillCrop ? 'object-cover' : 'object-contain')
          }`}
        />

        {/* Draggable Gameplay + Facecam Boxes on Source Video */}
        {isSplitLayout && editingSplitBoxes && (
          <>
            {(
              [
                {
                  key: 'gameplay' as const,
                  label: 'Gameplay',
                  rect: settings.splitLayout.gameplayBox,
                  borderCls: 'border-[#e59a24] bg-[#e59a24]/15',
                  tagCls: 'bg-[#e59a24] text-[#0e1217]',
                },
                {
                  key: 'facecam' as const,
                  label: 'Facecam',
                  rect: settings.splitLayout.facecamBox,
                  borderCls: 'border-[#2ea043] bg-[#2ea043]/15',
                  tagCls: 'bg-[#2ea043] text-white',
                },
              ] as const
            ).map(({ key, label, rect, borderCls, tagCls }) => (
              <div
                key={key}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                  setSplitDrag({
                    target: key,
                    mode: 'move',
                    startClientX: ev.clientX,
                    startClientY: ev.clientY,
                    origRect: rect,
                  });
                }}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
                className={`absolute z-30 border-2 ${borderCls} cursor-move touch-none select-none`}
              >
                <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold ${tagCls}`}>
                  {label}
                </span>
                <button
                  type="button"
                  aria-label={`Resize ${label} box`}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    ev.currentTarget.setPointerCapture(ev.pointerId);
                    setSplitDrag({
                      target: key,
                      mode: 'resize',
                      startClientX: ev.clientX,
                      startClientY: ev.clientY,
                      origRect: rect,
                    });
                  }}
                  className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-sm border border-black cursor-nwse-resize ${tagCls}`}
                />
              </div>
            ))}
          </>
        )}

        {/* Safe-Zone Guide Overlay (for 9:16 / 4:5 short-form UI margins) */}
        {captions?.config.showSafeZoneGuide && !settings.keepOriginalFraming && !(isSplitLayout && editingSplitBoxes) && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 border-dashed"
          >
            <div className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-[#e59a24]/50 bg-[#e59a24]/5 flex items-end justify-center pb-0.5">
              <span className="text-[9px] text-[#e59a24]/80">Top UI margin</span>
            </div>
            <div className="absolute right-0 top-[25%] bottom-[22%] w-[14%] border-l border-dashed border-[#e59a24]/50 bg-[#e59a24]/5" />
            <div className="absolute inset-x-0 bottom-0 h-[20%] border-t border-dashed border-[#e59a24]/50 bg-[#e59a24]/5 flex items-start justify-center pt-0.5">
              <span className="text-[9px] text-[#e59a24]/80">Bottom UI / caption safe margin</span>
            </div>
          </div>
        )}

        {/* Live Hook Title Text Overlay Preview */}
        {showText && !(isSplitLayout && editingSplitBoxes) && (
          <div
            style={{ opacity: hookTextOpacity }}
            className={`pointer-events-none absolute inset-x-4 z-20 flex justify-center text-center transition-opacity duration-100 ${
              textOverlay.position === 'top' ? 'top-[8%]' : 'bottom-[10%]'
            }`}
          >
            <span
              style={{
                color: textOverlay.color,
                fontFamily: (BUNDLED_FONTS[textOverlay.font] ?? BUNDLED_FONTS['sans-bold']).cssFamily,
                fontWeight: 700,
                fontSize: `${Math.max(13, Math.round(textOverlay.fontSize * 0.42))}px`,
                lineHeight: 1.15,
                WebkitTextStroke:
                  textOverlay.outlineWidth > 0
                    ? `${Math.max(1, Math.round(textOverlay.outlineWidth * 0.5))}px ${textOverlay.outlineColor}`
                    : undefined,
                paintOrder: 'stroke fill',
              }}
            >
              {textOverlay.text}
            </span>
          </div>
        )}

        {/* Live Captions Preview (single unified layout matching ASS line-breaks & safe margins) */}
        {activeCaptionLine && captions && !(isSplitLayout && editingSplitBoxes) && (() => {
          const lineIdx = Math.max(
            0,
            captions.lines.findIndex((l) => l.id === activeCaptionLine.id)
          );
          const resolvedPreset: CaptionStylePresetId =
            activeCaptionLine.styleOverride ??
            captions.resolvedStyleMap?.[activeCaptionLine.id] ??
            captions.config.preset;
          const isSingleSame =
            (captions.config.styleMode ?? 'single') === 'single' &&
            resolvedPreset === captions.config.preset;
          const basePreset =
            CAPTION_PRESET_DEFAULTS[resolvedPreset] ?? CAPTION_PRESET_DEFAULTS.classic;

          const effectiveFontId = isSingleSame ? captions.config.font : basePreset.font;
          const effectiveFontSize = isSingleSame ? captions.config.fontSize : basePreset.fontSize;
          const effectiveTextColor = isSingleSame
            ? captions.config.textColor
            : basePreset.textColor;
          const effectiveHighlightColor = isSingleSame
            ? captions.config.highlightColor
            : basePreset.highlightColor;
          const effectiveOutline = isSingleSame
            ? captions.config.outlineWidth
            : basePreset.outlineWidth;
          const effectiveBox = isSingleSame
            ? captions.config.backgroundBox
            : basePreset.backgroundBox;
          const effectiveUpper =
            isSingleSame || resolvedPreset === 'classic' || resolvedPreset === 'minimal'
              ? captions.config.uppercase
              : basePreset.uppercase;

          const maxChars = getMaxCharsPerRow(
            effectiveFontSize,
            settings.aspect,
            captions.config.showSafeZoneGuide
          );
          const { rows, flatWords } = layoutCaptionRows({
            line: activeCaptionLine,
            wordsPerLine: captions.config.wordsPerLine,
            uppercase: effectiveUpper,
            maxCharsPerRow: maxChars,
          });
          if (rows.length === 0) return null;

          let activeWordIdx = flatWords.findIndex(
            (w) => currentTime >= w.start - 0.04 && currentTime <= w.end + 0.04
          );
          if (activeWordIdx < 0 && flatWords.length > 0) {
            activeWordIdx = Math.max(
              0,
              flatWords.findIndex((w) => w.end >= currentTime)
            );
          }

          const stickerBg =
            resolvedPreset === 'sticker-box'
              ? STICKER_BOX_CYCLE_COLORS[
                  (lineIdx + Math.max(0, activeWordIdx)) % STICKER_BOX_CYCLE_COLORS.length
                ]
              : undefined;

          const comicTilts = [-2.5, 2.2, -1.8, 2.5];
          const blockTilt =
            resolvedPreset === 'comic-burst'
              ? 'rotate(-2.5deg)'
              : resolvedPreset === 'hype-pop'
                ? `rotate(${comicTilts[lineIdx % comicTilts.length]}deg)`
                : undefined;

          const previewPx = Math.max(12, Math.round(effectiveFontSize * 0.34));
          const strokePx =
            effectiveOutline > 0 ? Math.max(1, Math.round(effectiveOutline * 0.42)) : 0;

          let cursorWordIdx = 0;

          return (
            <div
              style={
                captions.config.position === 'top'
                  ? { top: `${captions.config.offsetPercent}%` }
                  : captions.config.position === 'middle'
                    ? { top: '50%', transform: 'translateY(-50%)' }
                    : { bottom: `${captions.config.offsetPercent}%` }
              }
              className={`pointer-events-none absolute inset-x-0 z-25 flex justify-center text-center ${
                captions.config.showSafeZoneGuide ? 'pl-[6%] pr-[14%]' : 'px-[6%]'
              }`}
            >
              <div
                className={`inline-flex flex-col items-center gap-[0.18em] max-w-full ${
                  resolvedPreset === 'sticker-box'
                    ? 'px-3 py-1.5 rounded-md border-2 border-black shadow-[3px_3px_0_#000]'
                    : effectiveBox
                      ? 'bg-black/75 px-2.5 py-1 rounded'
                      : ''
                }`}
                style={{
                  backgroundColor: stickerBg,
                  fontFamily: (BUNDLED_FONTS[effectiveFontId] ?? BUNDLED_FONTS['sans-bold'])
                    .cssFamily,
                  fontWeight: 700,
                  fontSize: `${previewPx}px`,
                  lineHeight: 1.24,
                  transform: blockTilt,
                }}
              >
                {rows.map((rowWords, rIdx) => (
                  <div
                    key={`${activeCaptionLine.id}-row-${rIdx}`}
                    className="flex flex-wrap justify-center items-baseline gap-x-[0.3em]"
                  >
                    {rowWords.map((w, wOffset) => {
                      const myGlobalIdx = cursorWordIdx++;
                      const isActiveWord =
                        currentTime >= w.start - 0.04 && currentTime <= w.end + 0.04;

                      let wordColor = effectiveTextColor;
                      let wordScale = 'scale(1)';
                      let wordTilt = '';
                      let wordShadow =
                        resolvedPreset === 'comic-burst' ? '3px 3px 0 #000000' : undefined;

                      if (resolvedPreset === 'hype-pop') {
                        const cycleCol =
                          HYPE_POP_CYCLE_COLORS[
                            (lineIdx + myGlobalIdx) % HYPE_POP_CYCLE_COLORS.length
                          ];
                        wordColor = isActiveWord ? cycleCol : effectiveTextColor;
                        const tilts = [-3, 2.5, -2, 3];
                        wordTilt = `rotate(${tilts[myGlobalIdx % tilts.length]}deg)`;
                        if (isActiveWord) wordScale = 'scale(1.16)';
                      } else if (resolvedPreset === 'neon-glow') {
                        wordColor = isActiveWord ? '#FFFFFF' : '#E0FFFF';
                        wordShadow = isActiveWord
                          ? '0 0 8px #FFFFFF, 0 0 18px #00E5FF, 0 0 28px #00B8D4'
                          : '0 0 6px #00E5FF, 0 0 16px #00B8D4';
                      } else if (resolvedPreset === 'comic-burst') {
                        wordColor = isActiveWord ? effectiveHighlightColor : effectiveTextColor;
                        if (isActiveWord) wordScale = 'scale(1.14)';
                      } else if (resolvedPreset === 'sticker-box') {
                        wordColor = isActiveWord ? '#0E1217' : '#FFFFFF';
                        if (isActiveWord) wordScale = 'scale(1.06)';
                      } else if (
                        effectiveHighlightColor.toLowerCase() !== effectiveTextColor.toLowerCase()
                      ) {
                        wordColor = isActiveWord ? effectiveHighlightColor : effectiveTextColor;
                      }

                      const transformParts = [wordScale, wordTilt].filter(Boolean);

                      return (
                        <span
                          key={`${activeCaptionLine.id}-${rIdx}-${wOffset}`}
                          className="inline-block transition-transform duration-75"
                          style={{
                            color: wordColor,
                            transform:
                              transformParts.length > 0 ? transformParts.join(' ') : undefined,
                            WebkitTextStroke:
                              strokePx > 0 && resolvedPreset !== 'sticker-box'
                                ? `${strokePx}px ${
                                    resolvedPreset === 'neon-glow' ? '#003844' : '#000000'
                                  }`
                                : undefined,
                            paintOrder: 'stroke fill',
                            textShadow: wordShadow,
                          }}
                        >
                          {w.text}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Live Logo / Watermark Preview */}
        {logoOverlay.enabled && logoOverlay.dataUrl && !(isSplitLayout && editingSplitBoxes) && (
          <img
            src={logoOverlay.dataUrl}
            alt="Watermark overlay preview"
            referrerPolicy="no-referrer"
            style={{
              width: `${logoOverlay.sizePercent}%`,
              opacity: logoOverlay.opacity,
            }}
            className={`pointer-events-none absolute z-20 h-auto object-contain ${getLogoCornerClasses(
              logoOverlay.corner
            )}`}
          />
        )}

        {/* Framing indicator badge */}
        {isFillCrop && (
          <div className="pointer-events-none absolute top-2 left-2 z-30 max-w-[92%] inline-flex items-center gap-1.5 rounded bg-[#0e1217]/85 border border-[#39475a] px-2 py-1 text-[10px] text-[#eef2f6] whitespace-nowrap truncate">
            {isSmartActive ? (
              <>
                <Sparkles className="w-3 h-3 text-[#e59a24] shrink-0" />
                <span className="font-mono-num">
                  Smart follow ({Math.round(liveCrop.cropX * 100)}%,{' '}
                  {Math.round(liveCrop.cropY * 100)}%)
                </span>
              </>
            ) : settings.lockPosition ? (
              <>
                <Lock className="w-3 h-3 text-[#e59a24] shrink-0" />
                <span className="font-mono-num">
                  Locked ({Math.round(liveCrop.cropX * 100)}%, {Math.round(liveCrop.cropY * 100)}%)
                </span>
              </>
            ) : (
              <>
                <Move className="w-3 h-3 text-[#e59a24] shrink-0" />
                <span className="font-mono-num">
                  Drag crop ({Math.round(liveCrop.cropX * 100)}%,{' '}
                  {Math.round(liveCrop.cropY * 100)}%)
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
