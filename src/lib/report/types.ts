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
  /** IndexedDB key for an offline copy of this photo. */
  localBlobKey?: string;
  /** ISO timestamp when the photo was captured / approved (auto-set). */
  capturedAt?: string;
  /**
   * When slot is null: "map" = additional labeled map/overlay tile (annex maps);
   * "title" = Certificate of Title page (annex);
   * "survey" = Survey Plan page (annex);
   * "cadastral" = Cadastral plan page (annex, A4, before survey);
   * "annex" = additional appendix PDF/image page (A4);
   * "photo" or omitted = additional subject photograph.
   */
  kind?: "map" | "photo" | "title" | "survey" | "cadastral" | "annex";
  /** Groups pages from one dropped appendix PDF. */
  annexGroup?: string;
  /** Heading for that appendix document. */
  annexTitle?: string;
  /**
   * Where an annex document prints. Missing means the client annexure only,
   * so existing documents are unchanged. Working-file documents print only in
   * the field and working notes annexure.
   */
  annexDestination?: "client" | "working" | "both";
  /**
   * When true, the image stays on the job (working file) but is omitted from
   * the printed report, Word export, cover and annexures.
   */
  omitFromReport?: boolean;
}

export function photoIsOnReport(photo: ReportPhoto | null | undefined): boolean {
  return Boolean(photo?.url) && photo?.omitFromReport !== true;
}

export function photosOnReport(photos: ReportPhoto[] | null | undefined): ReportPhoto[] {
  return (photos ?? []).filter((p) => p.omitFromReport !== true);
}

export function isTitleAnnexPhoto(photo: ReportPhoto): boolean {
  if (photo.kind === "title") return true;
  return /^certificate of title/i.test(photo.caption || "");
}

export function isSurveyAnnexPhoto(photo: ReportPhoto): boolean {
  if (photo.kind === "survey") return true;
  return /^survey plan/i.test(photo.caption || "");
}

export function isMapAnnexPhoto(photo: ReportPhoto): boolean {
  if (photo.kind === "map") return true;
  return Boolean(photo.slot && String(photo.slot).startsWith("map_"));
}

