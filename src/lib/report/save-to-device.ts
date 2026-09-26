/**
 * Device copies of captured photos.
 *
 * Do not use <a download>. On iOS Safari that prompts “Download PVP-….jpg”,
 * often interrupts the attach handler, and parks copies in Downloads that the
 * app does not need. The durable on-device backup is IndexedDB (photo-idb).
 *
 * Optional extra: Web Share → Save Image, which writes to Photos. That file is
 * the user’s copy. The report never points at it.
 */

export function captureFilename(kind: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `PVP-${kind}-${stamp}.jpg`;
}

export function canShareImageFile(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  const payload = { files: [file] };
  if (typeof navigator.canShare === "function") {
    try {
      return navigator.canShare(payload);
    } catch {
      return false;
    }
  }
  return true;
}

/** User-gesture share sheet. On iOS choose Save Image. Never auto-called. */
export async function shareImageToDevice(file: File, filename: string): Promise<boolean> {
  if (!canShareImageFile(file)) return false;
  const named =
    file.name && file.name !== "image.jpg"
      ? file
      : new File([file], filename, { type: file.type || "image/jpeg" });
  try {
    await navigator.share({ files: [named], title: named.name });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    return false;
  }
}
