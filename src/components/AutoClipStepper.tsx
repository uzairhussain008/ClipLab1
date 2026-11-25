import { Check, ChevronRight, Sparkles, Wand2 } from 'lucide-react';
import { PLATFORM_PRESETS } from '../config/appConfig';
import type { PlatformPreset } from '../types/editor';

interface AutoClipStepperProps {
  activePlatform: PlatformPreset | null;
  hasAnalysis: boolean;
  isAnalyzing: boolean;
  isAutoClipping?: boolean;
  segmentCount: number;
  captionCount: number;
  onSelectPlatform: (preset: PlatformPreset) => void;
  onFindMoments: () => void;
  onAutoClipEverything: () => void;
  onGoCaptions: () => void;
  onExportActive: () => void;
}

export function AutoClipStepper({
  activePlatform,
  hasAnalysis,
  isAnalyzing,
  isAutoClipping = false,
  segmentCount,
  captionCount,
  onSelectPlatform,
  onFindMoments,
  onAutoClipEverything,
  onGoCaptions,
  onExportActive,
}: AutoClipStepperProps) {
  const step1Done = Boolean(activePlatform);
  const step2Done = hasAnalysis;
  const step3Done = segmentCount > 1 || hasAnalysis;
  const step4Done = captionCount > 0;

  return (
    <div className="rounded-md border border-[#2a3544] bg-[#151b22] px-4 py-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#eef2f6]">
          <Sparkles className="w-3.5 h-3.5 text-[#e59a24]" />
          <span>Auto Clip Quick Flow (optional — full manual editor below)</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isAnalyzing || isAutoClipping}
            onClick={onAutoClipEverything}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-[11px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Wand2 className="w-3 h-3" />
            <span>{isAutoClipping ? 'Auto Clipping...' : 'Auto clip everything'}</span>
          </button>
          {PLATFORM_PRESETS.map((preset) => {
            const active = activePlatform?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPlatform(preset)}
                className={`px-2 py-1 rounded border text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#e59a24] bg-[#e59a24]/15 text-[#e59a24]'
                    : 'border-[#2a3544] bg-[#0e1217] text-[#9aa7b8] hover:text-[#eef2f6]'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div
          className={`flex items-center gap-2 rounded border px-2.5 py-2 ${
            step1Done ? 'border-[#2ea043]/60 bg-[#2ea043]/10' : 'border-[#2a3544] bg-[#0e1217]'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-[#1c242e] text-[11px] font-mono-num flex items-center justify-center text-[#eef2f6] shrink-0">
            {step1Done ? <Check className="w-3 h-3 text-[#2ea043]" /> : '1'}
          </span>
          <span className="text-[#eef2f6] truncate">
            {activePlatform ? activePlatform.name : 'Pick platform'}
          </span>
        </div>

        <button
          type="button"
          disabled={isAnalyzing}
          onClick={onFindMoments}
          className={`flex items-center justify-between gap-2 rounded border px-2.5 py-2 text-left cursor-pointer disabled:opacity-60 ${
            step2Done
              ? 'border-[#2ea043]/60 bg-[#2ea043]/10'
              : 'border-[#39475a] bg-[#0e1217] hover:border-[#e59a24]'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-full bg-[#1c242e] text-[11px] font-mono-num flex items-center justify-center text-[#eef2f6] shrink-0">
              {step2Done ? <Check className="w-3 h-3 text-[#2ea043]" /> : '2'}
            </span>
            <span className="text-[#eef2f6] truncate">
              {isAnalyzing ? 'Analyzing...' : 'Find moments'}
            </span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-[#9aa7b8] shrink-0" />
        </button>

        <div
          className={`flex items-center gap-2 rounded border px-2.5 py-2 ${
            step3Done ? 'border-[#2ea043]/60 bg-[#2ea043]/10' : 'border-[#2a3544] bg-[#0e1217]'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-[#1c242e] text-[11px] font-mono-num flex items-center justify-center text-[#eef2f6] shrink-0">
            {step3Done ? <Check className="w-3 h-3 text-[#2ea043]" /> : '3'}
          </span>
          <span className="text-[#eef2f6] truncate">Pick &amp; frame</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onGoCaptions}
            className={`flex-1 flex items-center gap-1.5 rounded border px-2.5 py-2 text-left cursor-pointer ${
              step4Done
                ? 'border-[#2ea043]/60 bg-[#2ea043]/10'
                : 'border-[#39475a] bg-[#0e1217] hover:border-[#e59a24]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-[#1c242e] text-[11px] font-mono-num flex items-center justify-center text-[#eef2f6] shrink-0">
              4
            </span>
            <span className="text-[#eef2f6] truncate">Captions</span>
          </button>
          <button
            type="button"
            onClick={onExportActive}
            className="px-2.5 py-2 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-xs whitespace-nowrap cursor-pointer"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
