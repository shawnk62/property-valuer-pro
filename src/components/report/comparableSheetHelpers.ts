/**
 * Shared mapping, matching and prefill for full-page comparable sheets
 * across sales, lease evidence and vacant land sales.
 *
 * Prefill is display-time only: it never mutates the source listing.
 * Edits are written only to the current section's record. accepted/overrides
 * patches are merged with the effective (prefilled) maps so a single field
 * edit cannot drop other prefilled keys. description/commentary use
 * `!== undefined` so an explicit empty value does not snap back to the source.
 */
import type { ComparableSale, ReportMeta } from "@/lib/report/types";
import type { ComparableSheetData, SheetPhoto } from "./ComparableSheet";

export type LeaseSheetRecord = NonNullable<ReportMeta["ciLeaseComps"]>[number];
export type LandSheetRecord = NonNullable<ReportMeta["ciLandSales"]>[number];
export type SheetKind = ComparableSheetData["kind"];

export interface SheetPools {
  sales?: ComparableSale[] | undefined;
  leases?: LeaseSheetRecord[] | undefined;
  landSales?: LandSheetRecord[] | undefined;
}

type PersistedSheetFields = {
  description?: string;
  extraPhotos?: Array<{ url: string; include?: boolean }>;
  includeSheet?: boolean;
  acceptedFields?: Record<string, boolean>;
  fieldOverrides?: Record<string, string>;
  verificationLink?: string;
};

function persistedSheetFields(source: {
  description?: string;
  extraPhotos?: Array<{ url: string; include?: boolean }>;
  includeSheet?: boolean;
  acceptedFields?: Record<string, boolean>;
  fieldOverrides?: Record<string, string>;
  verificationLink?: string;
}): PersistedSheetFields {
  const out: PersistedSheetFields = {};
  if (source.description !== undefined) out.description = source.description;
  if (source.extraPhotos !== undefined) out.extraPhotos = source.extraPhotos;
  if (source.includeSheet !== undefined) out.includeSheet = source.includeSheet;
  if (source.acceptedFields !== undefined) out.acceptedFields = source.acceptedFields;
  if (source.fieldOverrides !== undefined) out.fieldOverrides = source.fieldOverrides;
  if (source.verificationLink !== undefined) out.verificationLink = source.verificationLink;
  return out;
}

/** Hidden acceptedFields key: the valuer explicitly set sheet commentary (including ""). */
const COMMENTARY_SET_KEY = "__commentarySet";

export function normAddr(s: string | undefined): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function publicAccepted(accepted?: Record<string, boolean>): Record<string, boolean> {
  if (!accepted) return {};
  return Object.fromEntries(Object.entries(accepted).filter(([key]) => key !== COMMENTARY_SET_KEY));
}

function ownCommentary(text: string | undefined, acceptedFields?: Record<string, boolean>): string | undefined {
  if (acceptedFields?.[COMMENTARY_SET_KEY]) return text ?? "";
  if (text !== undefined && text !== "") return text;
  return undefined;
}

function markCommentarySet(
  accepted: Record<string, boolean> | undefined,
  commentaryPatched: boolean,
  alreadySet: boolean,
): Record<string, boolean> | undefined {
  if (!commentaryPatched && !alreadySet) return accepted;
  return { ...(accepted ?? {}), [COMMENTARY_SET_KEY]: true };
}

function hasSheetContent(data: ComparableSheetData): boolean {
  return Boolean(
    data.description ||
      data.commentary ||
      data.photoUrl ||
      data.verificationLink ||
      data.proximity ||
      (data.extraPhotos && data.extraPhotos.length > 0) ||
      (data.accepted && Object.keys(publicAccepted(data.accepted)).length > 0) ||
      (data.overrides && Object.keys(data.overrides).length > 0),
  );
}

export function saleToSheet(sale: ComparableSale, number?: number): ComparableSheetData {
  return {
    id: sale.id,
    kind: "sale",
    address: sale.address,
    price: sale.salePrice,
    date: sale.saleDate,
    landArea: sale.landArea,
    ...opt("number", number),
    ...opt("proximity", sale.proximity),
    ...opt("buildingArea", sale.gla),
    ...opt("photoUrl", sale.photoUrl),
    ...opt("extraPhotos", sale.extraPhotos as SheetPhoto[] | undefined),
    ...opt("includeSheet", sale.includeSheet),
    ...opt("accepted", sale.acceptedFields),
    ...opt("overrides", sale.fieldOverrides),
    ...opt("commentary", ownCommentary(sale.comments, sale.acceptedFields)),
    ...opt("description", sale.description),
    ...opt("verificationLink", sale.verificationLink),
  };
}

