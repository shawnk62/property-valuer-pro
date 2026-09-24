import type { InspectionField, InspectionSection, InspectionValues } from "./types";
import { fieldKeys } from "./schema";

const TYPE_KEYS = [
  "prop_type_residential",
  "prop_type_commercial",
  "prop_type_industrial",
  "prop_type_rural",
  "prop_type_specialised",
] as const;

const DWELLING_SECTION_IDS = new Set(["3", "special_design", "3A", "4", "4A"]);

const VACANT_FIELD_NAMES = new Set([
  "prop_hbu_vacant",
  "prop_hbu_vacant_notes",
  "yield_lots",
  "yield_gfa",
  "yield_height",
  "yield_site_cover",
  "yield_approval",
]);

const IMPROVED_ONLY_FIELDS = new Set(["prop_hbu", "overall_cond"]);

const RURAL_FIELD_NAMES = new Set([
  "rural_country",
  "rural_carrying",
  "rural_rainfall",
  "rural_water",
  "rural_water_cond",
  "rural_water_notes",
  "rural_veg",
  "rural_veg_notes",
  "rural_access",
]);

const INDUSTRIAL_FIELD_NAMES = new Set(["ind_power_kva", "ind_bdouble"]);

function str(values: InspectionValues, key: string): string {
  const raw = values[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export function isHbuVacantOther(value: InspectionValues[string]): boolean {
  return typeof value === "string" && /^other$/i.test(value.trim());
}

/** Keep HBU as vacant in lock-step with zoning until the valuer chooses Other. */
export function applyZoningToHbuVacant(values: InspectionValues): InspectionValues {
  const zoning = str(values, "prop_zoning");
  if (!zoning) return values;
  if (isHbuVacantOther(values["prop_hbu_vacant"])) return values;
  if (str(values, "prop_hbu_vacant") === zoning) return values;
  return { ...values, prop_hbu_vacant: zoning };
}

export function isRuralType(values: InspectionValues): boolean {
  return Boolean(str(values, "prop_type_rural")) || str(values, "nbhd_location").toLowerCase() === "rural";
}

export function isIndustrialType(values: InspectionValues): boolean {
  return Boolean(str(values, "prop_type_industrial"));
}

export function isCommercialType(values: InspectionValues): boolean {
  return Boolean(str(values, "prop_type_commercial"));
}

export function isDevelopmentSite(values: InspectionValues): boolean {
  return /development site/i.test(str(values, "prop_type_specialised"));
}

/** Vacant land job: a vacant / development-site subtype and no improved subtype. */
export function isVacantLand(values: InspectionValues): boolean {
  const selected = TYPE_KEYS.map((k) => str(values, k)).filter(Boolean);
  if (selected.length === 0) return false;
  const vacantish = selected.filter((t) => /vacant|development site/i.test(t));
  const improved = selected.filter((t) => !/vacant|development site/i.test(t));
  return vacantish.length > 0 && improved.length === 0;
}

export function sectionIsVisible(section: InspectionSection, values: InspectionValues): boolean {
  if (DWELLING_SECTION_IDS.has(section.id)) return !isVacantLand(values);
  if (section.id === "5") {
    if (!isVacantLand(values)) return true;
    return isIndustrialType(values) || isCommercialType(values) || isRuralType(values);
  }
  return true;
}

export function fieldIsVisible(field: InspectionField, values: InspectionValues): boolean {
  const keys = fieldKeys(field);
  if (keys.some((k) => IMPROVED_ONLY_FIELDS.has(k)) && isVacantLand(values)) return false;
  if (keys.includes("prop_hbu_vacant_notes")) {
    const showBlock =
      isVacantLand(values) || isDevelopmentSite(values) || isCommercialType(values) || isIndustrialType(values);
    return showBlock && /^other$/i.test(str(values, "prop_hbu_vacant"));
  }
  if (keys.some((k) => VACANT_FIELD_NAMES.has(k))) {
    return isVacantLand(values) || isDevelopmentSite(values) || isCommercialType(values) || isIndustrialType(values);
  }
  if (keys.some((k) => RURAL_FIELD_NAMES.has(k))) return isRuralType(values);
  if (keys.some((k) => INDUSTRIAL_FIELD_NAMES.has(k))) {
    return isIndustrialType(values) || /energy generation/i.test(str(values, "prop_type_specialised"));
  }
  return true;
}

export function visibleFields(section: InspectionSection, values: InspectionValues): InspectionField[] {
  if (!sectionIsVisible(section, values)) return [];
  return section.fields.filter((field) => fieldIsVisible(field, values));
}

export function nextVisibleStep(
  sections: InspectionSection[],
  from: number,
  values: InspectionValues,
  direction: 1 | -1,
): number | "review" {
  let i = from + direction;
  while (i >= 0 && i < sections.length) {
    if (sectionIsVisible(sections[i]!, values) && visibleFields(sections[i]!, values).length > 0) {
      return i;
    }
    i += direction;
  }
  return direction > 0 ? "review" : Math.max(0, from);
}
