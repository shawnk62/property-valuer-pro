import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { BOILERPLATE } from "@/lib/report/boilerplate";
import { get, hasValue, labelFor } from "@/lib/report/schema";
import { PHOTO_SLOTS, type ReportDraft } from "@/lib/report/types";

/** A4 width in DXA (twips). Australian valuation reports use A4. */
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN = 1134; // ~20mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

async function loadLogoImage(): Promise<{ data: Uint8Array; type: "jpg" | "png" } | null> {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/ppv-logo.jpeg`);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    if (!data.byteLength) return null;
    return { data, type: "jpg" };
  } catch {
    return null;
  }
}

function text(value: string, opts?: { bold?: boolean; italics?: boolean; size?: number }) {
  return new TextRun({
    text: value,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? 20,
    font: "Times New Roman",
  });
}

function para(
  content: string,
  opts?: { spacingAfter?: number; center?: boolean; bold?: boolean },
) {
  return new Paragraph({
    children: [text(content, { bold: opts?.bold })],
    spacing: { after: opts?.spacingAfter ?? 160 },
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.BOTH,
  });
}

function heading(number: string, title: string) {
  return new Paragraph({
    children: [text(`${number}  ${title}`.toUpperCase(), { bold: true, size: 22 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "666666", space: 4 },
    },
  });
}

function subheading(title: string) {
  return new Paragraph({
    children: [text(title, { bold: true, size: 20 })],
    spacing: { before: 200, after: 100 },
  });
}

function factsTable(
  draft: ReportDraft,
  fields: string[],
  extra: { label: string; value: string }[] = [],
): Table | null {
  const rows: { label: string; value: string }[] = [];
  for (const name of fields) {
    if (!hasValue(draft.values[name])) continue;
    rows.push({ label: labelFor(name), value: get(draft.values, name) });
  }
  for (const e of extra) {
    if (e.value?.trim()) rows.push(e);
  }
  if (rows.length === 0) return null;

  const left = Math.floor(CONTENT_WIDTH * 0.38);
  const right = CONTENT_WIDTH - left;

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [left, right],
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: left, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NIL },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                left: { style: BorderStyle.NIL },
                right: { style: BorderStyle.NIL },
              },
              children: [
                new Paragraph({
                  children: [text(r.label, { size: 18 })],
                  spacing: { after: 40 },
                }),
              ],
            }),
            new TableCell({
              width: { size: right, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.NIL },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                left: { style: BorderStyle.NIL },
                right: { style: BorderStyle.NIL },
              },
              children: [
                new Paragraph({
                  children: [text(r.value, { size: 18 })],
                  spacing: { after: 40 },
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

function proseBlocks(body: string): Paragraph[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => para(line));
}

async function fetchImageBytes(
  url: string,
): Promise<{ data: Uint8Array; type: "jpg" | "png" | "gif" | "bmp" } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const match = /^data:image\/(\w+);base64,(.+)$/i.exec(url);
      if (!match) return null;
      const subtype = match[1].toLowerCase();
      const bin = atob(match[2]);
      const data = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
      let type: "jpg" | "png" | "gif" | "bmp" = "jpg";
      if (subtype.includes("png")) type = "png";
      else if (subtype.includes("gif")) type = "gif";
      else if (subtype.includes("bmp")) type = "bmp";
      return { data, type };
    }
    if (!/^https?:\/\//i.test(url)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let type: "jpg" | "png" | "gif" | "bmp" = "jpg";
    if (ct.includes("png") || url.toLowerCase().includes(".png")) type = "png";
    else if (ct.includes("gif")) type = "gif";
    return { data, type };
  } catch {
    return null;
  }
}

function addressLine(draft: ReportDraft): string {
  return [get(draft.values, "prop_address"), get(draft.values, "prop_suburb")]
    .filter(Boolean)
    .join(", ");
}

function pushTable(children: (Paragraph | Table)[], table: Table | null) {
  if (table) children.push(table);
}

/** Build a Peterson-style Sunshine Coast valuation report as a .docx Blob. */
export async function generateValuationDocx(draft: ReportDraft): Promise<Blob> {
  const v = draft.values;
  const m = draft.reportMeta;
  const addr = addressLine(draft);
  const children: (Paragraph | Table)[] = [];

  const logo = await loadLogoImage();
  if (logo) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logo.data,
            type: logo.type,
            transformation: { width: 160, height: 72 },
            altText: { title: "Logo", description: "Peterson Property Valuations", name: "logo" },
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );
  }

  children.push(
    new Paragraph({
      children: [text("PETERSON PROPERTY VALUATIONS", { bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [text("Real Estate Valuers", { italics: true, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [text("REPORT AND VALUATION", { bold: true, size: 26 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [text("VALUATION SUMMARY", { bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [text("Residential Valuation Report", { size: 18 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  );

  if (addr) {
    children.push(
      new Paragraph({
        children: [text(addr.toUpperCase(), { bold: true, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
    );
  }
  if (get(v, "prop_lotplan")) {
    children.push(para(get(v, "prop_lotplan"), { center: true, spacingAfter: 80 }));
  }
  if (m.valueAmount) {
    children.push(
      new Paragraph({
        children: [text(`Market Value: $${m.valueAmount}`, { bold: true, size: 26 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
      }),
    );
  }
  if (m.valueDate) {
    children.push(para(`As at ${m.valueDate}`, { center: true }));
  }

  pushTable(
    children,
    factsTable(
      draft,
      ["prop_assignment", "insp_purpose", "prop_owner", "prop_rights"],
      [
        { label: "Date of inspection", value: m.inspectionDate },
        { label: "Date of valuation", value: m.valueDate },
        { label: "Valuer", value: m.valuerName },
        { label: "Prepared by", value: m.firmName },
      ],
    ),
  );

  if (draft.narrative.brief.trim()) {
    children.push(...proseBlocks(draft.narrative.brief));
  }
  children.push(para(BOILERPLATE.summaryDisclaimer, { spacingAfter: 200 }));
  children.push(para(m.valuerName || get(v, "insp_valuer") || "", { bold: true, spacingAfter: 40 }));
  if (get(v, "sign_member")) children.push(para(get(v, "sign_member"), { spacingAfter: 40 }));
  children.push(para(m.firmName || get(v, "insp_firm") || "Peterson Property Valuations Pty Ltd"));

  children.push(
    new Paragraph({
      children: [text("TABLE OF CONTENTS", { bold: true, size: 22 })],
      spacing: { before: 400, after: 160 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "666666", space: 4 },
      },
    }),
  );
  for (const line of [
    "1. Instructions and Purpose",
    "2. Property Details",
    "3. Statutory Information",
    "4. Town Planning",
    "5. Location",
    "6. Site Details",
    "7. Improvements",
    "8. Accommodation – Fixtures and Fittings",
    "9. Improvements – Other Valuation Issues",
    "10. Environmental Matters",
    "11. Basis of Valuation",
    "12. Sales Evidence",
    "13. Remarks",
    "14. Limitations",
    "15. Critical Assumptions",
    "16. Valuation Statement",
  ]) {
    children.push(para(line, { spacingAfter: 60 }));
  }

  children.push(heading("1.", "Instructions and Purpose of Valuation"));
  pushTable(
    children,
    factsTable(
      draft,
      ["insp_purpose", "prop_assignment", "prop_rights"],
      [
        { label: "Date of inspection", value: m.inspectionDate },
        { label: "Date of valuation", value: m.valueDate },
      ],
    ),
  );
  children.push(para(BOILERPLATE.natureOfInterest));
  children.push(para(BOILERPLATE.basisOfValuation));
  children.push(para(BOILERPLATE.marketValueDefinition));
  children.push(para(BOILERPLATE.highestAndBestUse));
  children.push(para(BOILERPLATE.assumptionsAndLimitations));

  children.push(heading("2.", "Property Details"));
  pushTable(
    children,
    factsTable(draft, [
      "prop_address",
      "prop_suburb",
      "prop_state",
      "prop_postcode",
      "prop_lotplan",
      "prop_legal",
      "prop_title",
      "prop_parish",
      "prop_lga",
      "prop_owner",
      "prop_occupant",
    ]),
  );

  children.push(heading("3.", "Statutory Information"));
  pushTable(
    children,
    factsTable(draft, [
      "prop_lga",
      "prop_offered",
      "prop_offer_details",
      "prop_contract_price",
      "prop_contract_date",
      "prop_seller_owner",
      "prop_assistance",
      "prop_assistance_details",
    ]),
  );

  children.push(heading("4.", "Town Planning"));
  pushTable(children, factsTable(draft, ["prop_zoning", "prop_zoning_desc", "prop_zoning_comp", "prop_hbu"]));
  children.push(para(BOILERPLATE.townPlanningConsent));
  children.push(subheading("Development potential"));
  children.push(para(BOILERPLATE.developmentPotential));

  children.push(heading("5.", "Location and Neighbourhood"));
  if (get(v, "nbhd_description")) children.push(...proseBlocks(get(v, "nbhd_description")));
  if (get(v, "nbhd_market_conditions")) children.push(...proseBlocks(get(v, "nbhd_market_conditions")));
  pushTable(
    children,
    factsTable(draft, [
      "nbhd_location",
      "nbhd_builtup",
      "nbhd_growth",
      "nbhd_values",
      "nbhd_demand",
      "nbhd_marketing",
      "nbhd_price_range",
      "nbhd_age",
    ]),
  );
  const offsite = factsTable(draft, [
    "offsite_road_type",
    "offsite_road_surface",
    "offsite_carriageway",
    "offsite_kerb",
    "offsite_footpaths",
    "offsite_verge",
    "offsite_lighting",
    "offsite_drainage",
  ]);
  if (offsite) {
    children.push(subheading("Roads and access"));
    children.push(offsite);
  }

  children.push(heading("6.", "Site Details"));
  pushTable(
    children,
    factsTable(draft, [
      "prop_sitearea",
      "prop_areaunit",
      "prop_dimensions",
      "prop_shape",
      "topo",
      "land",
      "va",
      "fence",
      "exc",
      "prop_view",
      "svc_water_type",
      "svc_sewer_type",
      "svc_elec_type",
      "svc_storm_type",
      "svc_tel_type",
      "svc_internet_type",
      "svc_gas_type",
      "prop_flood",
    ]),
  );

  children.push(heading("7.", "Improvements"));
  if (draft.narrative.improvements.trim()) {
    children.push(subheading("7.1 General description"));
    children.push(...proseBlocks(draft.narrative.improvements));
  }
  const imp = factsTable(draft, [
    "imp_design",
    "imp_storeys",
    "imp_yearbuilt",
    "imp_effage",
    "imp_quality",
    "imp_gla",
    "imp_add_features",
    "ext",
    "rc",
    "rd",
    "foundations",
    "floor_structure",
    "flr",
    "il",
    "ceil",
    "vent",
    "overall_cond",
  ]);
  if (imp) {
    children.push(subheading("7.3 General construction"));
    children.push(imp);
  }

  children.push(heading("8.", "Accommodation – Fixtures and Fittings"));
  if (draft.narrative.accommodation.trim()) {
    children.push(...proseBlocks(draft.narrative.accommodation));
  }
  pushTable(children, factsTable(draft, ["imp_rooms", "imp_beds", "imp_baths", "accom", "park", "anc"]));

  children.push(heading("9.", "Improvements – Other Valuation Issues"));
  children.push(subheading("Encroachments"));
  children.push(para(BOILERPLATE.encroachments));
  children.push(subheading("Condition of improvements"));
  children.push(para(BOILERPLATE.conditionOfImprovements));
  children.push(subheading("Development potential"));
  children.push(para(BOILERPLATE.developmentPotential));
  pushTable(children, factsTable(draft, ["other_notes", "defects_notes", "overall_site_cond"]));

  children.push(heading("10.", "Environmental Matters"));
  children.push(para(BOILERPLATE.contaminatedLand));
  children.push(para(BOILERPLATE.heritageListing));
  children.push(para(BOILERPLATE.vegetationProtection));
  children.push(para(BOILERPLATE.asbestos));
  pushTable(children, factsTable(draft, ["prop_flood", "prop_flood_map", "prop_adverse_site"]));

  children.push(heading("11.", "Basis of Valuation"));
  children.push(subheading("Direct Comparison"));
  children.push(para(BOILERPLATE.directComparisonIntro));
  for (const line of BOILERPLATE.directComparisonBody) {
    children.push(para(line));
  }
  for (const f of BOILERPLATE.directComparisonFactors) {
    children.push(para(`• ${f}`, { spacingAfter: 40 }));
  }
  children.push(para(BOILERPLATE.directComparisonClose));
  children.push(para(BOILERPLATE.addedValue));

  children.push(heading("12.", "Sales Evidence"));
  const sales = draft.sales.filter(
    (s) => s.address.trim() || s.salePrice.trim() || s.saleDate.trim(),
  );
  if (sales.length === 0) {
    children.push(para("No comparable sales have been recorded for this report."));
  } else {
    sales.forEach((s, i) => {
      children.push(subheading(`${i + 1}. ${s.address || "Comparable sale"}`));
      const saleRows = [
        { label: "Sale date", value: s.saleDate },
        { label: "Sale price", value: s.salePrice },
        { label: "Land area", value: s.landArea },
        { label: "Comments", value: s.comments },
      ].filter((r) => r.value.trim());
      if (saleRows.length) {
        const left = Math.floor(CONTENT_WIDTH * 0.3);
        const right = CONTENT_WIDTH - left;
        children.push(
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: [left, right],
            rows: saleRows.map(
              (r) =>
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: left, type: WidthType.DXA },
                      borders: {
                        top: { style: BorderStyle.NIL },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                        left: { style: BorderStyle.NIL },
                        right: { style: BorderStyle.NIL },
                      },
                      children: [new Paragraph({ children: [text(r.label, { size: 18 })] })],
                    }),
                    new TableCell({
                      width: { size: right, type: WidthType.DXA },
                      borders: {
                        top: { style: BorderStyle.NIL },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                        left: { style: BorderStyle.NIL },
                        right: { style: BorderStyle.NIL },
                      },
                      children: [new Paragraph({ children: [text(r.value, { size: 18 })] })],
                    }),
                  ],
                }),
            ),
          }),
        );
      }
    });
  }

  children.push(heading("13.", "Remarks"));
  children.push(...proseBlocks(draft.narrative.remarks || BOILERPLATE.remarksDefault));

  children.push(heading("14.", "Limitations"));
  children.push(para(BOILERPLATE.assumptionsAndLimitations));
  for (const l of BOILERPLATE.limitations) {
    children.push(para(l));
  }

  children.push(heading("15.", "Critical Assumptions"));
  children.push(para(BOILERPLATE.criticalAssumptionsIntro));
  BOILERPLATE.criticalAssumptions.forEach((a, i) => {
    children.push(para(`${i + 1}. ${a}`));
  });
  children.push(para(BOILERPLATE.criticalAssumptionsClose));

  children.push(heading("16.", "Valuation Statement"));
  children.push(
    para(
      `Having regard to the foregoing, I am of the opinion that the market value of the unencumbered fee simple interest in the subject property${addr ? `, ${addr},` : ""} as at ${m.valueDate || "the date of valuation"} is:`,
    ),
  );
  if (m.valueAmount) {
    children.push(
      new Paragraph({
        children: [text(`$${m.valueAmount}`, { bold: true, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      }),
    );
  }
  children.push(para(m.valuerName || get(v, "insp_valuer") || "", { bold: true, spacingAfter: 40 }));
  if (get(v, "sign_member")) children.push(para(get(v, "sign_member"), { spacingAfter: 40 }));
  children.push(para(m.firmName || "Peterson Property Valuations Pty Ltd"));
  for (const a of BOILERPLATE.annexures) {
    children.push(para(a, { spacingAfter: 40 }));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      children: [text("ANNEXURE 2 — PHOTOGRAPHS", { bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
    }),
  );

  const annexure = draft.photos.filter((p) => p.url && (/^https?:\/\//i.test(p.url) || p.url.startsWith("data:image/")));
  if (annexure.length === 0) {
    children.push(para("No photographs have been attached.", { center: true }));
  } else {
    for (const photo of annexure) {
      const img = await fetchImageBytes(photo.url);
      if (img) {
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: img.data,
                type: img.type,
                transformation: { width: 480, height: 360 },
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
          }),
        );
      }
      const caption =
        photo.caption ||
        PHOTO_SLOTS.find((s) => s.slot === photo.slot)?.label ||
        "Photograph";
      children.push(para(caption, { center: true, spacingAfter: 200 }));
    }
  }

  const doc = new Document({
    creator: m.firmName || "Peterson Property Valuations",
    title: addr ? `Valuation — ${addr}` : "Valuation Report",
    description: "Queensland residential valuation report",
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 20 },
          paragraph: { spacing: { after: 120, line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickStyle: true,
          run: { font: "Times New Roman", size: 22, bold: true },
          paragraph: { spacing: { before: 280, after: 140 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
            },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function suggestedDocxFilename(draft: ReportDraft): string {
  const suburb = get(draft.values, "prop_suburb") || "property";
  const safe = suburb.replace(/[^\w\-]+/g, "_").slice(0, 40);
  const date = draft.reportMeta.valueDate || new Date().toISOString().slice(0, 10);
  return `Valuation_${safe}_${date}.docx`;
}
