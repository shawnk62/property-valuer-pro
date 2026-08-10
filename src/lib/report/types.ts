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
  | "baths"
  | "living";

export interface ReportPhoto {
  id: string;
  slot: PhotoSlot | null;
  caption: string;
  url: string;
}

export interface ComparableSale {
  id: string;
  address: string;
  saleDate: string;
  salePrice: string;
  landArea: string;
  comments: string;
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
  { slot: "kitchen", label: "Kitchen" },
  { slot: "baths", label: "Baths" },
  { slot: "living", label: "Living Room" },
];
