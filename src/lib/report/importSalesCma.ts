/**
 * Cotality / RP Data CMA → ComparableSale rows for the shared adjustment grid.
 *
 * Primary path: parse extracted PDF text (or pasted text) with a heuristic tuned
 * to Cotality Comparable Sales pages and map legends. No artificial sale-count limit.
 * AI is optional fallback / enrichment when the heuristic finds nothing or is incomplete.
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
  "STREET|ST|ROAD|RD|CRESCENT|CRES|CR|COURT|CT|AVENUE|AVE|DRIVE|DR|PLACE|PL|WAY|CLOSE|CL|TERRACE|TCE|PARADE|PDE|BOULEVARD|BLVD|LANE|LN|CIRCUIT|CCT|HIGHWAY|HWY|ESPLANADE|ESP|GROVE|GR|RISE|MEWS|WALK|ROW|QUAY|POINT|PT|CIRCLE|CIR|TRAIL|TRL|LINK|VISTA|HEIGHTS|HTS|PARK|GARDENS|GDNS|SQUARE|SQ|PROMENADE|PROM|ALLEY|MALL|BYPASS|LOOP";

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
  "actual age": "actualAge",
  gla: "grossLivingArea",
  "floor area": "grossLivingArea",
  "living area": "grossLivingArea",
  "gross living area": "grossLivingArea",
  accommodation: "aboveGradeRoomCount",
  accom: "aboveGradeRoomCount",
  "accom. layout": "aboveGradeRoomCount",
  layout: "aboveGradeRoomCount",
  "room count": "aboveGradeRoomCount",
  car: "garageCarport",
  cars: "garageCarport",
  garage: "garageCarport",
  carport: "garageCarport",
  "garage/carport": "garageCarport",
  outdoor: "porchPatioDeck",
  porch: "porchPatioDeck",
  patio: "porchPatioDeck",
  deck: "porchPatioDeck",
  "porch/patio/deck": "porchPatioDeck",
  basement: "basement",
  "functional utility": "functionalUtility",
  heating: "heatingCooling",
  cooling: "heatingCooling",
  "heating/cooling": "heatingCooling",
  energy: "energyEfficient",
  financing: "saleOrFinancing",
  concessions: "concessions",
  leasehold: "leasehold",
  other: "other1",
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

/**
 * Parse CMA comparison-note lines into feature relativities.
 * Not applied on import — new reports start all qualitative marks at "similar".
 * Kept for optional future “apply CMA marks” tools.
 */
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
  return normaliseAddress(addr)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Canonical key from house number + street name + type only.
 * Prevents "9 ROBINSON CRESCENT" and "9 ROBINSON CRESCENT RUNCORN QLD 4113"
 * from becoming two separate comps (which produced grids 1–3 and 4–6).
 */
function streetKey(addr: string): string {
  const a = normaliseAddress(addr).toUpperCase();
  if (!a) return "";
  const streetTypes =
    "STREET|ST|ROAD|RD|CRESCENT|CRES|CR|COURT|CT|AVENUE|AVE|DRIVE|DR|PLACE|PL|WAY|CLOSE|CL|TERRACE|TCE|PARADE|PDE|BOULEVARD|BLVD|LANE|LN|CIRCUIT|CCT|HIGHWAY|HWY|ESPLANADE|ESP|GROVE|GR|RISE|MEWS|WALK|ROW|QUAY|POINT|PT|CIRCLE|CIR|TRAIL|TRL|LINK|VISTA|HEIGHTS|HTS|PARK|GARDENS|GDNS|SQUARE|SQ|PROMENADE|PROM|ALLEY|MALL|BYPASS|LOOP";
  const m = a.match(
    new RegExp(
      String.raw`(?:UNIT\s+\d+[A-Z]?\s*[\/,]?\s*)?(?:LOT\s+\d+\s+)?(?:\d+[A-Z]?\s*\/\s*)?(\d+[A-Z]?)\s+([A-Z][A-Z0-9'./ -]*?)\s+\b(${streetTypes})\b`,
    ),
  );
  if (!m) return addressKey(a);
  return `${m[1]}${m[2].replace(/[^A-Z0-9]/g, "")}${m[3]}`.replace(/\s+/g, "");
}

