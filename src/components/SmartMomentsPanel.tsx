import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  HelpCircle,
  Play,
  Plus,
  Sparkles,
  Type,
  Wand2,
  XCircle,
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import type {
  ActivityLevel,
  MomentReasonTag,
  SmartAnalysisResult,
  SmartMomentCandidate,
} from '../types/editor';
import { formatTimecode } from '../utils/timecode';

interface SmartMomentsPanelProps {
  duration: number;
  activeRange: { start: number; end: number };
  ignoreHudEdges: boolean;
  boostKeywordsRaw: string;
  isAnalyzing: boolean;
  isAutoClipping: boolean;
  progress: { percent: number; message: string } | null;
  error: string | null;
  result: SmartAnalysisResult | null;
  onToggleIgnoreHud: (val: boolean) => void;
  onChangeBoostKeywords: (raw: string) => void;
  onRunAnalysis: (rangeOnly: boolean) => void;
  onAutoClipEverything: () => void;
  onCancelAnalysis: () => void;
  onPreviewMoment: (moment: SmartMomentCandidate) => void;
  onAddMoment: (moment: SmartMomentCandidate) => void;
  onAddAllMoments: (moments: SmartMomentCandidate[]) => void;
  onApplyHookSuggestion: (moment: SmartMomentCandidate, hookText: string) => void;
}

function getActivityTone(level: ActivityLevel): string {
  switch (level) {
    case 'High':
      return 'text-[#e59a24] border-[#e59a24]/50 bg-[#e59a24]/10';
    case 'Medium':
      return 'text-[#eef2f6] border-[#39475a] bg-[#1c242e]';
    case 'Low':
    default:
      return 'text-[#9aa7b8] border-[#2a3544] bg-[#0e1217]';
  }
}

function getReasonTagTone(tag: MomentReasonTag): string {
  switch (tag) {
    case 'keyword':
      return 'border-[#e59a24]/50 bg-[#e59a24]/10 text-[#e59a24]';
    case 'speech':
      return 'border-[#39475a] bg-[#1c242e] text-[#eef2f6]';
    default:
      return 'border-[#2a3544] bg-[#151b22] text-[#9aa7b8]';
  }
}

