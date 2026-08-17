/**
 * Cotality / RP Data CMA → ComparableSale rows for the shared adjustment grid.
 *
 * Primary path: parse extracted PDF text (or pasted text) with a heuristic tuned
 * to Cotality Comparable Sales pages and map legends. No artificial sale-count limit.
 * AI is optional fallback only when the heuristic finds nothing.
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
  comparisonNotes?: string | null;
}

/** Soft guidance only — grid and import accept more. */
export const RECOMMENDED_MAX_GRID_SALES = 12;

const STREET =
  "STREET|ST|ROAD|RD|CRESCENT|CRES|CR|COURT|CT|AVENUE|AVE|DRIVE|DR|PLACE|PL|WAY|CLOSE|CL|TERRACE|TCE|PARADE|PDE|BOULEVARD|BLVD|LANE|LN|CIRCUIT|CCT|HIGHWAY|HWY|ESPLANADE|ESP|GROVE|GR|RISE|MEWS|WALK|ROW|QUAY|POINT|PT";

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
  if (!n || n === "nil" || n === "n/a") return null;
  if (FEATURE_ALIASES[n]) return FEATURE_ALIASES[n];
  for (const [k, v] of Object.entries(FEATURE_ALIASES)) {
    if (n.includes(k)) return v;
  }
  return null;
}

function parseRelativityWord(word: string): Relativity | null {
  const w = word.trim().toLowerCase().replace(/\s+/g, " ");
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
  const base = defaultAdjustments() as Record<string, FeatureAdjustment>;
  if (!notes?.trim()) return base;

  for (const line of notes.split(/\n+/)) {
    const m = line.match(
      /^\s*(COMPARABLE|SUPERIOR|INFERIOR|SLIGHTLY\s+SUPERIOR|SLIGHTLY\s+INFERIOR)\s*:\s*(.+)$/i,
    );
    if (!m) continue;
    const rel = parseRelativityWord(m[1]!);
    if (!rel) continue;
    for (const part of m[2]!.split(/[;]/)) {
      const label = part.replace(/\s*[-–—(].*$/, "").trim();
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

function normaliseAddress(addr: string): string {
  return addr.replace(/\s+/g, " ").trim();
}

function addressKey(addr: string): string {
  return normaliseAddress(addr).toUpperCase();
}

export function cmaExtractsToSales(rows: CmaSaleExtract[]): ComparableSale[] {
  const out: ComparableSale[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const address = normaliseAddress(String(r.address ?? ""));
    const salePrice = String(r.salePrice ?? "").trim();
    if (!address && !salePrice) continue;

    const key = address ? addressKey(address) : `price:${salePrice}:${r.saleDate ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

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

    out.push({
      id: newId(),
      address,
      saleDate: String(r.saleDate ?? "").trim(),
      salePrice,
      landArea: String(r.landArea ?? "").trim(),
      gla: String(r.gla ?? "").trim() || undefined,
      comments,
      adjustments: adjustmentsFromComparisonNotes(comparisonNotes || comments),
    });
  }

  return out;
}

/**
 * Parse Cotality CMA text into sale extracts.
 * Handles detail pages and map-legend style lines. No maximum sale count.
 */
export function parseCmaTextHeuristic(text: string): CmaSaleExtract[] {
  if (!text?.trim()) return [];

  // Flatten soft hyphens / odd spaces from PDF extraction
  const cleaned = text
    .replace(/\u00ad/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  const addressRe = new RegExp(
    String.raw`((?:UNIT\s+\d+[A-Z]?\s*[\/,]?\s*)?(?:LOT\s+\d+\s+)?\d+[A-Z]?\s+[A-Z][A-Z0-9'./ -]{2,80}?\b(?:${STREET})\b\s+[A-Z][A-Z0-9' -]{2,40}?\s+QLD\s*\d{4})`,
    "gi",
  );

  const matches = [...cleaned.matchAll(addressRe)];
  if (matches.length === 0) return [];

  const extracts: CmaSaleExtract[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const address = normaliseAddress(m[1]!);
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? cleaned.length) : cleaned.length;
    const block = cleaned.slice(start, end);

    // Require a sold price so floor-plan / subject-only pages drop out
    const priceMatch = block.match(/\$\s*[\d,]+(?:\.\d{2})?/);
    if (!priceMatch) continue;
    const salePrice = priceMatch[0]!.replace(/\s+/g, "");

    const dateMatch = block.match(
      /(?:Sold\s*Date|Sale\s*Date)\s*[:\s]*([0-9]{1,2}[-/][A-Za-z]{3}[-/][0-9]{2,4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i,
    );

    const areaMatches = [...block.matchAll(/(\d{2,4}(?:\.\d+)?)\s*m\s*²/gi)];
    const landArea = areaMatches[0] ? `${areaMatches[0][1]}m²` : "";
    const gla = areaMatches[1] ? `${areaMatches[1][1]}m²` : "";

    // beds / baths / cars: explicit words, or icon triplet near the address line
    let beds = "";
    let baths = "";
    let cars = "";
    const bedWord = block.match(/\b(\d{1,2})\s*(?:bed|beds|br|bedroom)s?\b/i);
    const bathWord = block.match(/\b(\d{1,2})\s*(?:bath|baths|ba|bathroom)s?\b/i);
    const carWord = block.match(/\b(\d{1,2})\s*(?:car|cars|garage|carport)\b/i);
    if (bedWord) beds = bedWord[1]!;
    if (bathWord) baths = bathWord[1]!;
    if (carWord) cars = carWord[1]!;
    if (!beds || !baths) {
      const triplet = block.match(/\b([1-6])\s+([1-6])\s+([0-4])\b/);
      if (triplet) {
        if (!beds) beds = triplet[1]!;
        if (!baths) baths = triplet[2]!;
        if (!cars) cars = triplet[3]!;
      }
    }

    const yearMatch = block.match(/Year\s*Built\s*[:\s]*(\d{4})/i);
    const distMatch = block.match(/Distance\s*[:\s]*([\d.]+\s*[kK][mM])/i);

    const compLines = [
      ...block.matchAll(/((?:COMPARABLE|SUPERIOR|INFERIOR)\s*:\s*[^\n]+)/gi),
    ].map((x) => x[1]!.trim());

    // Description paragraph before COMPARABLE: or Property Insights
    let comments = "";
    const descMatch = block.match(
      /(?:Comments?\s*&?\s*Comparison|Comments?)\s*([\s\S]*?)(?=COMPARABLE\s*:|SUPERIOR\s*:|INFERIOR\s*:|Property\s*Insights|$)/i,
    );
    if (descMatch) {
      comments = descMatch[1]!
        .replace(/\$\s*[\d,]+/g, " ")
        .replace(/\b\d+\s*m\s*²/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (comments.length > 400) comments = comments.slice(0, 400).trim();
    }

    extracts.push({
      address,
      saleDate: dateMatch?.[1]?.trim() ?? "",
      salePrice,
      landArea,
      gla,
      beds: beds || null,
      baths: baths || null,
      cars: cars || null,
      yearBuilt: yearMatch?.[1] ?? null,
      distance: distMatch?.[1]?.replace(/\s+/g, "") ?? null,
      comments: comments || null,
      comparisonNotes: compLines.length ? compLines.join("\n") : null,
    });
  }

  return extracts;
}

/**
 * End-to-end: text → ComparableSale[] (heuristic only).
 */
export function salesFromCmaText(text: string): ComparableSale[] {
  return cmaExtractsToSales(parseCmaTextHeuristic(text));
}
