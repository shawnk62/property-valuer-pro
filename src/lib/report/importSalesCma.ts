/**
 * Map Cotality CMA extract results into ComparableSale rows for the shared grid.
 * Includes a heuristic text parser for standard Cotality CMA layout (no AI required).
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
  if (w.startsWith("slightly inferior")) return "slightly inferior";
  if (w.startsWith("slightly superior")) return "slightly superior";
  if (w.startsWith("inferior")) return "inferior";
  if (w.startsWith("superior")) return "superior";
  if (w.startsWith("comparable") || w.startsWith("similar")) return "similar";
  return null;
}

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

      const comparisonNotes = String(r.comparisonNotes ?? "").trim();
      const detailBits = [
        r.beds ? `${r.beds} bed` : null,
        r.baths ? `${r.baths} bath` : null,
        r.cars ? `${r.cars} car` : null,
        r.yearBuilt ? `Built ${r.yearBuilt}` : null,
        r.distance ? `${r.distance} from subject` : null,
        r.comments?.trim() || null,
      ].filter(Boolean);

      const comments = [detailBits.join(". "), comparisonNotes].filter(Boolean).join("\n");

      return {
        id: newId(),
        address,
        saleDate,
        salePrice,
        landArea: String(r.landArea ?? "").trim(),
        gla: String(r.gla ?? "").trim() || undefined,
        comments,
        adjustments: adjustmentsFromComparisonNotes(comparisonNotes || comments),
      } satisfies ComparableSale;
    })
    .filter((s): s is ComparableSale => s != null);
}

/**
 * Heuristic parse of Cotality CMA text (Comparable Sales pages / map legend).
 * Does not require AI — works when the user pastes text from the PDF.
 */
export function parseCmaTextHeuristic(text: string): CmaSaleExtract[] {
  const cleaned = text.replace(/\r/g, "\n");
  const sales: CmaSaleExtract[] = [];

  // Split on street-address lines that look like comps (number + street + suburb + QLD)
  const addressRe =
    /(\d+[A-Z]?\s+[A-Z][A-Z0-9 '.-]+?(?:STREET|ST|ROAD|RD|CRESCENT|CR|CRES|COURT|CT|AVENUE|AVE|DRIVE|DR|PLACE|PL|WAY|CLOSE|CL|TERRACE|TCE|PARADE|PDE|BOULEVARD|BLVD|LANE|LN)\s+[A-Z][A-Z0-9 '.-]+?\s+QLD\s*\d{4})/gi;

  const matches = [...cleaned.matchAll(addressRe)];
  if (matches.length === 0) {
    // Fallback: lines with Sold Price nearby
    return sales;
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const address = m[1]!.replace(/\s+/g, " ").trim();
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? cleaned.length) : cleaned.length;
    const block = cleaned.slice(start, end);

    // Skip subject-only floor plan pages (no sold price)
    const priceM = block.match(/\$\s*[\d,]+(?:\.\d{2})?/);
    if (!priceM) continue;

    const salePrice = priceM[0]!.replace(/\s+/g, "");
    const dateM = block.match(
      /(?:Sold\s*Date|Sale\s*Date)\s*[:\s]*([0-9]{1,2}[-/][A-Za-z]{3}[-/][0-9]{2,4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
    );
    const saleDate = dateM?.[1]?.trim() ?? "";

    const areas = [...block.matchAll(/(\d+(?:\.\d+)?)\s*m\s*²/gi)].map((x) => x[0]!.replace(/\s+/g, ""));
    // Cotality shows land then floor typically
    const landArea = areas[0] ?? "";
    const gla = areas[1] ?? "";

    const bedsM = block.match(/\b(\d+)\s*(?:bed|beds|br)\b/i) || block.match(/^\s*(\d)\s+(\d)\s+(\d)\s*$/m);
    // Icon row sometimes: 4  2  1 near beds baths cars — hard; try explicit
    let beds = "";
    let baths = "";
    let cars = "";
    const bbc = block.match(/\b(\d)\s+(\d)\s+(\d)\b/);
    if (block.match(/\b4\s+2\s+1\b/)) {
      beds = "4";
      baths = "2";
      cars = "1";
    } else if (block.match(/\b3\s+1\s+1\b/)) {
      beds = "3";
      baths = "1";
      cars = "1";
    } else if (bbc && !bedsM) {
      beds = bbc[1]!;
      baths = bbc[2]!;
      cars = bbc[3]!;
    }
    if (bedsM && bedsM[1] && !beds) beds = bedsM[1];

    const yearM = block.match(/Year\s*Built\s*[:\s]*(\d{4}|-)/i);
    const distM = block.match(/Distance\s*[:\s]*([\d.]+\s*[kK][mM])/i);

    const compLines = [
      ...block.matchAll(/^\s*((?:COMPARABLE|SUPERIOR|INFERIOR)\s*:[^\n]+)/gim),
    ].map((x) => x[1]!.trim());

    const commentM = block.match(
      /Comments?\s*&?\s*Comparison\s*([\s\S]*?)(?=Property\s*Insights|COMPARABLE:|SUPERIOR:|$)/i,
    );
    let comments = commentM?.[1]?.trim() ?? "";
    // Trim noise
    comments = comments
      .split("\n")
      .filter((l) => !/^(RS\s*=|UN\s*=|©|Copyright)/i.test(l.trim()))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    sales.push({
      address,
      saleDate,
      salePrice,
      landArea,
      gla,
      beds: beds || null,
      baths: baths || null,
      cars: cars || null,
      yearBuilt: yearM?.[1] && yearM[1] !== "-" ? yearM[1] : null,
      distance: distM?.[1] ?? null,
      comments: comments || null,
      comparisonNotes: compLines.length ? compLines.join("\n") : null,
    });
  }

  // Dedupe by address
  const seen = new Set<string>();
  return sales.filter((s) => {
    const key = (s.address ?? "").toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
