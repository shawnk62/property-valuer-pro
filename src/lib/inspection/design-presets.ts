import type { InspectionValues } from "./types";

/**
 * Design / Style presets.
 *
 * When the valuer selects a value in `imp_design`, fields listed here that are
 * still empty are pre-filled. Existing answers are never overwritten.
 *
 * Rules:
 * - Every value is a single primary typical answer (one item only) unless a
 *   minimal required set is needed (e.g. fire detection).
 * - Checkbox groups receive arrays of item ids.
 * - Selects receive one string.
 * - Booleans (high/mid/low set) are applied only when still undefined.
 */
export const DESIGN_PRESETS: Record<string, InspectionValues> = {
  /* ------------------------------------------------------------------ */
  /* Timber high-set family                                              */
  /* ------------------------------------------------------------------ */
  Queenslander: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_colorbond"],
    il: ["il_vj"],
    ceil: ["ceil_vj_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  "Highset Queenslander": {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_colorbond"],
    il: ["il_vj"],
    ceil: ["ceil_vj_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  Ashgrovian: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_colorbond"],
    il: ["il_vj"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  "Workers Cottage": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_colorbond"],
    il: ["il_vj"],
    ceil: ["ceil_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
  },

  Colonial: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber hardwood",
    roof_framing_type: "Timber rafters conventional",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_colorbond"],
    il: ["il_timber"],
    ceil: ["ceil_timber"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "3.0 metres",
    light: ["light_natural"],
    accom: ["accom_front_verandah"],
    fire: ["fire_conventional_alarm"],
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
    imp_units: "1",
    foundations: ["found_concrete_stumps"],
    floor_structure: ["floor_struct_timber"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
  },

  "Post-war Brick": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    // Brick veneer is timber-framed in almost all Australian houses
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_concrete_tiles"],
    rd: ["rd_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_carpet"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
  },

  "Brick and Tile": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    // Brick veneer is timber-framed
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_concrete_tiles"],
    rd: ["rd_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_carpet"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
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
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_brick_veneer"],
    rc: ["rc_colorbond"],
    rd: ["rd_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_led"],
    vent: ["hvac_split_multi"],
    fire: ["fire_conventional_alarm"],
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
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_fc_weatherboard"],
    rc: ["rc_colorbond"],
    rd: ["rd_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "3.0 metres",
    light: ["light_high_quality"],
    vent: ["hvac_ducted_heating_ac"],
    fire: ["fire_conventional_alarm"],
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
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    wall_framing_type: "Timber softwood",
    roof_framing_type: "Timber trusses",
    ext: ["ext_fc_weatherboard"],
    rc: ["rc_colorbond"],
    rd: ["rd_colorbond"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_natural"],
    vent: ["hvac_split_multi"],
    fire: ["fire_conventional_alarm"],
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
 * - Checkbox groups (string[]): merge — typical items are added if missing.
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
