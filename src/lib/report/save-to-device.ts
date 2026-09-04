/**
 * Best-effort copy of a captured image onto the device.
 * Runs from the file-input change handler so iOS still treats it as a user gesture.
 * Safari cannot silently write the Photos library; a download is the reliable
 * offline copy (Files / Downloads, and Photos when the browser offers that).
 */
export function saveToDeviceGallery(file: File, filename: string): void {
  if (typeof document === "undefined") return;
  try {
    const safe = filename.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
    const name = /\.(jpe?g|png|webp|heic|heif)$/i.test(safe) ? safe : `${safe}.jpg`;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 8000);
  } catch {
    /* ignore — app copy is stored separately */
  }
}

export function captureFilename(kind: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `PVP-${kind}-${stamp}.jpg`;
}
