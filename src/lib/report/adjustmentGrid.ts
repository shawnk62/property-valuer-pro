/**
 * Sales comparison adjustment grid aligned to Fannie Mae Form 1004 / Freddie Mac Form 70
 * Uniform Residential Appraisal Report (URAR) — Sales Comparison Approach page.
 *
 * Shared across all report types; only report *output* differs by type.
 */
import { isCommercialType, isMixedUseCommercial, isVacantLand } from "@/lib/inspection/visibility";
import { parseMoney } from "./salesRelativity";
import type { ComparableSale, InspectionValues, ReportMeta } from "./types";

export const RELATIVITY_OPTIONS = [
  "inferior",
  "slightly inferior",
  "similar",
  "slightly superior",
  "superior",
] as const;

export type Relativity = (typeof RELATIVITY_OPTIONS)[number];

export const DEFAULT_RELATIVITY: Relativity = "similar";

/**
 * Working-grid only: background for the relativity select.
 * Default "similar" stays neutral; superior = green, inferior = red.
 */
export function relativitySelectClass(relativity: Relativity | string | undefined): string {
  const base =
    "w-full rounded border px-0.5 py-0.5 text-[0.6rem] outline-none focus:ring-1 focus:ring-ring";
  switch (relativity) {
    case "superior":
      return `${base} border-emerald-500/60 bg-emerald-300 text-emerald-950`;
    case "slightly superior":
      return `${base} border-emerald-400/50 bg-emerald-100 text-emerald-900`;
    case "inferior":
      return `${base} border-red-500/60 bg-red-300 text-red-950`;
    case "slightly inferior":
      return `${base} border-red-400/50 bg-red-100 text-red-900`;
    default:
      // similar or unknown
      return `${base} border-input bg-card text-foreground`;
  }
}

/** Working-grid zebra row: light gray on odd rows (Excel-style). */
export function adjustmentRowClass(index: number): string {
  return index % 2 === 1 ? "bg-slate-100/90" : "bg-card";
}

const AMOUNT_INPUT_BASE =
  "w-full rounded border px-1 py-0.5 text-[0.65rem] outline-none focus:ring-1 focus:ring-ring";

/**
 * Dollar adjustment cell: green if positive, red if negative, neutral if zero/empty.
 * `displayRaw` is the live input string (supports mid-typing e.g. "-").
 */
export function adjustmentAmountClass(
  amount: number | null | undefined,
  displayRaw?: string,
): string {
  let n: number | null =
    typeof amount === "number" && Number.isFinite(amount) ? amount : null;
  if (displayRaw !== undefined) {
    const cleaned = displayRaw.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
      n = null; // mid-typing — keep neutral
    } else {
      const parsed = Number(cleaned);
      n = Number.isFinite(parsed) ? parsed : n;
    }
  }
  if (n === null || n === 0) {
    return `${AMOUNT_INPUT_BASE} border-input bg-card text-foreground`;
  }
  if (n < 0) {
    return `${AMOUNT_INPUT_BASE} border-red-400/60 bg-red-200 text-red-950`;
  }
  return `${AMOUNT_INPUT_BASE} border-emerald-400/60 bg-emerald-200 text-emerald-950`;
}

const RATE_INPUT_BASE =
  "w-full rounded border px-1 py-0.5 text-[0.7rem] outline-none focus:ring-1 focus:ring-ring";

/** $/m² rate under subject: light blue when a figure is entered, otherwise blank/neutral. */
export function areaRateInputClass(rateValue: string | null | undefined): string {
  const hasFigure = String(rateValue ?? "").trim().length > 0;
  if (hasFigure) {
    return `${RATE_INPUT_BASE} border-sky-400/60 bg-sky-100 text-sky-950`;
  }
  return `${RATE_INPUT_BASE} border-input bg-card text-foreground`;
}

export interface FeatureAdjustment {
  /** Qualitative mark in URAR DESCRIPTION (similar / superior / …). */
  relativity: Relativity;
  /** Factual detail in DESCRIPTION (lot size, GLA, room count, cars, etc.). */
  detail?: string;
  /** URAR + (-) $ Adjustment — sits beside description, not below. */
  amount: number;
  /** When true, site/GLA rate math must not overwrite amount. */
  amountManual?: boolean;
  /** When true, automatic superior/inferior for site/GLA must not overwrite relativity. */
  relativityManual?: boolean;
}