export function titlePhotosOnReport(photos: ReportPhoto[] | null | undefined): ReportPhoto[] {
  const seen = new Set<string>();
  return photosOnReport(photos).filter(isTitleAnnexPhoto).filter((photo) => {
    const key = photo.url || photo.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function surveyPhotosOnReport(photos: ReportPhoto[] | null | undefined): ReportPhoto[] {
  return photosOnReport(photos).filter(isSurveyAnnexPhoto);
}

export function isCadastralAnnexPhoto(photo: ReportPhoto): boolean {
  if (photo.kind === "cadastral") return true;
  return /^cadastral plan/i.test(photo.caption || "");
}

export function cadastralPhotosOnReport(photos: ReportPhoto[] | null | undefined): ReportPhoto[] {
  return photosOnReport(photos).filter(isCadastralAnnexPhoto);
}

export function isExtraAnnexPhoto(photo: ReportPhoto): boolean {
  if (photo.kind === "annex") return true;
  return /^appendix document|^annexure document/i.test(photo.caption || "");
}

export function extraAnnexPhotosOnReport(photos: ReportPhoto[] | null | undefined): ReportPhoto[] {
  return photosOnReport(photos).filter(isExtraAnnexPhoto);
}

function annexDocumentTitle(page: ReportPhoto): string {
  const titled = page.annexTitle?.trim();
  if (titled) return titled;
  return String(page.caption ?? "")
    .replace(/\s+[—-]\s+page\s+\d+\s*$/i, "")
    .replace(/\s+page\s+\d+\s*$/i, "")
    .trim();
}

export function annexPageLabel(title: string, index: number): string {
  return `${title} Page ${index + 1}`;
}

export function annexPrintsOnClient(photo: ReportPhoto): boolean {
  const destination = photo.annexDestination ?? "client";
  return destination === "client" || destination === "both";
}

export function annexPrintsInWorkingFile(photo: ReportPhoto): boolean {
  return photo.annexDestination === "working" || photo.annexDestination === "both";
}

export function extraAnnexGroups(
  photos: ReportPhoto[] | null | undefined,
): { id: string; title: string; pages: ReportPhoto[] }[] {
  const pages = (photos ?? []).filter(isExtraAnnexPhoto);
  const order: string[] = [];
  const map = new Map<string, ReportPhoto[]>();
  for (const page of pages) {
    const title = annexDocumentTitle(page);
    const id = page.annexGroup || (title ? `title:${title.toLowerCase()}` : page.id);
    if (!map.has(id)) {
      map.set(id, []);
      order.push(id);
    }
    map.get(id)!.push(page);
  }
  return order.map((id, i) => {
    const groupPages = map.get(id) ?? [];
    const title = annexDocumentTitle(groupPages[0] ?? {}) || `Annexure document ${i + 1}`;
    return { id, title, pages: groupPages };
  });
}

export function extraAnnexGroupsOnReport(
  photos: ReportPhoto[] | null | undefined,
): { id: string; title: string; pages: ReportPhoto[] }[] {
  const pages = extraAnnexPhotosOnReport(photos);
  const order: string[] = [];
  const map = new Map<string, ReportPhoto[]>();
  for (const page of pages) {
    const title = annexDocumentTitle(page);
    const id = page.annexGroup || (title ? `title:${title.toLowerCase()}` : page.id);
    if (!map.has(id)) {
      map.set(id, []);
      order.push(id);
    }
    map.get(id)!.push(page);
  }
  return order.map((id, i) => {
    const groupPages = map.get(id) ?? [];
    const title = annexDocumentTitle(groupPages[0] ?? {}) || `Annexure document ${i + 1}`;
    return { id, title, pages: groupPages };
  });
}

export function clientAnnexGroupsOnReport(
  photos: ReportPhoto[] | null | undefined,
) {
  return extraAnnexGroupsOnReport(photos)
    .map((group) => ({ ...group, pages: group.pages.filter(annexPrintsOnClient) }))
    .filter((group) => group.pages.length > 0);
}

export function workingAnnexGroupsOnReport(
  photos: ReportPhoto[] | null | undefined,
) {
  return extraAnnexGroupsOnReport(photos)
    .map((group) => ({ ...group, pages: group.pages.filter(annexPrintsInWorkingFile) }))
    .filter((group) => group.pages.length > 0);
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
  /** When true, automatic site/GLA $ must not overwrite this amount. */
  amountManual?: boolean;
  /** When true, automatic superior/inferior for site/GLA must not overwrite relativity. */
  relativityManual?: boolean;
}

export interface ComparableSale {
  id: string;
  address: string;
  saleDate: string;
  salePrice: string;
  landArea: string;
  comments: string;
  /** Printed rating on the sales schedule. Blank uses the calculated rating. */
  printRating?: string;
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
  /** IndexedDB key for an offline copy of photoUrl. */
  photoLocalKey?: string;
  /**
   * When true, the sale stays in the working file (notes, photos, adjustments)
   * but is omitted from the printed report and from the compact adjustment grid.
   */
  omitFromReport?: boolean;
}

/** Sales that print and appear in the compact grid. */
export function salesOnReport(sales: ComparableSale[] | null | undefined): ComparableSale[] {
  return (sales ?? []).filter((s) => s.omitFromReport !== true);
}

/** Sales held in the working file only. */
export function salesHeldBack(sales: ComparableSale[] | null | undefined): ComparableSale[] {
  return (sales ?? []).filter((s) => s.omitFromReport === true);
}

export interface ReportNarrative {
  /** §1.1 Instructions from the client. */
  instructions: string;
  brief: string;
  /** Shawn Exam executive summary paragraph above the particulars grid. Independent of §1.1. */
  executiveSummary: string;
  /** §5.1 Location — distance and direction from CBD / nearest centre. */
  location: string;
  /** §5.2 Neighbourhood — locality and neighbouring development only. */
  neighbourhood: string;
  /** §6.1 Physical Description of the allotment (AI or template). */
  sitePhysical: string;
  /** How the site was identified. */
  siteIdentification: string;
  /** Legal access — 2.2 Title Particulars. */
  legalAccess: string;
  /** Narrative written from the full imported title search. Manual text is kept. */
  titleSearchNarrative: string;
  /** Short easements cell. Same wording as the title narrative. Manual text is kept. */
  encumbrancesSummary: string;
  /** Physical ingress/egress — 2.3 Particulars of Land when relevant. */
  physicalAccess: string;
  /** §6.2 Services/Amenities (AI or template). */
  servicesAmenities: string;
  improvements: string;
  accommodation: string;
  /** §9.2 Condition of Improvements (AI or template from component conditions + notes). */
  conditionImprovements: string;
  /** Zoning purpose rewritten as a sentence. Manual text is kept. */
  zoningPurpose: string;
  /** Highest and best use — editable; prints in 1.8 / Basis of valuation. */
  highestBestUse: string;
  remarks: string;
  /** Shawn Exam — individual commentary (prints before appendices). */
  individualCommentary: string;
  /** Assignment only. Written by the valuer. Not generated. Default excluded. */
  assignmentReflection: string;
  /** PropertyPRO risk analysis — one paragraph per heading. */
  riskAnalysis: string;
  /** Direct comparison / valuation approach narrative. */
  valuationApproach: string;
  envIntro: string;
  acidSulphate: string;
  floodAssessment: string;
  noiseNuisances: string;
  /** Title administrative advices, including Vegetation Management Act notices. */
  titleNotices: string;
  amenities: string;
  popularDestinations: string;
  marketAustralia: string;
  marketState: string;
  marketRegion: string;
  marketLocality: string;
  salesAnalysis: string;
  /** Comments on the comparable sales. Prints under the sales grids. */
  salesComments: string;
  /** Final reconciliation of value. Prints after the sales comments. */
  valueReconciliation: string;
  disclaimer: string;
  assumptions: string;
  references: string;
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
  /** Override of the subject asking price shown on the sale price line. */
  subjectAskingPrice?: string;
  /** Override of the subject topography printed on the adjustment grid. */
  subjectTopography?: string;
  /** Subject-column description for the first Other adjustment row. */
  subjectOther1?: string;
  /** Subject-column description for the second Other adjustment row. */
  subjectOther2?: string;
  /**
   * Sales map image (HTTPS preferred for cross-device; data URL local-only).
   */
  salesMapUrl?: string;
  /** Supabase Storage path for salesMapUrl when uploaded. */
  salesMapStoragePath?: string;
  /** Location-map (s.5.2) Google zoom. Sales map is unchanged. */
  subjectMapZoom?: number;
  /** When true, Generate maps keeps subjectMapZoom instead of refitting the nearest centre. */
  subjectMapManual?: boolean;
  /** Geocoded subject coordinates used for Location distances. */
  subjectLat?: number;
  subjectLng?: number;
  /** When false, the sales-evidence table is omitted from the PDF. Default true. */
  printSalesEvidence?: boolean;
  /** When false, the adjustment grid is omitted from the PDF. Default true. */
  printAdjustmentGrid?: boolean;
  /** Feature ids the valuer has unticked for print. Default none (all visible rows print). */
  omitAdjustmentPrintRows?: string[];
  /**
   * Per-narrative-block print flags. Missing or true = print.
   * False keeps the working text and omits it from the PDF.
   */
  printNarrative?: Partial<Record<keyof ReportNarrative, boolean>>;
  /** Keys the valuer edited. Auto-AI must not replace these. */
  manualNarrative?: Partial<Record<keyof ReportNarrative, boolean>>;
  /** Optional named estate used when collecting suburb notes. */
  nbhdEstateHint?: string;
  /** Trial: web-search neighbourhood claims awaiting valuer sign-off. */
  nbhdClaims?: Array<{
    id: string;
    kind: string;
    text: string;
    source?: string;
    accepted: boolean;
  }>;
  marketClaimsAustralia?: Array<{
    id: string;
    kind: string;
    text: string;
    source?: string;
    accepted: boolean;
  }>;
  marketClaimsState?: Array<{
    id: string;
    kind: string;
    text: string;
    source?: string;
    accepted: boolean;
  }>;
  marketClaimsRegion?: Array<{
    id: string;
    kind: string;
    text: string;
    source?: string;
    accepted: boolean;
  }>;
  marketClaimsLocality?: Array<{
    id: string;
    kind: string;
    text: string;
    source?: string;
    accepted: boolean;
  }>;
  reportReferences?: Array<{
    id: string;
    text: string;
    sourceRaw?: string;
    accepted: boolean;
  }>;
  /** Reference list style. Missing means Harvard. */
  referenceStyle?: "harvard" | "apa";
  salesMapPins?: Array<{
    id: string;
    label: string;
    shortLabel: string;
    lat: number;
    lng: number;
    kind: "subject" | "sale" | "custom";
    saleId?: string;
    address?: string;
  }>;
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

/** Site / street slots only — interiors do not apply to vacant land. Extra slots stay unlimited. */
export const VACANT_PHOTO_SLOTS: { slot: PhotoSlot; label: string }[] = [
  { slot: "front", label: "Front / street view" },
  { slot: "street", label: "Streetscape" },
  { slot: "rear", label: "Rear / opposite boundary" },
  { slot: "view", label: "View / outlook" },
  { slot: "view_2", label: "View 2" },
];

export function photoSlotsForJob(vacantLand: boolean) {
  return vacantLand ? VACANT_PHOTO_SLOTS : PHOTO_SLOTS;
}

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
