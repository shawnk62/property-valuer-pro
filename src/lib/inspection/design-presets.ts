import type { InspectionValues } from "./types";

/**
 * Design / Style presets for Queensland / Australian residential stock.
 * Single primary values only. Existing answers are never overwritten.
 */
export const DESIGN_PRESETS: Record<string, InspectionValues> = {
  Queenslander: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard", "ext_timber_vj"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_vj"],
    ceil: ["ceil_vj_timber"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah", "accom_rear_verandah", "accom_side_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Ashgrovian: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_vj"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Workers Cottage": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_vj"],
    ceil: ["ceil_timber"],
    flr: ["flr_solid_timber", "flr_pine", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Colonial: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_timber"],
    ceil: ["ceil_timber"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Victorian: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_timber"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.5 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Federation: {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_terracotta"],
    rd: ["rd_metal"],
    il: ["il_timber"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Federation Filigree": {
    imp_highset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_timber"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Federation Bungalow": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_timber_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_terracotta"],
    rd: ["rd_metal"],
    il: ["il_timber"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    accom: ["accom_front_verandah"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Interwar: {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    vent: ["vent_subfloor"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Art Deco": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_rendered"],
    rc: ["rc_terracotta"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Post-war Timber": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_stumps"],
    floor_structure: ["floor_struct_timber"],
    ext: ["ext_timber_weatherboard"],
    rc: ["rc_corrugated"],
    rd: ["rd_metal"],
    il: ["il_plasterboard", "il_likely_asbestos"],
    ceil: ["ceil_plasterboard", "ceil_likely_asbestos"],
    flr: ["flr_solid_timber", "flr_polished"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Post-war Brick": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_brick"],
    rc: ["rc_concrete_tiles"],
    rd: ["rd_metal"],
    il: ["il_plasterboard", "il_likely_asbestos"],
    ceil: ["ceil_plasterboard", "ceil_likely_asbestos"],
    flr: ["flr_carpet", "flr_polished"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Mid-century Modern": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_brick"],
    rc: ["rc_concrete_tiles"],
    rd: ["rd_metal"],
    il: ["il_plasterboard", "il_likely_asbestos"],
    ceil: ["ceil_plasterboard", "ceil_likely_asbestos"],
    flr: ["flr_solid_timber"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Brick and Tile": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_brick"],
    rc: ["rc_concrete_tiles"],
    rd: ["rd_metal"],
    il: ["il_plasterboard", "il_likely_asbestos"],
    ceil: ["ceil_plasterboard", "ceil_likely_asbestos"],
    flr: ["flr_carpet"],
    ceil_heights_type: "Typical",
    light: ["light_mixed"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    kit_feat: ["kit_gas"],
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Contemporary: {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_brick"],
    rc: ["rc_colorbond"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_mixed"],
    vent: ["hvac_split_multi"],
    fire: ["fire_conventional_alarm"],
    kit_feat: ["kit_induction"],
    app: ["app_bosch"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    bath_feat: ["bath_frameless"],
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Hamptons: {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_fc_weatherboard"],
    rc: ["rc_colorbond"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "3.0 metres",
    light: ["light_mixed"],
    vent: ["hvac_ducted_heating_ac"],
    fire: ["fire_conventional_alarm"],
    kit_feat: ["kit_softclose"],
    app: ["app_fisherpaykel"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    bath_feat: ["bath_freestanding"],
    am: ["am_wir"],
    accom: ["accom_front_verandah"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  Coastal: {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_fc_weatherboard"],
    rc: ["rc_colorbond"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_mixed"],
    vent: ["hvac_split_multi"],
    fire: ["fire_conventional_alarm"],
    kit_feat: ["kit_induction"],
    app: ["app_fisherpaykel"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    bath_feat: ["bath_frameless"],
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Acreage or Rural": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_brick"],
    rc: ["rc_colorbond"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_mixed"],
    vent: ["hvac_split_multi"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Ceramic tiles",
    bath_floor: "Ceramic tiles",
    bath_surround: "Ceramic tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },

  "Townhouse or Terrace": {
    imp_lowset: true,
    imp_units: "1",
    foundations: ["found_concrete_slab"],
    floor_structure: ["floor_struct_concrete"],
    ext: ["ext_brick"],
    rc: ["rc_colorbond"],
    rd: ["rd_metal"],
    il: ["il_plasterboard"],
    ceil: ["ceil_plasterboard"],
    flr: ["flr_engineered"],
    ceil_heights_type: "2.7 metres",
    light: ["light_mixed"],
    vent: ["hvac_split_single"],
    fire: ["fire_conventional_alarm"],
    bath_tiles_type: "Porcelain tiles",
    bath_floor: "Porcelain tiles",
    bath_surround: "Porcelain tiles",
    am: ["am_bir"],
    kit_tapware_type: "Chrome",
    bath_tapware_type: "Chrome"
  },
};

export function isUnset(value: InspectionValues[string]): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

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