export interface AdjustmentFeature {
  id: string;
  /** Exact URAR row label where applicable. */
  label: string;
  subjectKeys?: string[];
}

/**
 * VALUE ADJUSTMENTS rows — order and labels match URAR page 2.
 * Ids are stable keys; do not rename (stored on drafts).
 */
export const ADJUSTMENT_FEATURES: AdjustmentFeature[] = [
  { id: "saleOrFinancing", label: "Sale or financing concessions" },
  { id: "concessions", label: "Concessions" },
  { id: "dateOfSale", label: "Date of Sale/Time" },
  { id: "location", label: "Location" },
  { id: "leasehold", label: "Property rights", subjectKeys: ["prop_rights"] },
  { id: "site", label: "Site", subjectKeys: ["prop_usable_sitearea", "prop_sitearea", "prop_areaunit", "prop_shape", "prop_lot_position"] },
  { id: "topography", label: "Topography", subjectKeys: ["topo"] },
  { id: "view", label: "View" },
  { id: "design", label: "Design (Style)", subjectKeys: ["imp_design", "ext"] },
  { id: "quality", label: "Quality of Construction", subjectKeys: ["imp_quality"] },
  { id: "actualAge", label: "Age", subjectKeys: ["imp_yearbuilt", "imp_effage"] },
  { id: "condition", label: "Condition", subjectKeys: ["overall_cond"] },
  {
    id: "aboveGradeRoomCount",
    label: "Above Grade Room Count",
    subjectKeys: ["imp_rooms", "imp_beds", "imp_baths"],
  },
  { id: "grossLivingArea", label: "Gross Living Area", subjectKeys: ["imp_gla"] },
  {
    id: "basement",
    label: "Basement & Finished Rooms Below Grade",
  },
  { id: "functionalUtility", label: "Functional Utility" },
  { id: "heatingCooling", label: "Heating/Cooling", subjectKeys: ["vent"] },
  { id: "energyEfficient", label: "Energy Efficient Items" },
  { id: "garageCarport", label: "Garage/Carport", subjectKeys: ["park", "area_garage", "area_carport"] },
  { id: "porchPatioDeck", label: "Porch/Patio/Deck", subjectKeys: ["anc", "area_verandahs"] },
  { id: "other1", label: "Other" },
  { id: "other2", label: "Other" },
];

const VACANT_FEATURE_IDS = new Set([
  "saleOrFinancing",
  "concessions",
  "dateOfSale",
  "location",
  "leasehold",
  "site",
  "topography",
  "view",
  "other1",
  "other2",
]);

/** Working-grid and print rows that apply to this property type. */
export function adjustmentFeaturesForProperty(
  values: InspectionValues,
): AdjustmentFeature[] {
  const hideSplitTerms = (f: AdjustmentFeature) => f.id !== "concessions";
  if (isVacantLand(values)) {
    return ADJUSTMENT_FEATURES.filter((f) => VACANT_FEATURE_IDS.has(f.id)).filter(hideSplitTerms);
  }
  if (isCommercialType(values) && !isMixedUseCommercial(values)) {
    return ADJUSTMENT_FEATURES.filter(hideSplitTerms).filter(
      (f) => f.id !== "basement" && f.id !== "aboveGradeRoomCount" && f.id !== "porchPatioDeck",
    );
  }
  return ADJUSTMENT_FEATURES.filter((f) => f.id !== "basement" && hideSplitTerms(f));
}

export function printSalesEvidenceEnabled(meta: ReportMeta | undefined): boolean {
  return meta?.printSalesEvidence !== false;
}

export function printAdjustmentGridEnabled(meta: ReportMeta | undefined): boolean {
  return meta?.printAdjustmentGrid !== false;
}

export function adjustmentRowPrints(
  meta: ReportMeta | undefined,
  featureId: string,
): boolean {
  return !(meta?.omitAdjustmentPrintRows ?? []).includes(featureId);
}

export function setAdjustmentRowPrint(
  meta: ReportMeta,
  featureId: string,
  print: boolean,
): string[] {
  const current = new Set(meta.omitAdjustmentPrintRows ?? []);
  if (print) current.delete(featureId);
  else current.add(featureId);
  return [...current];
}

