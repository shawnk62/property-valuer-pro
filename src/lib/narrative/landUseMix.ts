import type { InspectionValues } from "@/lib/inspection/types";

/** Inspection keys for Present Land Use %. Do not rename. */
export const LAND_USE_PCT_KEYS = [
  "nbhd_use_one",
  "nbhd_use_24",
  "nbhd_use_mf",
  "nbhd_use_comm",
  "nbhd_use_vacant",
] as const;

const LAND_USE_LABELS: Record<(typeof LAND_USE_PCT_KEYS)[number], string> = {
  nbhd_use_one: "single-unit residential",
  nbhd_use_24: "two-to-four unit residential",
  nbhd_use_mf: "multi-family residential",
  nbhd_use_comm: "commercial",
  nbhd_use_vacant: "vacant land",
};

function parsePct(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).replace(/%/g, "").replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function qualifier(pct: number): "a few" | "some" | "a substantial component of" | "mainly" | "predominantly" {
  if (pct <= 10) return "a few";
  if (pct <= 25) return "some";
  if (pct <= 45) return "a substantial component of";
  if (pct <= 70) return "mainly";
  return "predominantly";
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Qualitative land-use sentence from the % fields.
 * Exact figures are a guide only and must not appear in the text.
 */
export function describeLandUseMix(values: InspectionValues): string {
  const rows = LAND_USE_PCT_KEYS.map((key) => {
    const pct = parsePct(values[key]);
    return pct == null ? null : { key, pct, label: LAND_USE_LABELS[key], q: qualifier(pct) };
  }).filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length === 0) return "";

  rows.sort((a, b) => b.pct - a.pct);
  const primary = rows[0]!;
  const rest = rows.slice(1);

  const lead =
    primary.q === "a few" || primary.q === "some" || primary.q === "a substantial component of"
      ? `The locality includes ${primary.q} ${primary.label}`
      : `The locality is ${primary.q} ${primary.label}`;

  if (rest.length === 0) return `${lead}.`;

  const groups = new Map<string, string[]>();
  for (const row of rest) {
    const list = groups.get(row.q) ?? [];
    list.push(row.label);
    groups.set(row.q, list);
  }

  const tails: string[] = [];
  for (const q of ["mainly", "a substantial component of", "some", "a few"] as const) {
    const labels = groups.get(q);
    if (!labels?.length) continue;
    if (q === "a few") tails.push(`a few ${joinList(labels)} properties`);
    else if (q === "some") tails.push(`some ${joinList(labels)}`);
    else tails.push(`${q} ${joinList(labels)}`);
  }

  if (tails.length === 0) return `${lead}.`;
  return `${lead}, with ${joinList(tails)}.`;
}

/** Drop raw % fields so the model cannot echo exact figures. */
export function stripLandUsePercentages(values: InspectionValues): InspectionValues {
  const next = { ...values };
  for (const key of LAND_USE_PCT_KEYS) delete next[key];
  return next;
}
