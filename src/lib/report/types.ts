/**
 * Report Workspace data model (Phase 2).
 *
 * `values` keys are the schema v14 inspection field `name` keys, verbatim.
 * Never rename a key here — the production inspection form owns them.
 */
export type FieldValue = string | string[] | boolean | number | null;

export type InspectionValues = Record<string, FieldValue>;

export type PhotoSlot =
  | "front"
  | "rear"
  | "street"
  | "kitchen"
  | "baths" // first bath; key kept so existing drafts still match
  | "bath_2"
  | "bath_3"
  | "living"
  | "view"
  | "view_2"
  | "pool"
  // Subject maps / overlays — manual attach only; omit from export when empty
  | "map_location"
  | "map_site_dimensions"
  | "map_aerial"
  | "map_zoning"
  | "map_overlays"
  | "map_nearby_overlays"
  | "map_place_based"
  | "map_flood"
  | "map_bushfire"
  | "map_heritage"
  | "map_landslide"
  | "map_acid_sulfate"
  | "map_easements"
  | "map_topography"
  | "map_planning_permits";

export interface ReportPhoto {
  id: string;
  slot: PhotoSlot | null;
  caption: string;
  /** Public or signed URL for display and Word export. */
  url: string;
  /** Supabase Storage object path — used for delete. */
  storagePath?: string;
  /** ISO timestamp when the photo was captured / approved (auto-set). */
  capturedAt?: string;
  /**
   * When slot is null: "map" = additional labeled map/overlay tile (annex maps);
   * "photo" or omitted = additional subject photograph.
   */
  kind?: "map" | "photo";
}

/** Relativity mark on a comparison feature (URAR-style description). */
export type SaleRelativity =
  | "inferior"
  | "slightly inferior"
  | "similar"
  | "slightly superior"
  | "superior";

export interface FeatureAdjustment {
  /**
   * URAR DESCRIPTION — qualitative mark (similar / superior / …).
   * Shown beside the dollar adjustment, not above it.
   */
  relativity: SaleRelativity;
  /** Optional factual detail in DESCRIPTION (e.g. 390m², 4/2, 1 car). */
  detail?: string;
  /** URAR + (-) $ Adjustment — signed dollars applied to the comparable. */
  amount: number;
}

export interface ComparableSale {
  id: string;
  address: string;
  saleDate: string;
  salePrice: string;
  landArea: string;
  comments: string;
  /** Gross living area (Sale Price/GLA row + GLA adjustment line). */
  gla?: string;
  beds?: string;
  baths?: string;
  cars?: string;
  /** URAR: Proximity to Subject. */
  proximity?: string;
  /** URAR: Data Source(s). */
  dataSource?: string;
  /** URAR: Verification Source(s). */
  verificationSource?: string;
  /** URAR VALUE ADJUSTMENTS by feature id. */
  adjustments?: Record<string, FeatureAdjustment>;
  /**
   * AI (or manual) narrative for the report sales evidence column.
   */
  narrative?: string;
  /**
   * When true, AI must not overwrite narrative (auto or Regenerate).
   * Set automatically when the valuer edits the narrative text, or via Manual lock.
   */
  narrativeManual?: boolean;
  /**
   * In-house working notes under the grid column. Not printed, not sent to AI.
   */
  workingNotes?: string;
  /**
   * Front elevation photo (HTTPS preferred for cross-device; data URL local-only).
   */
  photoUrl?: string;
  /** Supabase Storage path for photoUrl when uploaded. */
  photoStoragePath?: string;
}

export interface ReportNarrative {
  brief: string;
  /** §5.1 Description of Neighbourhood (AI or template). */
  location: string;
  /** §6.1 Physical Description of the allotment (AI or template). */
  sitePhysical: string;
  /** §6.2 Services/Amenities (AI or template). */
  servicesAmenities: string;
  improvements: string;
  accommodation: string;
  /** §9.2 Condition of Improvements (AI or template from component conditions + notes). */
  conditionImprovements: string;
  remarks: string;
}

export interface ReportMeta {
  valueAmount: string;
  valueDate: string;
  inspectionDate: string;
  valuerName: string;
  firmName: string;
  /**
   * $/m² rate for Gross Living Area adjustments.
   * Adjustment = round_to_1000(rate × (subject GLA − comparable GLA)).
   */
  glaRatePerM2?: string;
  /**
   * $/m² rate for Site (land) adjustments.
   * Adjustment = round_to_1000(rate × (subject site − comparable site)).
   */
  siteRatePerM2?: string;
  /**
   * Sales map image (HTTPS preferred for cross-device; data URL local-only).
   */
  salesMapUrl?: string;
  /** Supabase Storage path for salesMapUrl when uploaded. */
  salesMapStoragePath?: string;
}

