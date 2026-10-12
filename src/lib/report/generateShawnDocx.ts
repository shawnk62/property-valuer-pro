/**
 * Word export for Shawn reports. Follows the Shawn section order,
 * not the Phil/Murray numbered structure.
 */
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { formatNarrativeDate, formatNarrativeDateOr } from "@/lib/report/dates";
import { SHAWN_EXAM_STYLE } from "@/lib/report/shawnExamStyle";
import { get } from "@/lib/report/schema";
import { formatCurrencyDisplay } from "@/lib/report/salesRelativity";
import { salesOnReport, type ReportDraft } from "@/lib/report/types";
import { referencesForPrint } from "@/lib/report/references";

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN = 1134;

function run(text: string, opts?: { bold?: boolean; italics?: boolean; size?: number }): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? 22,
    font: "Arial",
  });
}

function p(text: string, opts?: { bold?: boolean; italics?: boolean; size?: number; after?: number; before?: number; center?: boolean }): Paragraph {
  return new Paragraph({
    children: [run(text, opts)],
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: opts?.after ?? 120, before: opts?.before ?? 0 },
  });
}

function heading(text: string): Paragraph {
  return p(text, { bold: true, size: 28, before: 360, after: 160 });
}

function sub(text: string): Paragraph {
  return p(text, { bold: true, size: 24, before: 240, after: 80 });
}

function prose(body: string): Paragraph[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => p(line, { after: 120 }));
}

export async function generateShawnDocx(draft: ReportDraft): Promise<Blob> {
  const m = draft.reportMeta;
  const v = draft.values;
  const n = draft.narrative;
  const address = [get(v, "prop_address"), get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")]
    .filter(Boolean)
    .join(", ");
  const children: Paragraph[] = [];

  children.push(
    p(SHAWN_EXAM_STYLE.firmName, { bold: true, size: 32, center: true, after: 60 }),
    p("Valuation Report", { bold: true, size: 28, center: true, after: 200 }),
    p(address || "—", { bold: true, size: 24, center: true, after: 60 }),
    p(get(v, "prop_lotplan"), { center: true, after: 60 }),
    p(`Prepared for ${get(v, "instr_from_name") || "—"}`, { center: true, after: 200 }),
  );

  if (m.valueAmount) {
    children.push(p(`Market Value: $${formatCurrencyDisplay(m.valueAmount)}`, { bold: true, size: 26, center: true, before: 200, after: 60 }));
  }
  if (m.valueDate) {
    children.push(p(`As at ${formatNarrativeDate(m.valueDate)}`, { center: true, after: 200 }));
  }

  children.push(heading("Executive Summary"));
  if (n.executiveSummary?.trim()) children.push(...prose(n.executiveSummary));
  if (n.brief?.trim()) children.push(...prose(n.brief));

  children.push(heading("1. Basis of Value"));
  children.push(sub("1.1 Instructions"));
  if (n.instructions?.trim()) children.push(...prose(n.instructions));
  children.push(sub("1.2 Valuation Standards"));
  children.push(p("The methodological framework for this valuation is grounded in the standards established by the International Valuation Standards Council (IVSC), the Australian Property Institute (API), and the Royal Institution of Chartered Surveyors (RICS). The basis of valuation is Market Value."));
  children.push(sub("1.3 Valuer’s Interest"));
  children.push(p("The valuer declares that there is no pecuniary, professional or other interest that would constitute a conflict of interest or otherwise compromise the ability to provide an independent and unbiased valuation."));
  children.push(sub("1.4 Date of Valuation"));
  children.push(p(`The subject property was inspected on ${formatNarrativeDateOr(m.inspectionDate, "the date recorded in this report")}. The valuation is effective as at ${formatNarrativeDateOr(m.valueDate, "the date of valuation")} only.`));

  children.push(heading("2. Title and Property Details"));
  children.push(sub("2.1 Property Description"));
  if (n.sitePhysical?.trim()) children.push(...prose(n.sitePhysical));
  children.push(sub("2.2 Title Particulars"));
  children.push(p(`Street address: ${address}`));
  children.push(p(`Real property description: ${get(v, "prop_lotplan")}`));
  children.push(p(`Title reference: ${get(v, "prop_title")}`));
  children.push(p(`Registered owner: ${get(v, "prop_owner")}`));
  children.push(p(`Nature of interest: ${get(v, "prop_rights")}`));
  if (n.siteIdentification?.trim()) children.push(...prose(n.siteIdentification));
  children.push(sub("2.3 Particulars of Land"));
  if (n.sitePhysical?.trim()) children.push(...prose(n.sitePhysical));

  children.push(heading("3. Planning Controls"));
  if (n.zoningPurpose?.trim()) children.push(...prose(n.zoningPurpose));
  children.push(p(`Zoning: ${get(v, "prop_zoning")}`));
  children.push(p(`Planning scheme: ${get(v, "prop_planning_scheme")}`));

  children.push(heading("4. Environmental Issues"));
  if (n.envIntro?.trim()) children.push(...prose(n.envIntro));
  if (n.floodAssessment?.trim()) children.push(...prose(n.floodAssessment));
  if (n.acidSulphate?.trim()) children.push(...prose(n.acidSulphate));

  children.push(heading("5. Locality and Location"));
  if (n.location?.trim()) children.push(...prose(n.location));
  if (n.neighbourhood?.trim()) children.push(...prose(n.neighbourhood));

  children.push(heading("6. Market Commentary"));
  if (n.marketAustralia?.trim()) children.push(...prose(n.marketAustralia));
  if (n.marketState?.trim()) children.push(...prose(n.marketState));
  if (n.marketRegion?.trim()) children.push(...prose(n.marketRegion));
  if (n.marketLocality?.trim()) children.push(...prose(n.marketLocality));

  children.push(heading("7. Risk Assessment"));
  if (n.riskAnalysis?.trim()) children.push(...prose(n.riskAnalysis));

  children.push(heading("8. Valuation Approach"));
  if (n.valuationApproach?.trim()) children.push(...prose(n.valuationApproach));
  if (n.salesComments?.trim()) {
    children.push(sub("8.2 Comments on comparable sales"));
    children.push(...prose(n.salesComments));
  }
  if (n.valueReconciliation?.trim()) {
    children.push(sub("8.3 Final reconciliation of value"));
    children.push(...prose(n.valueReconciliation));
  }

  const sales = salesOnReport(draft.sales);
  if (sales.length) {
    children.push(sub("Comparable sales"));
    for (const [i, s] of sales.entries()) {
      children.push(p(`${i + 1}. ${s.address || "—"} — ${s.salePrice || "—"} — ${s.saleDate || "—"}`, { bold: true }));
      if (s.narrative?.trim()) children.push(...prose(s.narrative));
    }
  }

  children.push(heading("9. References"));
  const refs = referencesForPrint(m, n.references, v, Object.values(n).join("\n"));
  for (const ref of refs) {
    const site = ref.site && ref.site.toLowerCase() !== ref.author.toLowerCase() ? `, ${ref.site}` : "";
    children.push(p(`${ref.author} ${ref.year}, ${ref.title}${site}, viewed ${ref.accessed}, <${ref.url}>.`));
  }

  children.push(heading("10. Annexures"));
  children.push(p("Subject photographs, comparable sale photographs, maps, cadastral plan, certificate of title and survey plan are annexed."));

  const doc = new Document({
    creator: SHAWN_EXAM_STYLE.firmName,
    sections: [
      {
        properties: {
          page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