export function SmartMomentsPanel({
  duration,
  activeRange,
  ignoreHudEdges,
  boostKeywordsRaw,
  isAnalyzing,
  isAutoClipping,
  progress,
  error,
  result,
  onToggleIgnoreHud,
  onChangeBoostKeywords,
  onRunAnalysis,
  onAutoClipEverything,
  onCancelAnalysis,
  onPreviewMoment,
  onAddMoment,
  onAddAllMoments,
  onApplyHookSuggestion,
}: SmartMomentsPanelProps) {
  const isLongVideo = duration > APP_CONFIG.smartFeatures.longVideoWarningMinutes * 60;
  const [analyzeRangeOnly, setAnalyzeRangeOnly] = useState(isLongVideo);
  const [hookDrafts, setHookDrafts] = useState<Record<string, string>>({});
  const [appliedMomentId, setAppliedMomentId] = useState<string | null>(null);
  const busy = isAnalyzing || isAutoClipping;

  return (
    <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#e59a24]" />
          <h2 className="font-display text-lg font-bold text-[#eef2f6]">Smart Moments</h2>
          <span
            title="Based on loudness, motion, and matched speech keywords. Always review before posting."
            aria-label="Based on loudness, motion, and matched speech keywords. Always review before posting."
            className="inline-flex items-center text-[#9aa7b8] hover:text-[#eef2f6] cursor-help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        </div>

        {!busy && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAutoClipEverything}
              disabled={duration <= 0.5}
              title={
                APP_CONFIG.ENABLE_AUTO_CAPTIONS
                  ? 'Find moments, reframe to 9:16 Smart follow, add captions, and review clips before export'
                  : 'Find moments, reframe to 9:16 Smart follow, and review clips before export'
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#e59a24]/70 bg-[#1c242e] hover:border-[#e59a24] text-[#eef2f6] text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#e59a24]" />
              <span>Auto clip everything</span>
            </button>

            <button
              type="button"
              onClick={() => onRunAnalysis(isLongVideo ? analyzeRangeOnly : false)}
              disabled={duration <= 0.5}
              title="Based on loudness and motion. Always review before posting."
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{result ? 'Re-scan moments' : 'Find best moments'}</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#9aa7b8] leading-relaxed">
        Scores mono 8 kHz audio spikes, low-res frame motion, and scene shifts locally on your
        device. When captions exist, speech density, exclamations, and matched keywords boost scores.
        Always review before posting.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="inline-flex items-center gap-2 text-[#9aa7b8] cursor-pointer">
          <input
            type="checkbox"
            checked={ignoreHudEdges}
            onChange={(e) => onToggleIgnoreHud(e.target.checked)}
            className="accent-[#e59a24] w-3.5 h-3.5"
          />
          <span>Ignore outer HUD edges during framing</span>
        </label>

        <div className="space-y-1">
          <label htmlFor="speech-boost-keywords" className="block text-[11px] text-[#9aa7b8]">
            Speech boost keywords (comma-separated)
          </label>
          <input
            id="speech-boost-keywords"
            type="text"
            value={boostKeywordsRaw}
            onChange={(e) => onChangeBoostKeywords(e.target.value)}
            placeholder="no way, clutch, watch this"
            className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-1 text-xs text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
          />
        </div>
      </div>

      {isLongVideo && (
        <div className="rounded border border-[#e59a24]/50 bg-[#e59a24]/10 p-3 text-xs text-[#eef2f6] space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#e59a24] shrink-0 mt-0.5" />
            <span>
              Video is over {APP_CONFIG.smartFeatures.longVideoWarningMinutes} minutes. Analyzing the
              whole file in browser memory can take longer; you can scan only the active trim range (
              {formatTimecode(activeRange.start)} – {formatTimecode(activeRange.end)}).
            </span>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-[#eef2f6]">
            <input
              type="checkbox"
              checked={analyzeRangeOnly}
              onChange={(e) => setAnalyzeRangeOnly(e.target.checked)}
              className="accent-[#e59a24] w-3.5 h-3.5"
            />
            <span>Analyze selected trim range only</span>
          </label>
        </div>
      )}

      {busy && progress && (
        <div className="rounded border border-[#39475a] bg-[#0e1217] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#eef2f6]">{progress.message}</span>
            <span className="font-mono-num text-[#e59a24]">{progress.percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1c242e] overflow-hidden">
            <div
              style={{ width: `${progress.percent}%` }}
              className="h-full bg-[#e59a24] transition-all duration-150"
            />
          </div>
          <button
            type="button"
            onClick={onCancelAnalysis}
            className="w-full py-1.5 rounded border border-[#dc3545]/70 bg-[#dc3545]/15 hover:bg-[#dc3545]/25 text-xs font-semibold text-[#f8d7da] cursor-pointer"
          >
            Cancel Analysis
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded border border-[#dc3545]/60 bg-[#dc3545]/10 px-3 py-2 text-xs text-[#f8d7da] flex items-start gap-2"
        >
          <XCircle className="w-4 h-4 text-[#dc3545] shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && !busy && (
        <div className="space-y-3 pt-1">
          {!result.hasAudio && (
            <div
              role="status"
              className="rounded border border-[#39475a] bg-[#0e1217] px-3 py-2 text-xs text-[#9aa7b8]"
            >
              No audio signal detected — activity was scored using motion and scene changes only.
            </div>
          )}

          {!result.hasStrongMoments || result.moments.length === 0 ? (
            <div
              role="status"
              className="rounded border border-[#2a3544] bg-[#0e1217] px-3 py-3 text-xs text-[#9aa7b8]"
            >
              No strong moments found (video appears mostly quiet or static). Use the timeline
              handles below to trim highlights manually.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#eef2f6]">
                  Suggested Segments ({result.moments.length})
                </span>
                <button
                  type="button"
                  onClick={() => onAddAllMoments(result.moments)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#39475a] bg-[#1c242e] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#e59a24]" />
                  <span>Add All</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.moments.map((m) => {
                  const hookDraft = hookDrafts[m.id] ?? m.hookSuggestion ?? '';
                  return (
                    <div
                      key={m.id}
                      className="rounded border border-[#2a3544] bg-[#0e1217] p-2.5 space-y-2"
                    >
                      <div className="flex gap-2.5 items-start">
                        {m.thumbnailDataUrl ? (
                          <img
                            src={m.thumbnailDataUrl}
                            alt={`Moment at ${formatTimecode(m.peakTime)}`}
                            width={80}
                            height={48}
                            className="w-20 h-12 object-cover rounded border border-[#2a3544] shrink-0 bg-black"
                          />
                        ) : (
                          <div className="w-20 h-12 rounded border border-[#2a3544] bg-[#151b22] shrink-0 flex items-center justify-center text-[10px] text-[#6c7a8c]">
                            Preview
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-mono-num text-[11px] font-semibold text-[#eef2f6] whitespace-nowrap">
                              {formatTimecode(m.startTime)} – {formatTimecode(m.endTime)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${getActivityTone(
                                m.activityLevel
                              )}`}
                            >
                              {m.activityLevel} activity
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            {(m.reasonTags ?? ['motion']).map((tag) => (
                              <span
                                key={tag}
                                className={`text-[10px] font-mono-num px-1.5 py-0.5 rounded border ${getReasonTagTone(
                                  tag
                                )}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <p className="text-[11px] text-[#9aa7b8] truncate" title={m.reason}>
                            {m.reason}
                          </p>

                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => onPreviewMoment(m)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2a3544] hover:border-[#39475a] text-[11px] text-[#eef2f6] cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-[#e59a24]" />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onAddMoment(m)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#e59a24]/60 bg-[#e59a24]/15 hover:bg-[#e59a24]/25 text-[11px] font-medium text-[#eef2f6] cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-[#e59a24]" />
                              <span>Add to clips</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {m.hookSuggestion && (
                        <div className="border-t border-[#1c242e] pt-2 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-[#9aa7b8]">
                            <Type className="w-3 h-3 text-[#e59a24]" />
                            <span>Hook candidate (editable, not auto-applied):</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={hookDraft}
                              maxLength={80}
                              aria-label={`Edit hook suggestion for moment ${formatTimecode(m.startTime)}`}
                              onChange={(e) =>
                                setHookDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                              className="flex-1 min-w-0 rounded border border-[#2a3544] bg-[#151b22] px-2 py-1 text-[11px] text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onApplyHookSuggestion(m, hookDraft);
                                setAppliedMomentId(m.id);
                              }}
                              className="px-2 py-1 rounded border border-[#39475a] hover:border-[#e59a24] text-[10px] font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
                            >
                              {appliedMomentId === m.id ? 'Applied' : 'Use Hook'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

