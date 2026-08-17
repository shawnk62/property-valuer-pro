/**
 * Sales comparison adjustment grid aligned to Fannie Mae Form 1004 / Freddie Mac Form 70
 * Uniform Residential Appraisal Report (URAR) — Sales Comparison Approach page.
 *
 * Shared across all report types; only report *output* differs by type.
 */
import { parseMoney } from "./salesRelativity";
import type { ComparableSale, InspectionValues } from "./types";

export const RELATIVITY_OPTIONS = [
  "inferior",
  "slightly inferior",
  "similar",
  "slightly superior",
  "superior",
] as const;

export type Relativity = (typeof RELATIVITY_OPTIONS)[number];

export const DEFAULT_RELATIVITY: Relativity = "similar";

export interface FeatureAdjustment {
  /** Qualitative mark in URAR DESCRIPTION (similar / superior / …). */
  relativity: Relativity;
  /** Factual detail in DESCRIPTION (lot size, GLA, room count, cars, etc.). */
  detail?: string;
  /** URAR + (-) $ Adjustment — sits beside description, not below. */
  amount: number;
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
  { id: "saleOrFinancing", label: "Sale or Financing" },
  { id: "concessions", label: "Concessions" },
  { id: "dateOfSale", label: "Date of Sale/Time" },
  { id: "location", label: "Location" },
  { id: "leasehold", label: "Leasehold/Fee Simple" },
  { id: "site", label: "Site", subjectKeys: ["prop_sitearea", "prop_areaunit", "prop_shape"] },
  { id: "view", label: "View" },
  { id: "design", label: "Design (Style)", subjectKeys: ["imp_design", "ext"] },
  { id: "quality", label: "Quality of Construction", subjectKeys: ["imp_quality"] },
  { id: "actualAge", label: "Actual Age", subjectKeys: ["imp_yearbuilt", "imp_effective_age"] },
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
    };
  }
  return { ...sale, adjustments };
}

export function subjectFeatureDisplay(
  feature: AdjustmentFeature,
  values: InspectionValues,
): string {
  if (!feature.subjectKeys?.length) return "—";

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

  if (feature.id === "site") {
    const area = values["prop_sitearea"];
    const unit = values["prop_areaunit"];
    const shape = values["prop_shape"];
    const unitLabel = unit === "m2" || unit === "m²" ? "m²" : unit ? String(unit) : "";
    const parts = [
      area !== undefined && area !== null && String(area).trim()
        ? `${area}${unitLabel ? ` ${unitLabel}` : ""}`
        : null,
      shape ? String(shape) : null,
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

export function formatMoney(n: number | null | undefined): string {
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

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
