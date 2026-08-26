import { fieldKeys, labelForField, sections } from "@/lib/inspection/schema";
import type { InspectionField, InspectionValues } from "@/lib/inspection/types";

export interface BlockPrompt {
  system: string;
  prompt: string;
}

function assignmentType(values: InspectionValues): string {
  const v = values["prop_assignment"];
  return typeof v === "string" ? v : "valuation report";
}

/**
 * Style guide by report type — aligned to issued Peterson samples.
 * Stamp Duty – Murray (Bassett Road sample): moderate detail, factual multi-sentence
 * paragraphs, "subject property / subject allotment" openings, no marketing language.
 * Stamp Duty – Phil: tighter / more compact.
 * CGT: fuller comparison detail.
 */
function styleGuide(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("murray") && t.includes("stamp")) {
    return `
This is a Stamp Duty – Murray valuation. Match Murray Peterson sample style (e.g. Bassett Road stamp duty reports):
- Length: moderate — typically 2–5 sentences per block, or 2–3 short paragraphs for the summary description.
- Openings: prefer "The subject property…", "The subject allotment…", "This is predominantly…".
- Use "allotment" for the subject site (not "lot"), except in fixed legal phrases.
- Include concrete recorded facts (beds/baths, materials, age, ancillary counts, shape, position, topography, orientation, flood where recorded).
- Plain Australian valuation English. Short direct sentences. No marketing language.
- Do not invent facts. Omit unrecorded detail.`;
  }
  if (t.includes("murray") && (t.includes("family") || t.includes("singly"))) {
    return `
This is a Family Law – Murray valuation (Singly Appointed Family Law Matter). Match Murray Peterson sample style (e.g. Woodcliffe Crescent / unit family-law reports):
- Length: moderate detail — summary DESCRIPTION is typically 2–3 short paragraphs.
- Unit/strata: open with "The subject property is a [beds] bedroom, [baths] bathroom unit located in '[complex]'…" including storeys, unit count, level/tower, and complex features (pool, lift, secure parking) when recorded.
- Building construction paragraph: walls, roof, foundations, levels of accommodation, car parking, lift — only as recorded.
- Parent allotment paragraph: "The subject parent allotment is a [area] [shape] [inside/corner] allotment which faces [orientation]…" plus retaining/topography if recorded.
- Neighbourhood: short (1–3 sentences). Services: one compact sentence.
- Prefer "allotment" / "parent allotment" for site. Plain Australian valuation English. No marketing language. Do not invent facts.`;
  }
  if (t.includes("murray") && t.includes("cgt")) {
    return `
This is a CGT – Murray valuation (including retrospective). Match Murray Peterson CGT sample style (e.g. Gower Street Holland Park West):
- Summary DESCRIPTION: typically TWO short paragraphs only —
  (1) "The subject property is a [set] [materials] dwelling with X bedrooms and Y bathrooms. The dwelling was constructed circa [year]."
  (2) "The subject allotment is a [area] [shape] [inside/corner] allotment which faces [orientation]. [Topography / retaining / crossfall if recorded]."
- Neighbourhood: 1–3 short sentences. Site physical: same density as paragraph 2 above.
- Services: one compact sentence. Condition: 1–2 short sentences.
- Sales comments: detailed comparison paragraphs (3–6 sentences) as for CGT.
- Prefer "The subject property…" / "The subject allotment…". Use "allotment" for the site. Plain valuation English. No marketing language. Do not invent facts.`;
  }
  if (t.includes("murray")) {
    return `
This is a Murray Peterson valuation report. Match Murray sample tone (Bassett Road / Woodcliffe Crescent / Gower Street samples):
- Factual, moderately detailed Australian valuation English (2–5 sentences per block; summary description typically 2 short paragraphs for suburban houses, 2–3 for complex/unit).
- Prefer "The subject property…" / "The subject allotment…" / "The subject parent allotment…" openings.
- Use "allotment" for the subject site. Include recorded facts only. No marketing language.`;
  }
  if (t.includes("stamp duty")) {
    return `
This is a Stamp Duty – Phil valuation: prefer concise wording.
Avoid long marketing-style descriptions. One tight paragraph is usually enough.`;
  }
  if (t.includes("cgt")) {
    return `
This is a CGT / full valuation report: allow fuller comparison detail where the data supports it.
Plain valuation English; short sentences preferred over long compounds.`;
  }
  return "";
}

