import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { APP_CONFIG, BUNDLED_FONTS } from '../config/appConfig';
import type {
  CaptionConfig,
  CaptionLine,
  CaptionStylePresetId,
  ClipSegment,
  CropKeyframe,
  ExportSettings,
  LogoOverlayConfig,
  OverlayFontId,
  TextOverlayConfig,
} from '../types/editor';
import { buildAssSubtitles, CAPTION_PRESET_DEFAULTS } from '../utils/captions';
import { mapFfmpegErrorMessage } from '../utils/deviceCheck';
import { buildFfmpegArgs, getTargetDimensions } from '../utils/ffmpegArgs';

export interface ExportProgressInfo {
  phase: 'loading-core' | 'preparing' | 'encoding' | 'finalizing';
  percent: number;
  message: string;
}

class FfmpegService {
  private instance: FFmpeg | null = null;
  private loadingPromise: Promise<FFmpeg> | null = null;
  private cancelled = false;
  private fontCache = new Map<OverlayFontId, Uint8Array>();

  isLoaded(): boolean {
    return Boolean(this.instance?.loaded);
  }

  async ensureLoaded(onStatus?: (msg: string) => void): Promise<FFmpeg> {
    if (this.instance?.loaded) {
      return this.instance;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      onStatus?.('Loading FFmpeg WebAssembly core from this site...');
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);

      const ffmpeg = new FFmpeg();
      const configuredBase = APP_CONFIG.FFMPEG_CORE_BASE_URL || '/ffmpeg';
      const coreBase = /^https?:\/\//i.test(configuredBase)
        ? configuredBase
        : `${window.location.origin}${configuredBase.startsWith('/') ? configuredBase : `/${configuredBase}`}`;
      const coreURL = await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm');

      await ffmpeg.load({ coreURL, wasmURL });
      this.instance = ffmpeg;
      return ffmpeg;
    })();

    try {
      return await this.loadingPromise;
    } catch (err) {
      this.loadingPromise = null;
      throw err;
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (this.instance) {
      try {
        this.instance.terminate();
      } catch {
        // ignore termination error
      }
      this.instance = null;
    }
    this.loadingPromise = null;
  }

  private async fetchFontBytes(fontId: OverlayFontId): Promise<Uint8Array> {
    const cached = this.fontCache.get(fontId);
    if (cached) return cached.slice();

    const fontMeta = BUNDLED_FONTS[fontId] ?? BUNDLED_FONTS['sans-bold'];
    const resp = await fetch(fontMeta.publicUrl);
    if (!resp.ok) {
      throw new Error(
        `Missing caption font at ${fontMeta.publicUrl}. See README.md for placing open-license TTF fonts in /public/fonts.`
      );
    }
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error(
        `Caption font not found at ${fontMeta.publicUrl}. See README.md to add open-license TTF fonts.`
      );
    }
    const bytes = new Uint8Array(await resp.arrayBuffer());
    this.fontCache.set(fontId, bytes);
    return bytes.slice();
  }

  private dataUrlToBytes(dataUrl: string): Uint8Array {
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Extracts mono float32 PCM audio for a time range using ffmpeg.wasm.
   * Returns null cleanly if the input video contains no audio stream.
   */
  async extractMonoAudioPcm(params: {
    file: File;
    startTime: number;
    endTime: number;
    sampleRate: number;
    onStatus?: (msg: string) => void;
  }): Promise<Float32Array | null> {
    this.cancelled = false;
    const { file, startTime, endTime, sampleRate, onStatus } = params;
    const duration = Math.max(0.2, endTime - startTime);

    const ffmpeg = await this.ensureLoaded(onStatus);
    if (this.cancelled) {
      throw new Error('Operation cancelled.');
    }

    const extMatch = file.name.toLowerCase().match(/\.(mp4|mov|webm)$/);
    const inputExt = extMatch ? extMatch[1] : 'mp4';
    const inputFileName = `audio_in.${inputExt}`;
    const pcmFileName = 'audio_out.pcm';
    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => {
      logs.push(message);
      if (logs.length > 50) logs.shift();
    };

    ffmpeg.on('log', onLog);

    try {
      const { fetchFile } = await import('@ffmpeg/util');
      onStatus?.('Reading video into local FFmpeg memory...');
      await ffmpeg.writeFile(inputFileName, await fetchFile(file));
      if (this.cancelled) throw new Error('Operation cancelled.');

      onStatus?.(`Extracting ${sampleRate / 1000} kHz mono audio locally...`);
      const args = [
        '-ss',
        startTime.toFixed(3),
        '-t',
        duration.toFixed(3),
        '-i',
        inputFileName,
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(sampleRate),
        '-f',
        'f32le',
        pcmFileName,
      ];

      const exitCode = await ffmpeg.exec(args);
      if (this.cancelled) throw new Error('Operation cancelled.');

      if (exitCode !== 0) {
        const joined = logs.join('\n').toLowerCase();
        if (
          joined.includes('does not contain any stream') ||
          joined.includes('matches no streams') ||
          joined.includes('output file #0 does not contain any stream')
        ) {
          return null;
        }
        throw new Error(logs.slice(-5).join(' | ') || `Audio extraction failed (${exitCode})`);
      }

      const raw = await ffmpeg.readFile(pcmFileName);
      if (!(raw instanceof Uint8Array) || raw.byteLength < 4) {
        return null;
      }

      const alignedLen = raw.byteLength - (raw.byteLength % 4);
      const copy = raw.slice(0, alignedLen);
      return new Float32Array(copy.buffer);
    } catch (err) {
      if (this.cancelled) throw new Error('Operation cancelled.');
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('terminate')) throw new Error('Operation cancelled.');
      throw err;
    } finally {
      ffmpeg.off('log', onLog);
      if (this.instance?.loaded) {
        for (const tempFile of [inputFileName, pcmFileName]) {
          try {
            await this.instance.deleteFile(tempFile);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  async exportClip(params: {
    file: File;
    segment: ClipSegment;
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
    hasAudio: boolean;
    onProgress: (info: ExportProgressInfo) => void;
  }): Promise<{ blob: Blob; extension: 'mp4' | 'webm' | 'gif'; usedDrawtextFallback?: boolean }> {
    this.cancelled = false;
    const {
      file,
      segment,
      settings,
      textOverlay,
      logoOverlay,
      captions,
      cropPath = [],
      peakTimes = [],
      hasAudio,
      onProgress,
    } = params;

    onProgress({
      phase: 'loading-core',
      percent: 5,
      message: 'Initializing local FFmpeg core...',
    });

    const ffmpeg = await this.ensureLoaded((msg) => {
      onProgress({ phase: 'loading-core', percent: 8, message: msg });
    });

    if (this.cancelled) {
      throw new Error('Export cancelled.');
    }

    onProgress({
      phase: 'preparing',
      percent: 15,
      message: 'Staging video into browser memory...',
    });

    const extMatch = file.name.toLowerCase().match(/\.(mp4|mov|webm)$/);
    const inputExt = extMatch ? extMatch[1] : 'mp4';
    const inputFileName = `input.${inputExt}`;

    const hasCaptions = Boolean(
      captions?.config.enabled && captions.lines.length > 0 && settings.format !== 'gif'
    );

    const previewArgs = buildFfmpegArgs({
      inputFileName,
      outputFileName: 'temp.mp4',
      segment,
      settings,
      textOverlay,
      logoOverlay,
      captions:
        hasCaptions && captions
          ? {
              config: captions.config,
              lines: captions.lines,
              resolvedStyleMap: captions.resolvedStyleMap,
            }
          : undefined,
      cropPath,
      peakTimes,
      hasAudio,
    });

    const outputExt: 'mp4' | 'webm' | 'gif' =
      settings.format === 'gif'
        ? 'gif'
        : previewArgs.mode === 'fast-copy' && inputExt === 'webm'
          ? 'webm'
          : 'mp4';
    const outputFileName = `output.${outputExt}`;
    const logoFileName = 'logo.png';
    const assFileName = 'captions.ass';

    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => {
      logs.push(message);
      if (logs.length > 100) logs.shift();
    };
    const onFfmpegProgress = ({ progress }: { progress: number }) => {
      if (this.cancelled) return;
      const pct = Math.min(95, Math.max(20, Math.round(20 + progress * 75)));
      onProgress({
        phase: 'encoding',
        percent: pct,
        message: `Processing clip (${pct}%)...`,
      });
    };

    ffmpeg.on('log', onLog);
    ffmpeg.on('progress', onFfmpegProgress);

    let usedDrawtextFallback = false;

    try {
      const { fetchFile } = await import('@ffmpeg/util');
      await ffmpeg.writeFile(inputFileName, await fetchFile(file));

      const needsTextFont =
        textOverlay.enabled && textOverlay.text.trim().length > 0 && settings.format !== 'gif';

      if (needsTextFont || hasCaptions) {
        try {
          await ffmpeg.createDir('/fonts');
        } catch {
          // directory already exists
        }
        if (needsTextFont) {
          const hookFontBytes = await this.fetchFontBytes(textOverlay.font);
          await ffmpeg.writeFile('/fonts/caption.ttf', hookFontBytes.slice());
        }
        if (hasCaptions && captions) {
          const neededFontIds = new Set<OverlayFontId>([captions.config.font]);
          const defPresetMeta = CAPTION_PRESET_DEFAULTS[captions.config.preset];
          if (defPresetMeta) neededFontIds.add(defPresetMeta.font);
          for (const line of captions.lines) {
            const pId =
              line.styleOverride ??
              captions.resolvedStyleMap?.[line.id] ??
              captions.config.preset;
            const pMeta = CAPTION_PRESET_DEFAULTS[pId];
            if (pMeta) neededFontIds.add(pMeta.font);
          }

          let primaryCapBytes: Uint8Array | null = null;
          for (const fid of neededFontIds) {
            const fontMeta = BUNDLED_FONTS[fid];
            if (!fontMeta) continue;
            const bytes = await this.fetchFontBytes(fid);
            await ffmpeg.writeFile(`/fonts/${fontMeta.assFamily}.ttf`, bytes.slice());
            if (fid === captions.config.font || !primaryCapBytes) {
              primaryCapBytes = bytes;
            }
          }
          if (!needsTextFont && primaryCapBytes) {
            await ffmpeg.writeFile('/fonts/caption.ttf', primaryCapBytes.slice());
          }

          const { width: targetW, height: targetH } = getTargetDimensions(
            settings.aspect,
            settings.quality
          );
          const assContent = buildAssSubtitles(
            captions.lines,
            captions.config,
            segment.startTime,
            segment.endTime,
            settings.speed,
            targetW,
            targetH,
            captions.resolvedStyleMap
          );
          await ffmpeg.writeFile(assFileName, new TextEncoder().encode(assContent));
        }
      }

      if (logoOverlay.enabled && logoOverlay.dataUrl && settings.format !== 'gif') {
        await ffmpeg.writeFile(logoFileName, this.dataUrlToBytes(logoOverlay.dataUrl));
      }

      const runOnce = async (assumeAudio: boolean, useDrawtextForCaptions: boolean) => {
        const { mode, args } = buildFfmpegArgs({
          inputFileName,
          outputFileName,
          segment,
          settings,
          textOverlay,
          logoOverlay,
          captions:
            hasCaptions && captions
              ? {
                  config: captions.config,
                  lines: captions.lines,
                  resolvedStyleMap: captions.resolvedStyleMap,
                  assVirtualPath: assFileName,
                  useDrawtextFallback: useDrawtextForCaptions,
                }
              : undefined,
          cropPath,
          peakTimes,
          hasAudio: assumeAudio,
          fontVirtualPath: '/fonts/caption.ttf',
          logoVirtualPath: logoFileName,
        });

        onProgress({
          phase: 'encoding',
          percent: 20,
          message:
            mode === 'fast-copy'
              ? 'Trimming in Fast Copy mode...'
              : 'Re-encoding clip (H.264 + AAC veryfast)...',
        });

        const exitCode = await ffmpeg.exec(args);
        if (this.cancelled) {
          throw new Error('Export cancelled.');
        }
        return exitCode;
      };

      let assumedAudio = hasAudio;
      let exitCode = await runOnce(assumedAudio, false);

      // Fallback 1: source video actually has no audio stream
      if (exitCode !== 0 && assumedAudio) {
        const joined = logs.join('\n').toLowerCase();
        if (joined.includes('matches no streams') || joined.includes('stream specifier')) {
          logs.length = 0;
          assumedAudio = false;
          exitCode = await runOnce(false, false);
        }
      }

      // Fallback 2: if ASS filter fails, retry with drawtext fallback
      if (exitCode !== 0 && hasCaptions) {
        logs.length = 0;
        usedDrawtextFallback = true;
        exitCode = await runOnce(assumedAudio, true);
      }

      if (exitCode !== 0) {
        const tail = logs.slice(-6).join(' | ');
        throw new Error(tail || `FFmpeg exited with code ${exitCode}`);
      }

      onProgress({
        phase: 'finalizing',
        percent: 98,
        message: 'Packaging output file...',
      });

      const outData = await ffmpeg.readFile(outputFileName);
      const uint8 = outData instanceof Uint8Array ? outData : new TextEncoder().encode(String(outData));
      const arrayBuffer = uint8.slice().buffer;
      const mime =
        outputExt === 'gif'
          ? 'image/gif'
          : outputExt === 'webm'
            ? 'video/webm'
            : 'video/mp4';
      const blob = new Blob([arrayBuffer], { type: mime });

      return { blob, extension: outputExt, usedDrawtextFallback };
    } catch (err) {
      if (this.cancelled) {
        throw new Error('Export cancelled.');
      }
      throw new Error(mapFfmpegErrorMessage(err));
    } finally {
      ffmpeg.off('log', onLog);
      ffmpeg.off('progress', onFfmpegProgress);
      if (this.instance?.loaded) {
        for (const tempFile of [inputFileName, outputFileName, logoFileName, assFileName]) {
          try {
            await this.instance.deleteFile(tempFile);
          } catch {
            // ignore missing file
          }
        }
      }
    }
  }
}

export const ffmpegService = new FfmpegService();
