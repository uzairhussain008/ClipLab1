import { APP_CONFIG } from '../config/appConfig';

export type DirectVideoExtension = 'mp4' | 'webm' | 'mov';

export type PastedLinkResult =
  | { kind: 'platform'; platformName: string; url: string }
  | { kind: 'direct-video'; extension: DirectVideoExtension; url: string; fileName: string }
  | { kind: 'unsupported-webpage'; url: string }
  | { kind: 'invalid'; reason: string };

export const PLATFORM_LINK_MESSAGE =
  `${APP_CONFIG.appName} can't download videos from other platforms. If it's your own video, download it from your account using the platform's official option, then drop the file here. Only edit videos you own or have permission to use.`;

export const DIRECT_HOST_BLOCKED_MESSAGE =
  "This host doesn't allow loading in the browser. Download the file and drop it here instead.";

export const UNSUPPORTED_LINK_MESSAGE =
  `${APP_CONFIG.appName} can't download videos from other websites. Drop a local MP4, MOV, or WebM file here, or paste a direct .mp4, .webm, or .mov file URL if its host permits browser access.`;

const PLATFORM_DOMAINS: Array<{ domain: string; name: string }> = [
  { domain: 'youtube.com', name: 'YouTube' },
  { domain: 'youtu.be', name: 'YouTube' },
  { domain: 'youtube-nocookie.com', name: 'YouTube' },
  { domain: 'instagram.com', name: 'Instagram' },
  { domain: 'instagr.am', name: 'Instagram' },
  { domain: 'facebook.com', name: 'Facebook' },
  { domain: 'fb.watch', name: 'Facebook' },
  { domain: 'fb.com', name: 'Facebook' },
  { domain: 'tiktok.com', name: 'TikTok' },
  { domain: 'twitch.tv', name: 'Twitch' },
  { domain: 'kick.com', name: 'Kick' },
  { domain: 'x.com', name: 'X' },
  { domain: 'twitter.com', name: 'X / Twitter' },
  { domain: 't.co', name: 'X / Twitter' },
  { domain: 'reddit.com', name: 'Reddit' },
  { domain: 'redd.it', name: 'Reddit' },
  { domain: 'vimeo.com', name: 'Vimeo' },
  { domain: 'threads.net', name: 'Threads' },
  { domain: 'snapchat.com', name: 'Snapchat' },
  { domain: 'dailymotion.com', name: 'Dailymotion' },
  { domain: 'dai.ly', name: 'Dailymotion' },
  { domain: 'streamable.com', name: 'Streamable' },
  { domain: 'rumble.com', name: 'Rumble' },
  { domain: 'bilibili.com', name: 'Bilibili' },
  { domain: 'loom.com', name: 'Loom' },
];

const MIME_BY_EXT: Record<DirectVideoExtension, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

const MAX_REMOTE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB browser ArrayBuffer ceiling

function matchDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectPlatformHost(hostname: string): string | null {
  const cleanHost = hostname.trim().toLowerCase().replace(/\.+$/, '');
  for (const entry of PLATFORM_DOMAINS) {
    if (matchDomain(cleanHost, entry.domain)) {
      return entry.name;
    }
  }
  return null;
}

export function classifyPastedLink(rawInput: string): PastedLinkResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { kind: 'invalid', reason: 'Paste a video URL first.' };
  }

  // Reject dangerous or non-HTTP(S) schemes explicitly
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return {
        kind: 'invalid',
        reason: 'Only http:// or https:// links can be checked here.',
      };
    }
  }

  const normalized =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)
        ? `https://${trimmed}`
        : '';

  if (!normalized) {
    return {
      kind: 'invalid',
      reason: 'Enter a valid link (starting with https://) or drop a local video file above.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return {
      kind: 'invalid',
      reason: 'Enter a valid URL or drop a local video file above.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'invalid', reason: 'Only http:// or https:// links are supported.' };
  }

  const platformName = detectPlatformHost(parsed.hostname);
  if (platformName) {
    return {
      kind: 'platform',
      platformName,
      url: parsed.toString(),
    };
  }

  const pathMatch = /\.([a-z0-9]+)$/i.exec(parsed.pathname);
  const extRaw = pathMatch?.[1]?.toLowerCase();
  if (extRaw === 'mp4' || extRaw === 'webm' || extRaw === 'mov') {
    const rawSegment = parsed.pathname.split('/').pop() || `clip.${extRaw}`;
    const decoded = (() => {
      try {
        return decodeURIComponent(rawSegment);
      } catch {
        return rawSegment;
      }
    })();
    const fileName = decoded.replace(/[^a-zA-Z0-9._-]/g, '_') || `remote-clip.${extRaw}`;
    return {
      kind: 'direct-video',
      extension: extRaw,
      url: parsed.toString(),
      fileName,
    };
  }

  return {
    kind: 'unsupported-webpage',
    url: parsed.toString(),
  };
}

export interface DirectVideoProgress {
  loadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export async function loadDirectVideoFromUrl(params: {
  url: string;
  fileName: string;
  extension: DirectVideoExtension;
  signal: AbortSignal;
  onProgress: (progress: DirectVideoProgress) => void;
}): Promise<File> {
  const { url, fileName, extension, signal, onProgress } = params;

  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors', signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new Error(DIRECT_HOST_BLOCKED_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(DIRECT_HOST_BLOCKED_MESSAGE);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml') ||
    contentType.includes('application/json') ||
    contentType.includes('text/plain')
  ) {
    throw new Error(DIRECT_HOST_BLOCKED_MESSAGE);
  }

  const rawLength = response.headers.get('content-length');
  const totalBytes =
    rawLength && Number.isFinite(Number(rawLength)) && Number(rawLength) > 0
      ? Number(rawLength)
      : null;

  if (totalBytes !== null && totalBytes > MAX_REMOTE_VIDEO_BYTES) {
    throw new Error('This remote video exceeds browser tab memory limits. Download and pre-trim it locally.');
  }

  const mimeType =
    contentType.startsWith('video/') ? contentType.split(';')[0] : MIME_BY_EXT[extension];

  if (!response.body) {
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error(DIRECT_HOST_BLOCKED_MESSAGE);
    }
    onProgress({ loadedBytes: blob.size, totalBytes: blob.size, percent: 100 });
    return new File([blob], fileName, { type: mimeType });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loadedBytes += value.byteLength;
        if (loadedBytes > MAX_REMOTE_VIDEO_BYTES) {
          await reader.cancel();
          throw new Error('This remote video exceeds browser tab memory limits.');
        }
        const percent =
          totalBytes && totalBytes > 0
            ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
            : null;
        onProgress({ loadedBytes, totalBytes, percent });
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (err instanceof Error && err.message.includes('memory limits')) {
      throw err;
    }
    throw new Error(DIRECT_HOST_BLOCKED_MESSAGE);
  }

  if (loadedBytes === 0) {
    throw new Error(DIRECT_HOST_BLOCKED_MESSAGE);
  }

  const blob = new Blob(chunks as BlobPart[], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
}
