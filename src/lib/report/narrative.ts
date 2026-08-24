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
      hasValue(values["imp_yearbuilt"]) &&
        `The improvements are understood to have been constructed circa ${v(values, "imp_yearbuilt")}`,
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

function buildRemarks(values: InspectionValues): string {
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

function buildServicesAmenities(values: InspectionValues): string {
  const parts: string[] = [];
  const water = v(values, "svc_water_type");
  const sewer = v(values, "svc_sewer_type");
  const elec = v(values, "svc_elec_type");
  const gas = v(values, "svc_gas_type");
  const storm = v(values, "svc_storm_type");
  const tel = v(values, "svc_tel_type");
  const net = v(values, "svc_internet_type");

  const listed = [
    water && `water (${water.toLowerCase()})`,
    sewer && `sewerage (${sewer.toLowerCase()})`,
    elec && `electricity (${elec.toLowerCase()})`,
    gas && `gas (${gas.toLowerCase()})`,
    storm && `stormwater drainage (${storm.toLowerCase()})`,
    tel && `telephone (${tel.toLowerCase()})`,
    net && `internet (${net.toLowerCase()})`,
  ].filter(Boolean);

  if (listed.length) {
    parts.push(
      sentence([
        "The property is understood to be connected to",
        listed.slice(0, -1).join(", ") +
          (listed.length > 1 ? ` and ${listed[listed.length - 1]}` : listed[0]),
        "as recorded at inspection",
      ]),
    );
  }

  return parts.filter(Boolean).join(" ");
}

export function generateNarrative(values: InspectionValues): ReportNarrative {
  return {
    brief: buildBrief(values) ||
      sentence(["The subject property is located at", fullAddress(values)]),
    location: buildLocation(values),
    servicesAmenities: buildServicesAmenities(values),
    improvements: buildImprovements(values),
    accommodation: buildAccommodation(values),
    remarks: buildRemarks(values),
  };
}

export { fullAddress };
