export interface ZipFileEntry {
  name: string;
  blob: Blob;
}

/**
 * Lazy-loads fflate only when the user exports all clips as a ZIP.
 * Throws cleanly if fflate fails to load or the browser aborts, allowing sequential fallback.
 */
export async function buildClipsZipBlob(params: {
  entries: ZipFileEntry[];
  signal?: AbortSignal;
  onProgress?: (percent: number, message: string) => void;
}): Promise<Blob> {
  const { entries, signal, onProgress } = params;
  if (entries.length === 0) {
    throw new Error('No clips available to pack into ZIP.');
  }

  const checkCancelled = () => {
    if (signal?.aborted) {
      throw new Error('Export cancelled.');
    }
  };

  checkCancelled();
  onProgress?.(10, 'Loading ZIP packager...');

  const fflate = await import('fflate');
  checkCancelled();

  const filesMap: Record<string, Uint8Array> = {};
  const seenNames = new Map<string, number>();

  for (let i = 0; i < entries.length; i++) {
    checkCancelled();
    const entry = entries[i];
    const count = seenNames.get(entry.name) ?? 0;
    seenNames.set(entry.name, count + 1);
    const uniqueName =
      count === 0 ? entry.name : entry.name.replace(/(\.[^.]+)$/, `-${count + 1}$1`);

    onProgress?.(
      Math.min(85, Math.round(15 + ((i + 1) / entries.length) * 65)),
      `Adding ${uniqueName} to ZIP...`
    );

    const buf = await entry.blob.arrayBuffer();
    filesMap[uniqueName] = new Uint8Array(buf);
  }

  checkCancelled();
  onProgress?.(92, 'Finalizing ZIP archive...');

  // Store level 0 since MP4/WebM/GIF streams are already compressed (fast & low memory overhead)
  const zipped = fflate.zipSync(filesMap, { level: 0 });
  const normalizedBytes = new Uint8Array(zipped.byteLength);
  normalizedBytes.set(zipped);

  onProgress?.(100, 'ZIP ready.');
  return new Blob([normalizedBytes.buffer], { type: 'application/zip' });
}
