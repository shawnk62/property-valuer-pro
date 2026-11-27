/**
 * Auto-populated rows for commercial/industrial sales and lease evidence
 * summary tables. Explicit summaryOverrides (including "") always win so a
 * cleared cell does not snap back to the calculated value.
 */
import {
  effectiveLeaseSheet,
  effectiveSaleSheet,
  resolveLeaseLand,
  type LeaseSheetRecord,
  type SheetPools,
} from "./comparableSheetHelpers";
import { formatNarrativeDateOr } from "@/lib/report/dates";
import { formatSalePrice } from "@/lib/report/salesRelativity";
import type {
  ComparableSale,
  EvidenceSummaryOverrides,
  InspectionValues,
  ReportMeta,
} from "@/lib/report/types";

export type EvidenceSummaryKind = "sales" | "leases";

export interface EvidenceSummaryRow {
  id: string;
  number: number;
  address: string;
  photoUrl: string;
  price: string;
  date: string;
  buildingArea: string;
  pricePerM2Building: string;
  landArea: string;
  pricePerM2Land: string;
  indicatedYield: string;
  overallRating: string;
  comments: string;
}

export const SUMMARY_OVERRIDE_KEYS = [
  "price",
  "date",
  "buildingArea",
  "pricePerM2Building",
  "landArea",
  "pricePerM2Land",
  "indicatedYield",
  "overallRating",
  "comments",
] as const satisfies ReadonlyArray<keyof EvidenceSummaryOverrides>;

export type SummaryOverrideKey = (typeof SUMMARY_OVERRIDE_KEYS)[number];

/** Parse a currency / area / percentage string, stripping $, commas and spaces. */
export function parseNumericAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).replace(/[^0-9.-]/g, "");
  if (!text || text === "-" || text === "." || text === "-.") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare a comparable price to the subject's indicated value.
 * Within 2% (inclusive) → Similar; higher → Superior; lower → Inferior.
 * Empty until both values are positive finite numbers.
 */
export function overallRatingFromPrices(
  comparable: number | null,
  subject: number | null,
): "Similar" | "Superior" | "Inferior" | "" {
  if (comparable == null || subject == null || comparable <= 0 || subject <= 0) return "";
  if (Math.abs(comparable - subject) / subject <= 0.02) return "Similar";
  return comparable > subject ? "Superior" : "Inferior";
}

/** Official valuation amount, falling back to the assessed/asking figure on the grid. */
export function subjectIndicatedSaleValue(meta: ReportMeta): number | null {
  const adopted = parseNumericAmount(meta.valueAmount);
  if (adopted != null && adopted > 0) return adopted;
  const asking = parseNumericAmount(meta.subjectAskingPrice);
  if (asking != null && asking > 0) return asking;
  return null;
}

function subjectBuildingArea(values: InspectionValues): number | null {
  const n = parseNumericAmount(values["comm_nla"] ?? values["comm_gba"]);
  return n != null && n > 0 ? n : null;
}

/** Annual subject market rent, or adopted $/m² × subject NLA. */
export function subjectIndicatedAnnualRent(values: InspectionValues, meta: ReportMeta): number | null {
  const entered = parseNumericAmount(meta.subjectMarketRent);
  if (entered != null && entered > 0) return entered;
  const rate = parseNumericAmount(meta.ciAdoptedRentPerM2);
  const area = subjectBuildingArea(values);
  if (rate != null && rate > 0 && area != null) return rate * area;
  const passing = parseNumericAmount(meta.subjectPassingRent ?? String(values["comm_passing_rent"] ?? ""));
  if (passing != null && passing > 0) return passing;
  return null;
}

/** Subject market rent as a $/m² rate. */
export function subjectIndicatedRentRate(values: InspectionValues, meta: ReportMeta): number | null {
  const adopted = parseNumericAmount(meta.ciAdoptedRentPerM2);
  if (adopted != null && adopted > 0) return adopted;
  const annual = parseNumericAmount(meta.subjectMarketRent);
  const area = subjectBuildingArea(values);
  if (annual != null && annual > 0 && area != null) return annual / area;
  return null;
}

export function areaToM2(raw: string | null | undefined, unit?: "m2" | "ha"): number | null {
  const n = parseNumericAmount(raw);
  if (n == null || n <= 0) return null;
  const text = String(raw ?? "");
  if (unit === "ha" || /\bha\b|hectare/i.test(text)) return n * 10_000;
  if (/\bacre/i.test(text)) return n * 4046.8564224;
  return n;
}

export function formatAreaDisplay(raw: string | null | undefined, unit?: "m2" | "ha"): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (/ha|hectare|acre|m²|m2/i.test(text)) return text.replace(/\bm2\b/gi, "m²");
  const n = parseNumericAmount(text);
  if (n == null) return text;
  const suffix = unit === "ha" ? " ha" : " m²";
  const digits = Number.isInteger(n) ? 0 : 2;
  return `${n.toLocaleString("en-AU", { maximumFractionDigits: digits })}${suffix}`;
}

