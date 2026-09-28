/**
 * API PropertyPRO Supporting Memorandum risk ratings (1 low – 5 high).
 * Scores persist on the inspection record. Hints are floors, never auto-ticks.
 */

import type { InspectionValues } from "@/lib/inspection/types";
import { isVacantLand } from "@/lib/inspection/visibility";

export const RISK_SCALE = [
  { score: 1, label: "Low" },
  { score: 2, label: "Low to medium" },
  { score: 3, label: "Medium" },
  { score: 4, label: "Medium to high" },
  { score: 5, label: "High" },
] as const;

export type RiskScore = 1 | 2 | 3 | 4 | 5;

export type RiskCategoryId =
  | "location"
  | "land"
  | "environment"
  | "improvements"
  | "market_direction"
  | "volatility"
  | "local_economy"
  | "segment";

export interface RiskCategory {
  id: RiskCategoryId;
  field: string;
  heading: string;
  group: "property" | "market";
  purpose: string;
  criteria: Record<RiskScore, string[]>;
}

export const RISK_CATEGORIES: RiskCategory[] = [
  {
    id: "location",
    field: "risk_location",
    heading: "Location / Neighbourhood",
    group: "property",
    purpose:
      "Quality of the neighbourhood and location relative to amenities, including adverse features that affect marketability.",
    criteria: {
      1: [
        "Established locality with no adverse neighbourhood features recorded.",
        "Location relative to amenities and facilities is consistent with the market for this class of property.",
      ],
      2: [
        "Established locality with only minor adverse features (for example proximity to a main road, train line, moderate traffic noise, or similar).",
        "Any drawback is not expected to affect value or marketability.",
      ],
      3: [
        "Developing locality, or some adverse features in the immediate area.",
        "Known flood zone / water over the land that does not adversely affect existing improvements; storm-surge area; or overlays such as bushfire, flood, cyclone or mine-subsidence district may apply under this heading where they affect neighbourhood quality.",
        "Marketability may be narrower than a comparable lot without those features.",
      ],
      4: [
        "Significant adverse location or neighbourhood features.",
        "Saleability is constrained relative to the broader market.",
      ],
      5: [
        "Proximity to major industry, an isolated community, a poorly perceived location, or another extreme location risk.",
        "There is an important adverse issue that could have a major impact on current value or marketability.",
      ],
    },
  },
  {
    id: "land",
    field: "risk_land",
    heading: "Land (including planning & title)",
    group: "property",
    purpose:
      "Shape, title, easements, planning and whether the land can be used as assumed.",
    criteria: {
      1: [
        "Regular allotment, clear title, and zoning consistent with the assumed use.",
        "No material easement, encroachment or planning constraint recorded.",
      ],
      2: [
        "Minor title, shape or planning issues that are not expected to affect current marketability or value.",
      ],
      3: [
        "Some planning or title constraints a buyer would weigh (irregular or hatchet shape, easement, overlay, or similar).",
        "Characteristics of the land may require specialised construction techniques.",
      ],
      4: [
        "Significant constraints on use or title that affect marketability or value.",
        "Examples include known encumbrances or easements that adversely affect the land, access issues, existing-use rights only, or a NSW limited-title scenario.",
      ],
      5: [
        "Illegal use of the property, extremely difficult access, cultural or heritage constraints that prevent the assumed use, or adverse current or known future authority proposals.",
        "There is an important adverse title or planning issue for the client to consider before reliance on the report.",
      ],
    },
  },
  {
    id: "environment",
    field: "risk_environment",
    heading: "Environmental issues",
    group: "property",
    purpose:
      "Flood, bushfire, contamination, coastal and other environmental constraints.",
    criteria: {
      1: ["No environmental issues recorded at inspection."],
      2: [
        "Minor environmental notation that is not expected to affect current value or marketability.",
      ],
      3: [
        "Known overlay or flood / bushfire / cyclone / storm-surge notation that requires investigation or allowance.",
        "Previous site contamination rehabilitated, but restrictions on use may remain.",
      ],
      4: [
        "Significant environmental constraint likely to affect value, insurance or lending.",
      ],
      5: [
        "Known or suspected site contamination that has not been rehabilitated, evidence of soil contamination or radioactive material, a neighbouring polluting site, mining subsidence, or direct coastal erosion.",
        "There is an important adverse environmental issue for the client to consider before reliance on the report.",
      ],
    },
  },
  {
    id: "improvements",
    field: "risk_improvements",
    heading: "Improvements",
    group: "property",
    purpose:
      "Design, construction, condition and maintenance of improvements (or the absence of them on vacant land).",
    criteria: {
      1: [
        "Vacant land with no structural improvement risk, or improvements that appear sound with no material defects recorded.",
      ],
      2: ["Minor maintenance items only. No material structural issue recorded."],
      3: ["Age-related wear or some defects a buyer would allow for."],
      4: ["Significant defects affecting saleability or requiring substantial work."],
      5: [
        "Evidence of major structural faults, a dwelling that has been gutted, observable friable asbestos, or a unit development known to contain non-compliant cladding.",
        "Improvements cannot be assumed to be fit for the recorded use without further investigation.",
      ],
    },
  },
  {
    id: "market_direction",
    field: "risk_market_direction",
    heading: "Recent market direction (price)",
    group: "market",
    purpose:
      "Direction and magnitude of price movement over about the past 12 months and the likely near-term trend.",
    criteria: {
      1: [
        "Relates to the direction and strength of price movement over the previous 12 months in the market segment in which the subject is transacted.",
        "Markets appear stable, with no evidence of significant price movement.",
      ],
      2: ["Modest decline, or a consistent modest increase, over the previous 12 months."],
      3: ["Early signs of a larger rise or fall in the subject market segment."],
      4: ["Definite signs of a larger rise or fall over the previous 12 months."],
      5: [
        "Significant price increase or decrease that affects reliance on recent sales as evidence of current value.",
      ],
    },
  },
  {
    id: "volatility",
    field: "risk_volatility",
    heading: "Market volatility",
    group: "market",
    purpose:
      "Market activity for competing product in the segment in which the subject is transacted (API Market Activity).",
    criteria: {
      1: [
        "Supply and demand for competing product appear balanced.",
        "Price levels and saleability of the subject class are expected to remain stable.",
      ],
      2: ["Some evidence that sales of competing product in this segment are subject to variation."],
      3: ["Clear variability among competing product in the subject market."],
      4: ["Material variability in activity; saleability is less certain than a stable market."],
      5: ["Wide range of competing outcomes; saleability is uncertain."],
    },
  },
  {
    id: "local_economy",
    field: "risk_local_economy",
    heading: "Local / regional economy impact",
    group: "market",
    purpose: "Dependence of the local economy on particular industries or employers.",
    criteria: {
      1: [
        "Local or regional economy (population, employment and services) appears stable.",
        "The economy is broad based and not reliant on one or two major industries.",
      ],
      2: ["Normal seasonal fluctuation in the local or regional economy only."],
      3: [
        "Above-average seasonal fluctuation, or evidence of softening in the local or regional economy.",
      ],
      4: [
        "Significant fluctuations in the local or regional economy (for example mining, rural or drought-exposed industries).",
        "The economy is not broad based and is reliant on one or two major industries.",
      ],
      5: [
        "Significant decline evident in the local or regional economy, or another extreme economic risk.",
      ],
    },
  },
  {
    id: "segment",
    field: "risk_segment",
    heading: "Market segment conditions",
    group: "market",
    purpose: "Demand and supply for this class of property in this locality.",
    criteria: {
      1: [
        "Readily saleable property with an expected selling period of about six weeks.",
        "Demand is underpinned by the owner-occupier market.",
        "Assessed value is supported by sales evidence within the past six months.",
      ],
      2: [
        "Expected marketing period of up to three months.",
        "Assessed value is supported by sales evidence within the last six months.",
      ],
      3: [
        "Expected marketing period of up to six months.",
        "Limited sales evidence within the last six months that supports the assessed value, or sales evidence suggests a fairly broad range in value.",
        "There may be a known restriction on resale in the open market (for example an over-55s restriction on occupation or ownership).",
      ],
      4: [
        "Expected marketing period of up to 12 months.",
        "Unique property for the locality, or limited sales evidence within the last 12 months that supports the assessed value.",
        "Market largely driven by interstate or overseas investors, or the contract price cannot be supported by available sales evidence.",
      ],
      5: [
        "Expected marketing period of over 12 months, limited potential purchasers, or no available sales evidence within the last 12 months that supports the assessed value.",
        "Do not use 5 solely because the locality is thinly traded where it is tightly held and highly desired.",
      ],
    },
  },
];