/** Legacy ids from earlier AU-oriented grid → current URAR ids (draft migration). */
const LEGACY_FEATURE_MAP: Record<string, string> = {
  financing: "saleOrFinancing",
  gla: "grossLivingArea",
  accommodation: "aboveGradeRoomCount",
  car: "garageCarport",
  outdoor: "porchPatioDeck",
  other: "other1",
};

export function defaultFeatureAdjustment(): FeatureAdjustment {
  return { relativity: DEFAULT_RELATIVITY, amount: 0, detail: "" };
}

export function defaultAdjustments(): Record<string, FeatureAdjustment> {
  const out: Record<string, FeatureAdjustment> = {};
  for (const f of ADJUSTMENT_FEATURES) {
    out[f.id] = defaultFeatureAdjustment();
  }
  return out;
}

export function ensureSaleAdjustments(sale: ComparableSale): ComparableSale {
  const raw = sale.adjustments ?? {};
  const migrated: Record<string, FeatureAdjustment> = { ...raw };

  for (const [legacy, next] of Object.entries(LEGACY_FEATURE_MAP)) {
    if (raw[legacy] && !raw[next]) {
      migrated[next] = {
        relativity: raw[legacy]!.relativity ?? DEFAULT_RELATIVITY,
        detail: raw[legacy]!.detail ?? "",
        amount:
          typeof raw[legacy]!.amount === "number" && Number.isFinite(raw[legacy]!.amount)
            ? raw[legacy]!.amount
            : 0,
      };
    }
  }

  const adjustments: Record<string, FeatureAdjustment> = {};
  for (const f of ADJUSTMENT_FEATURES) {
    const existing = migrated[f.id];
    adjustments[f.id] = {
      relativity: existing?.relativity ?? DEFAULT_RELATIVITY,
      detail: existing?.detail ?? "",
      amount:
        typeof existing?.amount === "number" && Number.isFinite(existing.amount)
          ? existing.amount
          : 0,
      ...(existing?.amountManual ? { amountManual: true } : {}),
      ...(existing?.relativityManual ? { relativityManual: true } : {}),
    };
  }
  return { ...sale, adjustments };
}


/** Inspection checkbox ids for topography. The stored value is the id, not the label. */
const TOPO_LABELS: Record<string, string> = {
  topo_gentle: "Gentle fall",
  topo_moderate: "Moderate fall",
  topo_steep: "Steep fall",
  topo_fall_to_road: "Falls to the road",
  topo_fall_from_road: "Falls from the road",
  topo_gentle_to_road: "Falls gently to the road",
  topo_moderate_to_road: "Falls moderately to the road",
  topo_steep_to_road: "Falls steeply to the road",
  topo_gentle_from_road: "Falls gently from the road",
  topo_moderate_from_road: "Falls moderately from the road",
  topo_steep_from_road: "Falls steeply from the road",
  topo_slope_front: "Slopes to front",
  topo_slope_rear: "Slopes to rear",
  topo_slope_right: "Slopes to right",
  topo_slope_left: "Slopes to left",
  topo_slope_north: "Slopes to north",
  topo_slope_south: "Slopes to south",
  topo_slope_east: "Slopes to east",
  topo_slope_west: "Slopes to west",
  topo_level: "Level",
  topo_level_with_road: "Level with road",
  topo_poorly_drained: "Poorly drained",
  topo_undulating: "Undulating",
  topo_well_drained: "Well drained",
  topo_other: "Other",
};

