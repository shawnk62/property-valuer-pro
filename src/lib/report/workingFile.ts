import schema from "@/data/inspection-schema.json";
import { formatCurrencyDisplay } from "@/lib/report/salesRelativity";
import { formatUsableSiteAreaIfDifferent, get, joinValues } from "@/lib/report/schema";
import type { ComparableSale, InspectionValues, ReportDraft, ReportMeta } from "@/lib/report/types";
import { computeSaleAdjustmentTotals } from "@/lib/report/adjustmentGrid";

type SchemaField = {
  name: string;
  label?: string;
  type?: string;
  items?: { id: string; label: string }[];
  options?: string[];
  notes_field?: string;
  condition_field?: string;
};

type SchemaSection = {
  id: string;
  title: string;
  fields: SchemaField[];
};

export type WorkingFieldRow = { label: string; value: string };
export type WorkingSection = { id: string; title: string; rows: WorkingFieldRow[] };

const COVER_LINE =
  "These pages are the working file for this valuation. They record the inspection, the sales analysis and the documents relied on. They are not part of the client report.";

export function workingFileCoverLine(): string {
  return COVER_LINE;
}

function itemLabel(field: SchemaField, id: string): string {
  return field.items?.find((item) => item.id === id)?.label || id;
}

function formatStored(field: SchemaField, raw: InspectionValues[string]): string {
  if (raw == null) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) {
    return raw
      .map((item) => itemLabel(field, String(item)))
      .filter(Boolean)
      .join(", ");
  }
  return String(raw).trim();
}

/** Inspection answers as stored. Empty fields are omitted. Nothing is rewritten. */
export function inspectionWorkingSections(values: InspectionValues): WorkingSection[] {
  const sections = (schema.sections ?? []) as SchemaSection[];
  return sections
    .map((section) => {
      const rows: WorkingFieldRow[] = [];
      for (const field of section.fields ?? []) {
        const value = formatStored(field, values[field.name]);
        if (value) rows.push({ label: field.label || field.name, value });
        if (field.notes_field) {
          const notes = formatStored(field, values[field.notes_field]);
          if (notes) rows.push({ label: `${field.label || field.name} — notes`, value: notes });
        }
        if (field.condition_field) {
          const condition = formatStored(field, values[field.condition_field]);
          if (condition) rows.push({ label: `${field.label || field.name} — condition`, value: condition });
        }
      }
      return { id: section.id, title: section.title, rows };
    })
    .filter((section) => section.rows.length > 0);
}

export function saleWorkingRating(sale: ComparableSale): string {
  const chosen = sale.printRating?.trim();
  if (chosen) return chosen;
  const net = computeSaleAdjustmentTotals(sale).netAdjustment;
  if (!Number.isFinite(net) || net === 0) return "Similar";
  return net < 0 ? "Superior" : "Inferior";
}

export function calculationWorkingRows(draft: ReportDraft): WorkingFieldRow[] {
  const values = draft.values;
  const meta = draft.reportMeta;
  const rows: WorkingFieldRow[] = [];
  const land = joinValues(values, ["prop_sitearea", "prop_areaunit"], " ");
  if (land) rows.push({ label: "Land area", value: land });
  const usable = formatUsableSiteAreaIfDifferent(values);
  if (usable) rows.push({ label: "Usable area", value: usable });
  if (meta.siteRatePerM2?.trim()) {
    rows.push({ label: "Adopted land rate", value: `$${formatCurrencyDisplay(meta.siteRatePerM2)} per square metre` });
  }
  if (meta.valueAmount?.trim()) {
    rows.push({ label: "Concluded value", value: `$${formatCurrencyDisplay(meta.valueAmount)}` });
  }
  return rows;
}

export type StoredClaim = {
  id: string;
  kind: string;
  text: string;
  source?: string;
  accepted: boolean;
};

export function researchWorkingGroups(meta: ReportMeta): { title: string; claims: StoredClaim[] }[] {
  const groups = [
    { title: "Locality research", claims: meta.nbhdClaims },
    { title: "Market research — Australia", claims: meta.marketClaimsAustralia },
    { title: "Market research — state", claims: meta.marketClaimsState },
    { title: "Market research — region", claims: meta.marketClaimsRegion },
    { title: "Market research — locality", claims: meta.marketClaimsLocality },
  ];
  return groups
    .map((group) => ({
      title: group.title,
      claims: (group.claims ?? []).filter((claim) => claim.text?.trim()),
    }))
    .filter((group) => group.claims.length > 0);
}

export function workingLotPlan(values: InspectionValues): string {
  return get(values, "prop_lotplan");
}