export function parseRiskScore(raw: unknown): RiskScore | null {
  const n = Number(String(raw ?? "").trim().match(/^([1-5])/)?.[1] ?? "");
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

export function scoreLabel(score: RiskScore): string {
  return RISK_SCALE.find((s) => s.score === score)?.label ?? String(score);
}

export function riskNoteField(id: RiskCategoryId): string {
  return `risk_note_${id}`;
}

export function criteriaParagraph(category: RiskCategory, score: RiskScore): string {
  return category.criteria[score].join(" ");
}

/** True when the note is empty or still one of the stock API bands for this heading. */
export function noteIsStock(category: RiskCategory, text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return RISK_SCALE.some((col) => criteriaParagraph(category, col.score) === t);
}

export interface RiskHint {
  min: RiskScore;
  max: RiskScore;
  reason: string;
}

function str(values: InspectionValues, key: string): string {
  const v = values[key];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(String).join(" ").trim();
  if (v == null) return "";
  return String(v).trim();
}

function overlaySelected(values: InspectionValues, id: string): boolean {
  const raw = values["plan_overlay"];
  if (Array.isArray(raw)) return raw.map(String).includes(id);
  if (typeof raw === "string") return raw.split(/[,;|]/).map((s) => s.trim()).includes(id);
  return false;
}

function yesish(raw: string): boolean {
  return /^(yes|y|true|flood|prone|affected|partial|within)/i.test(raw);
}

export function hintForCategory(
  category: RiskCategory,
  values: InspectionValues,
): RiskHint | null {
  const flood = `${str(values, "prop_flood")} ${str(values, "prop_flood_map")}`;
  const adverse = str(values, "prop_adverse_site");
  const notes = `${str(values, "plan_overlay_notes")} ${str(values, "exam_risk_commentary")} ${adverse}`;
  const shape = str(values, "prop_shape");
  const usable = str(values, "prop_usable_sitearea");
  const site = str(values, "prop_sitearea");
  const zoningComp = str(values, "prop_zoning_comp");
  const overall = str(values, "overall_cond");
  const defects = str(values, "defects_notes");

  if (category.id === "environment") {
    const reasons: string[] = [];
    let min: RiskScore = 1;
    if (yesish(flood) || /flood/i.test(flood)) {
      min = 3;
      reasons.push("flood notation is recorded");
    }
    if (overlaySelected(values, "overlay_bushfire")) {
      min = Math.max(min, 3) as RiskScore;
      reasons.push("bushfire overlay is recorded");
    }
    if (overlaySelected(values, "overlay_landslide")) {
      min = Math.max(min, 3) as RiskScore;
      reasons.push("landslide overlay is recorded");
    }
    if (
      overlaySelected(values, "overlay_coastal") ||
      overlaySelected(values, "overlay_wetland") ||
      overlaySelected(values, "overlay_acid_sulfate")
    ) {
      min = Math.max(min, 2) as RiskScore;
      reasons.push("coastal, wetland or acid sulfate overlay is recorded");
    }
    if (/contaminat|dip(ping)? yard|landfill|unexploded/i.test(notes)) {
      min = Math.max(min, 4) as RiskScore;
      reasons.push("contamination language appears in the notes");
    }
    if (reasons.length === 0) return null;
    const max: RiskScore = min >= 4 ? 5 : ((min + 1) as RiskScore);
    return { min, max, reason: reasons.join("; ") };
  }

  if (category.id === "land") {
    const reasons: string[] = [];
    let min: RiskScore = 1;
    if (/hatchet|battle|irregular|fan/i.test(shape)) {
      min = 2;
      reasons.push(`allotment shape is recorded as ${shape}`);
    }
    if (/easement|right of way|encroachment|limited title/i.test(`${notes} ${str(values, "prop_legal")}`)) {
      min = Math.max(min, 3) as RiskScore;
      reasons.push("title or easement constraints are recorded");
    }
    if (/limited title|old system|building across/i.test(notes)) {
      min = Math.max(min, 5) as RiskScore;
      reasons.push("limited or defective title language is recorded");
    }
    if (usable && site && usable !== site) {
      min = Math.max(min, 2) as RiskScore;
      reasons.push("usable site area differs from site area");
    }
    if (/no|non.?comply/i.test(zoningComp)) {
      min = Math.max(min, 3) as RiskScore;
      reasons.push("zoning compliance is not recorded as compliant");
    }
    if (reasons.length === 0) return null;
    const max: RiskScore = min >= 5 ? 5 : ((min + 1) as RiskScore);
    return { min, max, reason: reasons.join("; ") };
  }

  if (category.id === "location") {
    const reasons: string[] = [];
    let min: RiskScore = 1;
    if (overlaySelected(values, "overlay_airport") || overlaySelected(values, "overlay_infrastructure")) {
      min = 2;
      reasons.push("airport or infrastructure overlay is recorded");
    }
    if (adverse) {
      min = Math.max(min, 3) as RiskScore;
      reasons.push("adverse site features are recorded");
    }
    if (reasons.length === 0) return null;
    const max: RiskScore = min >= 4 ? 5 : ((min + 1) as RiskScore);
    return { min, max, reason: reasons.join("; ") };
  }

  if (category.id === "improvements") {
    if (isVacantLand(values)) {
      return {
        min: 1,
        max: 2,
        reason: "vacant land — no structural improvement risk unless site works are recorded",
      };
    }
    const reasons: string[] = [];
    let min: RiskScore = 1;
    if (/fair|poor/i.test(overall)) {
      min = /poor/i.test(overall) ? 4 : 3;
      reasons.push(`overall condition is ${overall}`);
    }
    if (defects) {
      min = Math.max(min, 3) as RiskScore;
      reasons.push("defect notes are recorded");
    }
    if (reasons.length === 0) return null;
    const max: RiskScore = min >= 5 ? 5 : ((min + 1) as RiskScore);
    return { min, max, reason: reasons.join("; ") };
  }

  return null;
}

export function buildRiskAnalysis(values: InspectionValues): string {
  const parts: string[] = [];
  for (const cat of RISK_CATEGORIES) {
    const score = parseRiskScore(values[cat.field]);
    const note = str(values, riskNoteField(cat.id));
    if (!score && !note) continue;
    const body = note || (score ? criteriaParagraph(cat, score) : "");
    const rating = score ? ` is rated ${score} (${scoreLabel(score)})` : " is not rated";
    parts.push(`${cat.heading}${rating}. ${body}`.trim());
  }
  return parts.join("\n\n");
}
