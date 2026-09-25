/**
 * Subject-photo completeness for inspection submit.
 * Industry practice: at least five colour photos, including front, rear,
 * kitchen(s) and bathroom(s).
 */
import type { PhotoSlot, ReportPhoto } from "@/lib/report/types";

export type RequiredPhotoElement = {
  id: "front" | "rear" | "kitchen" | "bathroom" | "minimum_count";
  label: string;
  /** Slot to open when the user chooses Take photo (null = general photos grid). */
  focusSlot: PhotoSlot | null;
};

const MIN_PHOTOS = 5;

function hasSlot(photos: ReportPhoto[], slots: PhotoSlot[]): boolean {
  return photos.some((p) => p.url && p.slot && slots.includes(p.slot as PhotoSlot));
}

/**
 * Returns missing elements for submit gating. Empty array = OK to submit.
 */
export function missingRequiredPhotos(
  photos: ReportPhoto[],
  opts?: { vacantLand?: boolean },
): RequiredPhotoElement[] {
  const withUrl = photos.filter((p) => typeof p.url === "string" && p.url.trim().length > 0);
  const missing: RequiredPhotoElement[] = [];
  const vacant = Boolean(opts?.vacantLand);

  if (!hasSlot(withUrl, ["front"])) {
    missing.push({ id: "front", label: "Front elevation", focusSlot: "front" });
  }
  if (!vacant && !hasSlot(withUrl, ["rear"])) {
    missing.push({ id: "rear", label: "Rear elevation", focusSlot: "rear" });
  }
  if (!vacant && !hasSlot(withUrl, ["kitchen"])) {
    missing.push({ id: "kitchen", label: "Kitchen", focusSlot: "kitchen" });
  }
  if (!vacant && !hasSlot(withUrl, ["baths", "bath_2", "bath_3"])) {
    missing.push({ id: "bathroom", label: "Bathroom", focusSlot: "baths" });
  }
  const min = vacant ? 2 : MIN_PHOTOS;
  if (withUrl.length < min) {
    missing.push({
      id: "minimum_count",
      label: `At least ${min} photographs (currently ${withUrl.length})`,
      focusSlot: null,
    });
  }
  return missing;
}

/** Australian local date-time for display under photo labels. */
export function formatPhotoTimestamp(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function nowPhotoTimestamp(): string {
  return new Date().toISOString();
}