export function cmaExtractsToSales(rows: CmaSaleExtract[]): ComparableSale[] {
  const out: ComparableSale[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const address = normaliseAddress(String(r.address ?? ""));
    const salePrice = String(r.salePrice ?? "").trim();
    if (!address && !salePrice) continue;

    const key = address
      ? streetKey(address) || addressKey(address)
      : `price:${salePrice}:${r.saleDate ?? ""}`;
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

    const landArea = String(r.landArea ?? "").trim();
    const gla = String(r.gla ?? "").trim();
    const beds = String(r.beds ?? "").trim();
    const baths = String(r.baths ?? "").trim();
    const cars = String(r.cars ?? "").trim();
    const saleDate = String(r.saleDate ?? "").trim();
    const proximity = r.distance ? String(r.distance).trim() : "";

    // New comps always start with qualitative marks = "similar".
    // CMA comparison notes are kept in comments only — they must not pre-fill
    // superior/inferior on the grid. Manual edits after import are preserved
    // because ensureSaleAdjustments keeps any existing relativity on reload.
    const adjustments = defaultAdjustments() as Record<string, FeatureAdjustment>;

    // Seed URAR DESCRIPTION facts so they appear on the grid (not only in comments)
    const seed = (id: string, detail: string) => {
      if (!detail) return;
      const cur = adjustments[id] ?? {
        relativity: "similar" as const,
        amount: 0,
        detail: "",
      };
      adjustments[id] = {
        ...cur,
        detail: cur.detail?.trim() ? cur.detail : detail,
      };
    };
    seed("dateOfSale", saleDate);
    if (r.yearBuilt) {
      const y = parseInt(String(r.yearBuilt).replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(y) && y > 1800) {
        const age = new Date().getFullYear() - y;
        seed("actualAge", `A ${age} / E `);
      }
    }
    seed("site", landArea);
    seed("grossLivingArea", gla);
    if (beds || baths) {
      seed(
        "aboveGradeRoomCount",
        [beds ? `${beds} bd` : null, baths ? `${baths} ba` : null]
          .filter(Boolean)
          .join(" / "),
      );
    }
    if (cars) seed("garageCarport", `${cars} car`);

    out.push({
      id: newId(),
      address,
      saleDate,
      salePrice,
      landArea,
      gla: gla || undefined,
      beds: beds || undefined,
      baths: baths || undefined,
      cars: cars || undefined,
      proximity: proximity || undefined,
      dataSource: "Cotality / RP Data",
      comments,
      adjustments,
    });
  }

  return out;
}

/** Score how complete an extract is (prefer detail pages over map-legend stubs). */
function extractScore(r: CmaSaleExtract): number {
  return [
    r.salePrice,
    r.saleDate,
    r.landArea,
    r.gla,
    r.beds,
    r.baths,
    r.cars,
    r.yearBuilt,
    r.distance,
    r.comments,
    r.comparisonNotes,
  ].filter((x) => x && String(x).trim()).length;
}

/**
 * Parse Cotality CMA text into sale extracts.
 * Multi-pass designed for pdf.js output (line-reconstructed or flat):
 *  1) Contiguous full addresses (detail pages)
 *  2) Street + look-ahead suburb/postcode when PDF split the lines
 *  3) Ordered multi-column pairing: streets ↔ suburbs ↔ prices by document order
 *  4) Map-legend one-liners
 * No maximum sale count.
 */

/**
 * Parse Cotality CMA text into sale extracts.
 *
 * Tuned to real pdf.js output from Cotality detail pages:
 *
 *   Comparable Sales
 *   1 Sold Price $1,050,000
 *   9 ROBINSON CRESCENT RUNCORN QLD 4113
 *   4 2 1
 *   390m2 177m2
 *   Sold Date 16-Jun-26 Distance 1.39km
 *   Year Built 1996
 *
 * Areas may appear as 390m2 (after extractPdfText repair) or 390m.
 * Dedupes by street number + name + type so partial/full addresses never double.
 */
