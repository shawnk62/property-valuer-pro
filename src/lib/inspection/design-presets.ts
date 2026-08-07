import type { InspectionValues } from "./types";

/**
 * Design / Style presets.
 *
 * When the valuer selects a value in `imp_design`, fields listed here that are
 * still empty are pre-filled. Existing answers are never overwritten.
 *
 * Rules for this file:
 * - Every value is a single primary typical answer (one item only).
 * - Checkbox groups receive a single-item array of the most typical id.
 * - Selects receive one string.
 * - Booleans are applied only when still undefined.
 * - Leave condition and notes fields alone.
 *
 * To adjust a style: edit the exact keys below. Field names and item ids must
 * match the schema exactly.
 */
export const DESIGN_PRESETS: Record<string, InspectionValues> = {
  /* ------------------------------------------------------------------ */
  /* Timber high-set family                                              */
  /* ------------------------------------------------------------------ */
  Queenslander: {
    imp_highset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_vj"],
    ceil: ["ceil_vj_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  "Highset Queenslander": {
    imp_highset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_vj"],
    ceil: ["ceil_vj_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  Ashgrovian: {
    imp_highset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_vj"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  "Workers Cottage": {
    imp_lowset: true,
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_vj"],
    ceil: ["ceil_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  Colonial: {
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_timber"],
    ceil: ["ceil_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  /* ------------------------------------------------------------------ */
  /* Post-war family                                                     */
  /* ------------------------------------------------------------------ */
  "Post-war Timber": {
    imp_lowset: true,
    foundations: ["found_concrete_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
  },

  "Post-war Brick": {
    imp_lowset: true,
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Masonry brick",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_concrete_tiles"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_carpet"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
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
    flr: ["flr_carpet"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
  },

  /* ------------------------------------------------------------------ */
  /* Contemporary / lifestyle styles                                     */
  /* ------------------------------------------------------------------ */
  Contemporary: {
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_led"],
    kit_feat: ["kit_induction"],
    app: ["app_bosch"],
    bath_tiles_type: "Large format porcelain",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    bath_feat: ["bath_frameless"],
    am: ["am_bir"],
    sd: ["sd_large_glazed"],
  },

  Hamptons: {
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_fc_weatherboard"],
    rc: ["rc_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "3.0 metres",
    light: ["light_high_quality"],
    kit_feat: ["kit_softclose"],
    app: ["app_fisherpaykel"],
    bath_tiles_type: "Large format porcelain",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    bath_feat: ["bath_freestanding"],
    am: ["am_wir"],
    accom: ["accom_front_verandah"],
    sd: ["sd_indoor_outdoor"],
  },

  Coastal: {
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_fc_weatherboard"],
    rc: ["rc_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_natural"],
    kit_feat: ["kit_induction"],
    app: ["app_fisherpaykel"],
    bath_tiles_type: "Large format porcelain",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    bath_feat: ["bath_frameless"],
    am: ["am_bir"],
    sd: ["sd_indoor_outdoor"],
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
 * Apply a design preset on top of the current values.
 *
 * - Checkbox groups (string[]): merge — the typical item is added if missing.
 * - Other fields (string / boolean): only written when still unset.
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
      next[key] = [...existing, ...toAdd];
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
