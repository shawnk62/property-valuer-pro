import type { InspectionListItem, InspectionValues, ReportDraft } from "./types";

/**
 * Mock inspections standing in for the production inspection records.
 * All keys below are schema v14 catalogue `name` keys, verbatim.
 * Some fields are intentionally left unset so omission behaviour is visible.
 */

const sippyDownsValues: InspectionValues = {
  // [1] Property Identification & Inspection Details
  prop_assignment: "Purchase",
  insp_purpose: "Purchase from third party",
  prop_address: "17 Coolibah Crescent",
  prop_suburb: "Sippy Downs",
  prop_state: "QLD",
  prop_postcode: "4556",
  prop_lotplan: "Lot 42 on RP 214887",
  prop_title: "50412345",
  prop_legal: "Lot 42 on Registered Plan 214887, County of Canning, Parish of Mooloolah",
  prop_lga: "Sunshine Coast Regional Council",
  prop_parish: "Mooloolah",
  prop_owner: "J G & M L Hartigan",
  prop_occupant: "Owner",
  prop_rights: "Fee Simple",
  prop_sitearea: "452",
  prop_areaunit: "m2",
  prop_dimensions: "15.1m frontage x 30.0m depth",
  prop_shape: "Regular rectangular",
  prop_zoning: "Low density residential",
  prop_zoning_desc: "Low density residential zone under the Sunshine Coast Planning Scheme 2014",
  prop_zoning_comp: "Legal",
  prop_hbu: "Yes",
  prop_flood: "No",
  prop_flood_map: "Sunshine Coast Council Flood Hazard Overlay",
  prop_offered: "Yes",
  prop_offer_details: "Listed with Ray White Sippy Downs, offers over $875,000, February 2026",
  prop_contract_price: "$895,000",
  prop_contract_date: "24/07/2026",
  prop_seller_owner: "Yes",
  prop_assistance: "No",
  insp_date: "05/08/2026",
  insp_time: "10:15am",
  insp_weather: "Fine and clear",
  insp_valuer: "Phillip R Peterson, AVI",
  insp_firm: "Peterson Property Valuations Pty Ltd",
  // prop_adverse_site, prop_assistance_details, insp_access_limits left unset

  // [1A] Neighbourhood & Off-site Improvements
  nbhd_location: "Suburban",
  nbhd_builtup: "Over 75%",
  nbhd_growth: "Stable",
  nbhd_values: "Increasing",
  nbhd_demand: "Shortage",
  nbhd_marketing: "Under 3 mths",
  nbhd_price_range: "$720,000 - $1,150,000",
  nbhd_age: "18",
  nbhd_use_one: "85",
  nbhd_use_24: "5",
  nbhd_use_mf: "5",
  nbhd_use_comm: "5",
  nbhd_description:
    "An established residential estate approximately 6 kilometres south west of Maroochydore and within 3 kilometres of the University of the Sunshine Coast.",
  nbhd_market_conditions:
    "Demand remains firm with limited established stock and short marketing periods.",
  offsite_road_type: "Access Street",
  offsite_road_surface: "Bitumen sealed",
  offsite_road_ownership: "Public",
  offsite_carriageway: "Dual lane",
  offsite_terminates: "Through road",
  offsite_kerb: "Barrier kerb and channel",
  offsite_footpaths: "Concrete one side",
  offsite_verge: "Grassed",
  offsite_lighting: "Full street lighting",
  offsite_drainage: "Piped system",
  offsite_typical: "Yes",
  // nbhd_boundaries, nbhd_character, offsite_alley, offsite_notes left unset

  // [2] Site
  svc_water_type: "Town water",
  svc_water_cond: "Good",
  svc_sewer_type: "Town sewer",
  svc_sewer_cond: "Good",
  svc_elec_type: "Underground mains",
  svc_elec_cond: "Good",
  svc_elec_3phase: "No",
  svc_storm_type: "Piped to kerb",
  svc_storm_cond: "Good",
  svc_tel_type: "Available",
  svc_internet_type: "NBN fibre to the node",
  topo: ["topo_gentle", "topo_gentle_to_road", "topo_well_drained"],
  land: ["land_lawn", "land_garden_beds", "land_irrigation", "land_pathways"],
  va: ["va_double_driveway", "va_side_access"],
  fence: ["fence_fenced", "fence_timber", "fence_colorbond", "fence_pedestrian_gates"],
  // exc, prop_view, svc_gas_* left unset

  // [3] Improvements & Construction
  imp_design: "Contemporary",
  imp_lowset: true,
  imp_storeys: "1",
  imp_yearbuilt: "2003",
  imp_effage: "15",
  imp_quality: "Average",
  imp_units: "1",
  ext: ["ext_brick_veneer"],
  rc: ["rc_concrete_tiles"],
  rd: ["rd_colorbond", "rd_pvc"],
  foundations: ["found_concrete_slab"],
  floor_structure: ["floor_struct_concrete"],
  imp_gla: "168",
  area_living_downstairs: "168",
  area_covered_rear_patio: "24",
  area_garage: "37",
  imp_rooms: "7",
  imp_beds: "3",
  imp_baths: "2",
  accom: [
    "accom_open_plan_ldk",
    "accom_media",
    "accom_bir_bedrooms",
    "accom_main_wir_ensuite",
    "accom_bathroom",
    "accom_separate_toilet",
    "accom_laundry",
    "accom_rear_patio_covered",
  ],
  flr: ["flr_ceramic", "flr_carpet"],
  il: ["il_plasterboard"],
  ceil: ["ceil_plasterboard"],
  vent: ["hvac_split_multi", "vent_natural"],
  imp_add_features: "6.6kW rooftop solar photovoltaic system installed 2021.",
  // sd, design_features_notes, area_* others left unset

  // [3A] Kitchen & Bathrooms
  kit_bench_type: "Laminate",
  kit_bench_cond: "Average",
  kit_cab_type: "Laminate",
  kit_cab_cond: "Average",
  kit_splash_type: "Glass",
  kit_tapware_type: "Chrome",
  kit_overall_notes:
    "Original kitchen with electric cooktop, underbench oven and stainless steel dishwasher.",
  bath_vanity_type: "Laminate",
  bath_tiles_type: "Ceramic tiles",
  bath_floor: "Ceramic tiles",
  bath_surround: "Ceramic tiles",
  bath_tapware_type: "Chrome",
  bath_overall_notes:
    "Two bathrooms comprising main bathroom with bath and shower, separate toilet, and ensuite to the master bedroom.",
  // app, kit_feat, bath_feat left unset

  // [5] External Areas, Parking & Ancillary
  park: ["park_garage_2", "park_electric_door", "park_secure"],
  anc: ["anc_shed", "anc_patio"],
  // pool, load, hs, fire, sec, aux, lift left unset

  // [6] Overall Condition & Sign-off
  overall_cond: "Good",
  overall_site_cond: "Good",
  other_notes:
    "The dwelling presents in good order throughout with no functional obsolescence noted. Marketability is considered good.",
  sign_name: "Phillip R Peterson",
  sign_date: "07/08/2026",
  sign_member: "AVI 1083",
  sign_reg: "1083",
  // defects_notes, photo_refs, sign_sig left unset
};