export function topographyOptionLabel(raw: string): string {
  const key = raw.trim();
  if (!key) return "";
  if (TOPO_LABELS[key]) return TOPO_LABELS[key];
  if (key.startsWith("topo_")) {
    return key
      .slice(5)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return key;
}

export function topographyFromInspection(values: InspectionValues): string {
  const topo = values["topo"];
  const ids = Array.isArray(topo)
    ? topo.map((item) => String(item))
    : topo !== undefined && topo !== null && String(topo).trim()
      ? [String(topo)]
      : [];
  const labels = ids.map((id) => topographyOptionLabel(id)).filter(Boolean);
  return labels.length ? labels.join(", ") : "—";
}

/**
 * Subject topography on the adjustment grid.
 * A report-level override wins; otherwise the inspection selection is used.
 */
export function subjectTopographyDisplay(
  values: InspectionValues,
  override?: string | null,
): string {
  const custom = String(override ?? "").trim();
  if (custom) return custom;
  return topographyFromInspection(values);
}

export function subjectFeatureDisplay(
  feature: AdjustmentFeature,
  values: InspectionValues,
): string {
  // URAR Age line: "A {actual years} / E {effective}"
  // A = calendar age from Year Built; E = Effective Age from inspection (imp_effage).
  if (feature.id === "actualAge") {
    const yearRaw = values["imp_yearbuilt"];
    const year =
      typeof yearRaw === "number"
        ? yearRaw
        : parseInt(String(yearRaw ?? "").replace(/[^0-9]/g, ""), 10);
    let actualLabel = "";
    if (Number.isFinite(year) && year >= 1800 && year <= 2100) {
      const actual = new Date().getFullYear() - year;
      if (actual >= 0 && actual <= 300) actualLabel = String(actual);
    }

    // Inspection schema key is imp_effage (dropdown: New, 1–40).
    // Accept legacy imp_effective_age if present.
    const effRaw = values["imp_effage"] ?? values["imp_effective_age"];
    const eff =
      effRaw !== undefined && effRaw !== null && String(effRaw).trim() !== ""
        ? String(effRaw).trim()
        : "";

    if (actualLabel && eff) return `A ${actualLabel} / E ${eff}`;
    if (actualLabel) return `A ${actualLabel}`;
    if (eff) return `E ${eff}`;
    return "—";
  }

  if (!feature.subjectKeys?.length) return "—";


  // Condition: overall + kitchen/bath remodel status from inspection
  if (feature.id === "condition") {
    const overall = values["overall_cond"];
    const bits: string[] = [];
    if (overall !== undefined && overall !== null && String(overall).trim()) {
      bits.push(String(overall).trim());
    }
    const kit = values["kit_remodeled"];
    const bath = values["bath_remodeled"];
    const baths = values["baths_remodeled"];
    const remodelBits: string[] = [];
    if (kit && String(kit).trim() && String(kit) !== "Not remodeled") {
      remodelBits.push(`Kit: ${String(kit).trim()}`);
    }
    if (bath && String(bath).trim() && String(bath) !== "Not remodeled") {
      remodelBits.push(`Bath: ${String(bath).trim()}`);
    }
    if (
      baths &&
      String(baths).trim() &&
      String(baths) !== "Not remodeled" &&
      String(baths) !== "Not applicable"
    ) {
      remodelBits.push(`Baths: ${String(baths).trim()}`);
    }
    if (remodelBits.length) bits.push(remodelBits.join("; "));
    return bits.length ? bits.join(" · ") : "—";
  }

  if (feature.id === "aboveGradeRoomCount") {
    const rooms = values["imp_rooms"];
    const beds = values["imp_beds"];
    const baths = values["imp_baths"];
    const bits: string[] = [];
    if (rooms !== undefined && rooms !== null && String(rooms).trim()) {
      bits.push(`${rooms} rms`);
    }
    if (beds !== undefined && beds !== null && String(beds).trim()) {
      bits.push(`${beds} bd`);
    }
    if (baths !== undefined && baths !== null && String(baths).trim()) {
      bits.push(`${baths} ba`);
    }
    return bits.length ? bits.join(" / ") : "—";
  }

  if (feature.id === "topography") {
    return topographyFromInspection(values);
  }

  if (feature.id === "site") {
    const usable = values["prop_usable_sitearea"];
    const area = String(usable ?? "").trim() || values["prop_sitearea"];
    const unit = values["prop_areaunit"];
    const shape = values["prop_shape"];
    const lotPos = values["prop_lot_position"];
    const unitLabel = unit === "m2" || unit === "m²" ? "m²" : unit ? String(unit) : "";
    const parts = [
      area !== undefined && area !== null && String(area).trim()
        ? `${area}${unitLabel ? ` ${unitLabel}` : ""}`
        : null,
      shape ? String(shape) : null,
      lotPos ? String(lotPos) : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }

  const parts: string[] = [];
  for (const key of feature.subjectKeys) {
    const v = values[key];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) parts.push(v.join(", "));
    } else if (typeof v === "boolean") {
      if (v) parts.push(key);
    } else {
      parts.push(String(v));
    }
  }
  return parts.length ? parts.join(" · ") : "—";
}

