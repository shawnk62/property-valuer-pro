/**
 * Build prompts and fingerprints for AI comparable-sale narratives
 * from the URAR-style adjustment grid.
 */
import { ADJUSTMENT_FEATURES, computeSaleAdjustmentTotals, formatMoney, formatPct } from "./adjustmentGrid";
import { getReportTypeConfig } from "./reportTypes";
import { relativityPhrase } from "./salesRelativity";
import type { ComparableSale, InspectionValues, ReportMeta } from "./types";

const AUTO_KEY = "pvp-auto-sale-narratives-v1";

/** Default ON — easy to turn off in Sales tab. */
export function loadAutoSaleNarratives(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(AUTO_KEY);
    if (raw === null) return true;
    return raw === "1" || raw === "true";
  } catch {
    return true;
  }
}

export function saveAutoSaleNarratives(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_KEY, enabled ? "1" : "0");
}

export function saleNarrativeFingerprint(sale: ComparableSale): string {
  const adj = sale.adjustments ?? {};
  const adjPart = ADJUSTMENT_FEATURES.map((f) => {
    const a = adj[f.id];
    return `${f.id}:${a?.relativity ?? "similar"}:${a?.amount ?? 0}`;
  }).join("|");
  return [
    sale.address,
    sale.saleDate,
    sale.salePrice,
    sale.landArea,
    sale.gla ?? "",
    adjPart,
  ].join("::");
}

function subjectSummary(values: InspectionValues, meta: ReportMeta): string {
  const lines: string[] = [];
  const addr = [values["prop_address"], values["prop_suburb"], values["prop_state"], values["prop_postcode"]]
    .filter(Boolean)
    .join(", ");
  if (addr) lines.push(`Address: ${addr}`);
  if (meta.valueAmount) lines.push(`Valuation amount: ${meta.valueAmount}`);
  if (meta.valueDate) lines.push(`Valuation date: ${meta.valueDate}`);
  const site = [values["prop_sitearea"], values["prop_areaunit"]].filter(Boolean).join(" ");
  if (site) lines.push(`Land: ${site}`);
  for (const key of ["imp_yearbuilt", "imp_beds", "imp_baths", "imp_gla", "overall_cond"]) {
    const v = values[key];
    if (v !== undefined && v !== null && String(v).trim()) lines.push(`${key}: ${v}`);
  }
  return lines.join("\n") || "Subject details limited.";
}

export function buildSaleNarrativePrompt(
  sale: ComparableSale,
  values: InspectionValues,
  meta: ReportMeta,
): { system: string; prompt: string } {
  const totals = computeSaleAdjustmentTotals(sale);
  const adj = sale.adjustments ?? {};
  const marks = ADJUSTMENT_FEATURES.map((f) => {
    const a = adj[f.id];
    const rel = a?.relativity ?? "similar";
    const amt = a?.amount ?? 0;
    if (rel === "similar" && (!amt || amt === 0)) return null;
    return `- ${f.label}: ${rel}${amt ? ` (${amt > 0 ? "+" : ""}${amt})` : ""}`;
  }).filter(Boolean);

  const overallPhrase = relativityPhrase(sale.salePrice, meta.valueAmount || "");
  const overallHint = overallPhrase
    ? `Must align with the office rule: "${overallPhrase}" (sale price vs valuation amount). Do not state a conflicting overall conclusion.`
    : "Valuation amount is not set; do not state overall superior/inferior.";

  // Stamp Duty - Phil only: terse Peterson-style notes. Other report types: fuller paragraph.
  const reportType = getReportTypeConfig(
    values["prop_assignment"] != null ? String(values["prop_assignment"]) : "",
  );
  const isPhil = reportType.id === "stamp-duty-phil";

  const system = isPhil
    ? `You are writing sales evidence notes for an Australian residential valuation report (QLD), matching Peterson / Phil sample style (Stamp Duty - Phil only).
Write ONE compact note — ideally 1–2 short sentences, maximum about 45 words.
Style examples (match this brevity):
- "Lowset brick and tile, 4 bed 2 bath, 1 car, land 390 m², living 177 m², quieter elevated site."
- "3 bedroom, 1 bathroom, 1 car garage, in need of full renovation, land area 604 square metres, build area 171 square metres."
Rules:
- Lead with physical facts (beds/baths/cars, land, living area, condition or age if given).
- Mention only material differences from the subject (from the valuer marks). Do not list every "similar" feature.
- Use ONLY the facts and marks provided. Do not invent features, prices, or adjustments.
- Do NOT invent overall superior/inferior — that phrase is appended outside the model.
- No bullet points, headings, or dollar adjustment schedules.
- Tone: plain professional valuation English. Prefer short clauses over long sentences.`
    : `You are writing sales evidence notes for an Australian residential valuation report (QLD).
Write ONE short professional paragraph (2–5 sentences) comparing this comparable sale to the subject property.
Rules:
- Use ONLY the facts and relativity marks provided. Do not invent features, prices, or adjustments.
- Reflect the valuer's marks (inferior / slightly inferior / similar / slightly superior / superior).
- Do NOT invent your own overall superior/inferior conclusion. The overall conclusion is fixed by the valuation office rule below and will be appended outside the model.
- Do not use bullet points. No headings. No dollar adjustment schedules in the narrative unless a net figure is provided and useful in one clause.
- Tone: formal valuation report English used in Australian practice.`;

  const writeInstruction = isPhil
    ? "Write the compact sales-evidence note now (1–2 short sentences, ~45 words max). Do not end with overall superior/inferior — that is applied separately."
    : "Write the comparable sale narrative paragraph now (2–5 sentences). Do not end with an overall superior/inferior sentence — that is applied separately.";

  const prompt = `SUBJECT PROPERTY
${subjectSummary(values, meta)}

COMPARABLE SALE
Address: ${sale.address || "(not stated)"}
Sale date: ${sale.saleDate || "(not stated)"}
Sale price: ${sale.salePrice || "(not stated)"}
Land area: ${sale.landArea || "(not stated)"}
${sale.gla ? `Living area: ${sale.gla}` : ""}
${sale.comments?.trim() ? `CSV / user notes: ${sale.comments.trim()}` : ""}

VALUER RELATIVITY MARKS (vs subject)
${marks.length ? marks.join("\n") : "- All features marked similar (or not differentiated)."}

CALCULATED TOTALS (if sale price parsed)
Net adjustment: ${formatMoney(totals.netAdjustment)}
Net %: ${formatPct(totals.netPct)}
Gross %: ${formatPct(totals.grossPct)}
Adjusted sale price: ${formatMoney(totals.adjustedSalePrice)}

OVERALL CONCLUSION (office rule, not AI)
${overallHint}

REPORT TYPE: ${reportType.id}${isPhil ? " (Stamp Duty - Phil — short notes)" : " (fuller paragraph)"}

${writeInstruction}`;

  return { system, prompt };
}