export interface ReportDraft {
  inspectionId: string;
  values: InspectionValues;
  narrative: ReportNarrative;
  photos: ReportPhoto[];
  sales: ComparableSale[];
  reportMeta: ReportMeta;
}

export interface InspectionListItem {
  inspectionId: string;
  address: string;
  suburb: string;
  status: "Draft" | "In progress" | "Ready";
  updatedAt: string;
}

/** Subject improvement photographs (inspection / annex). */
export const PHOTO_SLOTS: { slot: PhotoSlot; label: string }[] = [
  { slot: "front", label: "Front" },
  { slot: "rear", label: "Rear" },
  { slot: "street", label: "Street" },
  { slot: "living", label: "Living Room" },
  { slot: "kitchen", label: "Kitchen" },
  { slot: "baths", label: "Bath" },
  { slot: "bath_2", label: "Bath" },
  { slot: "bath_3", label: "Bath" },
  { slot: "view", label: "View" },
  { slot: "view_2", label: "View" },
  { slot: "pool", label: "Pool" },
];

/**
 * Planning / site maps for the report annex (Landchecker-style layers).
 * Manual insert only. Empty slots are never written to Word/PDF export.
 */
export const MAP_SLOTS: { slot: PhotoSlot; label: string }[] = [
  // Inline in report body (sections 5–6) when attached
  { slot: "map_location", label: "Location map (s.5.2)" },
  { slot: "map_aerial", label: "Aerial of subject site (s.6.1)" },
  { slot: "map_site_dimensions", label: "Site dimensions plan" },
  { slot: "map_flood", label: "Flood hazard map (s.6.3)" },
  { slot: "map_bushfire", label: "Bushfire hazard map (s.6.4)" },
  { slot: "map_overlays", label: "Overlays map (Annexure 3)" },
  { slot: "map_landslide", label: "Landslide hazard map" },
  // Additional planning layers (annexure if attached)
  { slot: "map_zoning", label: "Zoning map — Zones (s.4)" },
  { slot: "map_nearby_overlays", label: "Nearby overlays" },
  { slot: "map_place_based", label: "Place-based plans" },
  { slot: "map_heritage", label: "Heritage" },
  { slot: "map_acid_sulfate", label: "Acid sulfate" },
  { slot: "map_easements", label: "Easements" },
  { slot: "map_topography", label: "Topography" },
  { slot: "map_planning_permits", label: "Planning permits" },
];

/** Slots rendered inline in the report body (not only annexure). */
export const BODY_MAP_SLOTS: PhotoSlot[] = [
  "map_location",
  "map_aerial",
  "map_site_dimensions",
  "map_zoning",
  "map_flood",
  "map_bushfire",
];

/**
 * Order of map drop-zones in the Photos import panel only.
 * Mirrors a typical Landchecker Property Report page sequence so maps can be
 * dropped in the same order they appear in that PDF. Does not control where
 * each map is placed in the finished report (that is slot-based).
 */
export const MAP_SLOT_IMPORT_ORDER: PhotoSlot[] = [
  "map_location",
  "map_aerial",
  "map_zoning",
  "map_overlays",
  "map_flood",
  "map_bushfire",
  "map_landslide",
  "map_place_based",
  "map_nearby_overlays",
  "map_heritage",
  "map_acid_sulfate",
  "map_easements",
  "map_topography",
  "map_site_dimensions",
  "map_planning_permits",
];

/** MAP_SLOTS sorted for the import panel (Landchecker order). */
export function mapSlotsForImport(): { slot: PhotoSlot; label: string }[] {
  const bySlot = new Map(MAP_SLOTS.map((m) => [m.slot, m]));
  const ordered: { slot: PhotoSlot; label: string }[] = [];
  for (const slot of MAP_SLOT_IMPORT_ORDER) {
    const entry = bySlot.get(slot);
    if (entry) ordered.push(entry);
  }
  // Any slots added to MAP_SLOTS later but missing from the order list still appear
  for (const entry of MAP_SLOTS) {
    if (!MAP_SLOT_IMPORT_ORDER.includes(entry.slot)) ordered.push(entry);
  }
  return ordered;
}

export const ALL_MEDIA_SLOTS: { slot: PhotoSlot; label: string }[] = [
  ...PHOTO_SLOTS,
  ...MAP_SLOTS,
];