export function parseCmaTextHeuristic(text: string): CmaSaleExtract[] {
  if (!text?.trim()) return [];

  // Normalise m² tokens the same way extractPdfText does (for paste path)
  const cleaned = text
    .replace(/\u00ad/g, "")
    .replace(/\r/g, "\n")
    .replace(/(\d+)\s*m\s*[²2]\b/gi, "$1m2")
    .replace(/(\d+m)\s+[²2]\b/gi, "$1m2")
    .replace(/(\d+)\s*m²/gi, "$1m2")
    .replace(/[ \t]+/g, " ");

  const byKey = new Map<string, CmaSaleExtract>();

  const merge = (next: CmaSaleExtract) => {
    const address = normaliseAddress(String(next.address ?? ""));
    if (!address) return;
    const key = streetKey(address) || addressKey(address);
    if (!key) return;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...next, address });
      return;
    }
    const preferAddr =
      address.length >= normaliseAddress(String(prev.address ?? "")).length
        ? address
        : normaliseAddress(String(prev.address ?? "")) || address;
    const winner =
      extractScore(next) >= extractScore(prev)
        ? {
            ...prev,
            ...Object.fromEntries(
              Object.entries(next).filter(([, v]) => v != null && String(v).trim() !== ""),
            ),
            address: preferAddr,
          }
        : {
            ...next,
            ...Object.fromEntries(
              Object.entries(prev).filter(([, v]) => v != null && String(v).trim() !== ""),
            ),
            address: preferAddr,
          };
    byKey.set(key, winner);
  };

  const NAME = String.raw`[A-Z][A-Za-z0-9'./-]*(?:\s+[A-Z][A-Za-z0-9'./-]*){0,5}?`;
  const SUBURB = String.raw`[A-Z][A-Za-z0-9'-]*(?:\s+[A-Z][A-Za-z0-9'-]*){0,3}?`;
  const UNIT =
    String.raw`(?:UNIT\s+\d+[A-Z]?\s*[\/,]?\s*)?(?:LOT\s+\d+\s+)?(?:\d+[A-Z]?\s*\/\s*)?`;

  // Full Cotality address: "9 ROBINSON CRESCENT RUNCORN QLD 4113"
  const fullAddressRe = new RegExp(
    String.raw`((?:${UNIT})\d+[A-Z]?\s+${NAME}\s+\b(?:${STREET})\b\s+${SUBURB}\s+(?:QLD|QUEENSLAND)\s*\d{4})`,
    "gi",
  );

  const matches = [...cleaned.matchAll(fullAddressRe)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const address = normaliseAddress(m[1]!);
    const start = m.index ?? 0;
    const end =
      i + 1 < matches.length ? (matches[i + 1]!.index ?? cleaned.length) : cleaned.length;
    // Detail cards are short; cap so we don't bleed into the next sale
    const block = cleaned.slice(Math.max(0, start - 80), Math.min(end, start + 1200));
    merge(extractFactsFromBlock(address, block));
  }

  // Map-legend style (when text survived): ADDRESS  beds baths cars  $price
  const legendRe = new RegExp(
    String.raw`(${fullAddressRe.source})\s+(?:([1-6])\s+([1-6])\s+([0-4])\s+)?(\$\s*[\d,]+)`,
    "gi",
  );
  for (const lm of cleaned.matchAll(legendRe)) {
    merge({
      address: normaliseAddress(lm[1]!),
      beds: lm[2] || null,
      baths: lm[3] || null,
      cars: lm[4] || null,
      salePrice: lm[5]!.replace(/\s+/g, ""),
    });
  }

  return [...byKey.values()].filter((r) => {
    const hasPrice = Boolean(r.salePrice && String(r.salePrice).trim());
    const hasDate = Boolean(r.saleDate && String(r.saleDate).trim());
    return hasPrice || hasDate;
  });
}

