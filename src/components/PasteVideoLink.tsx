import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Link2, XCircle } from 'lucide-react';
import { formatFileSize, validateVideoFile } from '../utils/deviceCheck';
import {
  classifyPastedLink,
  DIRECT_HOST_BLOCKED_MESSAGE,
  loadDirectVideoFromUrl,
  PLATFORM_LINK_MESSAGE,
  UNSUPPORTED_LINK_MESSAGE,
} from '../utils/linkHandling';

interface PasteVideoLinkProps {
  onVideoLoaded: (file: File, warnings: string[]) => void;
}

export function PasteVideoLink({ onVideoLoaded }: PasteVideoLinkProps) {
  const inputId = useId();
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{
    loadedBytes: number;
    totalBytes: number | null;
    percent: number | null;
  } | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'platform' | 'error' | 'info';
    text: string;
    showGuideLink?: boolean;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setProgressInfo(null);
    setNotice({ tone: 'info', text: 'Direct link load cancelled.' });
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (isLoading) return;

    const result = classifyPastedLink(urlInput);

    if (result.kind === 'invalid') {
      setNotice({ tone: 'error', text: result.reason });
      return;
    }

    if (result.kind === 'platform') {
      setNotice({
        tone: 'platform',
        text: PLATFORM_LINK_MESSAGE,
        showGuideLink: true,
      });
      return;
    }

    if (result.kind === 'unsupported-webpage') {
      setNotice({
        tone: 'platform',
        text: UNSUPPORTED_LINK_MESSAGE,
        showGuideLink: true,
      });
      return;
    }

    // Optional direct .mp4 / .webm / .mov file URL loader
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setNotice(null);
    setProgressInfo({ loadedBytes: 0, totalBytes: null, percent: null });

    try {
      const file = await loadDirectVideoFromUrl({
        url: result.url,
        fileName: result.fileName,
        extension: result.extension,
        signal: controller.signal,
        onProgress: (info) => setProgressInfo(info),
      });

      const check = validateVideoFile(file);
      if (!check.valid) {
        setNotice({ tone: 'error', text: check.error || DIRECT_HOST_BLOCKED_MESSAGE });
        return;
      }

      onVideoLoaded(file, check.warnings);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : DIRECT_HOST_BLOCKED_MESSAGE,
      });
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setProgressInfo(null);
    }
  };

  return (
    <div className="w-full pt-3 mt-1 border-t border-[#2a3544] text-left space-y-2">
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#9aa7b8]"
        >
          <Link2 className="w-3.5 h-3.5 text-[#e59a24]" />
          <span>Paste a link</span>
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={inputId}
            type="text"
            inputMode="url"
            value={urlInput}
            disabled={isLoading}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Direct .mp4 / .webm / .mov link..."
            className="flex-1 min-w-0 rounded border border-[#2a3544] bg-[#0e1217] px-2.5 py-1.5 text-xs text-[#eef2f6] placeholder:text-[#6c7a8c] focus:border-[#e59a24] focus:outline-none disabled:opacity-60"
          />
          {!isLoading ? (
            <button
              type="submit"
              className="px-3 py-1.5 rounded border border-[#39475a] bg-[#1c242e] hover:border-[#e59a24] text-xs font-medium text-[#eef2f6] whitespace-nowrap cursor-pointer"
            >
              Load URL
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 rounded border border-[#dc3545]/70 bg-[#dc3545]/15 text-xs font-medium text-[#f8d7da] whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <p className="text-[11px] text-[#6c7a8c] leading-relaxed">
        Platform links (YouTube, Instagram, Facebook, TikTok) are not downloaded. Direct file links
        send a browser request directly to that file&apos;s host, which sees the request.
      </p>

      {isLoading && progressInfo && (
        <div className="rounded border border-[#2a3544] bg-[#0e1217] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#eef2f6]">
              Loading direct video ({formatFileSize(progressInfo.loadedBytes)}
              {progressInfo.totalBytes ? ` / ${formatFileSize(progressInfo.totalBytes)}` : ''})...
            </span>
            {progressInfo.percent !== null && (
              <span className="font-mono-num text-[#e59a24]">{progressInfo.percent}%</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-[#1c242e] overflow-hidden">
            <div
              style={{ width: `${progressInfo.percent ?? 45}%` }}
              className={`h-full bg-[#e59a24] transition-all duration-150 ${
                progressInfo.percent === null ? 'animate-pulse' : ''
              }`}
            />
          </div>
        </div>
      )}

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`rounded border px-2.5 py-2 text-[11px] leading-relaxed flex items-start gap-2 ${
            notice.tone === 'error'
              ? 'border-[#dc3545]/60 bg-[#dc3545]/10 text-[#f8d7da]'
              : notice.tone === 'platform'
                ? 'border-[#e59a24]/50 bg-[#e59a24]/10 text-[#eef2f6]'
                : 'border-[#2a3544] bg-[#0e1217] text-[#9aa7b8]'
          }`}
        >
          {notice.tone === 'error' ? (
            <XCircle className="w-3.5 h-3.5 text-[#dc3545] shrink-0 mt-0.5" />
          ) : notice.tone === 'platform' ? (
            <AlertTriangle className="w-3.5 h-3.5 text-[#e59a24] shrink-0 mt-0.5" />
          ) : (
            <Info className="w-3.5 h-3.5 text-[#9aa7b8] shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p>{notice.text}</p>
            {notice.showGuideLink && (
              <Link
                to="/guides/download-your-own-videos"
                className="inline-block font-medium text-[#e59a24] underline hover:text-[#f0ab3c]"
              >
                How to download your own videos using official platform options →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
