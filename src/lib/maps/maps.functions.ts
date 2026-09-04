import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  apiKey: z.string().min(8),
  size: z.string().default("640x640"),
  scale: z.string().default("2"),
  maptype: z.string().default("roadmap"),
  markers: z.array(z.string().min(1)).min(1).max(40),
  center: z.string().optional(),
  zoom: z.number().int().min(1).max(21).optional(),
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
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        text.trim().slice(0, 180) || `Static map request failed (${res.status})`,
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 80) {
      throw new Error("Google returned an empty map image. Check the API key and Static Maps API.");
    }
    return {
      mime: res.headers.get("content-type") || "image/png",
      base64: buf.toString("base64"),
    };
  });