export function formatRatePerM2(price: number | null, areaM2: number | null): string {
  if (price == null || areaM2 == null || price <= 0 || areaM2 <= 0) return "";
  return formatUnitRate(price / areaM2);
}

function formatUnitRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "";
  return `$${Math.round(rate).toLocaleString("en-AU")}/m²`;
}

export function formatYieldDisplay(raw: string | number | null | undefined): string {
  if (raw == null) return "";
  const text = String(raw).trim();
  if (!text) return "";
  if (text.includes("%")) return text;
  const n = parseNumericAmount(text);
  if (n == null) return text;
  const body = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${body}%`;
}

export function yieldFromRentAndPrice(rent: number | null, price: number | null): string {
  if (rent == null || price == null || rent <= 0 || price <= 0) return "";
  return formatYieldDisplay(((rent / price) * 100).toFixed(2));
}

export function withSummaryOverride(
  overrides: EvidenceSummaryOverrides | undefined,
  key: SummaryOverrideKey,
  auto: string,
): string {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key] ?? "";
  }
  return auto;
}

export function patchSummaryOverride(
  current: EvidenceSummaryOverrides | undefined,
  key: SummaryOverrideKey,
  value: string,
): EvidenceSummaryOverrides {
  return { ...(current ?? {}), [key]: value };
}

function normAddr(s: string | undefined): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function linkedLease(sale: ComparableSale, leases: LeaseSheetRecord[] | undefined): LeaseSheetRecord | undefined {
  const list = leases ?? [];
  return list.find((l) => l.linkedSaleId === sale.id || l.id === sale.id)
    ?? list.find((l) => {
      const a = normAddr(l.address);
      return Boolean(a) && a === normAddr(sale.address);
    });
}

function linkedSale(lease: LeaseSheetRecord, sales: ComparableSale[] | undefined): ComparableSale | undefined {
  const list = sales ?? [];
  if (lease.linkedSaleId) {
    const found = list.find((s) => s.id === lease.linkedSaleId);
    if (found) return found;
  }
  return list.find((s) => s.id === lease.id)
    ?? list.find((s) => {
      const a = normAddr(s.address);
      return Boolean(a) && a === normAddr(lease.address);
    });
}

function annualLeaseAmount(lease: LeaseSheetRecord): number | null {
  const amount = parseNumericAmount(lease.leaseAmount);
  if (amount != null && amount > 0) return amount;
  const rate = parseNumericAmount(lease.netRentPerM2);
  const area = parseNumericAmount(lease.nla);
  if (rate != null && rate > 0 && area != null && area > 0) return rate * area;
  return null;
}

function leaseRentRate(lease: LeaseSheetRecord): number | null {
  const rate = parseNumericAmount(lease.netRentPerM2);
  if (rate != null && rate > 0) return rate;
  const amount = parseNumericAmount(lease.leaseAmount);
  const area = parseNumericAmount(lease.nla);
  if (amount != null && amount > 0 && area != null && area > 0) return amount / area;
  return null;
}

function computedSaleYield(sale: ComparableSale, lease: LeaseSheetRecord | undefined): string {
  const stored = String(sale.saleYield ?? "").trim();
  if (stored) return formatYieldDisplay(stored);
  const price = parseNumericAmount(sale.salePrice);
  const market = parseNumericAmount(sale.marketRent);
  const fromMarket = yieldFromRentAndPrice(market, price);
  if (fromMarket) return fromMarket;
  const passing = parseNumericAmount(sale.passingRent);
  const fromPassing = yieldFromRentAndPrice(passing, price);
  if (fromPassing) return fromPassing;
  if (!lease) return "";
  return yieldFromRentAndPrice(annualLeaseAmount(lease), price);
}

function computedLeaseYield(lease: LeaseSheetRecord, sale: ComparableSale | undefined): string {
  if (!sale) return "";
  const stored = String(sale.saleYield ?? "").trim();
  if (stored) return formatYieldDisplay(stored);
  return yieldFromRentAndPrice(annualLeaseAmount(lease), parseNumericAmount(sale.salePrice));
}

function leaseOverallRating(lease: LeaseSheetRecord, values: InspectionValues, meta: ReportMeta): string {
  const compAnnual = annualLeaseAmount(lease);
  const subjectAnnual = subjectIndicatedAnnualRent(values, meta);
  if (compAnnual != null && subjectAnnual != null) return overallRatingFromPrices(compAnnual, subjectAnnual);
  const compRate = leaseRentRate(lease);
  const subjectRate = subjectIndicatedRentRate(values, meta);
  if (compRate != null && subjectRate != null) return overallRatingFromPrices(compRate, subjectRate);
  return "";
}

export function printedLeases(
  leases: LeaseSheetRecord[] | null | undefined,
): LeaseSheetRecord[] {
  return (leases ?? []).filter((c) => {
    if (c.omitFromReport === true) return false;
    const address = String(c.address ?? "").replace(/[—–-]/g, "").trim();
    const amount = String(c.leaseAmount ?? "").replace(/[—–-]/g, "").trim();
    const rate = String(c.netRentPerM2 ?? "").replace(/[—–-]/g, "").trim();
    const area = String(c.nla ?? "").replace(/[—–-]/g, "").trim();
    return Boolean(address || amount || rate || area);
  });
}

export function buildSaleSummaryRow(
  sale: ComparableSale,
  number: number,
  meta: ReportMeta,
  pools: SheetPools,
): EvidenceSummaryRow {
  const sheet = effectiveSaleSheet(sale, number, pools);
  const lease = linkedLease(sale, pools.leases);
  const priceNum = parseNumericAmount(sale.salePrice);
  const building = parseNumericAmount(sale.gla);
  const landM2 = areaToM2(sale.landArea, sale.landUnit);
  const auto: Omit<EvidenceSummaryRow, "id" | "number" | "address" | "photoUrl"> = {
    price: formatSalePrice(sale.salePrice),
    date: sale.saleDate?.trim() ?? "",
    buildingArea: formatAreaDisplay(sale.gla),
    pricePerM2Building: formatRatePerM2(priceNum, building != null && building > 0 ? building : null),
    landArea: formatAreaDisplay(sale.landArea, sale.landUnit),
    pricePerM2Land: formatRatePerM2(priceNum, landM2),
    indicatedYield: computedSaleYield(sale, lease),
    overallRating: overallRatingFromPrices(priceNum, subjectIndicatedSaleValue(meta)),
    comments: sheet.description?.trim() ?? "",
  };
  const o = sale.summaryOverrides;
  return {
    id: sale.id,
    number,
    address: sale.address,
    photoUrl: sheet.photoUrl?.trim() ?? "",
    price: withSummaryOverride(o, "price", auto.price),
    date: withSummaryOverride(o, "date", auto.date),
    buildingArea: withSummaryOverride(o, "buildingArea", auto.buildingArea),
    pricePerM2Building: withSummaryOverride(o, "pricePerM2Building", auto.pricePerM2Building),
    landArea: withSummaryOverride(o, "landArea", auto.landArea),
    pricePerM2Land: withSummaryOverride(o, "pricePerM2Land", auto.pricePerM2Land),
    indicatedYield: withSummaryOverride(o, "indicatedYield", auto.indicatedYield),
    overallRating: withSummaryOverride(o, "overallRating", auto.overallRating),
    comments: withSummaryOverride(o, "comments", auto.comments),
  };
}

export function buildLeaseSummaryRow(
  lease: LeaseSheetRecord,
  number: number,
  values: InspectionValues,
  meta: ReportMeta,
  pools: SheetPools,
): EvidenceSummaryRow {
  const sheet = effectiveLeaseSheet(lease, number, pools);
  const sale = linkedSale(lease, pools.sales);
  const amountSource = lease.leaseAmount || sale?.passingRent || "";
  const areaSource = lease.nla || sale?.gla || "";
  const annual = annualLeaseAmount({ ...lease, leaseAmount: amountSource, nla: areaSource });
  const building = parseNumericAmount(areaSource);
  const land = resolveLeaseLand(lease, pools);
  const landM2 = areaToM2(land?.area, land?.unit);
  const rate = leaseRentRate(lease);
  const auto: Omit<EvidenceSummaryRow, "id" | "number" | "address" | "photoUrl"> = {
    price: annual != null ? formatSalePrice(String(annual)) : formatSalePrice(amountSource || lease.netRentPerM2 || ""),
    date: lease.date?.trim() ?? "",
    buildingArea: formatAreaDisplay(areaSource),
    pricePerM2Building: rate != null ? formatUnitRate(rate) : formatRatePerM2(annual, building != null && building > 0 ? building : null),
    landArea: land ? formatAreaDisplay(land.area, land.unit) : "",
    pricePerM2Land: formatRatePerM2(annual, landM2),
    indicatedYield: computedLeaseYield(lease, sale),
    overallRating: leaseOverallRating(lease, values, meta),
    comments: sheet.description?.trim() ?? "",
  };
  const o = lease.summaryOverrides;
  return {
    id: lease.id,
    number,
    address: lease.address,
    photoUrl: sheet.photoUrl?.trim() ?? "",
    price: withSummaryOverride(o, "price", auto.price),
    date: withSummaryOverride(o, "date", auto.date),
    buildingArea: withSummaryOverride(o, "buildingArea", auto.buildingArea),
    pricePerM2Building: withSummaryOverride(o, "pricePerM2Building", auto.pricePerM2Building),
    landArea: withSummaryOverride(o, "landArea", auto.landArea),
    pricePerM2Land: withSummaryOverride(o, "pricePerM2Land", auto.pricePerM2Land),
    indicatedYield: withSummaryOverride(o, "indicatedYield", auto.indicatedYield),
    overallRating: withSummaryOverride(o, "overallRating", auto.overallRating),
    comments: withSummaryOverride(o, "comments", auto.comments),
  };
}

export function printDate(raw: string): string {
  const text = raw.trim();
  if (!text) return "—";
  return formatNarrativeDateOr(text, text);
}
