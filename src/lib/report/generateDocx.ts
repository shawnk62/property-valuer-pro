/**
 * Word export — structure and content intentionally mirrored from
 * src/components/report/ReportPreview.tsx so the .docx matches Preview.
 */
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
import { parseOverlayList } from "@/lib/report/overlays";
import { PPV_LOGO_JPEG_BASE64 } from "@/lib/report/ppv-logo-base64";
import { get, hasValue, joinValues, labelFor } from "@/lib/report/schema";
import { cleanSaleProse, formatCurrencyDisplay } from "@/lib/report/salesRelativity";
import { MAP_SLOTS, PHOTO_SLOTS, type ReportDraft, type ReportNarrative } from "@/lib/report/types";

/** A4 (matches Australian report paper). */
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const MARGIN = 1134;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function run(value: string, opts?: { bold?: boolean; italics?: boolean; size?: number }) {
  return new TextRun({
    text: value,
    bold: opts?.bold,
    italics: opts?.italics,
    size: opts?.size ?? 20, // 10pt
    font: "Arial",
  });
}

function p(
  content: string,
  opts?: {
    after?: number;
    before?: number;
    center?: boolean;
    bold?: boolean;
    italics?: boolean;
    size?: number;
  },
) {
  return new Paragraph({
    children: [run(content, { bold: opts?.bold, italics: opts?.italics, size: opts?.size })],
    spacing: { after: opts?.after ?? 160, before: opts?.before ?? 0, line: 276 },
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.BOTH,
  });
}

/** Section heading — mirrors ReportPreview `.report-h2` uppercase + bottom rule. */
function sectionHeading(number: string, title: string) {
  return new Paragraph({
    children: [run(`${number}  ${title}`.toUpperCase(), { bold: true, size: 22 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: "333333", space: 6 },
    },
  });
}

function subHeading(title: string) {
  return new Paragraph({
    children: [run(title, { bold: true, size: 20 })],
    spacing: { before: 200, after: 100 },
  });
}

function prose(body: string): Paragraph[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => p(line));
}

