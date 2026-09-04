import type { ComparableSale, ReportMeta } from "@/lib/report/types";
import { salesOnReport } from "@/lib/report/types";
import type { InspectionValues } from "@/lib/inspection/types";

export type SalesMapPinKind = "subject" | "sale" | "custom";

export interface SalesMapPin {
  id: string;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
  kind: SalesMapPinKind;
  saleId?: string;
  address?: string;
}

export function geocodeQueryForSale(address: string, values: InspectionValues): string {
  let a = address.replace(/\s+/g, " ").trim();
  if (!a) return "";
  const hasLocality = /\b(QLD|NSW|VIC|WA|SA|TAS|NT|ACT)\b|\b\d{4}\b/i.test(a);
  if (!hasLocality) {
    const suburb = typeof values["prop_suburb"] === "string" ? values["prop_suburb"].trim() : "";
    const state = typeof values["prop_state"] === "string" ? values["prop_state"].trim() : "QLD";
    const pc = typeof values["prop_postcode"] === "string" ? values["prop_postcode"].trim() : "";
    a = [a, suburb, state, pc].filter(Boolean).join(", ");
  }
  if (!/australia/i.test(a)) a = `${a}, Australia`;
  return a;
}

export function subjectAddressLine(values: InspectionValues): string {
  const parts = [
    values["prop_address"],
    values["prop_suburb"],
    values["prop_state"],
    values["prop_postcode"],
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

function shortSaleLabel(index: number): string {
  if (index < 9) return String(index + 1);
  return String.fromCharCode(65 + (index - 9));
}

export function pinsFromDraft(opts: {
  values: InspectionValues;
  sales: ComparableSale[];
  saved?: SalesMapPin[] | null;
}): SalesMapPin[] {
  const printed = salesOnReport(opts.sales);
  const saved = opts.saved ?? [];
  const bySale = new Map(saved.filter((p) => p.saleId).map((p) => [p.saleId!, p]));
  const subjectSaved = saved.find((p) => p.kind === "subject");
  const customs = saved.filter((p) => p.kind === "custom");

  const pins: SalesMapPin[] = [];
  const subjectAddr = subjectAddressLine(opts.values);
  pins.push({
    id: subjectSaved?.id || "pin-subject",
    label: "Subject",
    shortLabel: "S",
    lat: subjectSaved?.lat ?? 0,
    lng: subjectSaved?.lng ?? 0,
    kind: "subject",
    address: subjectAddr,
  });

  opts.sales.forEach((sale, i) => {
    const addr = sale.address.trim();
    if (!addr && sale.omitFromReport) return;
    const printedIndex = printed.findIndex((s) => s.id === sale.id);
    const prev = bySale.get(sale.id);
    pins.push({
      id: prev?.id || `pin-sale-${sale.id}`,
      label: printedIndex >= 0 ? `Comp ${printedIndex + 1}` : `Held ${i + 1}`,
      shortLabel: printedIndex >= 0 ? shortSaleLabel(printedIndex) : "H",
      lat: prev?.lat ?? 0,
      lng: prev?.lng ?? 0,
      kind: "sale",
      saleId: sale.id,
      address: addr ? geocodeQueryForSale(addr, opts.values) : "",
    });
  });

  for (const extra of customs) {
    pins.push({ ...extra, kind: "custom" });
  }
  return pins;
}

export function pinsNeedingGeocode(pins: SalesMapPin[]): SalesMapPin[] {
  return pins.filter(
    (p) =>
      p.kind !== "custom" &&
      p.address &&
      (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || (p.lat === 0 && p.lng === 0)),
  );
}

export function staticMapQuery(pins: SalesMapPin[]): {
  size: string;
  scale: string;
  maptype: string;
  markers: string[];
} {
  const placed = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0));
  const markers = placed.map((p) => {
    const color = p.kind === "subject" ? "red" : p.kind === "custom" ? "green" : "blue";
    const label = encodeURIComponent(p.shortLabel.slice(0, 1));
    return `color:${color}|label:${label}|${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  });
  return {
    size: "640x640",
    scale: "2",
    maptype: "roadmap",
    markers,
  };
}