/** Sale price ÷ GLA when both parse (URAR Sale Price/Gross Liv. Area). */
export function salePricePerGla(sale: ComparableSale): string {
  const price = parseMoney(sale.salePrice);
  const glaRaw = sale.gla ?? "";
  const glaMatch = String(glaRaw).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  const gla = glaMatch ? Number(glaMatch[1]) : null;
  if (price == null || gla == null || gla === 0) return "—";
  const per = price / gla;
  return `$${Math.round(per).toLocaleString("en-AU")}/m²`;
}

export interface SaleAdjustmentTotals {
  salePrice: number | null;
  netAdjustment: number;
  grossAdjustment: number;
  netPct: number | null;
  grossPct: number | null;
  adjustedSalePrice: number | null;
}

export function computeSaleAdjustmentTotals(sale: ComparableSale): SaleAdjustmentTotals {
  const salePrice = parseMoney(sale.salePrice);
  const ensured = ensureSaleAdjustments(sale);
  let net = 0;
  let gross = 0;
  for (const f of ADJUSTMENT_FEATURES) {
    const amt = ensured.adjustments?.[f.id]?.amount ?? 0;
    if (!Number.isFinite(amt) || amt === 0) continue;
    net += amt;
    gross += Math.abs(amt);
  }
  const adjusted =
    salePrice == null ? null : Math.round((salePrice + net) * 100) / 100;
  return {
    salePrice,
    netAdjustment: net,
    grossAdjustment: gross,
    netPct: salePrice && salePrice !== 0 ? (net / salePrice) * 100 : null,
    grossPct: salePrice && salePrice !== 0 ? (gross / salePrice) * 100 : null,
    adjustedSalePrice: adjusted,
  };
}

export function subjectAskingPriceDisplay(
  values: InspectionValues,
  override?: string,
): string {
  if (override != null) return override;
  const offered = String(values["prop_offered"] ?? "").trim().toLowerCase();
  if (offered === "no") return "";
  const contract = String(values["prop_contract_price"] ?? "").trim();
  const details = String(values["prop_offer_details"] ?? "");
  const listed = details.match(/\$?\s*\d[\d,]*(?:\.\d+)?/)?.[0]?.trim() ?? "";
  if (offered !== "yes" && !contract && !listed) return "";
  return contract || listed;
}
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (n < 0) return `-$${formatted}`;
  if (n > 0) return `$${formatted}`;
  return "$0";
}

export function formatAreaWithSqm(raw: string | number | null | undefined): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s || s === "—") return "—";
  if (/ha\b|hectare|acre/i.test(s)) return s;
  if (/m\s*²/i.test(s) || /m²/.test(s)) return s.replace(/m\s*²/gi, "m²");
  if (/m\s*2\b/i.test(s)) return s.replace(/m\s*2\b/gi, "m²");
  return `${s} m²`;
}

export function subjectSiteSizeDisplay(values: InspectionValues): string {
  const usable = values["prop_usable_sitearea"];
  const area = String(usable ?? "").trim() || values["prop_sitearea"];
  const unit = values["prop_areaunit"];
  if (area === undefined || area === null || String(area).trim() === "") return "—";
  const unitLabel =
    unit === "m2" || unit === "m²" || !unit || String(unit).trim() === ""
      ? "m²"
      : String(unit);
  if (unitLabel === "m²") return formatAreaWithSqm(area);
  return `${String(area).trim()} ${unitLabel}`;
}

export function detailLooksLikeSaleDate(detail: string, saleDate?: string): boolean {
  const a = detail.replace(/\s+/g, " ").trim().toLowerCase();
  if (!a) return false;
  const b = String(saleDate ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (b && (a === b || a.includes(b) || b.includes(a))) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(a)) return true;
  if (
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(detail) &&
    /\d{4}/.test(detail) &&
    a.length <= 28
  ) {
    return true;
  }
  return false;
}

export function formatAdjustmentMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const formatted = Math.abs(Math.round(n)).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (n < 0) return `-$${formatted}`;
  if (n > 0) return `+$${formatted}`;
  return "$0";
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

