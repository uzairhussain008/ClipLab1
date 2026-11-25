import { ASPECT_PRESETS } from '../config/appConfig';
import type {
  AspectRatioId,
  CaptionConfig,
  CaptionLine,
  CaptionStylePresetId,
  ClipSegment,
  CropKeyframe,
  ExportQuality,
  ExportSettings,
  LogoCorner,
  LogoOverlayConfig,
  ProcessingMode,
  TextOverlayConfig,
} from '../types/editor';
import { CAPTION_PRESET_DEFAULTS, getMaxCharsPerRow, layoutCaptionRows } from './captions';
import { buildPiecewiseCropExpr } from './smartAnalysis';

export interface BuildFfmpegArgsInput {
  inputFileName: string;
  outputFileName: string;
  segment: ClipSegment;
  settings: ExportSettings;
  textOverlay: TextOverlayConfig;
  logoOverlay: LogoOverlayConfig;
  captions?: {
    config: CaptionConfig;
    lines: CaptionLine[];
    resolvedStyleMap?: Record<string, CaptionStylePresetId>;
    assVirtualPath?: string;
    useDrawtextFallback?: boolean;
  };
  cropPath?: CropKeyframe[];
  peakTimes?: number[];
  hasAudio?: boolean;
  fontVirtualPath?: string;
  logoVirtualPath?: string;
}

export function getTargetDimensions(
  aspect: AspectRatioId,
  quality: ExportQuality
): { width: number; height: number } {
  const preset = ASPECT_PRESETS.find((p) => p.id === aspect) ?? ASPECT_PRESETS[0];
  const scaleFactor = quality === 'small' ? 2 / 3 : 1;
  const makeEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return {
    width: makeEven(preset.width * scaleFactor),
    height: makeEven(preset.height * scaleFactor),
  };
}

export function getProcessingMode(
  settings: ExportSettings,
  textOverlay: TextOverlayConfig,
  logoOverlay: LogoOverlayConfig,
  captionsEnabledAndNonEmpty = false
): ProcessingMode {
  if (settings.format === 'gif') return 're-encode';
  if (!settings.keepOriginalFraming) return 're-encode';
  if (textOverlay.enabled && textOverlay.text.trim().length > 0) return 're-encode';
  if (logoOverlay.enabled && logoOverlay.dataUrl.length > 0) return 're-encode';
  if (captionsEnabledAndNonEmpty) return 're-encode';
  if (settings.zoom.punchZoom > 1.01 || settings.zoom.slowZoom || settings.zoom.pulseOnPeaks) {
    return 're-encode';
  }
  if (Math.abs(settings.speed - 1) > 0.01) return 're-encode';
  if (settings.muted || Math.abs(settings.volume - 1) > 0.01) return 're-encode';
  if (settings.quality === 'small') return 're-encode';
  return 'fast-copy';
}

export function escapeDrawtext(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ');
}

function getLogoPositionExpr(corner: LogoCorner, padPx: number): string {
  switch (corner) {
    case 'top-left':
      return `x=${padPx}:y=${padPx}`;
    case 'top-right':
      return `x=W-w-${padPx}:y=${padPx}`;
    case 'bottom-left':
      return `x=${padPx}:y=H-h-${padPx}`;
    case 'bottom-right':
    default:
      return `x=W-w-${padPx}:y=H-h-${padPx}`;
  }
}

function buildZoomFilter(
  inputLabel: string,
  settings: ExportSettings,
  segment: ClipSegment,
  peakTimes: number[],
  outW: number,
  outH: number
): { chain: string[]; outputLabel: string } {
  const { punchZoom, slowZoom, pulseOnPeaks } = settings.zoom;
  const hasStaticPunch = punchZoom > 1.01;
  const clipDur = Math.max(0.2, (segment.endTime - segment.startTime) / Math.max(0.5, settings.speed));

  const relevantPeaks = pulseOnPeaks
    ? peakTimes
        .filter((pt) => pt >= segment.startTime && pt <= segment.endTime)
        .slice(0, 5)
        .map((pt) => (pt - segment.startTime) / Math.max(0.5, settings.speed))
    : [];

  if (!hasStaticPunch && !slowZoom && relevantPeaks.length === 0) {
    return { chain: [], outputLabel: inputLabel };
  }

  // Pure static punch zoom without animated slowZoom/pulse is instant via crop+scale
  if (!slowZoom && relevantPeaks.length === 0 && hasStaticPunch) {
    const z = Math.min(1.5, Math.max(1.0, punchZoom)).toFixed(3);
    return {
      chain: [
        `${inputLabel}crop=w=trunc(iw/${z}/2)*2:h=trunc(ih/${z}/2)*2:x='(iw-ow)/2':y='(ih-oh)/2',scale=${outW}:${outH},setsar=1[v_zoom]`,
      ],
      outputLabel: '[v_zoom]',
    };
  }

  // Animated slow zoom / peak pulse via normalized time t=on/(30*clipDur)
  const terms: string[] = [Math.min(1.5, Math.max(1.0, punchZoom)).toFixed(3)];
  if (slowZoom) {
    terms.push(`0.10*min(1,it/${clipDur.toFixed(2)})`);
  }
  for (const tp of relevantPeaks) {
    // 0.36s triangle pulse centered at peak time tp
    terms.push(`0.09*max(0,1-abs(it-${tp.toFixed(2)})/0.18)`);
  }

  const zExpr = `min(1.5,${terms.join('+')})`;
  return {
    chain: [
      `${inputLabel}fps=30,zoompan=z='${zExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${outW}x${outH}:fps=30,setsar=1[v_zoom]`,
    ],
    outputLabel: '[v_zoom]',
  };
}

