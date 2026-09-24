import type { InspectionValues } from "./types";

function isUnset(value: InspectionValues[string]): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.length === 0;
  return !String(value).trim();
}

/**
 * Typical commercial specification. Existing answers are never overwritten.
 * Keys must match inspection-schema commercial subtype labels exactly.
 */
export const COMMERCIAL_PRESETS: Record<string, InspectionValues> = {
  "Retail: single shops, small shopping groups, supermarkets, neighbourhood/regional shopping centres, retail warehouses":
    {
      comm_structure: "Masonry",
      comm_shopfront: "Yes",
      comm_awning: "Yes",
      comm_loading: "Yes",
      comm_occupancy: "Leased",
      svc_elec_3phase: "Unknown",
    },
  "Offices and professional suites": {
    comm_structure: "Concrete frame",
    comm_shopfront: "Not applicable",
    comm_awning: "Not applicable",
    comm_loading: "Not applicable",
    comm_occupancy: "Leased",
    lift: ["lift_passenger"],
    vent: ["hvac_ducted_ac"],
    fire: ["fire_conventional_alarm"],
  },
  "Mixed-use buildings (shops with dwellings)": {
    comm_structure: "Masonry",
    comm_shopfront: "Yes",
    comm_awning: "Yes",
    comm_loading: "Yes",
    comm_occupancy: "Mixed",
  },
  "Hotels, taverns, motels and guest houses": {
    comm_structure: "Masonry",
    comm_shopfront: "Yes",
    comm_awning: "Yes",
    comm_occupancy: "Owner occupied",
    fire: ["fire_conventional_alarm"],
  },
  "Restaurants and fast-food outlets": {
    comm_structure: "Masonry",
    comm_shopfront: "Yes",
    comm_awning: "Yes",
    comm_loading: "Yes",
    comm_occupancy: "Leased",
  },
  "Service stations": {
    comm_structure: "Steel portal frame",
    comm_shopfront: "Yes",
    comm_awning: "Yes",
    comm_loading: "Yes",
    comm_occupancy: "Leased",
    svc_elec_3phase: "Yes",
    contam_status: "Possible",
  },
  "Outdoor sales yards (vehicles, boats, etc.)": {
    comm_structure: "Steel portal frame",
    comm_shopfront: "No",
    comm_awning: "No",
    comm_loading: "Yes",
    comm_occupancy: "Owner occupied",
  },
  "Car parks": {
    comm_structure: "Concrete frame",
    comm_shopfront: "Not applicable",
    comm_awning: "Not applicable",
    comm_loading: "Not applicable",
    comm_occupancy: "Owner occupied",
  },
  "Theatres and cinemas": {
    comm_structure: "Concrete frame",
    comm_shopfront: "Yes",
    comm_awning: "Yes",
    comm_occupancy: "Owner occupied",
    fire: ["fire_conventional_alarm"],
  },
  "Licensed clubs": {
    comm_structure: "Masonry",
    comm_shopfront: "Yes",
    comm_awning: "Yes",
    comm_occupancy: "Owner occupied",
    fire: ["fire_conventional_alarm"],
  },
};

export function applyCommercialPreset(
  current: InspectionValues,
  subtype: string,
): InspectionValues {
  const preset = COMMERCIAL_PRESETS[subtype];
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

    if (!isUnset(current[key])) continue;
    if (!changed) {
      next = { ...current };
      changed = true;
    }
    next[key] = presetValue as InspectionValues[string];
  }

  return next;
}