export function leaseToSheet(lease: LeaseSheetRecord, number?: number): ComparableSheetData {
  return {
    id: lease.id,
    kind: "lease",
    address: lease.address,
    price: lease.leaseAmount || lease.netRentPerM2,
    date: lease.date,
    ...opt("number", number),
    ...opt("proximity", lease.proximity),
    ...opt("buildingArea", lease.nla),
    ...opt("photoUrl", lease.photoUrl),
    ...opt("extraPhotos", lease.extraPhotos as SheetPhoto[] | undefined),
    ...opt("includeSheet", lease.includeSheet),
    ...opt("accepted", lease.acceptedFields),
    ...opt("overrides", lease.fieldOverrides),
    ...opt("commentary", ownCommentary(lease.notes, lease.acceptedFields)),
    ...opt("description", lease.description),
    ...opt("verificationLink", lease.verificationLink),
  };
}

export function landToSheet(land: LandSheetRecord, number?: number): ComparableSheetData {
  return {
    id: land.id,
    kind: "land",
    address: land.address,
    price: land.price,
    date: land.date,
    landArea: land.landArea,
    ...opt("number", number),
    ...opt("proximity", land.proximity),
    ...opt("photoUrl", land.photoUrl),
    ...opt("extraPhotos", land.extraPhotos as SheetPhoto[] | undefined),
    ...opt("includeSheet", land.includeSheet),
    ...opt("accepted", land.acceptedFields),
    ...opt("overrides", land.fieldOverrides),
    ...opt("commentary", ownCommentary(land.notes, land.acceptedFields)),
    ...opt("description", land.description),
    ...opt("verificationLink", land.verificationLink),
  };
}

interface Candidate {
  kind: SheetKind;
  data: ComparableSheetData;
  linkedSaleId?: string;
}

function collectOthers(currentId: string, currentKind: SheetKind, pools: SheetPools): Candidate[] {
  const out: Candidate[] = [];
  if (currentKind !== "sale") {
    for (const sale of pools.sales ?? []) {
      out.push({ kind: "sale", data: saleToSheet(sale) });
    }
  }
  if (currentKind !== "lease") {
    for (const lease of pools.leases ?? []) {
      out.push({
        kind: "lease",
        data: leaseToSheet(lease),
        ...opt("linkedSaleId", lease.linkedSaleId),
      });
    }
  }
  if (currentKind !== "land") {
    for (const land of pools.landSales ?? []) {
      out.push({ kind: "land", data: landToSheet(land) });
    }
  }
  return out.filter((item) => !(item.data.id === currentId && item.kind === currentKind));
}

function pick(matches: Candidate[]): ComparableSheetData | undefined {
  if (matches.length === 0) return undefined;
  return matches.find((item) => hasSheetContent(item.data))?.data ?? matches[0]?.data;
}

/**
 * Find an existing full-page listing for the same property in another section.
 * Matchers, in order: linkedSaleId → shared id (or reverse linkedSaleId) → normalised address.
 * Empty normalised addresses are skipped.
 */
export function findExistingSheet(
  current: { id: string; address?: string; linkedSaleId?: string },
  kind: SheetKind,
  pools: SheetPools,
): ComparableSheetData | undefined {
  const others = collectOthers(current.id, kind, pools);

  if (current.linkedSaleId) {
    const found = pick(others.filter((item) => item.data.id === current.linkedSaleId));
    if (found) return found;
  }

  const foundById = pick(
    others.filter((item) => item.data.id === current.id || item.linkedSaleId === current.id),
  );
  if (foundById) return foundById;

  const addr = normAddr(current.address);
  if (addr) {
    const foundByAddr = pick(others.filter((item) => normAddr(item.data.address) === addr));
    if (foundByAddr) return foundByAddr;
  }

  return undefined;
}

/**
 * Overlay applicable fields from a matched listing onto the current sheet
 * without overwriting values already set on the current record, and without
 * copying section-specific price or area fields.
 */
export function withSheetPrefill(
  own: ComparableSheetData,
  source: ComparableSheetData | undefined,
): ComparableSheetData {
  if (!source) return own;
  const description = own.description !== undefined ? own.description : source.description;
  const commentary = own.commentary !== undefined ? own.commentary : source.commentary;
  const proximity =
    own.proximity !== undefined && own.proximity !== "" ? own.proximity : (source.proximity ?? own.proximity);
  const photoUrl =
    own.photoUrl !== undefined && own.photoUrl !== "" ? own.photoUrl : (source.photoUrl ?? own.photoUrl);
  const verificationLink =
    own.verificationLink !== undefined && own.verificationLink !== ""
      ? own.verificationLink
      : (source.verificationLink ?? own.verificationLink);
  return {
    ...own,
    ...opt("proximity", proximity),
    ...opt("photoUrl", photoUrl),
    ...opt("extraPhotos", own.extraPhotos !== undefined ? own.extraPhotos : source.extraPhotos),
    accepted: { ...publicAccepted(source.accepted), ...(own.accepted ?? {}) },
    overrides: { ...(source.overrides ?? {}), ...(own.overrides ?? {}) },
    ...opt("description", description),
    ...opt("commentary", commentary),
    ...opt("verificationLink", verificationLink),
  };
}