export function buildFfmpegArgs(input: BuildFfmpegArgsInput): {
  mode: ProcessingMode;
  args: string[];
} {
  const {
    inputFileName,
    outputFileName,
    segment,
    settings,
    textOverlay,
    logoOverlay,
    captions,
    cropPath = [],
    peakTimes = [],
    hasAudio = true,
    fontVirtualPath = '/fonts/caption.ttf',
    logoVirtualPath = 'logo.png',
  } = input;

  const hasCaptions = Boolean(captions?.config.enabled && captions.lines.length > 0);
  const duration = Math.max(0.2, segment.endTime - segment.startTime);
  const startStr = segment.startTime.toFixed(3);
  const durationStr = duration.toFixed(3);
  const mode = getProcessingMode(settings, textOverlay, logoOverlay, hasCaptions);

  if (mode === 'fast-copy') {
    const fastCopyArgs = [
      '-ss',
      startStr,
      '-i',
      inputFileName,
      '-t',
      durationStr,
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
    ];
    if (outputFileName.toLowerCase().endsWith('.mp4')) {
      fastCopyArgs.push('-movflags', '+faststart');
    }
    fastCopyArgs.push(outputFileName);
    return { mode, args: fastCopyArgs };
  }

  const args: string[] = ['-ss', startStr, '-i', inputFileName, '-t', durationStr];

  const hasLogo = logoOverlay.enabled && logoOverlay.dataUrl.length > 0;
  if (hasLogo && settings.format !== 'gif') {
    args.push('-i', logoVirtualPath);
  }

  const { width: targetW, height: targetH } = getTargetDimensions(settings.aspect, settings.quality);
  const cropX = Math.min(1, Math.max(0, settings.cropX));
  const cropY = Math.min(1, Math.max(0, settings.cropY));

  const filterChains: string[] = [];
  let currentVideoLabel = '[0:v]';

  // 1. Speed on video
  if (Math.abs(settings.speed - 1) > 0.01) {
    const ptsFactor = (1 / settings.speed).toFixed(4);
    filterChains.push(`${currentVideoLabel}setpts=${ptsFactor}*PTS[v_spd]`);
    currentVideoLabel = '[v_spd]';
  }

  // 2. Framing / Smart Reframe / Split Layout / Blur Fill
  const isBlurBg =
    !settings.keepOriginalFraming &&
    ((settings.aspect === '9:16' && settings.verticalMode === 'blur-bg') ||
      settings.reframeMode === 'blur-bg');

  const isSplitLayout =
    !settings.keepOriginalFraming &&
    settings.aspect === '9:16' &&
    settings.reframeMode === 'split-layout' &&
    settings.format !== 'gif';

  const useSmartFollow =
    !settings.keepOriginalFraming &&
    !isBlurBg &&
    !isSplitLayout &&
    !settings.lockPosition &&
    (settings.reframeMode === 'smart-follow' || settings.reframeMode === 'face-aware') &&
    cropPath.length > 0;

  if (settings.format === 'gif') {
    if (!settings.keepOriginalFraming) {
      const gifW = Math.min(480, targetW);
      const gifH = Math.max(2, Math.round(((gifW * targetH) / targetW) / 2) * 2);
      if (isBlurBg) {
        filterChains.push(
          `${currentVideoLabel}split=2[bg][fg]`,
          `[bg]scale=${gifW}:${gifH}:force_original_aspect_ratio=increase,crop=${gifW}:${gifH},boxblur=12:2[bg_blur]`,
          `[fg]scale=${gifW}:${gifH}:force_original_aspect_ratio=decrease[fg_fit]`,
          `[bg_blur][fg_fit]overlay=(W-w)/2:(H-h)/2,fps=12[v_framed]`
        );
      } else {
        filterChains.push(
          `${currentVideoLabel}scale=${gifW}:${gifH}:force_original_aspect_ratio=increase,crop=${gifW}:${gifH}:(iw-${gifW})*${cropX.toFixed(3)}:(ih-${gifH})*${cropY.toFixed(3)},fps=12[v_framed]`
        );
      }
    } else {
      filterChains.push(`${currentVideoLabel}scale=w=480:h=-2:flags=lanczos,fps=12[v_framed]`);
    }
    currentVideoLabel = '[v_framed]';
  } else if (isSplitLayout) {
    const { gameplayRatioPercent, backgroundMode, gameplayBox, facecamBox } = settings.splitLayout;
    const makeEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);
    const topH = makeEven((targetH * Math.min(80, Math.max(50, gameplayRatioPercent))) / 100);
    const botH = targetH - topH;

    const gpCrop = `crop=w=trunc(iw*${gameplayBox.w.toFixed(3)}/2)*2:h=trunc(ih*${gameplayBox.h.toFixed(3)}/2)*2:x=trunc(iw*${gameplayBox.x.toFixed(3)}):y=trunc(ih*${gameplayBox.y.toFixed(3)})`;
    const fcCrop = `crop=w=trunc(iw*${facecamBox.w.toFixed(3)}/2)*2:h=trunc(ih*${facecamBox.h.toFixed(3)}/2)*2:x=trunc(iw*${facecamBox.x.toFixed(3)}):y=trunc(ih*${facecamBox.y.toFixed(3)})`;

    if (backgroundMode === 'fill') {
      filterChains.push(
        `${currentVideoLabel}split=2[gp_src][fc_src]`,
        `[gp_src]${gpCrop},scale=${targetW}:${topH}:force_original_aspect_ratio=increase,crop=${targetW}:${topH},setsar=1[gp_out]`,
        `[fc_src]${fcCrop},scale=${targetW}:${botH}:force_original_aspect_ratio=increase,crop=${targetW}:${botH},setsar=1[fc_out]`,
        `[gp_out][fc_out]vstack=inputs=2[v_framed]`
      );
    } else {
      filterChains.push(
        `${currentVideoLabel}split=3[bg_src][gp_src][fc_src]`,
        `[bg_src]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=20:2,eq=brightness=0.02:saturation=0.95[bg_blur]`,
        `[gp_src]${gpCrop},scale=${targetW}:${topH}:force_original_aspect_ratio=decrease,setsar=1[gp_fit]`,
        `[fc_src]${fcCrop},scale=${targetW}:${botH}:force_original_aspect_ratio=decrease,setsar=1[fc_fit]`,
        `[bg_blur][gp_fit]overlay=(W-w)/2:(${topH}-h)/2[v_top]`,
        `[v_top][fc_fit]overlay=(W-w)/2:${topH}+(${botH}-h)/2,setsar=1[v_framed]`
      );
    }
    currentVideoLabel = '[v_framed]';
  } else if (!settings.keepOriginalFraming) {
    if (isBlurBg) {
      const fgScale = Math.min(1.4, Math.max(1.0, (settings.foregroundSizePercent || 100) / 100));
      const fgW = Math.max(2, Math.round((targetW * fgScale) / 2) * 2);
      filterChains.push(
        `${currentVideoLabel}split=2[bg][fg]`,
        `[bg]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=20:2,eq=brightness=0.02:saturation=0.95[bg_blur]`,
        `[fg]scale=${fgW}:-2[fg_fit]`,
        `[bg_blur][fg_fit]overlay=(W-w)/2:(H-h)/2,setsar=1[v_framed]`
      );
    } else if (useSmartFollow) {
      const xExpr = buildPiecewiseCropExpr(
        cropPath,
        segment.startTime,
        segment.endTime,
        'x',
        `iw-${targetW}`
      );
      const yExpr = buildPiecewiseCropExpr(
        cropPath,
        segment.startTime,
        segment.endTime,
        'y',
        `ih-${targetH}`
      );
      filterChains.push(
        `${currentVideoLabel}scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}:'${xExpr}':'${yExpr}',setsar=1[v_framed]`
      );
    } else {
      filterChains.push(
        `${currentVideoLabel}scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}:(iw-${targetW})*${cropX.toFixed(3)}:(ih-${targetH})*${cropY.toFixed(3)},setsar=1[v_framed]`
      );
    }
    currentVideoLabel = '[v_framed]';
  } else if (settings.quality === 'small') {
    filterChains.push(`${currentVideoLabel}scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2,setsar=1[v_framed]`);
    currentVideoLabel = '[v_framed]';
  }

  // 2b. Zoom (Punch-in, Slow Zoom, Pulse on loud peaks)
  if (settings.format !== 'gif' && !settings.keepOriginalFraming) {
    const zoomRes = buildZoomFilter(currentVideoLabel, settings, segment, peakTimes, targetW, targetH);
    if (zoomRes.chain.length > 0) {
      filterChains.push(...zoomRes.chain);
      currentVideoLabel = zoomRes.outputLabel;
    }
  }

  // 3. Hook Title Text Overlay (drawtext)
  const hasText = textOverlay.enabled && textOverlay.text.trim().length > 0;
  if (hasText && settings.format !== 'gif') {
    const escapedText = escapeDrawtext(textOverlay.text.trim());
    const relStart = Math.max(0, textOverlay.startTime - segment.startTime);
    const relEnd = Math.min(duration, Math.max(relStart + 0.1, textOverlay.endTime - segment.startTime));
    const speedAdjStart = Number((relStart / settings.speed).toFixed(2));
    const speedAdjEnd = Number((relEnd / settings.speed).toFixed(2));
    const yExpr = textOverlay.position === 'top' ? 'h*0.09' : 'h-th-h*0.11';
    const fontScale = settings.quality === 'small' ? 0.67 : 1;
    const fontSizePx = Math.max(16, Math.round(textOverlay.fontSize * fontScale));
    const borderPx = Math.max(0, Math.round(textOverlay.outlineWidth * fontScale));

    const alphaExpr = textOverlay.hookFade
      ? `:alpha='if(lt(t,${(speedAdjStart + 0.3).toFixed(2)}),max(0,(t-${speedAdjStart.toFixed(2)})/0.3),if(gt(t,${Math.max(speedAdjStart + 0.3, speedAdjEnd - 0.3).toFixed(2)}),max(0,(${speedAdjEnd.toFixed(2)}-t)/0.3),1))'`
      : '';

    filterChains.push(
      `${currentVideoLabel}drawtext=fontfile='${fontVirtualPath}':text='${escapedText}':fontsize=${fontSizePx}:fontcolor=${textOverlay.color}:borderw=${borderPx}:bordercolor=${textOverlay.outlineColor}:x=(w-text_w)/2:y=${yExpr}:enable='between(t,${speedAdjStart.toFixed(2)},${speedAdjEnd.toFixed(2)})'${alphaExpr}[v_txt]`
    );
    currentVideoLabel = '[v_txt]';
  }

  // 3b. Auto Captions (ASS via libass OR drawtext fallback)
  if (hasCaptions && captions && settings.format !== 'gif') {
    if (captions.assVirtualPath && !captions.useDrawtextFallback) {
      filterChains.push(
        `${currentVideoLabel}ass=filename='${captions.assVirtualPath}':fontsdir='/fonts'[v_cap]`
      );
      currentVideoLabel = '[v_cap]';
    } else {
      // Static drawtext fallback per wrapped row (ASS animations, tilt, glow, and word colors unavailable)
      const cfg = captions.config;
      const fontScale = settings.quality === 'small' ? 0.67 : 1;
      const maxChars = getMaxCharsPerRow(cfg.fontSize, settings.aspect, cfg.showSafeZoneGuide);

      let capIdx = 0;
      for (const line of captions.lines) {
        if (line.endTime <= segment.startTime || line.startTime >= segment.endTime) continue;
        const rs = Math.max(0, (line.startTime - segment.startTime) / settings.speed);
        const re = Math.min(duration / settings.speed, (line.endTime - segment.startTime) / settings.speed);
        if (re - rs < 0.08) continue;

        const effectivePreset =
          line.styleOverride ?? captions.resolvedStyleMap?.[line.id] ?? cfg.preset;
        const baseMeta = CAPTION_PRESET_DEFAULTS[effectivePreset] ?? CAPTION_PRESET_DEFAULTS.classic;
        const isSingleSame = (cfg.styleMode ?? 'single') === 'single' && effectivePreset === cfg.preset;
        const effectiveSize = isSingleSame ? cfg.fontSize : baseMeta.fontSize;
        const effectiveColor = isSingleSame ? cfg.textColor : baseMeta.textColor;
        const effectiveOutline = isSingleSame ? cfg.outlineWidth : baseMeta.outlineWidth;
        const effectiveBox = isSingleSame ? cfg.backgroundBox : baseMeta.backgroundBox;
        const effectiveUpper =
          isSingleSame || effectivePreset === 'classic' || effectivePreset === 'minimal'
            ? cfg.uppercase
            : baseMeta.uppercase;

        const fSize = Math.max(16, Math.round(effectiveSize * fontScale));
        const rowStep = Math.round(fSize * 1.24);
        const boxOpt = effectiveBox ? `:box=1:boxcolor=black@0.65:boxborderw=10` : '';

        const { rows } = layoutCaptionRows({
          line,
          wordsPerLine: cfg.wordsPerLine,
          uppercase: effectiveUpper,
          maxCharsPerRow: maxChars,
        });
        const totalRows = rows.length;
        if (totalRows === 0) continue;

        rows.forEach((rowWords, rowIdx) => {
          const rowText = escapeDrawtext(rowWords.map((w) => w.text).join(' '));
          const yExpr =
            cfg.position === 'top'
              ? `h*${(cfg.offsetPercent / 100).toFixed(2)}+${rowIdx * rowStep}`
              : cfg.position === 'middle'
                ? `(h-${totalRows * rowStep})/2+${rowIdx * rowStep}`
                : `h-${(totalRows - rowIdx) * rowStep}-h*${(cfg.offsetPercent / 100).toFixed(2)}`;
          const nextLabel = `[v_cap_${capIdx++}]`;
          filterChains.push(
            `${currentVideoLabel}drawtext=fontfile='${fontVirtualPath}':text='${rowText}':fontsize=${fSize}:fontcolor=${effectiveColor}:borderw=${effectiveOutline}:bordercolor=black${boxOpt}:x=(w-text_w)/2:y=${yExpr}:enable='between(t,${rs.toFixed(2)},${re.toFixed(2)})'${nextLabel}`
          );
          currentVideoLabel = nextLabel;
        });
      }
    }
  }

  // 4. Logo / Watermark PNG Overlay
  if (hasLogo && settings.format !== 'gif') {
    const logoWidthPx = Math.max(24, Math.round((targetW * logoOverlay.sizePercent) / 100));
    const padPx = Math.max(12, Math.round(targetW * 0.04));
    const alpha = Math.min(1, Math.max(0.05, logoOverlay.opacity));
    const posExpr = getLogoPositionExpr(logoOverlay.corner, padPx);

    filterChains.push(
      `[1:v]scale=w=${logoWidthPx}:h=-1,format=rgba,colorchannelmixer=aa=${alpha.toFixed(2)}[wm]`,
      `${currentVideoLabel}[wm]overlay=${posExpr}[v_logo]`
    );
    currentVideoLabel = '[v_logo]';
  }

  if (settings.format === 'gif') {
    filterChains.push(
      `${currentVideoLabel}split[g0][g1]`,
      `[g0]palettegen=max_colors=128[pal]`,
      `[g1][pal]paletteuse=dither=bayer[v_out]`
    );
    args.push('-filter_complex', filterChains.join(';'), '-map', '[v_out]', '-an', outputFileName);
    return { mode, args };
  }

  filterChains.push(`${currentVideoLabel}format=yuv420p[v_out]`);

  const useAudioFilters =
    hasAudio &&
    !settings.muted &&
    (Math.abs(settings.speed - 1) > 0.01 || Math.abs(settings.volume - 1) > 0.01);

  if (useAudioFilters) {
    const audioParts: string[] = [];
    if (Math.abs(settings.speed - 1) > 0.01) {
      audioParts.push(`atempo=${settings.speed.toFixed(3)}`);
    }
    if (Math.abs(settings.volume - 1) > 0.01) {
      audioParts.push(`volume=${settings.volume.toFixed(2)}`);
    }
    filterChains.push(`[0:a]${audioParts.join(',')}[a_out]`);
  }

  args.push('-filter_complex', filterChains.join(';'), '-map', '[v_out]');

  if (settings.muted || !hasAudio) {
    args.push('-an');
  } else if (useAudioFilters) {
    args.push('-map', '[a_out]');
  } else {
    args.push('-map', '0:a?');
  }

  const crf = settings.quality === 'small' ? '28' : settings.quality === 'shorts' ? '20' : '23';
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf);

  if (!settings.muted && hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  }

  args.push('-movflags', '+faststart', outputFileName);
  return { mode, args };
}
