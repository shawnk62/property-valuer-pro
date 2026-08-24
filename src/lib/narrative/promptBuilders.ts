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

/** Stamp Duty reports use shorter prose (match Peterson sample style). */
function brevityHint(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("stamp duty")) {
    return (
      "\nThis is a Stamp Duty valuation: prefer concise wording. " +
      "Avoid long marketing-style descriptions. One tight paragraph is usually enough."
    );
  }
  return "";
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

const BASE_RULES = `
You are writing formal valuation narrative for a Queensland Registered Valuer's report.
Write in plain, professional English suitable for inclusion in a valuation report.
Describe only what is recorded in the inspection data. Do not invent measurements, materials, values, or conditions.
If a detail is not recorded, omit it rather than guess.
Use third-person, objective tone. Avoid marketing language.
Output a single paragraph unless the data clearly supports two short paragraphs.
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
        system: BASE_RULES + brevityHint(type),
        prompt: `Write section 5.1 "Description of Neighbourhood" for a ${type} valuation report (QLD / Peterson style).

Inspection data (neighbourhood / location):
${sectionAnswers(values, ["1A", "1"])}

Requirements:
- One short professional paragraph (Stamp Duty: 1–2 sentences; other types: up to 4 short sentences).
- Describe the locality, surrounding development, and neighbourhood character from the recorded answers only.
- If a free-text Neighbourhood Description is present, refine it into report prose without inventing facts.
- Do not invent amenities, distances, or land uses that are not in the data.
- Do not include the street address sentence (that belongs in 5.2 Property Location).
- Plain valuation English; no marketing language.`,
      };
    case "brief":
      return {
        system: BASE_RULES + brevityHint(type),
        prompt: `Write a BRIEF DESCRIPTION for the valuation summary page of a ${type} report.

Inspection data:
${sectionAnswers(values, ["1", "2", "3", "6"])}

Requirements:
- One or two short sentences only.
- Include dwelling type/style, key construction if recorded, bedroom/bathroom counts if recorded, and site area if recorded.
- Do not write a full improvements essay.
- Suitable to appear under "BRIEF DESCRIPTION" on a valuation summary.`,
      };
    case "servicesAmenities":
      return {
        system: BASE_RULES + brevityHint(type),
        prompt: `Write section 6.2 "Services/Amenities" for a ${type} valuation report (QLD residential).

Inspection data (site services — use these TYPE values verbatim as the service names):
${siteServicesAnswers(values)}

Requirements:
- One short professional paragraph (typically 1–3 sentences).
- You MUST list each recorded service TYPE that is not Nil / Not applicable (e.g. if Water Supply — Type is "Town water", write "town water"; if Sewerage — Type is "Sewer", write "sewer"; if Electricity — Type is "Mains power only", write "mains power only").
- Do NOT write category labels with the type in parentheses (never "water (town water)"). Prefer "The property is connected to town water, sewer, and mains power only".
- Do NOT use generic wording such as "usual urban services" when any specific TYPE is recorded above.
- Omit services marked Nil or Not applicable.
- Do not invent connections, capacities, or providers not in the data.
- Only if the inspection data section above is exactly "No specific details recorded." may you use a single generic sentence about usual urban services.
- Plain valuation English; no marketing language.`,
      };
    case "improvements":
      return {
        system: BASE_RULES + brevityHint(type),
        prompt: `Write the "Improvements — General Description" paragraph (report section 7.1) for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["3", "special_design", "6"])}

Describe construction, materials, roof, foundations, approximate era if recorded, and overall condition. Stay factual. Do not invent floor areas or features not in the data.`,
      };
    case "accommodation":
      return {
        system: BASE_RULES + brevityHint(type),
        prompt: `Write the "Accommodation — Fixtures and Fittings" narrative (report section 8) for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["3", "3A", "5"])}

Cover rooms/layout as recorded, floor coverings, climate control, kitchen/bathroom notes if present, car accommodation, and ancillary items. Do not treat verandahs or outdoor areas as primary rooms. Omit empty topics.`,
      };
    case "remarks":
      return {
        system: BASE_RULES + brevityHint(type),
        prompt: `Write the Remarks paragraph (report section 13) for a ${type} valuation report.

Inspection data:
${sectionAnswers(values, ["6"])}

Include only recorded notes, defects, or qualifications. If little is recorded, write one short professional sentence that the valuation assumes information disclosed by the client and that a full schedule of limitations applies. Do not invent defects.`,
      };
    default:
      return {
        system: BASE_RULES,
        prompt: `Write a narrative paragraph for the ${blockKey} section of a ${type} valuation report.

Inspection data:
${sectionAnswers(values, [])}`,
      };
  }
}