export function effectiveSaleSheet(
  sale: ComparableSale,
  number: number | undefined,
  pools: SheetPools,
): ComparableSheetData {
  const own = saleToSheet(sale, number);
  return withSheetPrefill(own, findExistingSheet({ id: sale.id, address: sale.address }, "sale", pools));
}

export function effectiveLeaseSheet(
  lease: LeaseSheetRecord,
  number: number | undefined,
  pools: SheetPools,
): ComparableSheetData {
  const own = leaseToSheet(lease, number);
  return withSheetPrefill(
    own,
    findExistingSheet(
      { id: lease.id, address: lease.address, ...opt("linkedSaleId", lease.linkedSaleId) },
      "lease",
      pools,
    ),
  );
}

export function effectiveLandSheet(
  land: LandSheetRecord,
  number: number | undefined,
  pools: SheetPools,
): ComparableSheetData {
  const own = landToSheet(land, number);
  return withSheetPrefill(own, findExistingSheet({ id: land.id, address: land.address }, "land", pools));
}

export function saleFromSheetPatch(sale: ComparableSale, patch: Partial<ComparableSheetData>): ComparableSale {
  const accepted = markCommentarySet(
    patch.accepted !== undefined ? patch.accepted : sale.acceptedFields,
    patch.commentary !== undefined,
    Boolean(sale.acceptedFields?.[COMMENTARY_SET_KEY]),
  );
  return {
    ...sale,
    ...(patch.includeSheet !== undefined ? { includeSheet: patch.includeSheet } : {}),
    ...(accepted !== undefined ? { acceptedFields: accepted } : {}),
    ...(patch.overrides !== undefined ? { fieldOverrides: patch.overrides } : {}),
    ...(patch.commentary !== undefined ? { comments: patch.commentary } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.extraPhotos !== undefined ? { extraPhotos: patch.extraPhotos } : {}),
    ...(patch.verificationLink !== undefined ? { verificationLink: patch.verificationLink } : {}),
  };
}

export function leaseFromSheetPatch(
  lease: LeaseSheetRecord,
  patch: Partial<ComparableSheetData>,
): LeaseSheetRecord {
  const accepted = markCommentarySet(
    patch.accepted !== undefined ? patch.accepted : lease.acceptedFields,
    patch.commentary !== undefined,
    Boolean(lease.acceptedFields?.[COMMENTARY_SET_KEY]),
  );
  return {
    ...lease,
    ...(patch.includeSheet !== undefined ? { includeSheet: patch.includeSheet } : {}),
    ...(accepted !== undefined ? { acceptedFields: accepted } : {}),
    ...(patch.overrides !== undefined ? { fieldOverrides: patch.overrides } : {}),
    ...(patch.commentary !== undefined ? { notes: patch.commentary } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.extraPhotos !== undefined ? { extraPhotos: patch.extraPhotos } : {}),
    ...(patch.verificationLink !== undefined ? { verificationLink: patch.verificationLink } : {}),
  };
}

export function landFromSheetPatch(land: LandSheetRecord, patch: Partial<ComparableSheetData>): LandSheetRecord {
  const accepted = markCommentarySet(
    patch.accepted !== undefined ? patch.accepted : land.acceptedFields,
    patch.commentary !== undefined,
    Boolean(land.acceptedFields?.[COMMENTARY_SET_KEY]),
  );
  return {
    ...land,
    ...(patch.includeSheet !== undefined ? { includeSheet: patch.includeSheet } : {}),
    ...(accepted !== undefined ? { acceptedFields: accepted } : {}),
    ...(patch.overrides !== undefined ? { fieldOverrides: patch.overrides } : {}),
    ...(patch.commentary !== undefined ? { notes: patch.commentary } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.extraPhotos !== undefined ? { extraPhotos: patch.extraPhotos } : {}),
    ...(patch.verificationLink !== undefined ? { verificationLink: patch.verificationLink } : {}),
  };
}

/** Copy persisted sheet fields from a sale when creating a linked lease. */
export function sheetPersistFieldsFromSale(sale: ComparableSale): PersistedSheetFields {
  return persistedSheetFields(sale);
}

/** Copy persisted sheet fields from a lease when creating a linked sale. */
export function sheetPersistFieldsFromLease(lease: LeaseSheetRecord): PersistedSheetFields {
  return persistedSheetFields(lease);
}
