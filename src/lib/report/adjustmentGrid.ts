/**
 * URAR-style sales comparison adjustment grid.
 * Shared across all report types — only report *output* differs by type.
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
  relativity: Relativity;
  /** Signed $ adjustment applied to the comparable (URAR convention). */
  amount: number;
}

export interface AdjustmentFeature {
  id: string;
  label: string;
  /** Optional inspection field keys used to show subject value. */
  subjectKeys?: string[];
}

/** Core residential comparison lines (AU-oriented subset of URAR). */
export const ADJUSTMENT_FEATURES: AdjustmentFeature[] = [
  { id: "financing", label: "Sale or financing" },
  { id: "concessions", label: "Concessions" },
  { id: "dateOfSale", label: "Date of sale / time", subjectKeys: [] },
  { id: "location", label: "Location" },
  { id: "site", label: "Site / land", subjectKeys: ["prop_sitearea", "prop_areaunit"] },
  { id: "view", label: "View" },
  { id: "design", label: "Design / style", subjectKeys: ["imp_design", "ext"] },
  { id: "quality", label: "Quality of construction", subjectKeys: ["imp_quality"] },
  { id: "actualAge", label: "Actual age", subjectKeys: ["imp_yearbuilt"] },
  { id: "condition", label: "Condition", subjectKeys: ["overall_cond"] },
  { id: "gla", label: "Gross living area", subjectKeys: ["imp_gla"] },
  { id: "accommodation", label: "Accommodation", subjectKeys: ["imp_beds", "imp_baths", "accom"] },
  { id: "car", label: "Car accommodation", subjectKeys: ["park"] },
  { id: "outdoor", label: "Outdoor / ancillary", subjectKeys: ["anc"] },
  { id: "other", label: "Other" },
];

export function defaultFeatureAdjustment(): FeatureAdjustment {
  return { relativity: DEFAULT_RELATIVITY, amount: 0 };
}

export function defaultAdjustments(): Record<string, FeatureAdjustment> {
  const out: Record<string, FeatureAdjustment> = {};
  for (const f of ADJUSTMENT_FEATURES) {
    out[f.id] = defaultFeatureAdjustment();
  }
  return out;
}

export function ensureSaleAdjustments(sale: ComparableSale): ComparableSale {
  const base = sale.adjustments ?? {};
  const adjustments: Record<string, FeatureAdjustment> = {};
  for (const f of ADJUSTMENT_FEATURES) {
    const existing = base[f.id];
    adjustments[f.id] = {
      relativity: existing?.relativity ?? DEFAULT_RELATIVITY,
      amount: typeof existing?.amount === "number" && Number.isFinite(existing.amount)
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