/** @deprecated use styleGuide — kept as alias for any residual calls */
function brevityHint(type: string): string {
  return styleGuide(type);
}

function formatValueLine(label: string, raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return `${label}: ${raw.map(String).join(", ")}`;
  }
  if (typeof raw === "boolean") {
    return raw ? `${label}: Yes` : null;
  }
  const s = String(raw).trim();
  if (!s || s === "Select" || s === "—") return null;
  return `${label}: ${s}`;
}

/**
 * Collect filled answers for the given schema sections.
 * Walks single_row children and checkbox_group keys (not only the parent name),
 * so values like svc_water_type are included for AI prompts.
 */
function sectionAnswers(values: InspectionValues, sectionIds: string[]): string {
  const relevant = sections.filter((s) => sectionIds.includes(s.id));
  const lines: string[] = [];
  for (const section of relevant) {
    for (const field of section.fields as InspectionField[]) {
      for (const key of fieldKeys(field)) {
        const label =
          field.type === "single_row"
            ? labelForField(key)
            : key === field.name
              ? field.label
              : labelForField(key);
        const line = formatValueLine(label, values[key]);
        if (line) lines.push(line);
      }
    }
  }
  return lines.length ? lines.join("\n") : "No specific details recorded.";
}

/** Explicit site-services lines for §6.2 (always prefers *_type values). */
function siteServicesAnswers(values: InspectionValues): string {
  const keys = [
    "svc_water_type",
    "svc_sewer_type",
    "svc_elec_type",
    "svc_elec_3phase",
    "svc_gas_type",
    "svc_storm_type",
    "svc_tel_type",
    "svc_internet_type",
  ] as const;
  const lines: string[] = [];
  for (const key of keys) {
    const line = formatValueLine(labelForField(key), values[key]);
    if (line) lines.push(line);
  }
  // Also include any other filled section-2 answers (topography, access, etc.)
  const rest = sectionAnswers(values, ["2"]);
  if (rest !== "No specific details recorded.") {
    for (const line of rest.split("\n")) {
      if (!lines.includes(line)) lines.push(line);
    }
  }
  return lines.length ? lines.join("\n") : "No specific details recorded.";
}

/**
 * Component condition ratings + notes for §9.2 Condition of Improvements.
 * Prefer keys ending in _cond / _notes and overall/defects fields.
 */
function conditionOfImprovementsAnswers(values: InspectionValues): string {
  const sectionIds = ["3", "special_design", "3A", "4", "4A", "5", "6"];
  const relevant = sections.filter((s) => sectionIds.includes(s.id));
  const conditionLines: string[] = [];
  const noteLines: string[] = [];
  const otherLines: string[] = [];

  for (const section of relevant) {
    for (const field of section.fields as InspectionField[]) {
      for (const key of fieldKeys(field)) {
        const label =
          field.type === "single_row"
            ? labelForField(key)
            : key === field.name
              ? field.label
              : labelForField(key);
        const line = formatValueLine(label, values[key]);
        if (!line) continue;
        if (/_cond$/i.test(key) || /condition/i.test(label)) {
          conditionLines.push(line);
        } else if (
          /_notes$/i.test(key) ||
          /notes/i.test(label) ||
          key === "defects_notes" ||
          key === "other_notes" ||
          key === "kit_overall_notes" ||
          key === "bath_overall_notes" ||
          key === "design_features_notes"
        ) {
          noteLines.push(line);
        } else if (
          key === "overall_cond" ||
          key === "overall_site_cond" ||
          key === "imp_quality" ||
          key === "imp_effage"
        ) {
          otherLines.push(line);
        }
      }
    }
  }

  const blocks: string[] = [];
  if (otherLines.length) {
    blocks.push("Overall ratings:\n" + otherLines.join("\n"));
  }
  if (conditionLines.length) {
    blocks.push("Component condition ratings:\n" + conditionLines.join("\n"));
  }
  if (noteLines.length) {
    blocks.push("Section notes / defects:\n" + noteLines.join("\n"));
  }
  return blocks.length ? blocks.join("\n\n") : "No specific details recorded.";
}

