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
  relativity: SaleRelativity;
  /** Signed dollar adjustment to the comparable sale price. */
  amount: number;
}

export interface ComparableSale {
  id: string;
  address: string;
  saleDate: string;
  salePrice: string;
  landArea: string;
  comments: string;
  /** Optional living area from CSV / entry. */
  gla?: string;
  /** URAR-style feature adjustments (shared across report types). */
  adjustments?: Record<string, FeatureAdjustment>;
  /**
   * AI (or manual) narrative for the report sales evidence column.
   * Built from relativity marks on the adjustment grid.
   */
  narrative?: string;
}

export interface ReportNarrative {
  brief: string;
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
