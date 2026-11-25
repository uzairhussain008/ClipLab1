import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ActivitySample, ClipSegment, SmartMomentCandidate } from '../types/editor';
import { clampTime, formatTimecode, MIN_CLIP_DURATION } from '../utils/timecode';

interface TimelineProps {
  duration: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  segments: ClipSegment[];
  activeSegmentId: string;
  activitySamples?: ActivitySample[];
  suggestedMoments?: SmartMomentCandidate[];
  onSeek: (time: number) => void;
  onChangeRange: (start: number, end: number) => void;
  onStepFrame: (direction: -1 | 1) => void;
  onSelectSegment: (id: string) => void;
}

type DragTarget = 'start' | 'end' | 'playhead' | null;

export function Timeline({
  duration,
  currentTime,
  startTime,
  endTime,
  segments,
  activeSegmentId,
  activitySamples = [],
  suggestedMoments = [],
  onSeek,
  onChangeRange,
  onStepFrame,
  onSelectSegment,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragTarget>(null);

  const safeDuration = Math.max(duration, MIN_CLIP_DURATION);
  const startPct = (startTime / safeDuration) * 100;
  const endPct = (endTime / safeDuration) * 100;
  const playheadPct = (clampTime(currentTime, 0, safeDuration) / safeDuration) * 100;

  // Build SVG polygon points for activity sparkline graph
  const activityGraphPaths = useMemo(() => {
    if (activitySamples.length < 2) return null;
    const width = 1000;
    const height = 100;
    const pts = activitySamples.map((s) => {
      const x = (clampTime(s.time, 0, safeDuration) / safeDuration) * width;
      const y = height - clampTime(s.score, 0, 1) * (height - 10) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const firstX = (clampTime(activitySamples[0].time, 0, safeDuration) / safeDuration) * width;
    const lastX =
      (clampTime(activitySamples[activitySamples.length - 1].time, 0, safeDuration) / safeDuration) *
      width;
    const linePath = `M ${pts.join(' L ')}`;
    const areaPath = `M ${firstX.toFixed(1)},${height} L ${pts.join(' L ')} L ${lastX.toFixed(1)},${height} Z`;
    return { linePath, areaPath };
  }, [activitySamples, safeDuration]);

  const clientXToTime = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = clampTime((clientX - rect.left) / rect.width, 0, 1);
    return Number((ratio * safeDuration).toFixed(3));
  };

  const handlePointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const t = clientXToTime(ev.clientX);
    if (dragging === 'playhead') {
      onSeek(t);
    } else if (dragging === 'start') {
      const nextStart = clampTime(t, 0, endTime - MIN_CLIP_DURATION);
      onChangeRange(nextStart, endTime);
      onSeek(nextStart);
    } else if (dragging === 'end') {
      const nextEnd = clampTime(t, startTime + MIN_CLIP_DURATION, safeDuration);
      onChangeRange(startTime, nextEnd);
      onSeek(nextEnd);
    }
  };

  const handlePointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) {
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore if not captured
      }
      setDragging(null);
    }
  };

  const startDrag = (target: DragTarget, ev: React.PointerEvent) => {
    ev.stopPropagation();
    const track = trackRef.current;
    if (track) {
      try {
        track.setPointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
    }
    setDragging(target);
    if (target === 'playhead') {
      onSeek(clientXToTime(ev.clientX));
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Segment overview strip when multiple segments exist */}
      {segments.length > 1 && (
        <div className="relative h-4 rounded bg-[#0e1217] border border-[#2a3544] overflow-hidden">
          {segments.map((seg) => {
            const left = (seg.startTime / safeDuration) * 100;
            const width = Math.max(1.5, ((seg.endTime - seg.startTime) / safeDuration) * 100);
            const active = seg.id === activeSegmentId;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => onSelectSegment(seg.id)}
                title={`${seg.name} (${formatTimecode(seg.startTime)} – ${formatTimecode(seg.endTime)})`}
                aria-label={`Select segment ${seg.name}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                className={`absolute top-0 bottom-0 transition-colors ${
                  active
                    ? 'bg-[#e59a24]/80 border-x border-[#eef2f6]'
                    : 'bg-[#39475a]/70 hover:bg-[#4e617a]'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Activity Score Graph (audio energy + motion + scene spikes) */}
      {activityGraphPaths && (
        <div
          onClick={(ev) => {
            const rect = ev.currentTarget.getBoundingClientRect();
            if (rect.width <= 0) return;
            const ratio = clampTime((ev.clientX - rect.left) / rect.width, 0, 1);
            onSeek(Number((ratio * safeDuration).toFixed(3)));
          }}
          title="Audio + motion activity score (click to seek)"
          className="relative h-10 rounded border border-[#2a3544] bg-[#0b0f14] overflow-hidden cursor-pointer"
        >
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="w-full h-full block pointer-events-none"
            aria-label="Activity score graph"
          >
            <path d={activityGraphPaths.areaPath} fill="rgba(229, 154, 36, 0.22)" />
            <path d={activityGraphPaths.linePath} fill="none" stroke="#e59a24" strokeWidth="2.5" />
          </svg>

          {/* Suggested peak markers */}
          {suggestedMoments.map((m) => {
            const left = (clampTime(m.peakTime, 0, safeDuration) / safeDuration) * 100;
            return (
              <span
                key={m.id}
                style={{ left: `${left}%` }}
                title={`${m.activityLevel} activity peak at ${formatTimecode(m.peakTime)}`}
                className="absolute top-0 bottom-0 w-0.5 bg-[#eef2f6]/70 pointer-events-none"
              />
            );
          })}

          {/* Playhead cursor inside activity graph */}
          <span
            style={{ left: `${playheadPct}%` }}
            className="absolute top-0 bottom-0 w-px bg-[#eef2f6] pointer-events-none"
          />

          <span className="absolute top-1 left-2 text-[10px] font-medium text-[#9aa7b8] pointer-events-none">
            Activity score
          </span>
        </div>
      )}

      {/* Main interactive trim rail */}
      <div
        ref={trackRef}
        onPointerDown={(ev) => startDrag('playhead', ev)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-14 rounded-md border border-[#2a3544] bg-[#0e1217] select-none touch-none cursor-pointer"
      >
        {/* Subtle tick marks */}
        <div className="absolute inset-x-0 top-1.5 flex justify-between px-2 pointer-events-none">
          {[0, 25, 50, 75, 100].map((tick) => (
            <span key={tick} className="w-px h-2 bg-[#2a3544]" />
          ))}
        </div>

        {/* Selected active trim region */}
        <div
          style={{ left: `${startPct}%`, width: `${Math.max(0.5, endPct - startPct)}%` }}
          className="absolute top-2 bottom-2 bg-[#e59a24]/18 border-y-2 border-[#e59a24] pointer-events-none"
        />

        {/* In Handle */}
        <button
          type="button"
          aria-label="Trim start handle"
          onPointerDown={(ev) => startDrag('start', ev)}
          style={{ left: `${startPct}%` }}
          className="absolute top-0 bottom-0 -translate-x-1/2 w-5 flex items-center justify-center cursor-ew-resize group z-20"
        >
          <span className="w-3 h-11 rounded-sm bg-[#e59a24] group-hover:bg-[#f0ab3c] border border-[#0e1217] flex items-center justify-center shadow">
            <span className="w-0.5 h-5 bg-[#0e1217]/80" />
          </span>
        </button>

        {/* Out Handle */}
        <button
          type="button"
          aria-label="Trim end handle"
          onPointerDown={(ev) => startDrag('end', ev)}
          style={{ left: `${endPct}%` }}
          className="absolute top-0 bottom-0 -translate-x-1/2 w-5 flex items-center justify-center cursor-ew-resize group z-20"
        >
          <span className="w-3 h-11 rounded-sm bg-[#e59a24] group-hover:bg-[#f0ab3c] border border-[#0e1217] flex items-center justify-center shadow">
            <span className="w-0.5 h-5 bg-[#0e1217]/80" />
          </span>
        </button>

        {/* Playhead Needle */}
        <div
          style={{ left: `${playheadPct}%` }}
          className="absolute top-0 bottom-0 -translate-x-1/2 w-0.5 bg-[#eef2f6] z-30 pointer-events-none"
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-[#eef2f6]" />
        </div>
      </div>

      {/* Timecode readout & precision controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 font-mono-num text-[#9aa7b8]">
          <span>
            In: <strong className="text-[#eef2f6]">{formatTimecode(startTime)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Out: <strong className="text-[#eef2f6]">{formatTimecode(endTime)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Clip: <strong className="text-[#e59a24]">{formatTimecode(endTime - startTime)}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStepFrame(-1)}
            aria-label="Step back one frame"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#2a3544] bg-[#151b22] hover:bg-[#1c242e] text-[#eef2f6] whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>-1f</span>
          </button>
          <button
            type="button"
            onClick={() => onStepFrame(1)}
            aria-label="Step forward one frame"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#2a3544] bg-[#151b22] hover:bg-[#1c242e] text-[#eef2f6] whitespace-nowrap"
          >
            <span>+1f</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeRange(clampTime(currentTime, 0, endTime - MIN_CLIP_DURATION), endTime)}
            className="px-2.5 py-1.5 rounded border border-[#2a3544] bg-[#151b22] hover:border-[#e59a24] text-[#eef2f6] whitespace-nowrap"
          >
            Set In (I)
          </button>
          <button
            type="button"
            onClick={() => onChangeRange(startTime, clampTime(currentTime, startTime + MIN_CLIP_DURATION, safeDuration))}
            className="px-2.5 py-1.5 rounded border border-[#2a3544] bg-[#151b22] hover:border-[#e59a24] text-[#eef2f6] whitespace-nowrap"
          >
            Set Out (O)
          </button>
        </div>
      </div>
    </div>
  );
}