const BASE_RULES = `
You are writing formal valuation narrative for a Queensland Registered Valuer's report (Peterson Property Valuations style).
Write in plain, professional Australian valuation English suitable for inclusion in the report.
Describe only what is recorded in the inspection data. Do not invent measurements, materials, values, or conditions.
If a detail is not recorded, omit it rather than guess.
Use third-person, objective tone. Avoid marketing language.
Follow any report-type style guide appended below for length and phrasing.
`.trim();

export function buildBlockPrompt(
  blockKey: string,
  values: InspectionValues,
): BlockPrompt {
  const type = assignmentType(values);

  switch (blockKey) {
    case "location":
      return {
        system: BASE_RULES,
        prompt: `Write a "Location & Neighbourhood" paragraph for a ${type} valuation report of the subject property.

Inspection data:
${sectionAnswers(values, ["1", "1A"])}

Describe the locality, surrounding uses, and any neighbourhood characteristics recorded. Keep it factual and concise.`,
      };
    case "site":
      return {
        system: BASE_RULES,
        prompt: `Write a "Site Details" paragraph for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["2"])}

Describe the site, topography, access, services to the site, and any site-specific features recorded.`,
      };
    case "improvements-construction":
      return {
        system: BASE_RULES,
        prompt: `Write an "Improvements — Construction" paragraph for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["3"])}

Describe the construction of the dwelling, roof, walls, foundations, and any special construction features recorded.`,
      };
    case "improvements-internal":
      return {
        system: BASE_RULES,
        prompt: `Write an "Improvements — Internal" paragraph for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["3A"])}

Describe the internal layout, rooms, finishes, kitchen, bathrooms, and any internal features recorded.`,
      };
    case "services":
      return {
        system: BASE_RULES,
        prompt: `Write a "Building Services" paragraph for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["4"])}

Describe the services recorded (power, water, sewer, heating/cooling, etc.) and their condition if noted.`,
      };
    case "external":
      return {
        system: BASE_RULES,
        prompt: `Write an "External Areas & Ancillary" paragraph for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["5"])}

Describe external areas, outbuildings, fencing, driveways, landscaping, pools, and ancillary improvements recorded.`,
      };
    case "overall":
      return {
        system: BASE_RULES,
        prompt: `Write an "Overall Condition & Remarks" paragraph for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["6"])}

Summarise the overall condition and any final remarks or qualifications recorded.`,
      };

    /* ---- Report workspace narrative blocks (Narrative tab) ---- */
    case "location":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write section 5.1 "Description of Neighbourhood" for a ${type} valuation report (QLD / Peterson style).

Inspection data (neighbourhood / location):
${sectionAnswers(values, ["1A"])}

Murray Stamp Duty sample style: often one short sentence, e.g. "This is predominantly a rural residential precinct." Expand only with recorded neighbourhood character, built-up, growth, demand or boundaries — still keep it short (1–3 sentences).
Phil Stamp Duty: one tight sentence or two.
Do not invent facts.`,
      };
        case "brief":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write the DESCRIPTION / brief for the valuation summary page of a ${type} report.

Inspection data:
${sectionAnswers(values, ["1", "2", "3", "5", "6"])}

When type includes Murray, match Murray sample structure and density:

CGT – Murray (Gower Street sample) — prefer TWO short paragraphs:
Paragraph 1 — "The subject property is a [set] [materials] dwelling with X bedrooms and Y bathrooms. The dwelling was constructed circa [year]."
Paragraph 2 — "The subject allotment is a [area] [shape] [inside/corner] allotment which faces [orientation]. [Benching / retaining / crossfall if recorded]."

House / rural Stamp Duty – Murray (Bassett Road): up to 3 paragraphs (improvements; ancillary; allotment).

Unit / strata Family Law – Murray (Woodcliffe Crescent): unit in complex; building construction; parent allotment.

For Phil Stamp Duty: keep to one tight paragraph.
Use "allotment" / "parent allotment" for the site. Do not invent facts.`,
      };
        case "sitePhysical":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write section 6.1 "Physical Description" of the subject allotment for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["1", "2"])}

