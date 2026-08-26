import { BOILERPLATE } from "./boilerplate";
import { displayValue, hasValue, joinValues } from "./schema";
import type { InspectionValues, ReportNarrative } from "./types";

/**
 * Mock narrative generator. Composes QLD residential prose from the subject
 * values so the valuer has an editable starting point. Swap for the AI
 * narrative endpoint at integration — keep the same signature.
 */

function v(values: InspectionValues, key: string): string {
  return displayValue(values[key]);
}

function sentence(parts: (string | false | undefined)[]): string {
  const body = parts.filter(Boolean).join(" ");
  if (!body) return "";
  return body.endsWith(".") ? body : `${body}.`;
}

function fullAddress(values: InspectionValues): string {
  return joinValues(values, ["prop_address", "prop_suburb"], ", ") +
    (hasValue(values["prop_state"]) || hasValue(values["prop_postcode"])
      ? ` ${joinValues(values, ["prop_state", "prop_postcode"], " ")}`
      : "");
}

function setLevel(values: InspectionValues): string {
  if (values["imp_lowset"]) return "lowset";
  if (values["imp_midset"]) return "midset";
  if (values["imp_highset"]) return "highset";
  return "";
}

function buildBrief(values: InspectionValues): string {
  const level = setLevel(values);
  const walls = v(values, "ext").toLowerCase();
  const roof = v(values, "rc").toLowerCase();
  const beds = v(values, "imp_beds");
  const baths = v(values, "imp_baths");
  const area = hasValue(values["prop_sitearea"])
    ? `${v(values, "prop_sitearea")}${v(values, "prop_areaunit") === "m2" ? "m²" : ` ${v(values, "prop_areaunit")}`}`
    : "";
  const shape = v(values, "prop_shape");
  const lotPos = v(values, "prop_lot_position");
  const orient = v(values, "prop_orientation");
  const topo = v(values, "topo");
  const pool = v(values, "pool");
  const land = v(values, "land");
  const fence = v(values, "fence");
  const year = v(values, "imp_yearbuilt");

  // Murray samples: CGT (Gower St) = 2 short paras; Stamp Duty / Family Law may be longer
  if (isMurrayAssignment(values)) {
    const materials = [walls, roof && `${roof}`].filter(Boolean).join(" ");
    const assignment = v(values, "prop_assignment").toLowerCase();
    const isCgtMurray = assignment.includes("cgt");
    const shapePhrase = shape
      ? shape.toLowerCase().includes("shaped")
        ? shape.toLowerCase()
        : `${shape.toLowerCase()} shaped`
      : "";

    if (isCgtMurray) {
      const para1 = [
        sentence([
          "The subject property is a",
          level,
          materials,
          "dwelling",
          beds && `with ${beds} bedrooms`,
          baths && `and ${baths} bathrooms`,
        ]),
        year ? sentence([`The dwelling was constructed circa ${year}`]) : "",
      ]
        .filter(Boolean)
        .join(" ");
      const para2 = [
        sentence([
          "The subject allotment is",
          area && `a ${area}`,
          shapePhrase,
          lotPos && lotPositionPhrase(lotPos),
          orient && `which faces ${orient.toLowerCase()}`,
        ]),
        topo ? sentence(["Topography is described as", topo.toLowerCase()]) : "",
      ]
        .filter(Boolean)
        .join(" ");
      return [para1, para2].filter(Boolean).join(" ");
    }

    const para1 = sentence([
      "The subject property improvements consist of a",
      level,
      materials,
      "residence",
      beds && `with ${beds} bedrooms`,
      baths && `and ${baths} bathrooms`,
    ]);
    const para1b = year
      ? sentence([`The improvements were constructed circa ${year}`])
      : "";
    const para1c = pool
      ? sentence([
          `There is ${
            pool.toLowerCase().startsWith("a") || pool.toLowerCase().startsWith("an")
              ? pool.toLowerCase()
              : `a ${pool.toLowerCase()}`
          }`,
        ])
      : "";
    const ancillaryBits = [land, fence].filter(Boolean);
    const para2 = ancillaryBits.length
      ? sentence(["Ancillary improvements include", ancillaryBits.join("; ").toLowerCase()])
      : "";
    const para3 = sentence([
      "The subject allotment is",
      area && `a ${area}`,
      shapePhrase,
      lotPos && lotPositionPhrase(lotPos),
      orient && `which faces ${orient.toLowerCase()}`,
    ]);
    const para3b = topo
      ? sentence(["Topography is described as", topo.toLowerCase()])
      : "";
    return [para1, para1b, para1c, para2, para3, para3b].filter(Boolean).join(" ");
  }

  const descriptor = [level, walls, roof && `and ${roof}`, "dwelling"]
    .filter(Boolean)
    .join(" ");

  return [
    sentence([
      "The subject property comprises a",
      descriptor.trim(),
      beds && `containing ${beds} bedrooms`,
      baths && `and ${baths} bathrooms`,
      area && `situated on a ${area} allotment`,
    ]),
    sentence([
      year &&
        `The improvements are understood to have been constructed circa ${year}`,
      hasValue(values["overall_cond"]) &&
        `and present in ${v(values, "overall_cond").toLowerCase()} order having regard to their age`,
    ]),
    sentence([
      hasValue(values["prop_zoning"]) &&
        `The land is zoned ${v(values, "prop_zoning")} under the planning scheme administered by ${v(values, "prop_lga") || "the local authority"}`,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildImprovements(values: InspectionValues): string {
  return [
    sentence([
      "The improvements comprise a",
      setLevel(values),
      v(values, "imp_design").toLowerCase(),
      "style dwelling of",
      v(values, "ext").toLowerCase() || "conventional",
      "construction",
      hasValue(values["rc"]) && `beneath a ${v(values, "rc").toLowerCase()} roof`,
    ]),
    sentence([
      hasValue(values["foundations"]) &&
        `Foundations are ${v(values, "foundations").toLowerCase()}`,
      hasValue(values["floor_structure"]) &&
        `with ${v(values, "floor_structure").toLowerCase()} floor structure`,
    ]),
    sentence([
      hasValue(values["il"]) && `Internal linings are ${v(values, "il").toLowerCase()}`,
      hasValue(values["ceil"]) && `and ceilings are ${v(values, "ceil").toLowerCase()}`,
    ]),
    sentence([
      hasValue(values["imp_gla"]) &&
        `The dwelling provides an approximate living area of ${v(values, "imp_gla")}m²`,
      hasValue(values["area_garage"]) &&
        `together with a garage of approximately ${v(values, "area_garage")}m²`,
      hasValue(values["area_covered_rear_patio"]) &&
        `and a covered rear patio of approximately ${v(values, "area_covered_rear_patio")}m²`,
    ]),
    sentence([
      hasValue(values["imp_quality"]) &&
        `Overall quality of construction is assessed as ${v(values, "imp_quality").toLowerCase()}`,
      hasValue(values["overall_cond"]) &&
        `and the overall condition of the improvements is assessed as ${v(values, "overall_cond").toLowerCase()}`,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildAccommodation(values: InspectionValues): string {
  return [
    sentence([
      "The accommodation consists of",
      v(values, "accom").toLowerCase() || "the rooms observed at inspection",
    ]),
    sentence([
      hasValue(values["flr"]) && `Floor coverings comprise ${v(values, "flr").toLowerCase()}`,
      hasValue(values["vent"]) && `Climate control is provided by ${v(values, "vent").toLowerCase()}`,
    ]),
    sentence([v(values, "kit_overall_notes")]),
    sentence([v(values, "bath_overall_notes")]),
    sentence([
      hasValue(values["park"]) && `Car accommodation comprises ${v(values, "park").toLowerCase()}`,
    ]),
    sentence([
      hasValue(values["anc"]) &&
        `Ancillary improvements include ${v(values, "anc").toLowerCase()}`,
    ]),
    sentence([v(values, "imp_add_features")]),
  ]
    .filter(Boolean)
    .join(" ");
}

const PHIL_STRUCTURAL =
  "I recommend that a structural survey and pest inspection be obtained from suitably qualified professionals.";

const PHIL_SALE_METHOD =
  "If the property is to be sold it should be offered for sale by Auction or Private Tender.";

/** Opening line — overall condition from overall_cond dropdown (fallback: good). */
function philRemarksOpening(values: InspectionValues): string {
  const cond = v(values, "overall_cond").trim();
  const condPhrase = (cond || "good").toLowerCase();
  return `The valuation assumes information disclosed by the client, with the overall condition of improvements recorded as ${condPhrase}, and a full schedule of limitations applies.`;
}

function isPhilAssignment(values: InspectionValues): boolean {
  const a = v(values, "prop_assignment").toLowerCase();
  return a.includes("phil");
}

function isMurrayAssignment(values: InspectionValues): boolean {
  const a = v(values, "prop_assignment").toLowerCase();
  return a.includes("murray");
}

/** Lot position without repeating the word "allotment". */
function lotPositionPhrase(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (t.includes("inside")) return "inside";
  if (t.includes("corner")) return "corner";
  return t.replace(/\ballotment\b/gi, "").replace(/\s+/g, " ").trim();
}

/** Ground improvements sentence from pool / landscaping / fencing checkboxes. */
function buildGroundImprovementsLine(values: InspectionValues): string {
  const pool = v(values, "pool");
  const land = v(values, "land");
  const fence = v(values, "fence");
  const bits: string[] = [];
  if (pool) bits.push(pool.toLowerCase());
  if (land) bits.push(land.toLowerCase());
  if (fence) bits.push(fence.toLowerCase());
  if (!bits.length) return "";
  // Join with semicolons for distinct groups; sentence() adds the full stop
  return sentence([`The ground improvements include ${bits.join("; ")}`]);
}

function formatAssessedValue(raw: string | undefined): string {
  if (!raw || !String(raw).trim()) return "";
  const digits = String(raw).replace(/[^\d.]/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return String(raw).trim();
  return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

/**
 * Phil-family §13 Remarks — fixed order required by the practice:
 * 1. Opening / assumptions
 * 2. Structural + pest recommendation
 * 3. Brief description of the property
 * 4. Ground improvements (pool / landscaping / fencing)
 * 5. Number of comparable sales included
 * 6. Assessed value
 * 7. Auction / private tender closing
 */
function buildPhilRemarks(
  values: InspectionValues,
  opts?: {
    salesCount?: number;
    valueAmount?: string;
    /** Prefer existing brief narrative when regenerating */
    brief?: string;
  },
): string {
  const brief =
    (opts?.brief && opts.brief.trim()) ||
    buildBrief(values) ||
    sentence([
      "The property comprises a residential dwelling",
      hasValue(values["prop_sitearea"]) &&
        `on a ${v(values, "prop_sitearea")}${
          v(values, "prop_areaunit") === "m2" ? "m²" : ` ${v(values, "prop_areaunit")}`
        } allotment`,
    ]);

  const ground = buildGroundImprovementsLine(values);

  const count = typeof opts?.salesCount === "number" ? opts.salesCount : 0;
  const salesLine =
    count <= 0
      ? ""
      : count === 1
        ? "I have included 1 comparable sale."
        : `I have included ${count} comparable sales.`;

  const valueFmt = formatAssessedValue(opts?.valueAmount);
  const valueLine = valueFmt
    ? sentence([`I assess the current value at ${valueFmt}`])
    : "";

  // Optional extra notes from the form, after the fixed skeleton but before closing
  const extras = [
    sentence([v(values, "other_notes")]),
    sentence([v(values, "defects_notes")]),
  ].filter(Boolean);

  return [
    philRemarksOpening(values),
    PHIL_STRUCTURAL,
    brief,
    ground,
    salesLine,
    valueLine,
    ...extras,
    PHIL_SALE_METHOD,
  ]
    .filter(Boolean)
    .join(" ");
}


/**
 * Murray §13 Remarks — fixed order required by the practice:
 * 1. Structural + pest recommendation
 * 2. Brief description (from narrative / template)
 * 3. Editable sales-evidence commentary (default template; valuer may rewrite)
 * 4. Assessed value
 * 5. Auction / private tender closing
 */
function buildMurraySalesCommentary(
  values: InspectionValues,
  opts?: { salesCount?: number },
): string {
  const suburb = v(values, "prop_suburb") || "the subject suburb";
  const lga = v(values, "prop_lga") || "the local government area";
  const count = typeof opts?.salesCount === "number" ? opts.salesCount : 0;
  const salesRange =
    count <= 0 ? "[insert sale numbers]" : count === 1 ? "1" : `1-${count}`;
  const assignment = v(values, "prop_assignment").toLowerCase();
  const valueKind = assignment.includes("retrospective")
    ? "retrospective market value"
    : "current market value";

  // Default template — intended to be edited by the valuer (nearby suburbs list, etc.)
  const p1 = `This lack of comparable sales in ${suburb} has led me to rely on sales taken from the nearby and surrounding suburbs. These out of subject suburb sales are considered appropriate for comparative analysis via the Direct Comparison Approach due to those localities being considered to be within the same ${lga} regional real estate market – i.e. prospective buyers would likely be interested in similarly sized and zoned improved listed properties across all suburbs.`;

  const p2 = `There is some variation between the subject property and the sales evidence properties considering (yet not limited to) attributes such as accommodation layout (namely number of bedrooms and bathrooms), locational factors including suburb, total internal floor area, outdoor area, style of dwelling (lowset, highset etcetera), aspect and outlook, age of construction, fit-out specification (type and quality of finishes including renovation/refurbishment status), presentation (internal and external), ancillary (ground) improvements, car accommodation (number of spaces and configuration), dual living status, flood status (including type of flood and extent), etcetera. The Valuer has made allowance for these variations whilst undertaking sales analysis via the Direct Comparison Approach.`;

  const p3 = `Sales ${salesRange} in Section 9 above all recorded 'normal arm's length' transactions and were sold inside of 6 months previous to the date of valuation. They are appropriate for comparative analysis in order to ascertain the ${valueKind} of the subject property.`;

  return [p1, p2, p3].join("\n\n");
}

function buildMurrayRemarks(
  values: InspectionValues,
  opts?: {
    salesCount?: number;
    valueAmount?: string;
    brief?: string;
  },
): string {
  const brief =
    (opts?.brief && opts.brief.trim()) ||
    buildBrief(values) ||
    sentence([
      "The property comprises a residential dwelling",
      hasValue(values["prop_sitearea"]) &&
        `on a ${v(values, "prop_sitearea")}${
          v(values, "prop_areaunit") === "m2" ? "m²" : ` ${v(values, "prop_areaunit")}`
        } allotment`,
    ]);

  const commentary = buildMurraySalesCommentary(values, {
    salesCount: opts?.salesCount,
  });

  const valueFmt = formatAssessedValue(opts?.valueAmount);
  const assignment = v(values, "prop_assignment").toLowerCase();
  const valueLine = valueFmt
    ? sentence([
        assignment.includes("retrospective")
          ? `I assess the retrospective market value at ${valueFmt}`
          : `I assess the current value at ${valueFmt}`,
      ])
    : sentence(["I assess the current value at $[insert assessed value]"]);

  return [
    PHIL_STRUCTURAL,
    brief,
    commentary,
    valueLine,
    PHIL_SALE_METHOD,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildRemarks(
  values: InspectionValues,
  opts?: { salesCount?: number; valueAmount?: string; brief?: string },
): string {
  if (isPhilAssignment(values)) {
    return buildPhilRemarks(values, opts);
  }
  if (isMurrayAssignment(values)) {
    return buildMurrayRemarks(values, opts);
  }
  return [
    sentence([v(values, "other_notes")]),
    sentence([v(values, "defects_notes")]),
    BOILERPLATE.remarksDefault,
  ]
    .filter(Boolean)
    .join(" ");
}


function buildLocation(values: InspectionValues): string {
  // Prefer free-text neighbourhood description when the valuer typed one on site
  if (hasValue(values["nbhd_description"])) {
    return v(values, "nbhd_description");
  }

  const parts: string[] = [];
  const location = v(values, "nbhd_location");
  const builtup = v(values, "nbhd_builtup");
  const character = v(values, "nbhd_character");
  const boundaries = v(values, "nbhd_boundaries");
  const growth = v(values, "nbhd_growth");
  const demand = v(values, "nbhd_demand");
  const market = v(values, "nbhd_market_conditions");

  if (location || builtup) {
    parts.push(
      sentence([
        "The subject is situated in a",
        builtup && builtup.toLowerCase(),
        location && location.toLowerCase(),
        "locality",
        character && `characterised by ${character.toLowerCase()}`,
      ]),
    );
  }
  if (boundaries) {
    parts.push(sentence(["Neighbourhood boundaries are described as", boundaries]));
  }
  if (growth || demand) {
    parts.push(
      sentence([
        growth && `Growth is ${growth.toLowerCase()}`,
        demand && `with demand/supply assessed as ${demand.toLowerCase()}`,
      ]),
    );
  }
  if (market) {
    parts.push(sentence([market]));
  }

  return parts.filter(Boolean).join(" ");
}

/** Service type as plain prose; skip empty / N/A / Nil. No parenthetical labels. */
function serviceTypePhrase(raw: string, kind?: "storm" | "tel"): string | false {
  const t = raw.trim();
  if (!t) return false;
  if (/^not applicable$/i.test(t) || /^nil$/i.test(t)) return false;
  const lower = t.toLowerCase();
  if (kind === "storm") {
    if (/appears adequate/i.test(t)) return "stormwater drainage that appears adequate";
    if (/appears inadequate/i.test(t)) return "stormwater drainage that appears inadequate";
    return `stormwater drainage that ${lower}`;
  }
  if (kind === "tel" && /^landline$/i.test(t)) return "landline telephone";
  return lower;
}

function joinProseList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}


function buildSitePhysical(values: InspectionValues): string {
  const shape = v(values, "prop_shape");
  const lotPos = v(values, "prop_lot_position");
  const topo = v(values, "topo");
  const dims = v(values, "prop_dimensions");
  const orient = v(values, "prop_orientation");
  const siteArea = hasValue(values["prop_sitearea"])
    ? `${v(values, "prop_sitearea")}${
        v(values, "prop_areaunit") === "m2" ? "m²" : ` ${v(values, "prop_areaunit")}`.trim()
      }`
    : "";
  const view = v(values, "prop_view");
  const land = v(values, "land");
  const fence = v(values, "fence");
  const exc = v(values, "exc");

  const parts: string[] = [];

  // Opening: shape + position + area
  const openBits: string[] = [];
  if (shape) openBits.push(shape.toLowerCase().includes("shaped") ? shape.toLowerCase() : `${shape.toLowerCase()} shaped`);
  if (lotPos) openBits.push(lotPositionPhrase(lotPos));
  if (openBits.length || siteArea) {
    // Murray sample: "The subject allotment is a 4.9ha slightly irregular shaped inside allotment which faces north."
    if (isMurrayAssignment(values)) {
      parts.push(
        sentence([
          "The subject allotment is",
          siteArea && `a ${siteArea}`,
          openBits.length ? openBits.join(" ") : false,
          orient && `which faces ${orient.toLowerCase()}`,
        ]),
      );
    } else {
      parts.push(
        sentence([
          "The subject allotment is",
          openBits.length ? openBits.join(", ") : false,
          siteArea && `with a site area of approximately ${siteArea}`,
        ]),
      );
    }
  }

  if (dims) {
    parts.push(sentence(["Dimensions are recorded as", dims]));
  }
  if (orient && !isMurrayAssignment(values)) {
    parts.push(sentence(["The allotment has a", orient.toLowerCase(), "orientation"]));
  }
  if (topo) {
    parts.push(sentence(["Topography is described as", topo.toLowerCase()]));
  }
  if (view) {
    parts.push(sentence(["Views are", view.toLowerCase()]));
  }
  if (land) {
    parts.push(sentence(["Landscaping includes", land.toLowerCase()]));
  }
  if (fence) {
    parts.push(sentence(["Fencing comprises", fence.toLowerCase()]));
  }
  if (exc) {
    parts.push(sentence(["Excavations / retaining:", exc.toLowerCase()]));
  }

  return parts.filter(Boolean).join(" ");
}

function buildServicesAmenities(values: InspectionValues): string {
  const listed = [
    serviceTypePhrase(v(values, "svc_water_type")),
    serviceTypePhrase(v(values, "svc_sewer_type")),
    serviceTypePhrase(v(values, "svc_elec_type")),
    serviceTypePhrase(v(values, "svc_gas_type")),
    serviceTypePhrase(v(values, "svc_storm_type"), "storm"),
    serviceTypePhrase(v(values, "svc_tel_type"), "tel"),
    serviceTypePhrase(v(values, "svc_internet_type")),
  ].filter((x): x is string => Boolean(x));

  if (!listed.length) return "";

  // Murray sample: "Tank water, electricity, septic sewerage and telephone are available."
  if (isMurrayAssignment(values)) {
    return sentence([joinProseList(listed), "are available"]);
  }
  return sentence([
    "The property is understood to be connected to",
    joinProseList(listed),
    "as recorded at inspection",
  ]);
}

function buildConditionImprovements(values: InspectionValues): string {
  const overall = v(values, "overall_cond");
  const site = v(values, "overall_site_cond");
  const defects = v(values, "defects_notes");
  const other = v(values, "other_notes");
  const kitNotes = v(values, "kit_overall_notes");
  const bathNotes = v(values, "bath_overall_notes");

  // Collect component condition ratings (key ends with _cond)
  const componentConds: { label: string; cond: string }[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!/_cond$/i.test(key)) continue;
    if (key === "overall_cond" || key === "overall_site_cond") continue;
    const cond = displayValue(raw);
    if (!cond || cond === "Select" || cond === "—") continue;
    // Prefer a readable label from the key prefix
    const base = key.replace(/_cond$/i, "").replace(/_/g, " ");
    componentConds.push({ label: base, cond });
  }

  // Group by rating
  const byRating = new Map<string, string[]>();
  for (const c of componentConds) {
    const list = byRating.get(c.cond) ?? [];
    list.push(c.label);
    byRating.set(c.cond, list);
  }

  const parts: string[] = [];
  if (overall) {
    parts.push(
      isMurrayAssignment(values)
        ? sentence([
            "The subject property appears to be in",
            overall.toLowerCase(),
            "condition with a level of wear and tear to be expected given the age of the improvements",
          ])
        : sentence([
            "The improvements are assessed to be in",
            overall.toLowerCase(),
            "condition overall based on a visual inspection",
          ]),
    );
  } else if (byRating.size) {
    parts.push(
      sentence([
        "Based on a visual inspection, the condition of the improvements varies by component as recorded below",
      ]),
    );
  }

  if (byRating.size) {
    const ratingSentences: string[] = [];
    for (const [rating, items] of byRating) {
      if (items.length <= 4) {
        ratingSentences.push(
          `${joinProseList(items)} assessed as ${rating.toLowerCase()}`,
        );
      } else {
        ratingSentences.push(
          `a number of components (including ${items.slice(0, 3).join(", ")}) assessed as ${rating.toLowerCase()}`,
        );
      }
    }
    if (ratingSentences.length) {
      parts.push(sentence([ratingSentences.join("; ")]));
    }
  }

  if (site) {
    parts.push(sentence(["The site is assessed as being in", site.toLowerCase(), "condition"]));
  }

  for (const note of [kitNotes, bathNotes, defects, other]) {
    if (note) parts.push(sentence([note]));
  }

  return parts.filter(Boolean).join(" ");
}

export type NarrativeGenerateOptions = {
  salesCount?: number;
  valueAmount?: string;
  /** Existing brief text to reuse in Phil remarks when regenerating */
  brief?: string;
};

export function generateNarrative(
  values: InspectionValues,
  opts?: NarrativeGenerateOptions,
): ReportNarrative {
  const brief =
    buildBrief(values) ||
    sentence(["The subject property is located at", fullAddress(values)]);
  return {
    brief,
    location: buildLocation(values),
    sitePhysical: buildSitePhysical(values),
    servicesAmenities: buildServicesAmenities(values),
    improvements: buildImprovements(values),
    accommodation: buildAccommodation(values),
    conditionImprovements: buildConditionImprovements(values),
    remarks: buildRemarks(values, {
      salesCount: opts?.salesCount,
      valueAmount: opts?.valueAmount,
      brief: opts?.brief || brief,
    }),
  };
}

export { fullAddress, buildPhilRemarks, buildMurrayRemarks, isPhilAssignment, isMurrayAssignment };
