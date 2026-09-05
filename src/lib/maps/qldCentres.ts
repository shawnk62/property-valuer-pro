export interface QldCentre {
  name: string;
  kind: "cbd" | "regional" | "town";
  lat: number;
  lng: number;
}

/** Principal QLD centres for location statements. Brisbane GPO is the CBD reference. */
export const QLD_CENTRES: QldCentre[] = [
  { name: "the Brisbane GPO", kind: "cbd", lat: -27.4678, lng: 153.0281 },
  { name: "Southport", kind: "regional", lat: -27.9674, lng: 153.4003 },
  { name: "Maroochydore", kind: "regional", lat: -26.655, lng: 153.09 },
  { name: "Ipswich", kind: "regional", lat: -27.6144, lng: 152.7606 },
  { name: "Toowoomba", kind: "regional", lat: -27.5598, lng: 151.9507 },
  { name: "Logan Central", kind: "town", lat: -27.6392, lng: 153.1094 },
  { name: "Cleveland", kind: "town", lat: -27.5264, lng: 153.266 },
  { name: "Caboolture", kind: "town", lat: -27.0667, lng: 152.967 },
  { name: "Redcliffe", kind: "town", lat: -27.2258, lng: 153.1139 },
  { name: "Beenleigh", kind: "town", lat: -27.711, lng: 153.201 },
  { name: "Gympie", kind: "town", lat: -26.19, lng: 152.665 },
  { name: "Maryborough", kind: "town", lat: -25.537, lng: 152.7019 },
  { name: "Bundaberg", kind: "regional", lat: -24.8661, lng: 152.3489 },
  { name: "Gladstone", kind: "regional", lat: -23.8489, lng: 151.25 },
  { name: "Rockhampton", kind: "regional", lat: -23.3781, lng: 150.5136 },
  { name: "Mackay", kind: "regional", lat: -21.1411, lng: 149.186 },
  { name: "Townsville", kind: "regional", lat: -19.259, lng: 146.8169 },
  { name: "Cairns", kind: "regional", lat: -16.9203, lng: 145.771 },
  { name: "Mount Isa", kind: "regional", lat: -20.7256, lng: 139.4973 },
  { name: "Roma", kind: "town", lat: -26.5674, lng: 148.7864 },
  { name: "Warwick", kind: "town", lat: -28.2167, lng: 152.0333 },
  { name: "Emerald", kind: "town", lat: -23.525, lng: 148.161 },
];
