import type { InspectionValues } from "./types";

/**
 * Location presets (Urban / Suburban / Rural).
 *
 * Triggered when the valuer selects a value in `nbhd_location`.
 * Only empty / unset fields are filled; existing answers are never overwritten.
 * Checkbox groups receive a single typical item (or the minimum set the user
 * asked for, e.g. side + rear fencing).
 *
 * Sources: QLD neighbourhood planning guidelines, council road hierarchy
 * standards, urban vs rural cross-section differences, typical service
 * provision in SEQ and regional QLD.
 */
export const LOCATION_PRESETS: Record<string, InspectionValues> = {
  Urban: {
    // Neighbourhood intensity
    nbhd_builtup: "Over 75%",
    nbhd_growth: "Stable",
    nbhd_character: ["nbhd_char_established"],

    // Off-site / streetscape
    offsite_road_type: "Access Street",
    offsite_road_surface: "Bitumen sealed",
    offsite_road_ownership: "Public",
    offsite_carriageway: "Dual lane",
    offsite_kerb: "Barrier kerb and channel",
    offsite_footpaths: "Concrete both sides",
    offsite_verge: "Grassed",
    offsite_lighting: "Full street lighting",
    offsite_drainage: "Piped system",
    offsite_typical: "Yes",

    // On-site services (reticulated)
    svc_water_type: "Town water",
    svc_sewer_type: "Sewer",
    svc_elec_type: "Mains power",
    svc_gas_type: "Natural gas",
    svc_storm_type: "Appears adequate",
    svc_internet_type: "Fibre to the Node (FTTN)",

    // Fencing — urban/suburban assumed fenced back and sides
    fence: ["fence_fenced", "fence_side", "fence_rear", "fence_colorbond", "fence_pedestrian_gates"],
  },

  Suburban: {
    nbhd_builtup: "Over 75%",
    nbhd_growth: "Stable",
    nbhd_character: ["nbhd_char_established", "nbhd_char_quiet"],

    offsite_road_type: "Suburban Road",
    offsite_road_surface: "Bitumen sealed",
    offsite_road_ownership: "Public",
    offsite_carriageway: "Dual lane",
    offsite_kerb: "Barrier kerb and channel",
    offsite_footpaths: "Concrete one side",
    offsite_verge: "Grassed",
    offsite_lighting: "Full street lighting",
    offsite_drainage: "Piped system",
    offsite_typical: "Yes",

    svc_water_type: "Town water",
    svc_sewer_type: "Sewer",
    svc_elec_type: "Mains power",
    svc_gas_type: "Natural gas",
    svc_storm_type: "Appears adequate",
    svc_internet_type: "Fibre to the Node (FTTN)",

    fence: ["fence_fenced", "fence_side", "fence_rear", "fence_colorbond", "fence_pedestrian_gates"],
  },

  Rural: {
    nbhd_builtup: "Under 25%",
    nbhd_growth: "Slow",
    nbhd_character: ["nbhd_char_established", "nbhd_char_hinterland", "nbhd_char_quiet"],

    offsite_road_type: "Rural Road",
    offsite_road_surface: "Bitumen sealed",
    offsite_road_ownership: "Public",
    offsite_carriageway: "Single lane",
    offsite_kerb: "Table drain",
    offsite_footpaths: "None",
    offsite_verge: "Earth",
    offsite_lighting: "None",
    offsite_drainage: "Open drains",
    offsite_typical: "Yes",

    // On-site / non-reticulated typical for rural residential
    svc_water_type: "Rooftop / Tank",
    svc_sewer_type: "Septic",
    svc_elec_type: "Mains power",
    svc_gas_type: "LPG",
    svc_storm_type: "Appears adequate",
    svc_internet_type: "Fixed Wireless NBN",

    // Rural fencing more often wire / post; still mark side + rear where present
    fence: ["fence_fenced", "fence_side", "fence_rear", "fence_timber_post", "fence_four_wire", "fence_pedestrian_gates"],
  },
};

/** Returns true when the stored value has not been set by the user yet. */
export function isUnset(value: InspectionValues[string]): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Apply a location preset on top of the current values.
 * Checkbox groups: merge typical items if missing.
 * Other fields: only written when still unset.
 */
export function applyLocationPreset(
  current: InspectionValues,
  location: string,
): InspectionValues {
  const preset = LOCATION_PRESETS[location];
  if (!preset) return current;

  let next = current;
  let changed = false;

  for (const [key, presetValue] of Object.entries(preset)) {
    if (Array.isArray(presetValue)) {
      const existing = Array.isArray(current[key]) ? (current[key] as string[]) : [];
      const toAdd = presetValue.filter((id) => !existing.includes(id));
      if (toAdd.length === 0) continue;
      if (!changed) {
        next = { ...current };
        changed = true;
      }
      next[key] = [...existing, ...toAdd];
      continue;
    }

    // Electricity: always default to Mains power for every location type when
    // unset, or migrate the former "Mains power only" label.
    if (key === "svc_elec_type") {
      const cur = current[key];
      const needsDefault =
        isUnset(cur) ||
        (typeof cur === "string" && cur.trim().toLowerCase() === "mains power only");
      if (!needsDefault) continue;
      if (!changed) {
        next = { ...current };
        changed = true;
      }
      next[key] = "Mains power";
      continue;
    }

    if (!isUnset(current[key])) continue;
    if (!changed) {
      next = { ...current };
      changed = true;
    }
    next[key] = presetValue;
  }

  return next;
}
