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
  | "pool";

export interface ReportPhoto {
  id: string;
  slot: PhotoSlot | null;
  caption: string;
  /** Public or signed URL for display and Word export. */
  url: string;
  /** Supabase Storage object path — used for delete. */
  storagePath?: string;
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
  improvements: string;
  accommodation: string;
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
