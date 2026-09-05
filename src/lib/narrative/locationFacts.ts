import { QLD_CENTRES, type QldCentre } from "@/lib/maps/qldCentres";
import { formatDistanceFromSubject } from "@/lib/maps/distance";
import { subjectAddressLine } from "@/lib/maps/salesMapPins";
import type { InspectionValues } from "@/lib/inspection/types";
import type { SalesMapPin } from "@/lib/maps/salesMapPins";

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

export interface LocationFacts {
  sentence: string;
  promptBlock: string;
}

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

function compassToward(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(brng / 45) % 8]!;
}

function withDistance(from: { lat: number; lng: number }, centre: QldCentre) {
  const km = haversineKm(from, centre);
  return {
    ...centre,
    km,
    dir: compassToward(from, centre),
    label: formatDistanceFromSubject(km),
  };
}

export function subjectCoordsFromPins(
  pins: SalesMapPin[] | null | undefined,
): { lat: number; lng: number } | null {
  const subject = (pins ?? []).find((p) => p.kind === "subject");
  if (!subject) return null;
  if (!Number.isFinite(subject.lat) || !Number.isFinite(subject.lng)) return null;
  if (subject.lat === 0 && subject.lng === 0) return null;
  return { lat: subject.lat, lng: subject.lng };
}

export function buildLocationFacts(opts: {
  values: InspectionValues;
  coords?: { lat: number; lng: number } | null;
}): LocationFacts {
  const address = subjectAddressLine(opts.values);
  const suburb =
    typeof opts.values["prop_suburb"] === "string" ? opts.values["prop_suburb"].trim() : "";
  const place = address || suburb || "the subject property";

  if (!opts.coords) {
    const sentence = address
      ? `The subject property is located at ${address}.`
      : suburb
        ? `The subject property is located in ${suburb}.`
        : "";
    return {
      sentence,
      promptBlock: [
        "CALCULATED LOCATION: coordinates were not available.",
        sentence ? `Use this location sentence unchanged as paragraph 1: "${sentence}"` : "",
        "Do not invent kilometres, direction, or a CBD distance.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const ranked = QLD_CENTRES.map((c) => withDistance(opts.coords!, c)).sort(
    (a, b) => a.km - b.km,
  );
  const brisbane = ranked.find((c) => c.kind === "cbd")!;
  const nearestOther = ranked.find((c) => c.kind !== "cbd")!;

  const at = address ? `at ${address}` : suburb ? `in ${suburb}` : "";
  const opener = at
    ? `The subject property is located ${at}`
    : "The subject property is located";

  let sentence: string;
  if (brisbane.km <= 2.5) {
    sentence = `${opener} in Brisbane’s central area.`;
  } else if (brisbane.km <= 80) {
    sentence = `${opener}, approximately ${brisbane.label} ${brisbane.dir} of ${brisbane.name}`;
    if (nearestOther.km <= 12 && nearestOther.km + 3 < brisbane.km) {
      sentence += `, and approximately ${nearestOther.label} ${nearestOther.dir} of ${nearestOther.name}`;
    }
    sentence += ".";
  } else if (nearestOther.km <= 2.5) {
    sentence = `${opener} in ${nearestOther.name}, approximately ${brisbane.label} ${brisbane.dir} of ${brisbane.name}.`;
  } else {
    sentence = `${opener}, approximately ${nearestOther.label} ${nearestOther.dir} of ${nearestOther.name}`;
    if (brisbane.km <= 400) {
      sentence += `, and approximately ${brisbane.label} ${brisbane.dir} of ${brisbane.name}`;
    }
    sentence += ".";
  }

  return {
    sentence,
    promptBlock: [
      "CALCULATED LOCATION (use paragraph 1 exactly; do not change the kilometres or direction):",
      sentence,
      `Nearest measured centres: ${brisbane.label} ${brisbane.dir} of ${brisbane.name}; ${nearestOther.label} ${nearestOther.dir} of ${nearestOther.name}.`,
    ].join("\n"),
  };
}

export function locationFactsFromDraft(opts: {
  values: InspectionValues;
  pins?: SalesMapPin[] | null;
}): LocationFacts {
  return buildLocationFacts({
    values: opts.values,
    coords: subjectCoordsFromPins(opts.pins),
  });
}
