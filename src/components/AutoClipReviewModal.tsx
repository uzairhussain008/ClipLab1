import { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import type { ClipSegment, SmartMomentCandidate } from '../types/editor';
import { clampTime, formatTimecode, MIN_CLIP_DURATION, normalizeTrimRange } from '../utils/timecode';

interface AutoClipReviewModalProps {
  isOpen: boolean;
  duration: number;
  segments: ClipSegment[];
  moments: SmartMomentCandidate[];
  hookSuggestionsBySegmentId: Record<string, string>;
  hasCaptions: boolean;
  isExporting: boolean;
  exportProgress: { percent: number; message: string } | null;
  exportError: string | null;
  exportStatusNote: string | null;
  onClose: () => void;
  onUpdateSegment: (id: string, patch: Partial<ClipSegment>) => void;
  onDeleteSegment: (id: string) => void;
  onFocusSegment: (id: string) => void;
  onApplyHookSuggestion: (segment: ClipSegment, hookText: string) => void;
  onExportSingle: (segment: ClipSegment) => void;
  onExportAllZip: (segments: ClipSegment[]) => void;
  onExportAllSequential: (segments: ClipSegment[]) => void;
  onCancelExport: () => void;
}

export function AutoClipReviewModal({
  isOpen,
  duration,
  segments,
  moments,
  hookSuggestionsBySegmentId,
  hasCaptions,
  isExporting,
  exportProgress,
  exportError,
  exportStatusNote,
  onClose,
  onUpdateSegment,
  onDeleteSegment,
  onFocusSegment,
  onApplyHookSuggestion,
  onExportSingle,
  onExportAllZip,
  onExportAllSequential,
  onCancelExport,
}: AutoClipReviewModalProps) {
  const [hookDrafts, setHookDrafts] = useState<Record<string, string>>({});
  const [appliedHookId, setAppliedHookId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="autoclip-review-title"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="max-w-3xl w-full rounded-md border border-[#39475a] bg-[#151b22] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#2a3544] bg-[#0e1217]">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[#e59a24] shrink-0" />
            <h2 id="autoclip-review-title" className="font-display text-xl font-bold text-[#eef2f6] truncate">
              Review Auto-Clipped Highlights ({segments.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review screen"
            className="p-1.5 rounded border border-[#2a3544] text-[#9aa7b8] hover:text-[#eef2f6] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-[#9aa7b8] leading-relaxed">
            Smart follow framing{hasCaptions ? ' and your selected caption style are' : ' is'} active.
            Review, rename, trim, or remove any clip below before exporting. Hook suggestions are never
            auto-applied until you click Apply Hook.
          </p>

          {segments.length === 0 ? (
            <div className="rounded border border-[#2a3544] bg-[#0e1217] p-6 text-center text-xs text-[#9aa7b8]">
              No clips remaining. Close this dialog to add segments manually or re-scan moments.
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((seg, idx) => {
                const matchingMoment = moments.find(
                  (m) =>
                    Math.abs(m.startTime - seg.startTime) < 0.25 &&
                    Math.abs(m.endTime - seg.endTime) < 0.25
                );
                const defaultHook =
                  hookSuggestionsBySegmentId[seg.id] ?? matchingMoment?.hookSuggestion ?? '';
                const draftHook = hookDrafts[seg.id] ?? defaultHook;

                return (
                  <div
                    key={seg.id}
                    className="rounded border border-[#2a3544] bg-[#0e1217] p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono-num text-[11px] text-[#e59a24] font-semibold">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={seg.name}
                          aria-label={`Review clip name ${seg.name}`}
                          onChange={(e) => onUpdateSegment(seg.id, { name: e.target.value })}
                          className="min-w-[140px] flex-1 max-w-[240px] rounded border border-[#2a3544] bg-[#151b22] px-2.5 py-1 text-xs font-medium text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
                        />
                        {matchingMoment && (
                          <span className="text-[11px] font-mono-num text-[#c2cbd6]">
                            {matchingMoment.activityLevel} activity
                          </span>
                        )}
                        {matchingMoment?.reasonTags?.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono-num px-1.5 py-0.5 rounded border border-[#2a3544] bg-[#151b22] text-[#9aa7b8]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onFocusSegment(seg.id);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2a3544] hover:border-[#39475a] text-[11px] text-[#eef2f6] cursor-pointer"
                        >
                          <Scissors className="w-3 h-3 text-[#e59a24]" />
                          <span>Trim</span>
                        </button>
                        <button
                          type="button"
                          disabled={isExporting}
                          onClick={() => onExportSingle(seg)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#2a3544] hover:border-[#e59a24] text-[11px] text-[#eef2f6] cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3 h-3 text-[#e59a24]" />
                          <span>Export MP4</span>
                        </button>
                        {segments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteSegment(seg.id)}
                            aria-label={`Remove ${seg.name}`}
                            className="p-1.5 rounded text-[#9aa7b8] hover:text-[#dc3545] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center text-[11px]">
                      <label className="flex items-center gap-1.5 text-[#9aa7b8]">
                        <span>Start (s):</span>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={Math.max(0, seg.endTime - MIN_CLIP_DURATION)}
                          value={seg.startTime}
                          onChange={(e) => {
                            const nextStart = clampTime(
                              Number(e.target.value),
                              0,
                              seg.endTime - MIN_CLIP_DURATION
                            );
                            const norm = normalizeTrimRange(nextStart, seg.endTime, duration || 5);
                            onUpdateSegment(seg.id, norm);
                          }}
                          className="w-20 rounded border border-[#2a3544] bg-[#151b22] px-2 py-1 font-mono-num text-[#eef2f6]"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[#9aa7b8]">
                        <span>End (s):</span>
                        <input
                          type="number"
                          step="0.1"
                          min={seg.startTime + MIN_CLIP_DURATION}
                          max={duration || seg.endTime}
                          value={seg.endTime}
                          onChange={(e) => {
                            const nextEnd = clampTime(
                              Number(e.target.value),
                              seg.startTime + MIN_CLIP_DURATION,
                              duration || seg.endTime
                            );
                            const norm = normalizeTrimRange(seg.startTime, nextEnd, duration || 5);
                            onUpdateSegment(seg.id, norm);
                          }}
                          className="w-20 rounded border border-[#2a3544] bg-[#151b22] px-2 py-1 font-mono-num text-[#eef2f6]"
                        />
                      </label>
                      <div className="font-mono-num text-[#9aa7b8]">
                        Duration: {formatTimecode(Math.max(0, seg.endTime - seg.startTime))}
                      </div>
                    </div>

                    {defaultHook && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-[#1c242e]">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#9aa7b8] shrink-0">
                          <Type className="w-3 h-3 text-[#e59a24]" />
                          <span>Hook suggestion (optional):</span>
                        </span>
                        <input
                          type="text"
                          value={draftHook}
                          maxLength={80}
                          aria-label={`Editable hook suggestion for ${seg.name}`}
                          onChange={(e) =>
                            setHookDrafts((prev) => ({ ...prev, [seg.id]: e.target.value }))
                          }
                          className="flex-1 rounded border border-[#2a3544] bg-[#151b22] px-2 py-1 text-xs text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onApplyHookSuggestion(seg, draftHook);
                            setAppliedHookId(seg.id);
                          }}
                          className="px-2.5 py-1 rounded border border-[#e59a24]/60 bg-[#e59a24]/15 hover:bg-[#e59a24]/25 text-[11px] font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
                        >
                          {appliedHookId === seg.id ? 'Hook Applied' : 'Apply Hook'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isExporting && exportProgress && (
            <div className="rounded border border-[#39475a] bg-[#0e1217] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#eef2f6]">{exportProgress.message}</span>
                <span className="font-mono-num text-[#e59a24]">{exportProgress.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#1c242e] overflow-hidden">
                <div
                  style={{ width: `${exportProgress.percent}%` }}
                  className="h-full bg-[#e59a24] transition-all duration-150"
                />
              </div>
              <button
                type="button"
                onClick={onCancelExport}
                className="w-full py-1.5 rounded border border-[#dc3545]/70 bg-[#dc3545]/15 hover:bg-[#dc3545]/25 text-xs font-semibold text-[#f8d7da] cursor-pointer"
              >
                Cancel Export
              </button>
            </div>
          )}

          {exportError && (
            <div
              role="alert"
              className="rounded border border-[#dc3545]/60 bg-[#dc3545]/10 px-3 py-2 text-xs text-[#f8d7da]"
            >
              {exportError}
            </div>
          )}

          {exportStatusNote && !exportError && (
            <p role="status" className="text-xs text-[#9aa7b8] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2ea043] shrink-0" />
              <span>{exportStatusNote}</span>
            </p>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[#2a3544] bg-[#0e1217] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded border border-[#2a3544] text-xs font-medium text-[#9aa7b8] hover:text-[#eef2f6] cursor-pointer"
          >
            Back to Studio
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isExporting || segments.length === 0}
              onClick={() => onExportAllSequential(segments)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#39475a] bg-[#151b22] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#e59a24]" />
              <span>Export Separate MP4s</span>
            </button>

            <button
              type="button"
              disabled={isExporting || segments.length === 0}
              onClick={() => onExportAllZip(segments)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#e59a24] hover:bg-[#f0ab3c] text-xs font-semibold text-[#0e1217] disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Export All (.ZIP)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
