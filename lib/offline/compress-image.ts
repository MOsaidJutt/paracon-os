"use client";

/**
 * Resizes + re-encodes a captured photo to JPEG before it ever reaches
 * IndexedDB, so a queued site photo is small on a bad-signal connection. The
 * server (lib/storage.ts#uploadSitePhoto) re-compresses again on receipt as a
 * backstop, but doing it client-side first is what keeps the offline queue
 * light. Falls back to the original file untouched if the browser can't
 * decode it (e.g. an unsupported HEIC variant) — the server-side sharp pass
 * is the safety net for that case.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.78): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