Murray sample pattern (use when type includes Murray):
"The subject allotment is a [area] [shape] [inside/corner] allotment which faces [orientation]. [Topography sentence]. [Boundary / flood / creek only if recorded]."
Typically 2–4 short sentences. Use "allotment" not "lot". Include allotment shape, lot position, topography, dimensions/orientation and site area when recorded. Do not invent facts.`,
      };
        case "servicesAmenities":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write section 6.2 "Services/Amenities" for a ${type} valuation report.

Site services recorded:
${siteServicesAnswers(values)}

Murray sample style: one short factual sentence listing available services, e.g. "Tank water, electricity, septic sewerage and telephone are available."
Use plain service names (town water, sewer, mains power) without parenthetical labels.
Do not invent services.`,
      };
        case "improvements":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write the general improvements description for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["3", "4", "5"])}

Murray sample density: factual sentences covering set/level, wall/roof materials, bedroom/bathroom counts, age if recorded, secondary accommodation or pool if recorded. Then ancillary ground improvements if recorded (sheds, tanks, fencing, paddocks, etc.). Prefer "The subject property improvements consist of…".
Do not invent facts.`,
      };
        case "accommodation":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write the accommodation narrative for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["3", "4"])}

Murray sample style: short factual sentences — rooms, kitchen/living layout, built-ins, HVAC, outdoor areas only as recorded. Moderate detail, not a room-by-room inventory unless data is rich.
Do not invent facts.`,
      };
        case "conditionImprovements":
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write section 9.2 / condition of improvements for a ${type} valuation report.

Inspection data:
${conditionOfImprovementsAnswers(values)}

Murray sample style: 1–2 short sentences, e.g. "The subject property appears to be in good condition with a level of wear and tear to be expected given the age of the improvements." Reflect overall_cond and component notes only; do not invent defects or engineering conclusions.`,
      };
    case "remarks": {
      const isPhil = type.toLowerCase().includes("phil");
      if (isPhil) {
        const pool = formatValueLine("Pool", values["pool"]);
        const land = formatValueLine("Landscaping", values["land"]);
        const fence = formatValueLine("Fencing", values["fence"]);
        const other = formatValueLine("Other notes", values["other_notes"]);
        const defects = formatValueLine("Defects", values["defects_notes"]);
        const overall = formatValueLine(
          "Overall condition",
          values["overall_cond"],
        );
        const groundBits = [pool, land, fence].filter(Boolean).join("\n");
        return {
          system: BASE_RULES + styleGuide(type),
          prompt: `Write section 13 Remarks for a ${type} (Phil / Peterson) valuation report.

You MUST produce paragraphs in this exact order (do not reorder, omit the required fixed lines, or invent facts):

1. Exactly this pattern, substituting the recorded overall condition of improvements (or "good" if not recorded): "The valuation assumes information disclosed by the client, with the overall condition of improvements recorded as {overall condition}, and a full schedule of limitations applies."
2. Exactly: "I recommend that a structural survey and pest inspection be obtained from suitably qualified professionals."
3. A brief property description in the same style as the valuation summary brief description (e.g. "The property comprises a lowset …"). Use only inspection facts below.
4. "The ground improvements include …" drawing only from pool, landscaping and fencing data when present. Skip this sentence if none are recorded.
5. "I have included N comparable sales." (Use singular "sale" if N is 1.) If sales count is unknown, omit this sentence.
6. "I assess the current value at $X." only if an assessed value is provided below; otherwise omit.
7. Any short notes/defects from the data (optional; do not invent).
8. Exactly at the end: "If the property is to be sold it should be offered for sale by Auction or Private Tender."

Inspection facts:
${sectionAnswers(values, ["2", "3", "4", "5", "6"])}
${overall ? overall + "\n" : ""}${groundBits ? groundBits + "\n" : ""}${other ? other + "\n" : ""}${defects ? defects + "\n" : ""}
Write plain professional valuation English. No marketing language. Do not invent structural conclusions.`,
        };
      }
      return {
        system: BASE_RULES + styleGuide(type),
        prompt: `Write the Remarks paragraph (report section 13) for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["6"])}

Include only recorded notes, defects, or qualifications. If little is recorded, write one short professional sentence that the valuation assumes information disclosed by the client and that a full schedule of limitations applies. Do not invent defects.`,
      };
    }
    default:
      return {
        system: BASE_RULES,
        prompt: `Write a narrative paragraph for the ${blockKey} section of a ${type} valuation report.

Inspection data:
${sectionAnswers(values, [])}`,
      };
  }
}
