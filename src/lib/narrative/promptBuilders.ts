import { sections } from "@/lib/inspection/schema";
import type { InspectionValues } from "@/lib/inspection/types";

export interface BlockPrompt {
  system: string;
  prompt: string;
}

function assignmentType(values: InspectionValues): string {
  const v = values["prop_assignment"];
  return typeof v === "string" ? v : "valuation report";
}

function sectionAnswers(values: InspectionValues, sectionIds: string[]): string {
  const relevant = sections.filter((s) => sectionIds.includes(s.id));
  const lines: string[] = [];
  for (const section of relevant) {
    for (const field of section.fields) {
      const v = values[field.name];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      const display = Array.isArray(v) ? v.join(", ") : String(v);
      lines.push(`${field.label}: ${display}`);
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
    default:
      return {
        system: BASE_RULES,
        prompt: `Write a narrative paragraph for the ${blockKey} section of a ${type} valuation report.

Inspection data:
${sectionAnswers(values, [])}`,
      };
  }
}
