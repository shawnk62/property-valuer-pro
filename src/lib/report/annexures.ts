import { MAP_SLOTS, PHOTO_SLOTS } from "@/lib/report/photo-data";
import type { ReportDraft } from "@/lib/report/types";

export type AnnexureId = "photos" | "maps" | "placeBased";

export interface AnnexureSpec {
  id: AnnexureId;
  number: number;
  /** Short description of contents, e.g. "Photographs". */
  title: string;
  /** "Annexure 1 — Photographs" */
  heading: string;
  /** "Annexure 1  Photographs" */
  listLine: string;
}

const BODY_MAP_SLOTS = new Set([
  "map_location",
  "map_aerial",
  "map_site_dimensions",
  "map_zoning",
  "map_flood",
  "map_bushfire",
]);

function hasSubjectOrSalePhotos(draft: ReportDraft): boolean {
  const subject = [
    ...PHOTO_SLOTS.map(({ slot }) =>
      draft.photos.find((p) => p.slot === slot && p.url),
    ),
    ...draft.photos.filter((p) => p.slot === null && p.url && p.kind !== "map"),
  ].some(Boolean);
  const sales = draft.sales.some((s) => Boolean(s.photoUrl));
  return subject || sales;
}

function hasAnnexMaps(draft: ReportDraft): boolean {
  const slotted = MAP_SLOTS.some(
    ({ slot }) =>
      !BODY_MAP_SLOTS.has(slot) &&
      draft.photos.some((p) => p.slot === slot && p.url),
  );
  const loose = draft.photos.some(
    (p) => p.slot === null && p.kind === "map" && p.url,
  );
  return slotted || loose;
}

function hasPlaceBased(draft: ReportDraft): boolean {
  const text = draft.values["prop_place_based"];
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasMap = draft.photos.some((p) => p.slot === "map_place_based" && p.url);
  return hasText || hasMap;
}

/**
 * Annexures that actually contain material, numbered 1…n in report order.
 * Empty annexures are omitted so references stay sequential.
 */
export function resolveAnnexures(draft: ReportDraft): AnnexureSpec[] {
  const filled: { id: AnnexureId; title: string }[] = [];
  if (hasSubjectOrSalePhotos(draft)) {
    filled.push({ id: "photos", title: "Photographs" });
  }
  if (hasAnnexMaps(draft)) {
    filled.push({ id: "maps", title: "Maps & planning layers" });
  }
  if (hasPlaceBased(draft)) {
    filled.push({ id: "placeBased", title: "Place-based plans" });
  }
  return filled.map((item, i) => {
    const number = i + 1;
    return {
      id: item.id,
      number,
      title: item.title,
      heading: `Annexure ${number} — ${item.title}`,
      listLine: `Annexure ${number}  ${item.title}`,
    };
  });
}

export function annexureById(
  annexures: AnnexureSpec[],
  id: AnnexureId,
): AnnexureSpec | undefined {
  return annexures.find((a) => a.id === id);
}
