import { fetchGoogleStaticMap } from "@/lib/maps/maps.functions";
import type { SalesMapPin } from "@/lib/maps/salesMapPins";

const SIZE = 640;
const SCALE = 2;
/** ~10 km around the subject on a 640px roadmap (Brisbane latitudes). */
export const SUBJECT_MAP_ZOOM = 12;

function placedPins(pins: SalesMapPin[]): SalesMapPin[] {
  return pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0));
}

function world(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return { x, y };
}

function pixelAt(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  cssSize: number,
  scale: number,
): { x: number; y: number } {
  const worldPx = 256 * 2 ** zoom;
  const c = world(centerLat, centerLng);
  const p = world(lat, lng);
  return {
    x: (p.x - c.x) * worldPx * scale + (cssSize * scale) / 2,
    y: (p.y - c.y) * worldPx * scale + (cssSize * scale) / 2,
  };
}

export function zoomToFit(pins: SalesMapPin[], cssSize = SIZE, paddingPx = 56): number {
  const pts = placedPins(pins);
  if (pts.length <= 1) return SUBJECT_MAP_ZOOM;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  for (let z = 16; z >= 6; z--) {
    const worldPx = 256 * 2 ** z;
    const a = world(minLat, minLng);
    const b = world(maxLat, maxLng);
    const w = Math.abs(b.x - a.x) * worldPx;
    const h = Math.abs(b.y - a.y) * worldPx;
    if (w + paddingPx * 2 <= cssSize && h + paddingPx * 2 <= cssSize) return z;
  }
  return 6;
}

export function boundsCenter(pins: SalesMapPin[]): { lat: number; lng: number } {
  const pts = placedPins(pins);
  if (pts.length === 0) return { lat: -27.47, lng: 153.03 };
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return { lat, lng };
}

function markerSpec(pin: SalesMapPin): string {
  const color = pin.kind === "subject" ? "red" : pin.kind === "custom" ? "green" : "blue";
  return `color:${color}|${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`;
}

async function fetchMap(opts: {
  apiKey: string;
  pins: SalesMapPin[];
  center: { lat: number; lng: number };
  zoom: number;
}): Promise<{ blob: Blob; width: number; height: number }> {
  const result = await fetchGoogleStaticMap({
    data: {
      apiKey: opts.apiKey,
      size: `${SIZE}x${SIZE}`,
      scale: String(SCALE),
      maptype: "roadmap",
      center: `${opts.center.lat.toFixed(6)},${opts.center.lng.toFixed(6)}`,
      zoom: opts.zoom,
      markers: opts.pins.map(markerSpec),
    },
  });
  const binary = atob(result.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const mime = result.mime.startsWith("image/") ? result.mime : "image/png";
  return { blob: new Blob([bytes], { type: mime }), width: SIZE * SCALE, height: SIZE * SCALE };
}

function wrapLabel(text: string, max = 28): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

async function annotate(
  blob: Blob,
  pins: SalesMapPin[],
  center: { lat: number; lng: number },
  zoom: number,
  mode: "subject" | "sales",
): Promise<File> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read map image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw map labels");
    ctx.drawImage(img, 0, 0);

    for (const pin of pins) {
      const pt = pixelAt(pin.lat, pin.lng, center.lat, center.lng, zoom, SIZE, SCALE);
      const lines =
        mode === "subject" || pin.kind === "subject"
          ? wrapLabel(pin.address || pin.label)
          : [pin.kind === "sale" ? pin.shortLabel : pin.label];
      const fontSize = pin.kind === "subject" && mode === "sales" ? 22 : 26;
      ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const lineH = fontSize + 4;
      const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
      const boxH = lines.length * lineH + 8;
      const bx = pt.x - boxW / 2;
      const by = pt.y - 42 - boxH;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1;
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.fillStyle = "#111";
      lines.forEach((line, i) => {
        ctx.fillText(line, pt.x, by + boxH - 6 - (lines.length - 1 - i) * lineH);
      });
    }

    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))), "image/jpeg", 0.9);
    });
    const name = mode === "subject" ? "location-map.jpg" : "sales-map.jpg";
    return new File([out], name, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function buildSubjectLocationMap(opts: {
  apiKey: string;
  subject: SalesMapPin;
}): Promise<File> {
  const pins = placedPins([opts.subject]);
  if (pins.length === 0) throw new Error("Subject address could not be located on the map");
  const center = { lat: pins[0]!.lat, lng: pins[0]!.lng };
  const raw = await fetchMap({
    apiKey: opts.apiKey,
    pins,
    center,
    zoom: SUBJECT_MAP_ZOOM,
  });
  return annotate(raw.blob, pins, center, SUBJECT_MAP_ZOOM, "subject");
}

export async function buildComparableSalesMap(opts: {
  apiKey: string;
  pins: SalesMapPin[];
}): Promise<File> {
  const pins = placedPins(opts.pins);
  if (pins.length === 0) throw new Error("No mapped locations to draw");
  const center = boundsCenter(pins);
  const zoom = zoomToFit(pins);
  const raw = await fetchMap({ apiKey: opts.apiKey, pins, center, zoom });
  return annotate(raw.blob, pins, center, zoom, "sales");
}
