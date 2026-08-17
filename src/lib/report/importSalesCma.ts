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

    const adjustments = adjustmentsFromComparisonNotes(comparisonNotes || comments);

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
export function parseCmaTextHeuristic(text: string): CmaSaleExtract[] {
  if (!text?.trim()) return [];

  const cleaned = text
    .replace(/\u00ad/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  const byKey = new Map<string, CmaSaleExtract>();

  const merge = (next: CmaSaleExtract) => {
    const address = normaliseAddress(String(next.address ?? ""));
    if (!address) return;
    // Prefer street-level key so partial vs full addresses collapse to one sale
    const key = streetKey(address) || addressKey(address);
    if (!key) return;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...next, address });
      return;
    }
    // Prefer the longer / more complete address string when merging
    const preferAddr =
      address.length >= normaliseAddress(String(prev.address ?? "")).length
        ? address
        : normaliseAddress(String(prev.address ?? "")) || address;
    if (extractScore(next) >= extractScore(prev)) {
      byKey.set(key, {
        ...prev,
        ...Object.fromEntries(
          Object.entries(next).filter(([, v]) => v != null && String(v).trim() !== ""),
        ),
        address: preferAddr,
      });
    } else {
      byKey.set(key, {
        ...next,
        ...Object.fromEntries(
          Object.entries(prev).filter(([, v]) => v != null && String(v).trim() !== ""),
        ),
        address: preferAddr,
      });
    }
  };

  // Street / suburb name tokens must start with a letter so house numbers cannot
  // be swallowed into a previous street name on multi-column pages.
  const NAME = String.raw`[A-Z][A-Za-z0-9'./-]*(?:\s+[A-Z][A-Za-z0-9'./-]*){0,5}?`;
  const SUBURB = String.raw`[A-Z][A-Za-z0-9'-]*(?:\s+[A-Z][A-Za-z0-9'-]*){0,3}?`;
  const UNIT =
    String.raw`(?:UNIT\s+\d+[A-Z]?\s*[\/,]?\s*)?(?:LOT\s+\d+\s+)?(?:\d+[A-Z]?\s*\/\s*)?`;

  const fullAddressRe = new RegExp(
    String.raw`((?:${UNIT})\d+[A-Z]?\s+${NAME}\s+\b(?:${STREET})\b(?:\s+${SUBURB})?\s+(?:QLD|QUEENSLAND)\s*\d{4})`,
    "gi",
  );
  const streetOnlyRe = new RegExp(
    String.raw`((?:${UNIT})\d+[A-Z]?\s+${NAME}\s+\b(?:${STREET})\b)`,
    "gi",
  );
  const suburbPostRe = new RegExp(
    String.raw`\b(${SUBURB})\s+(?:QLD|QUEENSLAND)\s*(\d{4})\b`,
    "gi",
  );
  const priceRe = /(?:Sold\s*Price\s*[:\s]*)?(\$\s*[\d,]{4,}(?:\.\d{2})?)/gi;
  const dateRe =
    /(?:Sold\s*Date|Sale\s*Date)\s*[:\s]*([0-9]{1,2}[-/][A-Za-z]{3}[-/][0-9]{2,4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{2,4})/gi;

  // --- Pass 1: contiguous full addresses ---
  const fullMatches = [...cleaned.matchAll(fullAddressRe)];
  for (let i = 0; i < fullMatches.length; i++) {
    const m = fullMatches[i]!;
    const address = normaliseAddress(m[1]!);
    const start = m.index ?? 0;
    const end =
      i + 1 < fullMatches.length
        ? (fullMatches[i + 1]!.index ?? cleaned.length)
        : cleaned.length;
    const block = cleaned.slice(start, Math.min(end, start + 1800));
    merge(extractFactsFromBlock(address, block));
  }

  // --- Pass 2: street + nearby suburb (split lines) ---
  for (const sm of cleaned.matchAll(streetOnlyRe)) {
    const streetPart = normaliseAddress(sm[1]!);
    const idx = sm.index ?? 0;
    const already = [...byKey.values()].some((r) =>
      normaliseAddress(String(r.address ?? ""))
        .toUpperCase()
        .startsWith(streetPart.toUpperCase()),
    );
    if (already) continue;

    // Look ahead only; suburb must not start with a street-type word
    const window = cleaned.slice(idx + streetPart.length, idx + streetPart.length + 200);
    suburbPostRe.lastIndex = 0;
    const sub = suburbPostRe.exec(window);
    if (!sub) continue;
    const subName = sub[1]!.trim();
    if (new RegExp(`^(?:${STREET})$`, "i").test(subName.split(/\s+/).pop() || "")) continue;

    const address = normaliseAddress(`${streetPart} ${subName} QLD ${sub[2]}`);
    const block = cleaned.slice(idx, Math.min(cleaned.length, idx + 1800));
    merge(extractFactsFromBlock(address, block));
  }

  // --- Pass 3: ordered multi-column pairing (Cotality map / card rows) ---
  // Collect streets, suburbs, prices, dates by position, then assign in order.
  type Pos = { index: number; value: string };
  const streets: Pos[] = [...cleaned.matchAll(streetOnlyRe)].map((m) => ({
    index: m.index ?? 0,
    value: normaliseAddress(m[1]!),
  }));
  const streetTypeTail = new RegExp(`(?:${STREET})$`, "i");
  const suburbs: Pos[] = [...cleaned.matchAll(suburbPostRe)]
    .map((m) => {
      const rawName = (m[1] || "").trim();
      // Drop leading street-type tokens left over from multi-column glue
      const parts = rawName.split(/\s+/);
      while (parts.length > 1 && streetTypeTail.test(parts[0]!)) parts.shift();
      // Reject if the "suburb" is only a street type
      if (parts.length === 0 || streetTypeTail.test(parts.join(" "))) return null;
      return {
        index: m.index ?? 0,
        value: normaliseAddress(`${parts.join(" ")} QLD ${m[2]}`),
      };
    })
    .filter((x): x is Pos => x != null);
  const prices: Pos[] = [...cleaned.matchAll(priceRe)].map((m) => ({
    index: m.index ?? 0,
    value: m[1]!.replace(/\s+/g, ""),
  }));
  const dates: Pos[] = [...cleaned.matchAll(dateRe)].map((m) => ({
    index: m.index ?? 0,
    value: m[1]!.trim(),
  }));

  if (streets.length >= 2 && prices.length >= 2) {
    const usedPrice = new Set<number>();
    const usedSuburb = new Set<number>();
    const usedDate = new Set<number>();

    for (let si = 0; si < streets.length; si++) {
      const st = streets[si]!;
      const nextStreetIdx =
        si + 1 < streets.length ? streets[si + 1]!.index : cleaned.length;

      // Nearest unused suburb at or after this street (before next street preferred)
      let bestSub: Pos | null = null;
      for (const sub of suburbs) {
        if (usedSuburb.has(sub.index)) continue;
        if (sub.index < st.index - 20) continue;
        if (sub.index > nextStreetIdx + 80 && bestSub) break;
        if (!bestSub || Math.abs(sub.index - st.index) < Math.abs(bestSub.index - st.index)) {
          bestSub = sub;
        }
      }

      // Nearest unused price at or after this street
      let bestPrice: Pos | null = null;
      for (const pr of prices) {
        if (usedPrice.has(pr.index)) continue;
        if (pr.index < st.index - 40) continue;
        if (!bestPrice || Math.abs(pr.index - st.index) < Math.abs(bestPrice.index - st.index)) {
          bestPrice = pr;
        }
      }

      let bestDate: Pos | null = null;
      for (const d of dates) {
        if (usedDate.has(d.index)) continue;
        if (d.index < st.index - 40) continue;
        if (!bestDate || Math.abs(d.index - st.index) < Math.abs(bestDate.index - st.index)) {
          bestDate = d;
        }
      }

      if (!bestPrice) continue;
      usedPrice.add(bestPrice.index);
      if (bestSub) usedSuburb.add(bestSub.index);
      if (bestDate) usedDate.add(bestDate.index);

      const address = bestSub
        ? normaliseAddress(`${st.value} ${bestSub.value}`)
        : st.value;

      // Prefer a local block for other facts, but always seed price/date from pairing
      const block = cleaned.slice(st.index, Math.min(cleaned.length, nextStreetIdx + 200));
      const facts = extractFactsFromBlock(address, block);
      facts.salePrice = facts.salePrice || bestPrice.value;
      if (bestDate && !facts.saleDate) facts.saleDate = bestDate.value;
      merge(facts);
    }
  }

  // --- Pass 4: map-legend one-liners ---
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

  // Drop entries with neither price nor date
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

  // Prefer labelled areas; Cotality uses many label variants and sometimes omits m²
  const landLabel =
    block.match(
      /(?:Land\s*(?:Area|Size)|Site\s*(?:Area|Size)|Land)\s*[:\s]*([\d,]{2,5}(?:\.\d+)?)\s*(?:m\s*[²2]|sqm)?/i,
    ) ||
    block.match(/([\d,]{2,5}(?:\.\d+)?)\s*(?:m\s*[²2]|sqm)\s*(?:land|site)/i);
  const glaLabel =
    block.match(
      /(?:Floor\s*(?:Area|Size)|Living\s*(?:Area|Size)|Gross\s*Living\s*Area|GLA|Building\s*(?:Area|Size)|Internal\s*Area)\s*[:\s]*([\d,]{2,5}(?:\.\d+)?)\s*(?:m\s*[²2]|sqm)?/i,
    ) ||
    block.match(
      /([\d,]{2,5}(?:\.\d+)?)\s*(?:m\s*[²2]|sqm)\s*(?:floor|living|gla|bldg|internal)/i,
    );
  const areaMatches = [
    ...block.matchAll(/(\d{2,5}(?:\.\d+)?)\s*(?:m\s*[²2]|sqm)\b/gi),
  ];
  // Icon / card row: beds baths cars landGla landGla  e.g. "4 2 2 450 180"
  const fivePack = block.match(
    /\b([1-6])\s+([1-6])\s+([0-4])\s+(\d{2,4})\s+(\d{2,4})\b/,
  );
  let landArea = landLabel
    ? `${landLabel[1]!.replace(/,/g, "")}m²`
    : areaMatches[0]
      ? `${areaMatches[0][1]}m²`
      : "";
  let gla = glaLabel
    ? `${glaLabel[1]!.replace(/,/g, "")}m²`
    : areaMatches[landLabel ? 0 : 1]
      ? `${areaMatches[landLabel ? 0 : 1]![1]}m²`
      : "";
  if ((!landArea || !gla) && fivePack) {
    if (!landArea) landArea = `${fivePack[4]}m²`;
    if (!gla) gla = `${fivePack[5]}m²`;
  }

  let beds = "";
  let baths = "";
  let cars = "";
  const bedWord = block.match(/\b(\d{1,2})\s*(?:bed|beds|br|bedroom)s?\b/i);
  const bathWord = block.match(/\b(\d{1,2})\s*(?:bath|baths|ba|bathroom)s?\b/i);
  const carWord = block.match(/\b(\d{1,2})\s*(?:car|cars|garage|carport|lu)\b/i);
  if (bedWord) beds = bedWord[1]!;
  if (bathWord) baths = bathWord[1]!;
  if (carWord) cars = carWord[1]!;
  if (!beds || !baths) {
    const head = block.slice(0, Math.min(block.length, 360));
    const triplet =
      head.match(/\b([1-6])\s+([1-6])\s+([0-4])\b/) ||
      block.match(/\b([1-6])\s+([1-6])\s+([0-4])\b/);
    if (triplet) {
      if (!beds) beds = triplet[1]!;
      if (!baths) baths = triplet[2]!;
      if (!cars) cars = triplet[3]!;
    }
  }

  const yearMatch = block.match(/Year\s*Built\s*[:\s]*(\d{4})/i);
  const distMatch = block.match(/Distance\s*[:\s]*([\d.]+\s*[kK][mM])/i);

  const compLines = [
    ...block.matchAll(/((?:COMPARABLE|SUPERIOR|INFERIOR|SLIGHTLY\s+SUPERIOR|SLIGHTLY\s+INFERIOR)\s*:\s*[^\n]+)/gi),
  ].map((x) => x[1]!.trim());

  let comments = "";
  const descMatch = block.match(
    /(?:Comments?\s*&?\s*Comparison|Comments?)\s*([\s\S]*?)(?=COMPARABLE\s*:|SUPERIOR\s*:|INFERIOR\s*:|SLIGHTLY\s+|Property\s*Insights|$)/i,
  );
  if (descMatch) {
    comments = descMatch[1]!
      .replace(/\$\s*[\d,]+/g, " ")
      .replace(/\b\d+\s*m\s*[²2]/gi, " ")
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