/** Parse a numeric area from "126", "126m²", "474 m2", etc. */
export function parseAreaNumber(raw: string | number | null | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const m = String(raw).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Subject site figure for the adjustment grid:
 * grid override, then estimated usable, then title site area.
 */
export function subjectSiteAreaRaw(
  values: InspectionValues,
  override?: string | null,
): string {
  const fromGrid = String(override ?? "").trim();
  if (fromGrid) return fromGrid;
  const usable = String(values["prop_usable_sitearea"] ?? "").trim();
  if (usable) return usable;
  return String(values["prop_sitearea"] ?? "").trim();
}

/** Parse a rate entered as "2500" or "$2,500". */
export function parseRateInput(raw: string | number | null | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Round to nearest thousand dollars (URAR-style land/GLA lump-sum adjustments). */
export function roundToNearestThousand(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n / 1000) * 1000;
}

/**
 * Area adjustment: rate × (subject − comparable), rounded to nearest $1,000.
 * Comp larger than subject → negative; comp smaller → positive.
 */
export function computeAreaAdjustment(
  ratePerM2: number,
  subjectArea: number,
  comparableArea: number,
): number {
  return roundToNearestThousand(ratePerM2 * (subjectArea - comparableArea));
}


/**
 * Extract a leading count from strings like "2", "2 car", "3 bd / 2 ba", "2.5 ba".
 * When preferToken is set (e.g. "ba", "car"), prefer the number next to that token.
 */
export function parseCountNumber(
  raw: string | number | null | undefined,
  preferToken?: string,
): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).replace(/,/g, " ").trim().toLowerCase();
  if (!s) return null;
  if (preferToken) {
    const token = preferToken.toLowerCase();
    const re = new RegExp(
      String.raw`(\d+(?:\.\d+)?)\s*` + token + String.raw`\b|` + token + String.raw`\s*[:=]?\s*(\d+(?:\.\d+)?)`,
      "i",
    );
    const m = s.match(re);
    if (m) {
      const n = Number(m[1] || m[2]);
      if (Number.isFinite(n)) return n;
    }
  }
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Comparable larger / more than subject → superior; smaller / less → inferior; equal → similar.
 * (Descriptor is from the comparable's perspective relative to the subject.)
 */
export function relativityFromQuantity(
  subject: number,
  comparable: number,
): Relativity {
  if (!Number.isFinite(subject) || !Number.isFinite(comparable)) return DEFAULT_RELATIVITY;
  if (comparable > subject) return "superior";
  if (comparable < subject) return "inferior";
  return "similar";
}

function saleFeatureDetail(
  sale: ComparableSale,
  featureId: string,
): string {
  const adj = sale.adjustments?.[featureId];
  const fromAdj = adj?.detail?.trim() || "";
  if (fromAdj) return fromAdj;
  if (featureId === "grossLivingArea") return String(sale.gla ?? "").trim();
  if (featureId === "site") return String(sale.landArea ?? "").trim();
  if (featureId === "aboveGradeRoomCount") {
    const bits = [
      sale.beds ? `${sale.beds} bd` : "",
      sale.baths ? `${sale.baths} ba` : "",
    ].filter(Boolean);
    return bits.join(" / ");
  }
  if (featureId === "garageCarport") {
    return sale.cars ? `${sale.cars} car` : "";
  }
  return "";
}

/**
 * Auto-set qualitative marks for quantitative features (site, GLA, baths, garage)
 * from subject vs comparable numbers. Does not change features that cannot be
 * compared numerically. Leaves other features untouched.
 */
export function applyQuantitativeRelativity(
  sales: ComparableSale[],
  values: InspectionValues,
  subjectSiteOverride?: string | null,
): ComparableSale[] {
  const subjectGla = parseAreaNumber(values["imp_gla"]);
  const subjectSite = parseAreaNumber(subjectSiteAreaRaw(values, subjectSiteOverride));
  const subjectBaths = parseCountNumber(values["imp_baths"] as string | number | null | undefined);
  const subjectCars =
    parseCountNumber(values["area_garage"] as string | number | null | undefined) ??
    parseCountNumber(values["area_carport"] as string | number | null | undefined) ??
    parseCountNumber(
      Array.isArray(values["park"])
        ? (values["park"] as string[]).join(" ")
        : (values["park"] as string | number | null | undefined),
      "car",
    );

  return sales.map((sale) => {
    const ensured = ensureSaleAdjustments(sale);
    const adjustments = { ...ensured.adjustments };
    let changed = false;

    const setRel = (featureId: string, subjectN: number | null, compRaw: string) => {
      if (subjectN == null) return;
      const prefer =
        featureId === "aboveGradeRoomCount"
          ? "ba"
          : featureId === "garageCarport"
            ? "car"
            : undefined;
      const compN =
        featureId === "site" || featureId === "grossLivingArea"
          ? parseAreaNumber(compRaw)
          : parseCountNumber(compRaw, prefer);
      if (compN == null) return;
      const rel = relativityFromQuantity(subjectN, compN);
      const cur = adjustments[featureId] ?? defaultFeatureAdjustment();
      const canAutoRel =
        !cur.relativityManual &&
        (cur.relativity === "similar" || cur.relativity === DEFAULT_RELATIVITY);
      const nextRel = canAutoRel ? rel : cur.relativity;
      const nextDetail = cur.detail?.trim() ? cur.detail : compRaw;
      if (cur.relativity === nextRel && (cur.detail?.trim() || !compRaw)) return;
      adjustments[featureId] = {
        ...cur,
        relativity: nextRel,
        detail: nextDetail,
      };
      changed = true;
    };

    setRel("grossLivingArea", subjectGla, saleFeatureDetail(ensured, "grossLivingArea"));
    setRel("site", subjectSite, saleFeatureDetail(ensured, "site"));
    setRel("aboveGradeRoomCount", subjectBaths, saleFeatureDetail(ensured, "aboveGradeRoomCount"));
    setRel("garageCarport", subjectCars, saleFeatureDetail(ensured, "garageCarport"));

    return changed ? { ...ensured, adjustments } : ensured;
  });
}

/**
 * Apply GLA and Site $/m² rates from report meta to every sale's adjustment amounts.
 * Leaves other features untouched. No-ops when rate or either area is missing.
 */
export function applyAreaRateAdjustments(
  sales: ComparableSale[],
  values: InspectionValues,
  glaRateRaw: string | null | undefined,
  siteRateRaw: string | null | undefined,
  subjectSiteOverride?: string | null,
): ComparableSale[] {
  const glaRate = parseRateInput(glaRateRaw);
  const siteRate = parseRateInput(siteRateRaw);
  if (glaRate == null && siteRate == null) return sales;

  const subjectGla = parseAreaNumber(values["imp_gla"]);
  const subjectSite = parseAreaNumber(subjectSiteAreaRaw(values, subjectSiteOverride));

  return sales.map((sale) => {
    const ensured = ensureSaleAdjustments(sale);
    const adjustments = { ...ensured.adjustments };

    if (glaRate != null && subjectGla != null) {
      const detail = adjustments.grossLivingArea?.detail?.trim() || sale.gla || "";
      const compGla = parseAreaNumber(detail);
      if (compGla != null) {
        const cur = adjustments.grossLivingArea ?? defaultFeatureAdjustment();
        {
          const autoRel = relativityFromQuantity(subjectGla, compGla);
          const keepManualRel = Boolean(cur.relativityManual);
          adjustments.grossLivingArea = {
            ...cur,
            detail: cur.detail?.trim() ? cur.detail : detail,
            amount: cur.amountManual ? cur.amount : computeAreaAdjustment(glaRate, subjectGla, compGla),
            relativity: keepManualRel ? cur.relativity : autoRel,
          };
        }
      }
    }

    if (siteRate != null && subjectSite != null) {
      const detail = adjustments.site?.detail?.trim() || sale.landArea || "";
      const compSite = parseAreaNumber(detail);
      if (compSite != null) {
        const cur = adjustments.site ?? defaultFeatureAdjustment();
        {
          const autoRel = relativityFromQuantity(subjectSite, compSite);
          const keepManualRel = Boolean(cur.relativityManual);
          const autoAmount = computeAreaAdjustment(siteRate, subjectSite, compSite);
          adjustments.site = {
            ...cur,
            detail: cur.detail?.trim() ? cur.detail : detail,
            amount: cur.amountManual ? cur.amount : autoAmount,
            relativity: keepManualRel ? cur.relativity : autoRel,
          };
        }
      }
    }

    return { ...ensured, adjustments };
  });
}
