import type { ComparableSale } from "@/lib/report/types";
import type { SalesMapPin } from "@/lib/maps/salesMapPins";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceFromSubject(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 1) return `${km.toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

const BEARING_ABBR = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Bearing FROM the origin (subject) TO the destination. Abbreviated compass. */
export function bearingFromSubject(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return BEARING_ABBR[Math.round(brng / 45) % 8]!;
}

export function formatProximityWithBearing(km: number, bearing: string): string {
  const dist = formatDistanceFromSubject(km);
  if (!dist) return "";
  return bearing ? `${dist} ${bearing}` : dist;
}

/**
 * Commercial / industrial only. Same pin matching and haversine as proximityFromPins,
 * plus abbreviated bearing FROM the subject. Residential continues to use proximityFromPins.
 */
export function proximityWithBearingFromPins(
  sales: ComparableSale[],
  pins: SalesMapPin[],
): ComparableSale[] {
  const subject = pins.find((p) => p.kind === "subject");
  if (!subject || (subject.lat === 0 && subject.lng === 0)) return sales;
  const bySale = new Map(pins.filter((p) => p.saleId).map((p) => [p.saleId!, p]));
  return sales.map((sale) => {
    const pin = bySale.get(sale.id);
    if (!pin || (pin.lat === 0 && pin.lng === 0)) return sale;
    const km = haversineKm(subject, pin);
    const proximity = formatProximityWithBearing(km, bearingFromSubject(subject, pin));
    if (!proximity || sale.proximity === proximity) return sale;
    return { ...sale, proximity };
  });
}

export function proximityFromPins(
  sales: ComparableSale[],
  pins: SalesMapPin[],
): ComparableSale[] {
  const subject = pins.find((p) => p.kind === "subject");
  if (!subject || (subject.lat === 0 && subject.lng === 0)) return sales;
  const bySale = new Map(pins.filter((p) => p.saleId).map((p) => [p.saleId!, p]));
  return sales.map((sale) => {
    const pin = bySale.get(sale.id);
    if (!pin || (pin.lat === 0 && pin.lng === 0)) return sale;
    const km = haversineKm(subject, pin);
    const proximity = formatDistanceFromSubject(km);
    if (!proximity || sale.proximity === proximity) return sale;
    return { ...sale, proximity };
  });
}
