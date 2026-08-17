/**
 * Map Cotality CMA extract results into ComparableSale rows for the shared grid.
 */
import { defaultAdjustments, type Relativity } from "./adjustmentGrid";
import type { ComparableSale, FeatureAdjustment } from "./types";

export interface CmaSaleExtract {
  address?: string | null;
  saleDate?: string | null;
  salePrice?: string | null;
  landArea?: string | null;
  gla?: string | null;
  beds?: string | null;
  baths?: string | null;
  cars?: string | null;
  yearBuilt?: string | null;
  distance?: string | null;
  comments?: string | null;
  /** Free-form COMPARABLE / SUPERIOR / INFERIOR lines from the CMA. */
  comparisonNotes?: string | null;
}

const FEATURE_ALIASES: Record<string, string> = {
  location: "location",
  loc: "location",
  site: "site",
  "land area": "site",
  land: "site",
  topography: "site",
  view: "view",
  design: "design",
  style: "design",
  quality: "quality",
  finishes: "quality",
  presentation: "condition",
  condition: "condition",
  age: "actualAge",
  "year built": "actualAge",
  gla: "gla",
  "floor area": "gla",
  "living area": "gla",
  accommodation: "accommodation",
  accom: "accommodation",
  "accom. layout": "accommodation",
  layout: "accommodation",
  car: "car",
  cars: "car",
  garage: "car",
  carport: "car",
  outdoor: "outdoor",
  other: "other",
};

function mapFeatureLabel(label: string): string | null {
  const n = label.trim().toLowerCase().replace(/\s+/g, " ");
  if (FEATURE_ALIASES[n]) return FEATURE_ALIASES[n];
  for (const [k, v] of Object.entries(FEATURE_ALIASES)) {
    if (n.includes(k) || k.includes(n)) return v;
  }
  return null;
}

function parseRelativityWord(word: string): Relativity | null {
  const w = word.trim().toLowerCase();
  if (w.startsWith("slightly inferior") || w === "slightly inferior") return "slightly inferior";
  if (w.startsWith("slightly superior") || w === "slightly superior") return "slightly superior";
  if (w.startsWith("inferior")) return "inferior";
  if (w.startsWith("superior")) return "superior";
  if (w.startsWith("comparable") || w.startsWith("similar")) return "similar";
  return null;
}

/**
 * Parse CMA "SUPERIOR: Location; Presentation" style lines into grid marks.
 * Cotality uses COMPARABLE / SUPERIOR / INFERIOR from the *subject's* perspective
 * in agent CMAs — i.e. what is superior about the *comp* relative to subject.
 * Our grid marks describe the comp vs subject the same way.
 */
export function adjustmentsFromComparisonNotes(
  notes: string | null | undefined,
): Record<string, FeatureAdjustment> {
  const base = defaultAdjustments();
  if (!notes?.trim()) return base;

  const lines = notes.split(/\n+/);
  for (const line of lines) {
    const m = line.match(
      /^\s*(COMPARABLE|SUPERIOR|INFERIOR|SLIGHTLY\s+SUPERIOR|SLIGHTLY\s+INFERIOR)\s*:\s*(.+)$/i,
    );
    if (!m) continue;
    const rel = parseRelativityWord(m[1]!);
    if (!rel) continue;
    const parts = m[2]!.split(/[;,(]/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      // strip trailing " - negligible" etc.
      const label = part.replace(/\s*[-–—].*$/, "").trim();
      if (!label || /^nil$/i.test(label)) continue;
      const featureId = mapFeatureLabel(label);
      if (!featureId) continue;
      base[featureId] = { relativity: rel, amount: base[featureId]?.amount ?? 0 };
    }
  }
  return base;
}

function newId(): string {
  return `sale-${Math.random().toString(36).slice(2, 10)}`;
}

export function cmaExtractsToSales(rows: CmaSaleExtract[]): ComparableSale[] {
  return rows
    .map((r) => {
      const address = String(r.address ?? "").trim();
      const salePrice = String(r.salePrice ?? "").trim();
      const saleDate = String(r.saleDate ?? "").trim();
      if (!address && !salePrice) return null;

      const comparisonNotes = String(r.comparisonNotes ?? r.comments ?? "").trim();
      const detailBits = [
        r.beds ? `${r.beds} bed` : null,
        r.baths ? `${r.baths} bath` : null,
        r.cars ? `${r.cars} car` : null,
        r.yearBuilt ? `Built ${r.yearBuilt}` : null,
        r.distance ? `${r.distance} from subject` : null,
      ].filter(Boolean);

      const comments = [detailBits.join(", "), comparisonNotes].filter(Boolean).join("\n");

      return {
        id: newId(),
        address,
        saleDate,
        salePrice,
        landArea: String(r.landArea ?? "").trim(),
        gla: String(r.gla ?? "").trim() || undefined,
        comments,
        adjustments: adjustmentsFromComparisonNotes(comparisonNotes),
      } satisfies ComparableSale;
    })
    .filter((s): s is ComparableSale => s != null);
}
