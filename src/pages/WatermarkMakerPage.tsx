import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Download, RotateCcw } from 'lucide-react';
import { useClipLab } from '../context/ClipLabContext';
import type { WatermarkMakerConfig } from '../types/editor';
import { sanitizeFilename } from '../utils/timecode';
import { WATERMARK_MAKER_STEPS } from '../utils/seo';

const DEFAULT_CONFIG: WatermarkMakerConfig = {
  text: 'DOWNTOWN CLIPS',
  fontStyle: 'condensed',
  fontSize: 76,
  textColor: '#eef2f6',
  outlineColor: '#0e1217',
  outlineWidth: 8,
  shadowEnabled: true,
  shadowColor: '#000000',
  shadowBlur: 12,
  uppercase: true,
  letterSpacing: 3,
};

function drawWatermarkToCanvas(canvas: HTMLCanvasElement, cfg: WatermarkMakerConfig) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 960;
  const height = 280;
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  const label = (cfg.uppercase ? cfg.text.toUpperCase() : cfg.text).trim() || 'WATERMARK';
  const fontFamily =
    cfg.fontStyle === 'mono'
      ? '"JetBrains Mono", monospace'
      : '"Oswald", "Arial Narrow", sans-serif';

  ctx.save();
  ctx.font = `700 ${cfg.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Apply letter spacing when supported by Canvas2D
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${cfg.letterSpacing}px`;
  }

  const cx = width / 2;
  const cy = height / 2;

  if (cfg.shadowEnabled) {
    ctx.shadowColor = cfg.shadowColor;
    ctx.shadowBlur = cfg.shadowBlur;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;
  }

  if (cfg.outlineWidth > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = cfg.outlineWidth * 2;
    ctx.strokeStyle = cfg.outlineColor;
    ctx.strokeText(label, cx, cy);
  }

  // Clear shadow for crisp fill, or keep subtle fill
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = cfg.textColor;
  ctx.fillText(label, cx, cy);

  // Stencil effect: carve clean horizontal military stencil gap across the center
  if (cfg.fontStyle === 'stencil') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    const slitHeight = Math.max(3, Math.round(cfg.fontSize * 0.06));
    ctx.fillRect(40, cy - slitHeight / 2, width - 80, slitHeight);
  }

  ctx.restore();
}

