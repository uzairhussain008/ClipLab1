import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  HelpCircle,
  Lock,
  Merge,
  Mic,
  Plus,
  RotateCcw,
  Sparkles,
  Split,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { APP_CONFIG, BUNDLED_FONTS, WHISPER_LANGUAGES } from '../config/appConfig';
import type {
  AutoMixIntensity,
  CaptionConfig,
  CaptionInputMode,
  CaptionLine,
  CaptionStylePresetId,
  ComputeMode,
  OverlayFontId,
} from '../types/editor';
import { CAPTION_PRESET_DEFAULTS, exportSrt, exportVtt, mergeCaptionLines, parseSrt, splitCaptionLine } from '../utils/captions';
import {
  type AutoMixDecision,
  CAPTION_STYLE_LABELS,
  getAvailableCaptionInputModes,
} from '../utils/captionStyleMix';
import { isLowMemoryOrMobileDevice } from '../utils/deviceCheck';
import { clampTime, formatTimecode } from '../utils/timecode';
import { resolveWhisperModelId } from '../utils/whisperFallback';

interface CaptionsPanelProps {
  duration: number;
  activeRange: { start: number; end: number };
  config: CaptionConfig;
  lines: CaptionLine[];
  resolvedMixDecisions: Record<string, AutoMixDecision>;
  hasAudioAnalysisSamples: boolean;
  language: string;
  computeMode: ComputeMode;
  useEnglishOnlyModel: boolean;
  rememberedGpuFailure: boolean;
  approximateWordTiming: boolean;
  isGenerating: boolean;
  progress: { percent: number; message: string } | null;
  statusNote: string | null;
  error: string | null;
  hasConsentedModel: boolean;
  onChangeLanguage: (lang: string) => void;
  onChangeComputeMode: (mode: ComputeMode) => void;
  onChangeUseEnglishOnlyModel: (useEn: boolean) => void;
  onClearGpuFailureMemory: () => void;
  onChangeConfig: (updater: (prev: CaptionConfig) => CaptionConfig) => void;
  onChangeLines: (lines: CaptionLine[]) => void;
  onGenerateWithConsent: (selectedComputeMode?: ComputeMode) => void;
  onCancelGeneration: () => void;
  onSeek: (time: number) => void;
}

const PRESET_CARDS: { id: CaptionStylePresetId; label: string; note: string; funky?: boolean }[] = [
  { id: 'classic', label: 'Classic', note: 'Clean white bold' },
  { id: 'bold-pop', label: 'Bold Pop', note: 'Word highlight + pop' },
  { id: 'boxed', label: 'Boxed', note: 'Dark contrast box' },
  { id: 'minimal', label: 'Minimal', note: 'Subtle small captions' },
  { id: 'hype-pop', label: 'Hype Pop', note: 'Color cycle + overshoot', funky: true },
  { id: 'neon-glow', label: 'Neon Glow', note: 'Bright cyan halo', funky: true },
  { id: 'comic-burst', label: 'Comic Burst', note: 'Bangers yellow + tilt', funky: true },
  { id: 'sticker-box', label: 'Sticker Box', note: 'Color-cycling pill box', funky: true },
];

const INTENSITY_OPTIONS: { id: AutoMixIntensity; label: string; hint: string }[] = [
  { id: 'calm', label: 'Calm', hint: 'Only strong spikes get funky styles' },
  { id: 'balanced', label: 'Balanced', hint: 'Mixes Classic/Minimal with funky punchlines' },
  { id: 'hype', label: 'Hype', hint: 'Frequent funky shifts on short/loud cues' },
];

