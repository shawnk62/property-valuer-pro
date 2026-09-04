import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function geocodeVariants(address: string): string[] {
  const a = address.replace(/\s+/g, " ").trim();
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(a);
  add(a.replace(/^(?:unit|u|apt|apartment|lot)\s*[\w]+\s*[/,-]\s*/i, ""));
  add(a.replace(/^(\d+)\s*\/\s*/i, "$1 "));
  if (!/australia/i.test(a)) add(`${a}, Australia`);
  return out;
}

const Input = z.object({
  apiKey: z.string().min(8),
  size: z.string().default("640x640"),
  scale: z.string().default("2"),
  maptype: z.string().default("roadmap"),
  markers: z.array(z.string().min(1)).min(1).max(40),
  center: z.string().optional(),
  zoom: z.number().int().min(1).max(21).optional(),
});

const GeocodeInput = z.object({
  apiKey: z.string().min(8),
  addresses: z.array(z.string().min(1)).min(1).max(80),
});

export const geocodeGoogleAddresses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GeocodeInput.parse(input))
  .handler(async ({ data }) => {
    const results: Array<{
      address: string;
      lat: number | null;
      lng: number | null;
      status: string;
      error?: string;
    }> = [];
    for (const address of data.addresses) {
      const queries = geocodeVariants(address);
      let placed: { lat: number; lng: number; status: string; error?: string } | null = null;
      for (const query of queries) {
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        url.searchParams.set("address", query);
        url.searchParams.set("region", "au");
        url.searchParams.set("components", "country:AU");
        url.searchParams.set("key", data.apiKey.trim());
        const res = await fetch(url);
        const json = (await res.json()) as {
          status?: string;
          error_message?: string;
          results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
        };
        const loc = json.results?.[0]?.geometry?.location;
        if (json.status === "OK" && loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
          placed = { lat: loc.lat, lng: loc.lng, status: json.status };
          break;
        }
        placed = {
          lat: NaN,
          lng: NaN,
          status: json.status || `HTTP_${res.status}`,
          error: json.error_message,
        };
        if (json.status === "REQUEST_DENIED" || json.status === "OVER_QUERY_LIMIT") break;
      }
      results.push({
        address,
        lat: placed && Number.isFinite(placed.lat) ? placed.lat : null,
        lng: placed && Number.isFinite(placed.lng) ? placed.lng : null,
        status: placed?.status || "ZERO_RESULTS",
        error: placed?.error,
      });
    }
    return { results };
  });

export const fetchGoogleStaticMap = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      size: data.size,
      scale: data.scale,
      maptype: data.maptype,
      key: data.apiKey.trim(),
    });
    if (data.center) params.set("center", data.center);
    if (data.zoom != null) params.set("zoom", String(data.zoom));
    for (const marker of data.markers) {
      params.append("markers", marker);
    }
    const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
    const res = await fetch(url);
    const mime = (res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok || mime.includes("text") || mime.includes("json")) {
      const text = buf.toString("utf8").replace(/<[^>]+>/g, " ").trim();
      throw new Error(
        text.slice(0, 220) || `Static map request failed (${res.status}). Enable Maps Static API on this key.`,
      );
    }
    if (buf.byteLength < 800) {
      throw new Error("Google returned an empty or error map image. Enable Maps Static API and check the key.");
    }
    return {
      mime: mime.startsWith("image/") ? mime : "image/png",
      base64: buf.toString("base64"),
    };
  });
