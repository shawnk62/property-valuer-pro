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

  const reportType = getReportTypeConfig(
    values["prop_assignment"] != null ? String(values["prop_assignment"]) : "",
  );
  const compact = reportType.saleNarrativeStyle === "compact";
  const murrayStamp =
    reportType.id === "stamp-duty-murray" ||
    (typeof values["prop_assignment"] === "string" &&
      /stamp\s*duty/i.test(values["prop_assignment"]) &&
      /murray/i.test(values["prop_assignment"]));

  // Stamp Duty – Phil: ultra-compact. Stamp Duty – Murray: moderate sample style.
  // CGT / detailed: fuller comparison.
  const system = murrayStamp
    ? `You are writing sales evidence comments for a Stamp Duty – Murray valuation report (QLD), matching Murray Peterson sample tone.
Write ONE professional note of 2–4 short sentences comparing this comparable to the subject.
Rules:
- Lead with physical facts (beds/baths/cars, land, living area, condition/age if known).
- Combine source notes with VALUER RELATIVITY MARKS for similar / superior / inferior feature language.
- Mention material differences only; do not list every "similar" feature.
- Use ONLY provided facts and marks. Do not invent features, prices, or adjustments.
- Do NOT invent overall superior/inferior — that phrase is appended outside the model.
- Plain Australian valuation English. No bullet points or adjustment schedules.`
    : compact
    ? `You are writing sales evidence notes for an Australian residential valuation report (QLD), matching Peterson / Phil sample style (Stamp Duty - Phil only).
Write ONE compact note — ideally 1–2 short sentences, maximum about 45 words.
Style examples (match this brevity):
- "Lowset brick and tile, 4 bed 2 bath, 1 car, land 390 m², living 177 m², quieter elevated site."
- "3 bedroom, 1 bathroom, 1 car garage, in need of full renovation, land area 604 square metres, build area 171 square metres."
Rules:
- Lead with physical facts from the comparable sale data and source notes (beds/baths/cars, land, living area, condition or age).
- Combine source notes with the VALUER RELATIVITY MARKS: use marks for similar / superior / inferior feature language; use notes for physical facts and CMA context.
- Mention only material differences from the subject. Do not list every "similar" feature.
- Use ONLY the facts and marks provided. Do not invent features, prices, or adjustments.
- Do NOT invent overall superior/inferior — that phrase is appended outside the model.
- No bullet points, headings, or dollar adjustment schedules.
- Tone: plain professional valuation English. Prefer short clauses over long sentences.`
    : `You are writing sales evidence comments for an Australian Capital Gains Tax / full valuation report (QLD), matching Peterson CGT sample style.
Write ONE professional paragraph of 3–6 sentences comparing this comparable sale to the subject.
Style (match this tone and density):
- Open with the comparable's key physical facts from sale data and source notes (dwelling type, beds/baths, land, living area, condition/age if known).
- Combine source notes with the VALUER RELATIVITY MARKS: notes supply facts and CMA context; marks supply similar / superior / inferior feature comparisons.
- Keep language plain and direct — short sentences preferred over long compound ones (as in the Remarks sections of the CGT samples).
- Do not invent features, prices, or adjustments. Use only facts and marks provided.
- Do NOT invent overall superior/inferior — that phrase is appended outside the model.
- No bullet points, headings, or dollar adjustment schedules unless a net figure is clearly useful in one short clause.
- Tone: formal Australian valuation English.`;

  const writeInstruction = murrayStamp
    ? "Write the Murray Stamp Duty sales-evidence note now (2–4 short sentences). Do not end with overall superior/inferior — that is applied separately."
    : compact
    ? "Write the compact sales-evidence note now (1–2 short sentences, ~45 words max). Do not end with overall superior/inferior — that is applied separately."
    : "Write the CGT-style sales-evidence paragraph now (3–6 sentences). Do not end with overall superior/inferior — that is applied separately.";

  const prompt = `SUBJECT PROPERTY
${subjectSummary(values, meta)}

COMPARABLE SALE
Address: ${sale.address || "(not stated)"}
Sale date: ${sale.saleDate || "(not stated)"}
Sale price: ${sale.salePrice || "(not stated)"}
Land area: ${sale.landArea || "(not stated)"}
${sale.gla ? `Living area: ${sale.gla}` : ""}
${sale.comments?.trim() ? `CSV / user notes: ${sale.comments.trim()}` : ""}
Do not use in-house working notes — they are not provided and must not be invented.
${sale.narrative?.trim() ? `VALUER DRAFT NARRATIVE (revise and improve; preserve the valuer's intent and any facts they added; do not discard their wording without reason):\n${sale.narrative.trim()}` : ""}

VALUER RELATIVITY MARKS (vs subject)
${marks.length ? marks.join("\n") : "- All features marked similar (or not differentiated)."}

CALCULATED TOTALS (if sale price parsed)
Net adjustment: ${formatMoney(totals.netAdjustment)}
Net %: ${formatPct(totals.netPct)}
Gross %: ${formatPct(totals.grossPct)}
Adjusted sale price: ${formatMoney(totals.adjustedSalePrice)}

OVERALL CONCLUSION (office rule, not AI)
${overallHint}

REPORT TYPE: ${reportType.id} (${compact ? "compact Stamp Duty notes" : "detailed CGT / full comparison"})

${writeInstruction}`;

  return { system, prompt };
}