export function CaptionsPanel({
  duration,
  activeRange,
  config,
  lines,
  resolvedMixDecisions,
  hasAudioAnalysisSamples,
  language,
  computeMode,
  useEnglishOnlyModel,
  rememberedGpuFailure,
  approximateWordTiming,
  isGenerating,
  progress,
  statusNote,
  error,
  hasConsentedModel,
  onChangeLanguage,
  onChangeComputeMode,
  onChangeUseEnglishOnlyModel,
  onClearGpuFailureMemory,
  onChangeConfig,
  onChangeLines,
  onGenerateWithConsent,
  onCancelGeneration,
  onSeek,
}: CaptionsPanelProps) {
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingComputeMode, setPendingComputeMode] = useState<'cpu' | 'gpu'>(() =>
    computeMode === 'gpu' ? 'gpu' : 'cpu'
  );
  const [showAutoMixHelp, setShowAutoMixHelp] = useState(false);
  const [manualDraftText, setManualDraftText] = useState('');

  const availableInputModes = useMemo(
    () => getAvailableCaptionInputModes(APP_CONFIG.ENABLE_AUTO_CAPTIONS),
    []
  );
  const [inputMode, setInputMode] = useState<CaptionInputMode>(() =>
    APP_CONFIG.ENABLE_AUTO_CAPTIONS ? 'auto' : 'manual'
  );
  const activeInputMode: CaptionInputMode = availableInputModes.includes(inputMode)
    ? inputMode
    : availableInputModes[0];

  const isMobileOrLowMem = isLowMemoryOrMobileDevice();
  const activeModelId = resolveWhisperModelId({
    defaultModelId: APP_CONFIG.captions.MODEL_ID,
    englishModelId: APP_CONFIG.captions.ENGLISH_MODEL_ID,
    language,
    useEnglishOnlyModel,
  });
  const selectedComputeMode: 'cpu' | 'gpu' = computeMode === 'gpu' ? 'gpu' : 'cpu';
  const styleMode = config.styleMode ?? 'single';
  const autoMixIntensity = config.autoMixIntensity ?? 'balanced';
  const hasAnyOverride = lines.some((l) => Boolean(l.styleOverride));

  const handleGenerateClick = () => {
    if (!APP_CONFIG.ENABLE_AUTO_CAPTIONS) return;
    if (hasConsentedModel) {
      onGenerateWithConsent(selectedComputeMode);
    } else {
      setPendingComputeMode(selectedComputeMode);
      setShowConsentModal(true);
    }
  };

  const lockAllToPreset = (presetId: CaptionStylePresetId) => {
    const defaults = CAPTION_PRESET_DEFAULTS[presetId];
    onChangeConfig((prev) => ({
      ...prev,
      ...defaults,
      styleMode: 'single',
      enabled: true,
    }));
    if (lines.some((l) => l.styleOverride)) {
      onChangeLines(lines.map((l) => ({ ...l, styleOverride: undefined })));
    }
  };

  const enableAutoMix = () => {
    onChangeConfig((prev) => ({
      ...prev,
      styleMode: 'auto-mix',
      autoMixIntensity: prev.autoMixIntensity ?? 'balanced',
      uppercase: false,
      enabled: true,
    }));
  };

  const handleImportSrt = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const parsed = parseSrt(reader.result);
        if (parsed.length > 0) {
          onChangeLines(parsed);
          onChangeConfig((prev) => ({ ...prev, enabled: true }));
        }
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  const downloadSubtitleFile = (ext: 'srt' | 'vtt') => {
    if (lines.length === 0) return;
    const content = ext === 'srt' ? exportSrt(lines) : exportVtt(lines);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleAddManualLine = (customText?: string) => {
    const lastEnd = lines.length > 0 ? lines[lines.length - 1].endTime : activeRange.start;
    const start = clampTime(lastEnd, 0, Math.max(0, (duration || 5) - 0.5));
    const end = clampTime(start + 2.0, start + 0.4, duration || start + 2.0);
    const text = (customText ?? manualDraftText).trim() || 'New caption line';
    const newLine: CaptionLine = {
      id: `manual-${Date.now()}-${lines.length + 1}`,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      text,
    };
    onChangeLines([...lines, newLine]);
    onChangeConfig((prev) => ({ ...prev, enabled: true }));
    if (customText === undefined && manualDraftText.trim()) {
      setManualDraftText('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Burn-in Enable Toggle + Subtitle File Export */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#eef2f6] cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onChangeConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="accent-[#e59a24] w-4 h-4"
            />
            <span>Burn captions into video</span>
          </label>

          {lines.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => downloadSubtitleFile('srt')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2a3544] bg-[#0e1217] hover:border-[#e59a24] text-[11px] text-[#eef2f6] cursor-pointer"
              >
                <Download className="w-3 h-3 text-[#e59a24]" />
                <span>.SRT</span>
              </button>
              <button
                type="button"
                onClick={() => downloadSubtitleFile('vtt')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2a3544] bg-[#0e1217] hover:border-[#e59a24] text-[11px] text-[#eef2f6] cursor-pointer"
              >
                <Download className="w-3 h-3 text-[#e59a24]" />
                <span>.VTT</span>
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-[#9aa7b8] leading-snug">
          On: captions are permanently drawn on the exported video. Off: the video has no captions;
          download .SRT/.VTT to upload as a separate subtitle file.
        </p>
      </div>

      {/* 3-Way (or 2-Way when flag off) Caption Input Selector */}
      <div className="rounded border border-[#2a3544] bg-[#0e1217] p-3 space-y-3">
        <div
          role="tablist"
          aria-label="Caption input method"
          className={`grid gap-1 p-1 rounded border border-[#2a3544] bg-[#151b22] ${
            availableInputModes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {availableInputModes.map((mode) => {
            const active = activeInputMode === mode;
            const label =
              mode === 'auto'
                ? 'Auto (on-device)'
                : mode === 'manual'
                  ? 'Manual (add lines)'
                  : 'Import .SRT';
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setInputMode(mode)}
                className={`px-1.5 sm:px-2 py-1.5 rounded text-[11px] leading-tight font-medium text-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#e59a24] text-[#0e1217] font-semibold'
                    : 'text-[#9aa7b8] hover:text-[#eef2f6]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Hidden shared SRT file input */}
        <input
          ref={srtInputRef}
          type="file"
          accept=".srt,text/plain"
          onChange={handleImportSrt}
          className="sr-only"
          aria-label="Import SRT subtitle file"
        />

        {/* Mode 1: Auto (on-device) */}
        {activeInputMode === 'auto' && APP_CONFIG.ENABLE_AUTO_CAPTIONS && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="cap-lang" className="block text-[11px] text-[#9aa7b8]">
                  Speech Language
                </label>
                <select
                  id="cap-lang"
                  value={language}
                  onChange={(e) => onChangeLanguage(e.target.value)}
                  disabled={isGenerating}
                  className="w-full rounded border border-[#2a3544] bg-[#151b22] px-2.5 py-1.5 text-xs text-[#eef2f6]"
                >
                  {WHISPER_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="cap-compute" className="block text-[11px] text-[#9aa7b8]">
                  Speech Mode
                </label>
                <select
                  id="cap-compute"
                  value={selectedComputeMode}
                  onChange={(e) => onChangeComputeMode(e.target.value as ComputeMode)}
                  disabled={isGenerating}
                  className="w-full rounded border border-[#2a3544] bg-[#151b22] px-2.5 py-1.5 text-xs text-[#eef2f6]"
                >
                  <option value="cpu">
                    Light (CPU, about {APP_CONFIG.captions.estimatedModelSizeMB} MB)
                  </option>
                  <option value="gpu">
                    Fast (GPU, about {APP_CONFIG.captions.estimatedGpuModelSizeMB} MB)
                  </option>
                </select>
              </div>
            </div>

            {language === 'en' && (
              <label className="inline-flex items-center gap-2 text-[11px] text-[#eef2f6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useEnglishOnlyModel}
                  onChange={(e) => onChangeUseEnglishOnlyModel(e.target.checked)}
                  disabled={isGenerating}
                  className="accent-[#e59a24] w-3.5 h-3.5"
                />
                <span>
                  Use English-only model (
                  <code className="font-mono-num text-[#e59a24]">whisper-tiny.en_timestamped</code>)
                </span>
              </label>
            )}

            <div className="flex items-center gap-1.5">
              {!isGenerating ? (
                <button
                  type="button"
                  onClick={handleGenerateClick}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-xs whitespace-nowrap cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Generate captions</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancelGeneration}
                  className="flex-1 py-1.5 px-3 rounded border border-[#dc3545]/70 bg-[#dc3545]/15 text-xs font-semibold text-[#f8d7da] cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <p className="text-[11px] text-[#9aa7b8]">
              Model: <code className="font-mono-num text-[#eef2f6]">{activeModelId}</code> (
              {selectedComputeMode === 'gpu'
                ? `Fast GPU ~${APP_CONFIG.captions.estimatedGpuModelSizeMB} MB fp32; falls back to CPU if WebGPU fails`
                : `Light CPU ~${APP_CONFIG.captions.estimatedModelSizeMB} MB q8`}
              , cached once). Earlier <code className="font-mono-num">whisper-tiny</code> cache is
              not reused.
            </p>

            {selectedComputeMode === 'gpu' && rememberedGpuFailure && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#e59a24]">
                <span>
                  Previous WebGPU failure remembered — will fall back to CPU automatically if GPU
                  fails.
                </span>
                <button
                  type="button"
                  onClick={onClearGpuFailureMemory}
                  className="underline hover:text-[#f0ab3c] cursor-pointer"
                >
                  Clear GPU notice
                </button>
              </div>
            )}

            {isGenerating && progress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#eef2f6]">{progress.message}</span>
                  <span className="font-mono-num text-[#e59a24]">{progress.percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1c242e] overflow-hidden">
                  <div
                    style={{ width: `${progress.percent}%` }}
                    className="h-full bg-[#e59a24] transition-all duration-150"
                  />
                </div>
              </div>
            )}

            {statusNote && !error && (
              <p role="status" className="text-[11px] text-[#9aa7b8]">
                {statusNote}
              </p>
            )}

            {error && (
              <div
                role="alert"
                className="rounded border border-[#dc3545]/60 bg-[#dc3545]/10 px-2.5 py-2 text-[11px] text-[#f8d7da] flex items-start gap-2"
              >
                <XCircle className="w-3.5 h-3.5 text-[#dc3545] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Manual (add lines) */}
        {activeInputMode === 'manual' && (
          <div className="space-y-2">
            <label htmlFor="cap-manual-draft" className="block text-[11px] text-[#9aa7b8]">
              Type a caption line and add it directly to the timeline editor below:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="cap-manual-draft"
                type="text"
                value={manualDraftText}
                onChange={(e) => setManualDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualLine();
                  }
                }}
                placeholder="CLUTCH! Watch this ending..."
                className="flex-1 rounded border border-[#2a3544] bg-[#151b22] px-2.5 py-1.5 text-xs text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddManualLine()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-xs whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line</span>
              </button>
            </div>
          </div>
        )}

        {/* Mode 3: Import .SRT */}
        {activeInputMode === 'import' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[#9aa7b8]">
              Load an existing <code className="font-mono-num text-[#eef2f6]">.srt</code> subtitle
              file into the shared caption editor below.
            </p>
            <button
              type="button"
              onClick={() => srtInputRef.current?.click()}
              title="Import .srt subtitle file"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose .SRT File</span>
            </button>
          </div>
        )}
      </div>

      {/* Caption Style Mode (Single Style vs Auto Mix) & 8 Presets */}
      <div className="space-y-3 border-t border-[#2a3544] pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#eef2f6]">Caption Styles &amp; Auto Mix</span>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9aa7b8] cursor-pointer">
            <input
              type="checkbox"
              checked={config.showSafeZoneGuide}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, showSafeZoneGuide: e.target.checked }))
              }
              className="accent-[#e59a24] w-3.5 h-3.5"
            />
            <span>Safe-zone guide</span>
          </label>
        </div>

        {/* Auto Mix Selector Card */}
        <div
          className={`rounded border p-2.5 space-y-2 ${
            styleMode === 'auto-mix'
              ? 'border-[#e59a24] bg-[#e59a24]/10'
              : 'border-[#2a3544] bg-[#0e1217]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (styleMode === 'auto-mix' ? lockAllToPreset(config.preset) : enableAutoMix())}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#eef2f6] cursor-pointer"
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${
                  styleMode === 'auto-mix' ? 'text-[#e59a24]' : 'text-[#9aa7b8]'
                }`}
              />
              <span>Style: Auto mix</span>
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono-num ${
                  styleMode === 'auto-mix'
                    ? 'bg-[#e59a24] text-[#0e1217]'
                    : 'bg-[#1c242e] text-[#9aa7b8]'
                }`}
              >
                {styleMode === 'auto-mix' ? 'ACTIVE' : 'OFF'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              {(styleMode === 'auto-mix' || hasAnyOverride) && (
                <button
                  type="button"
                  onClick={() => lockAllToPreset(config.preset)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#e59a24] hover:underline cursor-pointer"
                  title="Lock entire video to a single style and clear per-line overrides"
                >
                  <Lock className="w-3 h-3" />
                  <span>Lock all to {CAPTION_STYLE_LABELS[config.preset]}</span>
                </button>
              )}
              <button
                type="button"
                aria-label="How Auto mix works"
                onClick={() => setShowAutoMixHelp((v) => !v)}
                className="text-[#9aa7b8] hover:text-[#eef2f6] cursor-pointer"
                title="How deterministic Auto mix chooses styles"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showAutoMixHelp && (
            <p className="text-[11px] text-[#c2cbd6] bg-[#151b22] border border-[#2a3544] rounded px-2.5 py-1.5 leading-relaxed">
              Auto mix uses deterministic rules — never AI guesses. Calm dialogue keeps clean{' '}
              <strong>Classic</strong> or <strong>Minimal</strong> styles, while energetic lines
              switch to <strong>Hype Pop</strong>, <strong>Neon Glow</strong>, or{' '}
              <strong>Comic Burst</strong> based on audio loudness spikes,{' '}
              <code className="font-mono-num">!</code> marks, ALL-CAPS words, short punchy lines (
              &le;3 words), and your keyword list. Override any line below or click a preset card to
              lock the whole video.
            </p>
          )}

          {styleMode === 'auto-mix' && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#9aa7b8]">Mix Intensity:</span>
                <div className="inline-flex rounded border border-[#2a3544] bg-[#151b22] p-0.5">
                  {INTENSITY_OPTIONS.map((opt) => {
                    const selected = autoMixIntensity === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.hint}
                        onClick={() =>
                          onChangeConfig((prev) => ({
                            ...prev,
                            styleMode: 'auto-mix',
                            autoMixIntensity: opt.id,
                          }))
                        }
                        className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                          selected
                            ? 'bg-[#e59a24] text-[#0e1217] font-semibold'
                            : 'text-[#9aa7b8] hover:text-[#eef2f6]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!hasAudioAnalysisSamples && (
                <p className="text-[10px] text-[#9aa7b8]">
                  Tip: Run <strong>Find best moments</strong> (or Auto clip) to include audio
                  loudness peaks in Auto mix; punctuation, CAPS, word count, and boost keywords apply
                  immediately.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 8 Single-Style Preset Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {PRESET_CARDS.map((p) => {
            const active = styleMode === 'single' && config.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => lockAllToPreset(p.id)}
                className={`p-2 rounded border text-left text-xs cursor-pointer transition-colors ${
                  active
                    ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#eef2f6]'
                    : 'border-[#2a3544] bg-[#0e1217] text-[#9aa7b8] hover:border-[#39475a]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-[#eef2f6] truncate">{p.label}</span>
                  {p.funky && (
                    <span className="text-[9px] uppercase tracking-wide text-[#e59a24] shrink-0">
                      FX
                    </span>
                  )}
                </div>
                <div className="text-[10px] mt-0.5 truncate">{p.note}</div>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-[#6c7a8c]">
          Preview approximates word pop, tilt, neon glow, and sticker box colors; MP4 export renders
          exact keyframed libass animations in a single pass.
        </p>

        {/* Global Position, Bundled Font, Size, Margin, Words/Line */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label htmlFor="cap-pos" className="block text-[11px] text-[#9aa7b8]">
              Position
            </label>
            <select
              id="cap-pos"
              value={config.position}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  position: e.target.value as CaptionConfig['position'],
                }))
              }
              className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-1.5 text-xs text-[#eef2f6]"
            >
              <option value="bottom">Bottom</option>
              <option value="middle">Middle</option>
              <option value="top">Top</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="cap-font" className="block text-[11px] text-[#9aa7b8]">
              Bundled Font
            </label>
            <select
              id="cap-font"
              value={config.font}
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  font: e.target.value as OverlayFontId,
                }))
              }
              className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-1.5 text-xs text-[#eef2f6]"
            >
              {(Object.keys(BUNDLED_FONTS) as OverlayFontId[]).map((fid) => (
                <option key={fid} value={fid}>
                  {BUNDLED_FONTS[fid].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label htmlFor="cap-size" className="block text-[11px] text-[#9aa7b8]">
              Size ({config.fontSize})
            </label>
            <input
              id="cap-size"
              type="range"
              min={28}
              max={88}
              value={config.fontSize}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))
              }
              className="w-full accent-[#e59a24]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cap-offset" className="block text-[11px] text-[#9aa7b8]">
              Margin ({config.offsetPercent}%)
            </label>
            <input
              id="cap-offset"
              type="range"
              min={4}
              max={32}
              value={config.offsetPercent}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, offsetPercent: Number(e.target.value) }))
              }
              className="w-full accent-[#e59a24]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cap-wpl" className="block text-[11px] text-[#9aa7b8]">
              Words/line ({config.wordsPerLine})
            </label>
            <input
              id="cap-wpl"
              type="range"
              min={1}
              max={5}
              value={config.wordsPerLine}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, wordsPerLine: Number(e.target.value) }))
              }
              className="w-full accent-[#e59a24]"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="space-y-1">
            <label htmlFor="cap-color" className="block text-[11px] text-[#9aa7b8]">
              Text Color
            </label>
            <input
              id="cap-color"
              type="color"
              value={config.textColor}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, textColor: e.target.value }))
              }
              className="w-full h-7 p-0.5 rounded border border-[#2a3544] bg-[#0e1217] cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cap-hi" className="block text-[11px] text-[#9aa7b8]">
              Highlight
            </label>
            <input
              id="cap-hi"
              type="color"
              value={config.highlightColor}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, highlightColor: e.target.value }))
              }
              className="w-full h-7 p-0.5 rounded border border-[#2a3544] bg-[#0e1217] cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cap-outline" className="block text-[11px] text-[#9aa7b8]">
              Outline ({config.outlineWidth}px)
            </label>
            <input
              id="cap-outline"
              type="range"
              min={0}
              max={8}
              value={config.outlineWidth}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, outlineWidth: Number(e.target.value) }))
              }
              className="w-full accent-[#e59a24]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#9aa7b8]">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.backgroundBox}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, backgroundBox: e.target.checked }))
              }
              className="accent-[#e59a24] w-3.5 h-3.5"
            />
            <span>Background box</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.uppercase}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, uppercase: e.target.checked }))
              }
              className="accent-[#e59a24] w-3.5 h-3.5"
            />
            <span>UPPERCASE</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.popIn}
              onChange={(e) =>
                onChangeConfig((prev) => ({ ...prev, popIn: e.target.checked }))
              }
              className="accent-[#e59a24] w-3.5 h-3.5"
            />
            <span>Pop-in animation</span>
          </label>
        </div>
      </div>

      {/* Shared Editable Caption Lines */}
      <div className="space-y-2 border-t border-[#2a3544] pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[#eef2f6]">
              Caption Lines ({lines.length})
            </span>
            {approximateWordTiming && lines.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#e59a24]/40 bg-[#e59a24]/10 text-[#e59a24]">
                Word timing is approximate
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {hasAnyOverride && (
              <button
                type="button"
                onClick={() => onChangeLines(lines.map((l) => ({ ...l, styleOverride: undefined })))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2a3544] text-[11px] text-[#9aa7b8] hover:text-[#eef2f6] cursor-pointer"
                title="Clear all per-line style overrides"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset overrides</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleAddManualLine('New caption line')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#39475a] bg-[#0e1217] hover:border-[#e59a24] text-[11px] text-[#eef2f6] cursor-pointer"
            >
              <Plus className="w-3 h-3 text-[#e59a24]" />
              <span>Add Line</span>
            </button>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => onChangeLines([])}
                className="px-2 py-1 rounded border border-[#2a3544] text-[11px] text-[#9aa7b8] hover:text-[#dc3545] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="rounded border border-[#2a3544] bg-[#0e1217] p-3 text-xs text-[#9aa7b8] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#6c7a8c] shrink-0" />
            <span>
              {APP_CONFIG.ENABLE_AUTO_CAPTIONS
                ? 'No caption lines yet. Use Auto (on-device), Manual (add lines), or Import .SRT above.'
                : 'No caption lines yet. Add lines manually or import an .SRT file above.'}
            </span>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-[#2a3544] border border-[#2a3544] rounded bg-[#0e1217]">
            {lines.map((line, idx) => {
              const decision = resolvedMixDecisions[line.id];
              const autoPicked = decision?.pickedPreset ?? config.preset;
              const resolvedStyle =
                line.styleOverride ?? decision?.resolvedPreset ?? config.preset;
              const badgeLabel = line.styleOverride
                ? `Override: ${CAPTION_STYLE_LABELS[line.styleOverride]}`
                : styleMode === 'auto-mix'
                  ? `Auto: ${CAPTION_STYLE_LABELS[autoPicked]}`
                  : CAPTION_STYLE_LABELS[resolvedStyle];

              return (
                <div key={line.id} className="p-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onSeek(line.startTime)}
                        className="font-mono-num text-[#e59a24] hover:underline cursor-pointer"
                        title="Jump playhead to line"
                      >
                        {formatTimecode(line.startTime)} – {formatTimecode(line.endTime)}
                      </button>

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          line.styleOverride
                            ? 'border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#E0FFFF]'
                            : decision?.isEnergetic && styleMode === 'auto-mix'
                              ? 'border-[#e59a24]/60 bg-[#e59a24]/15 text-[#e59a24]'
                              : 'border-[#2a3544] bg-[#151b22] text-[#9aa7b8]'
                        }`}
                      >
                        {badgeLabel}
                      </span>

                      {styleMode === 'auto-mix' &&
                        !line.styleOverride &&
                        decision?.energy.reasons.slice(0, 2).map((reason) => (
                          <span
                            key={reason}
                            className="text-[9px] px-1 py-0.5 rounded bg-[#151b22] text-[#6c7a8c] font-mono-num"
                          >
                            {reason}
                          </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <select
                        aria-label={`Line ${idx + 1} style override`}
                        value={line.styleOverride ?? ''}
                        onChange={(e) => {
                          const val = e.target.value as CaptionStylePresetId | '';
                          onChangeLines(
                            lines.map((l) =>
                              l.id === line.id
                                ? { ...l, styleOverride: val ? val : undefined }
                                : l
                            )
                          );
                        }}
                        className="rounded border border-[#2a3544] bg-[#151b22] px-1.5 py-0.5 text-[10px] text-[#eef2f6]"
                      >
                        <option value="">
                          {styleMode === 'auto-mix'
                            ? `Auto (${CAPTION_STYLE_LABELS[autoPicked]})`
                            : `Global (${CAPTION_STYLE_LABELS[config.preset]})`}
                        </option>
                        {PRESET_CARDS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>

                      {line.text.trim().split(/\s+/).length >= 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const split = splitCaptionLine(line);
                            if (!split) return;
                            const next = [...lines];
                            next.splice(idx, 1, split[0], split[1]);
                            onChangeLines(next);
                          }}
                          title="Split line in two"
                          aria-label={`Split line ${idx + 1}`}
                          className="p-1 text-[#9aa7b8] hover:text-[#eef2f6] cursor-pointer"
                        >
                          <Split className="w-3 h-3" />
                        </button>
                      )}
                      {idx < lines.length - 1 && (
                        <button
                          type="button"
                          onClick={() => onChangeLines(mergeCaptionLines(lines, idx))}
                          title="Merge with next line"
                          aria-label={`Merge line ${idx + 1} with next`}
                          className="p-1 text-[#9aa7b8] hover:text-[#eef2f6] cursor-pointer"
                        >
                          <Merge className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onChangeLines(lines.filter((l) => l.id !== line.id))}
                        title="Delete line"
                        aria-label={`Delete line ${idx + 1}`}
                        className="p-1 text-[#9aa7b8] hover:text-[#dc3545] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={line.text}
                    aria-label={`Caption text ${idx + 1}`}
                    onChange={(e) => {
                      const nextText = e.target.value;
                      onChangeLines(
                        lines.map((l) =>
                          l.id === line.id ? { ...l, text: nextText, words: undefined } : l
                        )
                      );
                    }}
                    className="w-full rounded border border-[#2a3544] bg-[#151b22] px-2 py-1 text-xs text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={line.endTime}
                      aria-label={`Start time ${idx + 1}`}
                      value={line.startTime}
                      onChange={(e) => {
                        const val = clampTime(Number(e.target.value), 0, line.endTime - 0.1);
                        onChangeLines(
                          lines.map((l) => (l.id === line.id ? { ...l, startTime: val } : l))
                        );
                      }}
                      className="rounded border border-[#2a3544] bg-[#151b22] px-2 py-0.5 text-[11px] font-mono-num text-[#9aa7b8]"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min={line.startTime}
                      max={duration || 9999}
                      aria-label={`End time ${idx + 1}`}
                      value={line.endTime}
                      onChange={(e) => {
                        const val = clampTime(
                          Number(e.target.value),
                          line.startTime + 0.1,
                          duration || 9999
                        );
                        onChangeLines(
                          lines.map((l) => (l.id === line.id ? { ...l, endTime: val } : l))
                        );
                      }}
                      className="rounded border border-[#2a3544] bg-[#151b22] px-2 py-0.5 text-[11px] font-mono-num text-[#9aa7b8]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* First-use Consent Modal for Speech Model Download */}
      {APP_CONFIG.ENABLE_AUTO_CAPTIONS && showConsentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="whisper-consent-title"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full rounded-md border border-[#39475a] bg-[#151b22] p-5 space-y-4 shadow-xl">
            <h3 id="whisper-consent-title" className="font-display text-xl font-bold text-[#eef2f6]">
              Download On-Device Speech Model?
            </h3>

            <p className="text-xs text-[#eef2f6] leading-relaxed">
              Runs on your device. Your video is not uploaded. Model weights are downloaded once and
              cached locally. Any earlier <code className="font-mono-num">whisper-tiny</code> cache
              is not reused.
            </p>

            <fieldset className="space-y-2">
              <legend className="block text-[11px] font-medium text-[#9aa7b8] mb-1">
                Choose speech model mode (remembered on this device)
              </legend>

              <label
                className={`flex items-start gap-2.5 rounded border p-2.5 cursor-pointer transition-colors ${
                  pendingComputeMode === 'cpu'
                    ? 'border-[#e59a24] bg-[#e59a24]/10'
                    : 'border-[#2a3544] bg-[#0e1217] hover:border-[#39475a]'
                }`}
              >
                <input
                  type="radio"
                  name="caption-consent-mode"
                  value="cpu"
                  checked={pendingComputeMode === 'cpu'}
                  onChange={() => setPendingComputeMode('cpu')}
                  className="mt-0.5 accent-[#e59a24]"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#eef2f6]">
                    Light (CPU, about {APP_CONFIG.captions.estimatedModelSizeMB} MB)
                  </div>
                  <div className="text-[11px] text-[#9aa7b8]">
                    Default · Smaller quantized q8 download. Works without WebGPU; runs slower in
                    chunks.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 rounded border p-2.5 cursor-pointer transition-colors ${
                  pendingComputeMode === 'gpu'
                    ? 'border-[#e59a24] bg-[#e59a24]/10'
                    : 'border-[#2a3544] bg-[#0e1217] hover:border-[#39475a]'
                }`}
              >
                <input
                  type="radio"
                  name="caption-consent-mode"
                  value="gpu"
                  checked={pendingComputeMode === 'gpu'}
                  onChange={() => setPendingComputeMode('gpu')}
                  className="mt-0.5 accent-[#e59a24]"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#eef2f6]">
                    Fast (GPU, about {APP_CONFIG.captions.estimatedGpuModelSizeMB} MB, only if
                    WebGPU works)
                  </div>
                  <div className="text-[11px] text-[#9aa7b8]">
                    Full fp32 weights for WebGPU. Automatically falls back to CPU if WebGPU fails or
                    is unavailable.
                  </div>
                </div>
              </label>
            </fieldset>

            <div className="rounded border border-[#2a3544] bg-[#0e1217] p-3 text-[11px] text-[#9aa7b8] space-y-1 font-mono-num">
              <div>Model: {activeModelId}</div>
              <div>
                Selected size: ~
                {pendingComputeMode === 'gpu'
                  ? APP_CONFIG.captions.estimatedGpuModelSizeMB
                  : APP_CONFIG.captions.estimatedModelSizeMB}{' '}
                MB ({pendingComputeMode === 'gpu' ? 'Fast · WebGPU fp32' : 'Light · CPU q8'})
              </div>
              <div className="truncate">Host: {APP_CONFIG.captions.MODEL_BASE_URL}</div>
            </div>

            {pendingComputeMode === 'gpu' && rememberedGpuFailure && (
              <div className="rounded border border-[#e59a24]/40 bg-[#e59a24]/10 p-2.5 text-[11px] text-[#eef2f6]">
                Note: WebGPU failed on an earlier run in this browser. If GPU fails again,
                transcription automatically falls back to CPU.
              </div>
            )}

            {isMobileOrLowMem && (
              <div className="rounded border border-[#e59a24]/50 bg-[#e59a24]/10 p-2.5 text-xs text-[#eef2f6] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#e59a24] shrink-0 mt-0.5" />
                <span>
                  Mobile / low-memory device detected. Speech transcription may be slow or run out of
                  memory on long videos — short clips work best.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-3.5 py-2 rounded border border-[#39475a] bg-[#0e1217] hover:bg-[#1c242e] text-xs font-medium text-[#eef2f6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConsentModal(false);
                  onChangeComputeMode(pendingComputeMode);
                  onGenerateWithConsent(pendingComputeMode);
                }}
                className="px-4 py-2 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217] cursor-pointer"
              >
                Download &amp; Transcribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