export function WatermarkMakerPage() {
  const navigate = useNavigate();
  const { setTransferredLogo } = useClipLab();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [config, setConfig] = useState<WatermarkMakerConfig>(DEFAULT_CONFIG);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    const render = () => {
      if (active) drawWatermarkToCanvas(canvas, config);
    };
    render();
    if (document.fonts?.ready) {
      document.fonts.ready.then(render).catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [config]);

  const exportTrimmedPngDataUrl = (): string | null => {
    const srcCanvas = canvasRef.current;
    if (!srcCanvas) return null;
    const ctx = srcCanvas.getContext('2d');
    if (!ctx) return null;

    // Trim transparent padding cleanly so watermark scales predictably in video editor
    const { width, height } = srcCanvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = pixels[(y * width + x) * 4 + 3];
        if (alpha > 4) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) {
      return srcCanvas.toDataURL('image/png');
    }

    const pad = 16;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sw;
    outCanvas.height = sh;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return srcCanvas.toDataURL('image/png');
    outCtx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return outCanvas.toDataURL('image/png');
  };

  const handleDownloadPng = () => {
    const dataUrl = exportTrimmedPngDataUrl();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${sanitizeFilename(config.text)}-watermark.png`;
    a.click();
    setStatusMessage('Transparent PNG downloaded.');
  };

  const handleSendToEditor = () => {
    const dataUrl = exportTrimmedPngDataUrl();
    if (!dataUrl) return;
    setTransferredLogo({
      dataUrl,
      fileName: `${sanitizeFilename(config.text)}-watermark.png`,
    });
    navigate('/editor');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#2a3544] pb-5">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">
            Watermark Maker
          </h1>
          <p className="text-sm text-[#9aa7b8] mt-1">
            Build a crisp transparent PNG tag for your channel, then export it or send it straight
            to the video editor.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setConfig(DEFAULT_CONFIG);
            setStatusMessage(null);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#2a3544] bg-[#151b22] hover:border-[#39475a] text-xs font-medium text-[#9aa7b8] hover:text-[#eef2f6] self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <div className="lg:col-span-5 rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="wm-text" className="block text-xs font-medium text-[#eef2f6]">
              Watermark Text
            </label>
            <input
              id="wm-text"
              type="text"
              maxLength={32}
              value={config.text}
              onChange={(e) => setConfig((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="Your handle or clan tag"
              className="w-full rounded-md border border-[#2a3544] bg-[#0e1217] px-3 py-2 text-sm text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="wm-font" className="block text-xs font-medium text-[#eef2f6]">
                Font Style
              </label>
              <select
                id="wm-font"
                value={config.fontStyle}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    fontStyle: e.target.value as WatermarkMakerConfig['fontStyle'],
                  }))
                }
                className="w-full rounded-md border border-[#2a3544] bg-[#0e1217] px-2.5 py-2 text-sm text-[#eef2f6]"
              >
                <option value="condensed">Condensed Bold</option>
                <option value="stencil">Stencil Cut</option>
                <option value="mono">Tactical Mono</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wm-size" className="block text-xs font-medium text-[#eef2f6]">
                Size ({config.fontSize}px)
              </label>
              <input
                id="wm-size"
                type="range"
                min={36}
                max={120}
                value={config.fontSize}
                onChange={(e) => setConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                className="w-full accent-[#e59a24] mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="wm-color" className="block text-xs font-medium text-[#eef2f6]">
                Text Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="wm-color"
                  type="color"
                  value={config.textColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, textColor: e.target.value }))}
                  className="h-9 w-12 rounded border border-[#2a3544] bg-[#0e1217] cursor-pointer"
                />
                <span className="font-mono-num text-xs text-[#9aa7b8]">{config.textColor}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wm-outline-color" className="block text-xs font-medium text-[#eef2f6]">
                Outline Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="wm-outline-color"
                  type="color"
                  value={config.outlineColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, outlineColor: e.target.value }))}
                  className="h-9 w-12 rounded border border-[#2a3544] bg-[#0e1217] cursor-pointer"
                />
                <span className="font-mono-num text-xs text-[#9aa7b8]">{config.outlineColor}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="wm-outline" className="block text-xs font-medium text-[#eef2f6]">
                Outline ({config.outlineWidth}px)
              </label>
              <input
                id="wm-outline"
                type="range"
                min={0}
                max={16}
                value={config.outlineWidth}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, outlineWidth: Number(e.target.value) }))
                }
                className="w-full accent-[#e59a24]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wm-spacing" className="block text-xs font-medium text-[#eef2f6]">
                Letter Spacing ({config.letterSpacing}px)
              </label>
              <input
                id="wm-spacing"
                type="range"
                min={0}
                max={12}
                value={config.letterSpacing}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, letterSpacing: Number(e.target.value) }))
                }
                className="w-full accent-[#e59a24]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-[#eef2f6] cursor-pointer">
              <input
                type="checkbox"
                checked={config.shadowEnabled}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, shadowEnabled: e.target.checked }))
                }
                className="accent-[#e59a24] w-4 h-4"
              />
              <span>Drop Shadow</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-[#eef2f6] cursor-pointer">
              <input
                type="checkbox"
                checked={config.uppercase}
                onChange={(e) => setConfig((prev) => ({ ...prev, uppercase: e.target.checked }))}
                className="accent-[#e59a24] w-4 h-4"
              />
              <span>Force Uppercase</span>
            </label>
          </div>
        </div>

        {/* Preview + Actions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-md border border-[#2a3544] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#2a3544] bg-[#151b22] flex items-center justify-between text-xs text-[#9aa7b8]">
              <span>Transparent PNG Preview</span>
              <span className="font-mono-num">Auto-cropped on export</span>
            </div>
            <div className="alpha-checkerboard p-4 sm:p-6 flex items-center justify-center min-h-[240px]">
              <canvas
                ref={canvasRef}
                data-testid="watermark-canvas"
                className="w-full max-w-[640px] h-auto"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#39475a] bg-[#1c242e] hover:border-[#6c7a8c] text-sm font-medium text-[#eef2f6] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Transparent PNG</span>
            </button>

            <button
              type="button"
              onClick={handleSendToEditor}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-sm font-semibold text-[#0e1217] cursor-pointer"
            >
              <span>Send to Editor</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {statusMessage && (
            <p role="status" className="text-xs text-[#e59a24]">
              {statusMessage}
            </p>
          )}
        </div>
      </div>

      {/* Visible 3-step guide matching HowTo schema */}
      <section className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-[#eef2f6]">
            How to Create &amp; Use a Transparent PNG Watermark
          </h2>
          <Link to="/guides/custom-png-watermarks-and-hook-titles" className="text-xs font-medium text-[#e59a24] hover:text-[#f0ab3c]">
            Read safe-zone placement guide →
          </Link>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WATERMARK_MAKER_STEPS.map((step, idx) => (
            <li key={step.name} className="rounded border border-[#2a3544] bg-[#0e1217] p-3.5 space-y-1">
              <span className="font-mono-num text-[11px] font-bold text-[#e59a24]">STEP 0{idx + 1}</span>
              <h3 className="text-sm font-semibold text-[#eef2f6]">{step.name}</h3>
              <p className="text-xs text-[#9aa7b8] leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