function extractFactsFromBlock(address: string, block: string): CmaSaleExtract {
  const priceMatch =
    block.match(/Sold\s*Price\s*[:\s]*(\$\s*[\d,]+(?:\.\d{2})?)/i) ||
    block.match(/(?:SOLD|Sale\s*Price)\s*[:\s]*(\$\s*[\d,]+(?:\.\d{2})?)/i) ||
    block.match(/(\$\s*[\d,]{4,}(?:\.\d{2})?)/);
  const salePrice = priceMatch ? priceMatch[1]!.replace(/\s+/g, "") : "";

  const dateMatch = block.match(
    /(?:Sold\s*Date|Sale\s*Date)\s*[:\s]*([0-9]{1,2}[-/][A-Za-z]{3}[-/][0-9]{2,4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{2,4})/i,
  );

  // Areas: 390m2 / 390m² / 390 m2 / bare 390m (pdf.js split residue)
  const areaMatches = [
    ...block.matchAll(/(\d{2,5}(?:\.\d+)?)\s*m\s*(?:2|²)?\b/gi),
  ];
  // Prefer values in the typical residential range when multiple hits
  const areas = areaMatches
    .map((x) => Number(String(x[1]).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 40 && n <= 5000);

  let landArea = "";
  let gla = "";
  if (areas.length >= 2) {
    // Cotality detail row: land then floor
    landArea = `${areas[0]}m²`;
    gla = `${areas[1]}m²`;
  } else if (areas.length === 1) {
    landArea = `${areas[0]}m²`;
  }

  // Labelled overrides
  const landLabel = block.match(
    /(?:Land\s*(?:Area|Size)|Site\s*(?:Area|Size))\s*[:\s]*([\d,]{2,5}(?:\.\d+)?)\s*m/i,
  );
  const glaLabel = block.match(
    /(?:Floor\s*(?:Area|Size)|Living\s*(?:Area|Size)|Gross\s*Living\s*Area|GLA|Building\s*(?:Area|Size))\s*[:\s]*([\d,]{2,5}(?:\.\d+)?)\s*m/i,
  );
  if (landLabel) landArea = `${landLabel[1]!.replace(/,/g, "")}m²`;
  if (glaLabel) gla = `${glaLabel[1]!.replace(/,/g, "")}m²`;

  let beds = "";
  let baths = "";
  let cars = "";
  const bedWord = block.match(/\b(\d{1,2})\s*(?:bed|beds|br|bedroom)s?\b/i);
  const bathWord = block.match(/\b(\d{1,2})\s*(?:bath|baths|ba|bathroom)s?\b/i);
  const carWord = block.match(/\b(\d{1,2})\s*(?:car|cars|garage|carport|lu)\b/i);
  if (bedWord) beds = bedWord[1]!;
  if (bathWord) baths = bathWord[1]!;
  if (carWord) cars = carWord[1]!;

  // Cotality icon row: "4 2 1" immediately before land/floor areas
  if (!beds || !baths) {
    const beforeAreas = block.match(
      /\b([1-6])\s+([1-6])\s+([0-4])\b(?=[\s\S]{0,40}?\d{2,4}\s*m)/i,
    );
    const plain = block.match(/\b([1-6])\s+([1-6])\s+([0-4])\b/);
    const triplet = beforeAreas || plain;
    if (triplet) {
      if (!beds) beds = triplet[1]!;
      if (!baths) baths = triplet[2]!;
      if (!cars) cars = triplet[3]!;
    }
  }

  const yearMatch = block.match(/Year\s*Built\s*[:\s]*(\d{4})/i);
  const distMatch = block.match(/Distance\s*[:\s]*([\d.]+\s*[kK][mM])/i);

  const compLines = [
    ...block.matchAll(
      /((?:COMPARABLE|SUPERIOR|INFERIOR|SLIGHTLY\s+SUPERIOR|SLIGHTLY\s+INFERIOR)\s*:\s*[^\n]+)/gi,
    ),
  ].map((x) => x[1]!.trim());

  let comments = "";
  const descMatch = block.match(
    /(?:Comments?\s*&?\s*Comparison|Comments?)\s*([\s\S]*?)(?=COMPARABLE\s*:|SUPERIOR\s*:|INFERIOR\s*:|SLIGHTLY\s+|Property\s*Insights|$)/i,
  );
  if (descMatch) {
    comments = descMatch[1]!
      .replace(/\$\s*[\d,]+/g, " ")
      .replace(/\b\d+\s*m\s*[²2]?\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (comments.length > 400) comments = comments.slice(0, 400).trim();
  }

  return {
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
  };
}

/** End-to-end: text → ComparableSale[] (heuristic only). */
export function salesFromCmaText(text: string): ComparableSale[] {
  return cmaExtractsToSales(parseCmaTextHeuristic(text));
}

/**
 * Merge two extract lists by address key, preferring higher-scoring records.
 * Used when AI enrichment runs after a partial heuristic result.
 */
export function mergeCmaExtracts(
  primary: CmaSaleExtract[],
  secondary: CmaSaleExtract[],
): CmaSaleExtract[] {
  const byKey = new Map<string, CmaSaleExtract>();
  const put = (r: CmaSaleExtract) => {
    const address = normaliseAddress(String(r.address ?? ""));
    if (!address && !r.salePrice) return;
    const key = address
      ? streetKey(address) || addressKey(address)
      : `price:${String(r.salePrice)}:${r.saleDate ?? ""}`;
    const prev = byKey.get(key);
    if (!prev || extractScore(r) >= extractScore(prev)) {
      byKey.set(key, prev ? { ...prev, ...r, address: address || prev.address } : r);
    } else {
      byKey.set(key, { ...r, ...prev, address: prev.address || address });
    }
  };
  for (const r of primary) put(r);
  for (const r of secondary) put(r);
  return [...byKey.values()];
}
