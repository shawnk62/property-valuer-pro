/**
 * Plan an inspection route for selected comparable sales.
 * Opens an optimised Google Maps directions URL with full addresses at each stop.
 * Start from the subject address or the valuer's current position.
 */
import { useState } from "react";
import { toast } from "sonner";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
type LeaseComp = NonNullable<ReportMeta["ciLeaseComps"]>[number];
type LandSale = NonNullable<ReportMeta["ciLandSales"]>[number];
import { salesOnReport } from "@/lib/report/types";
import { geocodeQueryForSale, subjectAddressLine, type SalesMapPin } from "@/lib/maps/salesMapPins";
import { isGoogleMapsConfigured, loadGoogleMapsKey } from "@/lib/maps/googleSettings";
import { geocodeGoogleAddresses } from "@/lib/maps/maps.functions";

interface Stop {
  id: string;
  address: string;
  lat: number;
  lng: number;
}

const MAX_STOPS = 25;

export function InspectionRoutePlanner({
  sales,
  values,
  meta,
  leaseComps,
  landSales,
}: {
  sales: ComparableSale[];
  values: InspectionValues;
  meta: ReportMeta;
  leaseComps?: LeaseComp[];
  landSales?: LandSale[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startFrom, setStartFrom] = useState<"subject" | "current">("subject");
  const onReport = new Set(salesOnReport(sales).map((s) => s.id));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(onReport));

  const saleCandidates = sales.filter((s) => s.address.trim()).map((s) => ({ id: s.id, address: s.address, kind: "sale" as const }));
  const leaseCandidates = (leaseComps ?? []).filter((c) => c.address.trim()).map((c) => ({ id: "lease-" + c.id, address: c.address, kind: "lease" as const }));
  const landCandidates = (landSales ?? []).filter((s) => s.address.trim()).map((s) => ({ id: "land-" + s.id, address: s.address, kind: "land" as const }));
  const candidates = [...saleCandidates, ...leaseCandidates, ...landCandidates];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function resolveStops(chosen: ComparableSale[]): Promise<{ stops: Stop[]; missing: string[] }> {
    const pins = (meta.salesMapPins ?? []) as SalesMapPin[];
    const bySale = new Map(pins.filter((p) => p.saleId).map((p) => [p.saleId!, p]));
    const stops: Stop[] = [];
    const needGeo: { id: string; query: string }[] = [];

    for (const sale of chosen) {
      const pin = bySale.get(sale.id);
      if (pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng) && !(pin.lat === 0 && pin.lng === 0)) {
        stops.push({ id: sale.id, address: sale.address.trim(), lat: pin.lat, lng: pin.lng });
      } else {
        needGeo.push({ id: sale.id, query: geocodeQueryForSale(sale.address, values) });
      }
    }

    const missing: string[] = [];
    if (needGeo.length) {
      const key = loadGoogleMapsKey();
      const geo = await geocodeGoogleAddresses({ data: { apiKey: key, addresses: needGeo.map((n) => n.query) } });
      needGeo.forEach((n, i) => {
        const hit = geo.results[i];
        if (hit?.lat != null && hit.lng != null) {
          const sale = chosen.find((s) => s.id === n.id);
          stops.push({ id: n.id, address: sale?.address.trim() || n.query, lat: hit.lat, lng: hit.lng });
        } else {
          const sale = chosen.find((s) => s.id === n.id);
          missing.push(sale?.address.trim() || n.query);
        }
      });
    }
    return { stops, missing };
  }

  async function plan() {
    if (!isGoogleMapsConfigured()) {
      toast.error("Google Maps key is not set. Add it under AI settings.");
      return;
    }
    const chosen = candidates.filter((s) => selected.has(s.id)).map((c) => {
      if (c.kind === "sale") return sales.find((s) => s.id === c.id);
      if (c.kind === "lease") return { id: c.id, address: c.address } as ComparableSale;
      return { id: c.id, address: c.address } as ComparableSale;
    }).filter(Boolean) as ComparableSale[];
    if (chosen.length === 0) {
      toast.error("Tick at least one comparable.");
      return;
    }
    if (chosen.length > MAX_STOPS) {
      toast.error(`Select ${MAX_STOPS} or fewer comparables. Google Maps limits intermediate stops.`);
      return;
    }

    setBusy(true);
    try {
      const { stops, missing } = await resolveStops(chosen);
      if (stops.length === 0) {
        toast.error("None of the selected comparables could be located.");
        return;
      }
      if (missing.length) {
        toast.message(`${missing.length} address${missing.length === 1 ? "" : "es"} could not be located and were skipped.`);
      }

      let originLat: number;
      let originLng: number;
      let originAddress: string;

      if (startFrom === "current") {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Location is not available on this device."));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        originLat = pos.coords.latitude;
        originLng = pos.coords.longitude;
        originAddress = `${originLat},${originLng}`;
      } else {
        const subjectAddr = subjectAddressLine(values);
        if (!subjectAddr) {
          toast.error("Subject address is not set.");
          return;
        }
        const subjectPin = ((meta.salesMapPins ?? []) as SalesMapPin[]).find((p) => p.kind === "subject");
        if (subjectPin && Number.isFinite(subjectPin.lat) && !(subjectPin.lat === 0 && subjectPin.lng === 0)) {
          originLat = subjectPin.lat;
          originLng = subjectPin.lng;
        } else {
          const key = loadGoogleMapsKey();
          const geo = await geocodeGoogleAddresses({ data: { apiKey: key, addresses: [geocodeQueryForSale(subjectAddr, values)] } });
          const hit = geo.results[0];
          if (hit?.lat == null || hit.lng == null) {
            toast.error("Could not locate the subject address.");
            return;
          }
          originLat = hit.lat;
          originLng = hit.lng;
        }
        originAddress = subjectAddr;
      }

      const ordered = await optimise(originLat, originLng, stops);
      const url = buildMapsUrl(originAddress, ordered);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(`Route opened with ${ordered.length} stop${ordered.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not plan the route.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Inspection route</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tick the comparables to visit. Opens an optimised Google Maps route with the address at each stop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          {open ? "Close" : "Plan inspection route"}
        </button>
      </div>
      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="route-start" checked={startFrom === "subject"} onChange={() => setStartFrom("subject")} />
              Start from subject
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="route-start" checked={startFrom === "current"} onChange={() => setStartFrom("current")} />
              Start from my current position
            </label>
          </div>
          {candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Import or add comparables first.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {candidates.map((s) => (
                <li key={s.id}>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block truncate">{s.address}</span>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {s.kind === "lease" ? "Lease" : s.kind === "land" ? "Land sale" : onReport.has(s.id) ? "Sale" : "Sale (held)"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={busy || candidates.length === 0}
            onClick={() => void plan()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Planning…" : "Open route in Google Maps"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function optimise(originLat: number, originLng: number, stops: Stop[]): Promise<Stop[]> {
  if (stops.length <= 1) return stops;
  const key = loadGoogleMapsKey();
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: stops[stops.length - 1].lat, longitude: stops[stops.length - 1].lng } } },
        intermediates: stops.slice(0, -1).map((s) => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } } })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        optimizeWaypointOrder: true,
        units: "METRIC",
        regionCode: "AU",
      }),
    });
    if (!res.ok) return stops;
    const json = (await res.json()) as { routes?: Array<{ optimizedIntermediateWaypointIndex?: number[] }> };
    const order = json.routes?.[0]?.optimizedIntermediateWaypointIndex;
    if (!order || order.length !== stops.length - 1) return stops;
    const intermediates = stops.slice(0, -1);
    const optimised = order.map((i) => intermediates[i]).filter(Boolean);
    optimised.push(stops[stops.length - 1]);
    return optimised;
  } catch {
    return stops;
  }
}

function buildMapsUrl(originAddress: string, stops: Stop[]): string {
  const parts = [originAddress, ...stops.map((s) => s.address)];
  const path = parts.map((p) => encodeURIComponent(p)).join("/");
  return `https://www.google.com/maps/dir/${path}`;
}