function thinBorder() {
  return {
    top: { style: BorderStyle.NIL as const },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    left: { style: BorderStyle.NIL as const },
    right: { style: BorderStyle.NIL as const },
  };
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
              borders: thinBorder(),
              children: [
                new Paragraph({
                  children: [run(r.label, { size: 18 })],
                  spacing: { after: 60 },
                }),
              ],
            }),
            new TableCell({
              width: { size: right, type: WidthType.DXA },
              borders: thinBorder(),
              children: [
                new Paragraph({
                  children: [run(r.value, { size: 18 })],
                  spacing: { after: 60 },
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

function push(children: (Paragraph | Table)[], item: Paragraph | Table | null | undefined) {
  if (item) children.push(item);
}

function pushAll(children: (Paragraph | Table)[], items: (Paragraph | Table | null | undefined)[]) {
  for (const item of items) push(children, item);
}

/* ---- TOC visibility (copied from ReportPreview) ---- */

type TocEntry = {
  id: string;
  number: string;
  title: string;
  always?: boolean;
  fields?: string[];
  narrativeKey?: keyof ReportNarrative;
  requireSales?: boolean;
};

const TOC_ENTRIES: TocEntry[] = [
  { id: "sec-instructions", number: "1.", title: "Instructions and Purpose", fields: ["prop_assignment", "prop_rights", "insp_date"] },
  { id: "sec-property", number: "2.", title: "Property Details", fields: ["prop_address", "prop_suburb", "prop_state", "prop_postcode", "prop_lotplan", "prop_legal", "prop_title", "prop_parish", "prop_lga", "prop_owner", "prop_occupant"] },
  { id: "sec-statutory", number: "3.", title: "Statutory Information", fields: ["prop_lga", "prop_site_value", "prop_sv_date", "prop_offered", "prop_offer_details", "prop_contract_price", "prop_contract_date", "prop_seller_owner", "prop_assistance", "prop_assistance_details"] },
  { id: "sec-planning", number: "4.", title: "Town Planning", fields: ["prop_zoning", "prop_zoning_desc", "prop_zoning_comp", "prop_hbu"] },
  { id: "sec-location", number: "5.", title: "Location", fields: ["nbhd_description", "nbhd_market_conditions", "nbhd_location", "nbhd_builtup", "nbhd_growth", "nbhd_values", "nbhd_demand", "nbhd_marketing", "nbhd_price_range", "nbhd_age", "offsite_road_type", "offsite_road_surface", "offsite_carriageway", "offsite_kerb", "offsite_footpaths"] },
  { id: "sec-site", number: "6.", title: "Site Details", fields: ["prop_sitearea", "prop_areaunit", "prop_dimensions", "prop_shape", "topo", "land", "va", "fence", "exc", "prop_view", "svc_water_type", "svc_sewer_type", "svc_elec_type", "svc_storm_type", "svc_tel_type", "prop_flood"] },
  { id: "sec-improvements", number: "7.", title: "Improvements", fields: ["imp_design", "imp_lowset", "imp_storeys", "imp_yearbuilt", "imp_effage", "imp_quality", "imp_gla", "ext", "rc", "rd", "foundations", "floor_structure", "flr", "overall_cond"], narrativeKey: "improvements" },
  { id: "sec-accommodation", number: "8.", title: "Accommodation – Fixtures and Fittings", fields: ["imp_rooms", "imp_beds", "imp_baths", "accom", "park", "anc"], narrativeKey: "accommodation" },
  { id: "sec-other", number: "9.", title: "Improvements – Other Valuation Issues", fields: ["other_notes", "defects_notes", "overall_site_cond"] },
  { id: "sec-environmental", number: "10.", title: "Environmental Matters", fields: ["prop_flood", "prop_flood_map", "prop_adverse_site"] },
  { id: "sec-basis", number: "11.", title: "Basis of Valuation", always: true },
  { id: "sec-sales", number: "12.", title: "Sales Evidence", requireSales: true },
  { id: "sec-remarks", number: "13.", title: "Remarks", narrativeKey: "remarks", fields: ["other_notes", "defects_notes"] },
  { id: "sec-limitations", number: "14.", title: "Limitations", always: true },
  { id: "sec-assumptions", number: "15.", title: "Critical Assumptions", always: true },
  { id: "sec-valuation", number: "16.", title: "Valuation Statement", always: true },
];

function sectionHasContent(entry: TocEntry, draft: ReportDraft): boolean {
  if (entry.always) return true;
  if (entry.requireSales) {
    return draft.sales.some(
      (s) => s.address.trim() || s.saleDate.trim() || s.salePrice.trim() || s.landArea.trim() || s.comments.trim(),
    );
  }
  if (entry.narrativeKey) {
    const text = draft.narrative[entry.narrativeKey];
    if (typeof text === "string" && text.trim()) return true;
  }
  if (entry.fields?.some((name) => hasValue(draft.values[name]))) return true;
  if (entry.id === "sec-instructions") {
    if (draft.reportMeta.inspectionDate.trim() || draft.reportMeta.valueDate.trim()) return true;
  }
  return false;
}

async function imageFromUrl(
  url: string,
): Promise<{ data: Uint8Array; type: "jpg" | "png" | "gif" | "bmp" } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const match = /^data:image\/(\w+);base64,(.+)$/i.exec(url);
      if (!match) return null;
      const subtype = match[1].toLowerCase();
      const data = base64ToUint8Array(match[2]);
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
  const v = draft.values;
  return [
    get(v, "prop_address"),
    [get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

/** Build Word document matching ReportPreview structure and content. */

async function pushInlineMap(
  children: Paragraph[],
  draft: ReportDraft,
  slot: string,
  caption?: string,
  opts?: { width?: number; height?: number },
) {
  const photo = draft.photos.find((ph) => ph.slot === slot && ph.url);
  if (!photo?.url) return;
  const img = await imageFromUrl(photo.url);
  if (!img) return;
  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: img.data,
          type: img.type,
          transformation: {
            width: opts?.width ?? 420,
            height: opts?.height ?? 300,
          },
          altText: {
            title: caption || photo.caption || "Map",
            description: caption || photo.caption || "Map",
            name: photo.id,
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
    }),
  );
  if (caption || photo.caption) {
    children.push(
      p(caption || photo.caption || "", { center: true, size: 16, after: 160 }),
    );
  }
}

export async function generateValuationDocx(draft: ReportDraft): Promise<Blob> {
  const v = draft.values;
  const m = draft.reportMeta;
  const addr = addressLine(draft);
  const siteArea = joinValues(v, ["prop_sitearea", "prop_areaunit"], "");
  const children: (Paragraph | Table)[] = [];

  // ---- Cover (mirrors ReportPreview header + summary band) ----
  children.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: base64ToUint8Array(PPV_LOGO_JPEG_BASE64),
          type: "jpg",
          transformation: { width: 180, height: 80 },
          altText: {
            title: "Peterson Property Valuations",
            description: "Company logo",
            name: "ppv-logo",
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  children.push(
    p("Valuation Summary", { center: true, bold: true, size: 28, after: 60 }),
    p("Residential Valuation Report", { center: true, size: 18, after: 200 }),
  );

  // Bordered address / value band
  if (addr) {
    children.push(p(addr.toUpperCase(), { center: true, bold: true, size: 24, after: 60, before: 120 }));
  }
  if (get(v, "prop_lotplan")) {
    children.push(p(get(v, "prop_lotplan"), { center: true, size: 18, after: 60 }));
  }
  if (m.valueAmount) {
    children.push(p(`Market Value: $${formatCurrencyDisplay(m.valueAmount)}`, { center: true, bold: true, size: 28, before: 120, after: 60 }));
  }
  if (m.valueDate) {
    children.push(p(`As at ${m.valueDate}`, { center: true, size: 18, after: 200 }));
  }

  push(
    children,
    factsTable(
      draft,
      ["prop_assignment", "prop_owner", "prop_rights"],
      [
        {
          label: "INSTRUCTIONS",
          value: get(v, "instr_from_name")
            ? `This report prepared as per instructions from ${get(v, "instr_from_name")}`
            : "This report prepared as per instructions from",
        },
        {
          label: "CONTACT DETAILS",
          value: [
            get(v, "instr_from_email") ? `Email: ${get(v, "instr_from_email")}` : "",
            get(v, "instr_from_mobile") ? `Mobile: ${get(v, "instr_from_mobile")}` : "",
          ]
            .filter(Boolean)
            .join("  ·  "),
        },
        { label: "Date of inspection", value: m.inspectionDate },
        { label: "Date of valuation", value: m.valueDate },
        { label: "Valuer", value: m.valuerName },
        { label: "Prepared by", value: m.firmName },
      ],
    ),
  );

  if (draft.narrative.brief.trim()) {
    children.push(...prose(draft.narrative.brief));
  }

  children.push(p(BOILERPLATE.summaryDisclaimer, { italics: true, size: 18, after: 200, before: 160 }));

  // Signature block (preview)
  children.push(p(m.valuerName || get(v, "insp_valuer") || "", { bold: true, after: 40, before: 200 }));
  if (get(v, "sign_member")) children.push(p(get(v, "sign_member"), { size: 18, after: 40 }));
  children.push(p(m.firmName || get(v, "insp_firm") || "Peterson Property Valuations Pty Ltd", { size: 18, after: 40 }));
  if (m.valueDate) children.push(p(m.valueDate, { size: 18, after: 200 }));

  // ---- TOC (same visibility rules as Preview) ----
  const tocVisible = TOC_ENTRIES.filter((e) => sectionHasContent(e, draft));
  if (tocVisible.length) {
    children.push(
      new Paragraph({
        children: [run("TABLE OF CONTENTS", { bold: true, size: 22 })],
        spacing: { before: 360, after: 160 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: "333333", space: 6 },
        },
      }),
    );
    for (const entry of tocVisible) {
      children.push(
        new Paragraph({
          children: [
            run(`${entry.number}  `, { size: 18 }),
            run(entry.title, { size: 18 }),
          ],
          spacing: { after: 60 },
        }),
      );
    }
  }

  // ---- 1 ----
  children.push(sectionHeading("1.", "Instructions and Purpose of Valuation"));
  push(
    children,
    factsTable(
      draft,
      ["prop_assignment", "prop_rights"],
      [
        { label: "Date of inspection", value: m.inspectionDate },
        { label: "Date of valuation", value: m.valueDate },
      ],
    ),
  );
  children.push(p(BOILERPLATE.natureOfInterest));

  // ---- 2 ----
  children.push(sectionHeading("2.", "Property Details"));
  push(
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

  // ---- 3 ----
  children.push(sectionHeading("3.", "Statutory Information"));
  push(
    children,
    factsTable(draft, [
      "prop_lga",
      "prop_site_value",
      "prop_sv_date",
      "prop_offered",
      "prop_offer_details",
      "prop_contract_price",
      "prop_contract_date",
      "prop_seller_owner",
      "prop_assistance",
      "prop_assistance_details",
    ]),
  );

  // ---- 4 ----
  children.push(sectionHeading("4.", "Town Planning"));
  push(children, factsTable(draft, ["prop_zoning", "prop_zoning_desc", "prop_zoning_comp", "prop_hbu"]));
  children.push(p(BOILERPLATE.townPlanningConsent));
  children.push(subHeading("Development potential"));
  children.push(p(BOILERPLATE.developmentPotential));
  await pushInlineMap(children, draft, "map_zoning", "Zones");

  // ---- 5 ----
  children.push(sectionHeading("5.", "Location and Neighbourhood"));
  {
    const locationText =
      (draft.narrative.location && draft.narrative.location.trim()) ||
      get(v, "nbhd_description");
    if (locationText) children.push(...prose(locationText));
  }
  if (get(v, "nbhd_market_conditions")) children.push(...prose(get(v, "nbhd_market_conditions")));
  push(
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
    children.push(subHeading("Off-site improvements"));
    children.push(offsite);
  }
  // 5.2-style locality map (manual)
  await pushInlineMap(children, draft, "map_location", "Property location");

  // ---- 6 ----
  children.push(sectionHeading("6.", "Site Details"));
  children.push(subHeading("6.1  Physical Description"));
  push(
    children,
    factsTable(
      draft,
      ["prop_dimensions", "prop_orientation", "prop_shape", "topo", "land", "va", "fence", "exc", "prop_view"],
      siteArea ? [{ label: labelFor("prop_sitearea"), value: siteArea }] : [],
    ),
  );
  await pushInlineMap(children, draft, "map_aerial", "Aerial view of subject site", {
    width: 460,
    height: 320,
  });
  await pushInlineMap(children, draft, "map_site_dimensions", "Site dimensions");

  const services = factsTable(draft, [
    "svc_water_type",
    "svc_sewer_type",
    "svc_elec_type",
    "svc_storm_type",
    "svc_tel_type",
    "svc_internet_type",
    "svc_gas_type",
  ]);
  children.push(subHeading("6.2  Services/Amenities"));
  if (services) children.push(services);
  else children.push(p("—"));

  children.push(subHeading("6.3  Flood Inquiry"));
  {
    const flood = get(v, "prop_flood");
    const floodMap = get(v, "prop_flood_map");
    if (flood === "Yes") {
      children.push(
        p(
          `The property is subject to flood hazard${floodMap ? ` (${floodMap})` : ""}.`,
        ),
      );
    } else if (flood === "No") {
      children.push(p("The property is not subject to flood."));
    } else if (flood) {
      children.push(p(flood));
    } else {
      children.push(p("—"));
    }
  }
  await pushInlineMap(children, draft, "map_flood", "Flood hazard map");

  children.push(subHeading("6.4  Bushfire Hazard"));
  await pushInlineMap(children, draft, "map_bushfire", "Bushfire hazard map");

  {
    const overlays = parseOverlayList(get(v, "prop_adverse_site"));
    const hasOverlayAnnexMaps = draft.photos.some(
      (ph) => (ph.slot === "map_overlays" || ph.slot === "map_landslide") && ph.url,
    );
    const annexRef =
      "Refer to Annexure 3 — Maps & planning layers for the associated mapping.";
    children.push(subHeading("6.5  Overlays"));
    if (overlays.length === 0) {
      children.push(p("No planning overlays recorded for the subject."));
    } else {
      for (const name of overlays) {
        children.push(
          new Paragraph({
            children: [run(`•  ${name}`, { size: 20 })],
            spacing: { after: 80, before: 0, line: 276 },
          }),
        );
      }
    }
    if (hasOverlayAnnexMaps) {
      children.push(p(annexRef));
    }
  }

  children.push(subHeading("Encroachments"));
  children.push(p(BOILERPLATE.encroachments));

  // ---- 7 ----
  children.push(sectionHeading("7.", "Improvements"));
  if (draft.narrative.improvements.trim()) {
    children.push(subHeading("7.1  General description"));
    children.push(...prose(draft.narrative.improvements));
  }
  push(
    children,
    factsTable(draft, [
      "imp_design",
      "imp_storeys",
      "imp_yearbuilt",
      "imp_effage",
      "imp_quality",
      "ext",
      "rc",
      "rd",
      "foundations",
      "floor_structure",
      "flr",
      "il",
      "ceil",
      "vent",
      "imp_gla",
      "imp_add_features",
    ]),
  );
  const kitBathNotes = [get(v, "kit_overall_notes"), get(v, "bath_overall_notes")].filter(Boolean);
  const kitBathFacts = factsTable(draft, [
    "kit_bench_type",
    "kit_cab_type",
    "kit_splash_type",
    "bath_vanity_type",
    "bath_tiles_type",
    "bath_tapware_type",
  ]);
  if (kitBathNotes.length || kitBathFacts) {
    children.push(subHeading("7.2  Kitchen and bathrooms"));
    for (const n of kitBathNotes) children.push(...prose(n));
    push(children, kitBathFacts);
  }
  children.push(subHeading("7.3  Condition of improvements"));
  push(children, factsTable(draft, ["overall_cond", "overall_site_cond"]));
  children.push(p(BOILERPLATE.conditionOfImprovements));

  // ---- 8 ----
  children.push(sectionHeading("8.", "Accommodation – Fixtures and Fittings"));
  if (draft.narrative.accommodation.trim()) children.push(...prose(draft.narrative.accommodation));
  push(children, factsTable(draft, ["imp_rooms", "imp_beds", "imp_baths", "accom", "park", "anc"]));

  // ---- 9 ----
  children.push(sectionHeading("9.", "Improvements – Other Valuation Issues"));
  children.push(subHeading("Encroachments"));
  children.push(p(BOILERPLATE.encroachments));
  children.push(subHeading("Condition of improvements"));
  children.push(p(BOILERPLATE.conditionOfImprovements));
  children.push(subHeading("Development potential"));
  children.push(p(BOILERPLATE.developmentPotential));
  push(children, factsTable(draft, ["other_notes", "defects_notes", "overall_site_cond"]));

  // ---- 10 ----
  children.push(sectionHeading("10.", "Environmental Matters"));
  children.push(p(BOILERPLATE.contaminatedLand));
  children.push(p(BOILERPLATE.heritageListing));
  children.push(p(BOILERPLATE.vegetationProtection));
  children.push(p(BOILERPLATE.asbestos));
  push(children, factsTable(draft, ["prop_flood", "prop_flood_map", "prop_adverse_site"]));

  // ---- 11 ----
  children.push(sectionHeading("11.", "Basis of Valuation"));
  children.push(subHeading("Direct Comparison"));
  children.push(p(BOILERPLATE.directComparisonIntro));
  for (const line of BOILERPLATE.directComparisonBody) children.push(p(line));
  for (const f of BOILERPLATE.directComparisonFactors) {
    children.push(p(`• ${f}`, { after: 40 }));
  }
  children.push(p(BOILERPLATE.directComparisonClose));
  children.push(p(BOILERPLATE.addedValue));

  // ---- 12 ----
  children.push(sectionHeading("12.", "Sales Evidence"));
  const sales = draft.sales.filter(
    (s) => s.address.trim() || s.salePrice.trim() || s.saleDate.trim(),
  );
  if (sales.length === 0) {
    children.push(p("No comparable sales have been recorded for this report."));
  } else {
    // Sales map (from CMA "Map: Sales" page)
    if (draft.reportMeta.salesMapUrl) {
      const mapImg = await imageFromUrl(draft.reportMeta.salesMapUrl);
      if (mapImg) {
        children.push(p("Sales map", { bold: true, after: 80 }));
        // Portrait map — fit width, reasonable height
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: mapImg.data,
                type: mapImg.type,
                // Pixel display size in the document (portrait map)
                transformation: { width: 400, height: 500 },
                altText: {
                  title: "Sales map",
                  description: "Comparable sales map",
                  name: "sales-map",
                },
              }),
            ],
            spacing: { after: 200 },
          }),
        );
      }
    }

    // Table matching Preview columns
    const colW = [
      Math.floor(CONTENT_WIDTH * 0.28),
      Math.floor(CONTENT_WIDTH * 0.14),
      Math.floor(CONTENT_WIDTH * 0.14),
      Math.floor(CONTENT_WIDTH * 0.14),
      Math.floor(CONTENT_WIDTH * 0.3),
    ];
    const headers = ["Address", "Sale date", "Sale price", "Land area", "Comments"];
    const headerRow = new TableRow({
      children: headers.map(
        (h, i) =>
          new TableCell({
            width: { size: colW[i], type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: "333333" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
            },
            children: [
              new Paragraph({
                children: [run(h, { bold: true, size: 16 })],
                spacing: { after: 40 },
              }),
            ],
          }),
      ),
    });
    const bodyRows = sales.map(
      (s) =>
        new TableRow({
          children: [s.address, s.saleDate, s.salePrice, s.landArea, cleanSaleProse((s.narrative && s.narrative.trim()) || s.comments || "")].map(
            (cell, i) =>
              new TableCell({
                width: { size: colW[i], type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
                },
                children: [
                  new Paragraph({
                    children: [run(cell || "—", { size: 16 })],
                    spacing: { after: 40 },
                  }),
                ],
              }),
          ),
        }),
    );
    // Sales map above the table content order: map → table → front photos
    // (map is pushed before the table when present)
    children.push(
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: colW,
        rows: [headerRow, ...bodyRows],
      }),
    );

    // Front elevation photos (one per comparable with photoUrl)
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i]!;
      if (!s.photoUrl) continue;
      const img = await imageFromUrl(s.photoUrl);
      if (!img) continue;
      children.push(
        p(`Comparable ${i + 1}${s.address ? ` — ${s.address}` : ""}`, {
          bold: true,
          after: 80,
          before: 200,
        }),
      );
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: img.data,
              type: img.type,
              transformation: { width: 420, height: 280 },
              altText: {
                title: s.address || "Comparable front elevation",
                description: "Comparable sale front elevation",
                name: s.id,
              },
            }),
          ],
          spacing: { after: 160 },
        }),
      );
    }
  }

  // ---- 13 ----
  children.push(sectionHeading("13.", "Remarks"));
  children.push(...prose(draft.narrative.remarks || BOILERPLATE.remarksDefault));

  // ---- 14 ----
  children.push(sectionHeading("14.", "Limitations"));
  children.push(p(BOILERPLATE.assumptionsAndLimitations));
  for (const l of BOILERPLATE.limitations) children.push(p(l));

  // ---- 15 ----
  children.push(sectionHeading("15.", "Critical Assumptions"));
  children.push(p(BOILERPLATE.criticalAssumptionsIntro));
  BOILERPLATE.criticalAssumptions.forEach((a, i) => {
    children.push(p(`${i + 1}. ${a}`));
  });
  children.push(p(BOILERPLATE.criticalAssumptionsClose));

  // ---- 16 ----
  children.push(sectionHeading("16.", "Valuation Statement"));
  children.push(
    p(
      `Having regard to the foregoing, I am of the opinion that the market value of the unencumbered fee simple interest in the subject property${addr ? `, ${addr},` : ""} as at ${m.valueDate || "the date of valuation"} is:`,
    ),
  );
  if (m.valueAmount) {
    children.push(p(`$${formatCurrencyDisplay(m.valueAmount)}`, { center: true, bold: true, size: 28, before: 160, after: 160 }));
  }
  children.push(p(m.valuerName || get(v, "insp_valuer") || "", { bold: true, after: 40, before: 200 }));
  if (get(v, "sign_member")) children.push(p(get(v, "sign_member"), { size: 18, after: 40 }));
  children.push(p(m.firmName || get(v, "insp_firm") || "Peterson Property Valuations Pty Ltd", { size: 18, after: 40 }));
  for (const a of BOILERPLATE.annexures) {
    children.push(p(a, { size: 18, after: 40 }));
  }

  // ---- Annexures: subject photos, maps, comparable photos (omit empty) ----
  const subjectPhotos = [
    ...PHOTO_SLOTS.map(({ slot, label }) => {
      const found = draft.photos.find((ph) => ph.slot === slot && ph.url);
      return found ? { ...found, caption: found.caption || label } : null;
    }).filter(Boolean),
    ...draft.photos.filter((ph) => ph.slot === null && ph.url && ph.kind !== "map"),
  ] as typeof draft.photos;

  // Overlay / landslide maps are annex-only; zoning, flood & bushfire stay in body.
  const bodyMapSlotSet = new Set([
    "map_location",
    "map_aerial",
    "map_site_dimensions",
    "map_zoning",
    "map_flood",
    "map_bushfire",
  ]);
  const mapPhotos = [
    ...MAP_SLOTS.map(({ slot, label }) => {
      if (bodyMapSlotSet.has(slot)) return null;
      const found = draft.photos.find((ph) => ph.slot === slot && ph.url);
      return found ? { ...found, caption: found.caption || label } : null;
    }).filter(Boolean),
    ...draft.photos.filter((ph) => ph.slot === null && ph.kind === "map" && ph.url),
  ] as typeof draft.photos;

  const salesWithPhotos = draft.sales.filter((s) => s.photoUrl);

  async function pushImageAnnex(
    photo: { id: string; url: string; caption?: string; slot?: string | null },
    opts?: { width?: number; height?: number },
  ) {
    const img = await imageFromUrl(photo.url);
    if (!img) return;
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: img.data,
            type: img.type,
            transformation: {
              width: opts?.width ?? 480,
              height: opts?.height ?? 360,
            },
            altText: {
              title: photo.caption || "Image",
              description: photo.caption || "Report image",
              name: photo.id,
            },
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 60 },
      }),
    );
    children.push(p(photo.caption || "Image", { center: true, size: 18, after: 200 }));
  }

  if (subjectPhotos.length > 0 || salesWithPhotos.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(p("Annexure 2 — Photographs", { center: true, bold: true, size: 26, after: 240 }));
    for (const photo of subjectPhotos) {
      await pushImageAnnex(photo, { width: 420, height: 315 });
    }
    if (salesWithPhotos.length > 0) {
      children.push(
        p("Comparable sales — front elevations", {
          center: true,
          bold: true,
          size: 20,
          before: 280,
          after: 160,
        }),
      );
      for (let i = 0; i < draft.sales.length; i++) {
        const s = draft.sales[i]!;
        if (!s.photoUrl) continue;
        await pushImageAnnex(
          {
            id: s.id,
            url: s.photoUrl,
            caption: `Comparable ${i + 1}${s.address ? ` — ${s.address}` : ""}`,
          },
          { width: 480, height: 320 },
        );
      }
    }
  }

  if (mapPhotos.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      p("Annexure 3 — Maps & planning layers", { center: true, bold: true, size: 26, after: 240 }),
    );
    for (const photo of mapPhotos) {
      await pushImageAnnex(photo, { width: 500, height: 375 });
    }
  }

  const placeBased = get(v, "prop_place_based")?.trim();
  if (placeBased) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      p("Annexure 4 — Place-based plans", { center: true, bold: true, size: 26, after: 240 }),
    );
    for (const para of placeBased.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
      children.push(p(para, { size: 18, after: 120 }));
    }
    await pushInlineMap(children, draft, "map_place_based", "Place-based plans map", {
      width: 500,
      height: 375,
    });
  }

  const doc = new Document({
    creator: m.firmName || "Peterson Property Valuations",
    title: addr ? `Valuation — ${addr}` : "Valuation Report",
    description: "Queensland residential valuation report",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 20 },
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
          run: { font: "Arial", size: 22, bold: true },
          paragraph: { spacing: { before: 280, after: 140 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
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
