import type { InspectionValues } from "./types";

/**
 * Design / Style presets.
 *
 * When the valuer selects a value in `imp_design`, any fields listed here that
 * are still empty are pre-filled. Existing answers are never overwritten, so
 * the valuer can freely change or clear any pre-filled item.
 *
 * To add or adjust a style:
 * 1. Use the exact option string from the Design / Style select (imp_design).
 * 2. Use exact field names and checkbox-group item ids from the schema.
 * 3. Only include structural / typical features — leave condition and notes alone.
 *
 * Arrays are set wholesale when the target group is empty.
 * Booleans are applied only when the key is still undefined.
 * Strings are applied only when empty/undefined.
 */
export const DESIGN_PRESETS: Record<string, InspectionValues> = {
  Queenslander: {
    // Classic high-set timber Queenslander
    imp_highset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard", "ext_timber_vj"],
    rc: ["rc_corrugated"],
    il: ["il_vj", "il_vj_timber"],
    ceil: ["ceil_vj_timber"],
    accom: ["accom_front_verandah", "accom_rear_verandah"],
    vent: ["vent_natural", "vent_subfloor"],
  },

  "Highset Queenslander": {
    imp_highset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard", "ext_timber_vj"],
    rc: ["rc_corrugated"],
    il: ["il_vj", "il_vj_timber"],
    ceil: ["ceil_vj_timber"],
    accom: ["accom_front_verandah", "accom_rear_verandah"],
    vent: ["vent_natural", "vent_subfloor"],
  },

  Ashgrovian: {
    // Decorative Queenslander variant (often Ashgrove / inner-north)
    imp_highset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard", "ext_timber_vj"],
    rc: ["rc_corrugated"],
    il: ["il_vj", "il_vj_timber"],
    ceil: ["ceil_vj_timber"],
    accom: ["accom_front_verandah", "accom_rear_verandah"],
    vent: ["vent_natural", "vent_subfloor"],
  },

  "Workers Cottage": {
    // Smaller, often lower-set timber cottage
    imp_lowset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_vj", "il_timber"],
    ceil: ["ceil_timber", "ceil_vj_timber"],
    accom: ["accom_front_verandah"],
    vent: ["vent_natural", "vent_subfloor"],
  },

  Colonial: {
    foundations: ["found_timber_stumps", "found_concrete_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated", "rc_metal"],
    il: ["il_timber", "il_vj"],
    ceil: ["ceil_timber"],
    accom: ["accom_front_verandah"],
  },

  "Post-war Timber": {
    imp_lowset: true,
    foundations: ["found_concrete_stumps", "found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_timber_weatherboard", "ext_fc_weatherboard"],
    rc: ["rc_corrugated", "rc_colorbond"],
    il: ["il_plasterboard", "il_fibre_cement"],
    ceil: ["ceil_plasterboard"],
  },

  "Post-war Brick": {
    imp_lowset: true,
    foundations: ["found_concrete_slab", "found_concrete_strip"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Masonry brick",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_concrete_tiles", "rc_terracotta"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
  },

  "Brick and Tile": {
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Masonry brick",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_concrete_tiles"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
  },

  Contemporary: {
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer", "ext_rendered_acrylic", "ext_fc_sheet"],
    rc: ["rc_colorbond", "rc_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
  },

  Hamptons: {
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete", "floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_timber_weatherboard", "ext_fc_weatherboard", "ext_rendered_acrylic"],
    rc: ["rc_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    accom: ["accom_front_verandah", "accom_rear_verandah"],
  },

  Coastal: {
    foundations: ["found_concrete_slab", "found_concrete_stumps"],
    floor_structure: ["floor_struct_concrete", "floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_fc_weatherboard", "ext_timber_weatherboard", "ext_rendered_acrylic"],
    rc: ["rc_colorbond", "rc_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
  },
};

/** Returns true when the stored value has not been set by the user yet. */
export function isUnset(value: InspectionValues[string]): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  // boolean: only apply when still undefined (already handled above)
  return false;
}

/**
 * Apply a design preset on top of the current values.
 *
 * - Checkbox groups (string[]): merge — typical items are added if missing.
 *   Existing selections are never removed.
 * - Other fields (string / boolean): only written when still unset.
 *
 * This keeps the form fully editable while still giving a useful starting point.
 */
export function applyDesignPreset(
  current: InspectionValues,
  design: string,
): InspectionValues {
  const preset = DESIGN_PRESETS[design];
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
      // Preserve existing order, append new items.
      next[key] = [...existing, ...toAdd];
      continue;
    }

    // string / boolean — only fill when still empty
    if (!isUnset(current[key])) continue;
    if (!changed) {
      next = { ...current };
      changed = true;
    }
    next[key] = presetValue;
  }

  return next;
}