export const MOCK_INSPECTIONS: InspectionListItem[] = [
  {
    inspectionId: "insp-2026-0412",
    address: "17 Coolibah Crescent",
    suburb: "Sippy Downs QLD 4556",
    status: "In progress",
    updatedAt: "07/08/2026",
  },
  {
    inspectionId: "insp-2026-0409",
    address: "9 Tanderra Street",
    suburb: "Buderim QLD 4556",
    status: "Draft",
    updatedAt: "04/08/2026",
  },
  {
    inspectionId: "insp-2026-0401",
    address: "22 Pelican Waters Boulevard",
    suburb: "Pelican Waters QLD 4551",
    status: "Ready",
    updatedAt: "29/07/2026",
  },
  {
    inspectionId: "insp-2026-0396",
    address: "3/48 Alexandra Parade",
    suburb: "Alexandra Headland QLD 4572",
    status: "Draft",
    updatedAt: "22/07/2026",
  },
];

const EMPTY_SUBJECT: InspectionValues = {
  prop_assignment: "Purchase",
  insp_purpose: "Purchase from third party",
};

/** Only the Sippy Downs inspection is fully populated; the rest are stubs. */
export function getMockValues(inspectionId: string): InspectionValues {
  if (inspectionId === "insp-2026-0412") return { ...sippyDownsValues };
  const listed = MOCK_INSPECTIONS.find((i) => i.inspectionId === inspectionId);
  if (!listed) return { ...EMPTY_SUBJECT };
  const [suburb = "", state = "", postcode = ""] = listed.suburb.split(" ");
  return {
    ...EMPTY_SUBJECT,
    prop_address: listed.address,
    prop_suburb: suburb,
    prop_state: state,
    prop_postcode: postcode,
    prop_lga: "Sunshine Coast Regional Council",
    insp_valuer: "Phillip R Peterson, AVI",
    insp_firm: "Peterson Property Valuations Pty Ltd",
  };
}

export function createDraft(inspectionId: string): ReportDraft {
  const values = getMockValues(inspectionId);
  return {
    inspectionId,
    values,
    narrative: { brief: "", location: "", improvements: "", accommodation: "", remarks: "" },
    photos: [],
    sales: [],
    reportMeta: {
      valueAmount: inspectionId === "insp-2026-0412" ? "895,000" : "",
      valueDate: inspectionId === "insp-2026-0412" ? "07/08/2026" : "",
      inspectionDate: String(values["insp_date"] ?? ""),
      valuerName: String(values["insp_valuer"] ?? "Phillip R Peterson, AVI"),
      firmName: String(values["insp_firm"] ?? "Peterson Property Valuations Pty Ltd"),
    },
  };
}
