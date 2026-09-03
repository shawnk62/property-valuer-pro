import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchGoogleStaticMap } from "@/lib/maps/maps.functions";
import { loadGoogleMapsKey } from "@/lib/maps/googleSettings";
import {
  geocodeAddress,
  loadGoogleMaps,
  type GoogleMap,
  type GoogleMarker,
} from "@/lib/maps/loadGoogleMaps";
import {
  pinsFromDraft,
  pinsNeedingGeocode,
  staticMapQuery,
  type SalesMapPin,
} from "@/lib/maps/salesMapPins";
import type { ComparableSale } from "@/lib/report/types";
import type { InspectionValues } from "@/lib/inspection/types";

type Props = {
  open: boolean;
  values: InspectionValues;
  sales: ComparableSale[];
  savedPins?: SalesMapPin[] | null;
  onClose: () => void;
  onApply: (result: { file: File; pins: SalesMapPin[] }) => Promise<void>;
};

export function SalesMapEditor({
  open,
  values,
  sales,
  savedPins,
  onClose,
  onApply,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markersRef = useRef<Map<string, GoogleMarker>>(new Map());
  const [pins, setPins] = useState<SalesMapPin[]>([]);
  const [busy, setBusy] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPins(pinsFromDraft({ values, sales, saved: savedPins }));
    setReady(false);
    setBusy("Loading Google Maps…");
    const key = loadGoogleMapsKey();
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleMaps(key);
        if (cancelled) return;
        setBusy("Geocoding addresses…");
        const seed = pinsFromDraft({ values, sales, saved: savedPins });
        const need = pinsNeedingGeocode(seed);
        const next = [...seed];
        for (const pin of need) {
          if (!pin.address) continue;
          const found = await geocodeAddress(pin.address);
          if (found) {
            const i = next.findIndex((p) => p.id === pin.id);
            if (i >= 0) next[i] = { ...next[i]!, lat: found.lat, lng: found.lng };
          }
        }
        if (cancelled) return;
        setPins(next);
        setBusy("");
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setBusy("");
        toast.error(err instanceof Error ? err.message : "Could not load Google Maps");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, values, sales, savedPins]);

  useEffect(() => {
    if (!open || !ready || !hostRef.current || !window.google?.maps) return;
    const g = window.google.maps;
    const placed = pins.filter((p) => !(p.lat === 0 && p.lng === 0));
    const center = placed[0]
      ? { lat: placed[0].lat, lng: placed[0].lng }
      : { lat: -27.47, lng: 153.03 };
    const map = new g.Map(hostRef.current, {
      center,
      zoom: 13,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapRef.current = map;

    const bounds = new g.LatLngBounds();
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();

    for (const pin of pins) {
      if (pin.lat === 0 && pin.lng === 0) continue;
      const marker = new g.Marker({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        draggable: true,
        label: pin.shortLabel,
        title: `${pin.label}${pin.address ? ` — ${pin.address}` : ""}`,
      });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (!pos) return;
        setPins((prev) =>
          prev.map((p) =>
            p.id === pin.id ? { ...p, lat: pos.lat(), lng: pos.lng() } : p,
          ),
        );
      });
      bounds.extend({ lat: pin.lat, lng: pin.lng });
      markersRef.current.set(pin.id, marker);
    }
    if (placed.length > 1) map.fitBounds(bounds);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
      mapRef.current = null;
    };
    // Recreate markers when pin list identity changes, not on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, pins.map((p) => p.id).join("|")]);

  if (!open) return null;

  async function addPinHere() {
    const map = mapRef.current;
    const center = map?.getCenter();
    const lat = center?.lat() ?? -27.47;
    const lng = center?.lng() ?? 153.03;
    const n = pins.filter((p) => p.kind === "custom").length + 1;
    const pin: SalesMapPin = {
      id: `pin-custom-${Date.now()}`,
      label: `Extra ${n}`,
      shortLabel: "X",
      lat,
      lng,
      kind: "custom",
    };
    setPins((prev) => [...prev, pin]);
    const g = window.google?.maps;
    if (g && map) {
      const marker = new g.Marker({
        map,
        position: { lat, lng },
        draggable: true,
        label: { text: "X", color: "#fff", fontWeight: "700" },
        title: pin.label,
      });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (!pos) return;
        setPins((prev) =>
          prev.map((p) =>
            p.id === pin.id ? { ...p, lat: pos.lat(), lng: pos.lng() } : p,
          ),
        );
      });
      markersRef.current.set(pin.id, marker);
    }
  }

  async function apply() {
    const key = loadGoogleMapsKey();
    const query = staticMapQuery(pins);
    if (query.markers.length === 0) {
      toast.error("No pins with coordinates to save");
      return;
    }
    setBusy("Building map image…");
    try {
      const result = await fetchGoogleStaticMap({
        data: {
          apiKey: key,
          size: query.size,
          scale: query.scale,
          maptype: query.maptype,
          markers: query.markers,
        },
      });
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const mime = result.mime.startsWith("image/") ? result.mime : "image/png";
      const file = new File([bytes], "sales-map.png", { type: mime });
      await onApply({ file, pins });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build map image");
    } finally {
      setBusy("");
    }
  }

  const missing = pins.filter((p) => p.kind !== "custom" && p.lat === 0 && p.lng === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Sales map</h2>
            <p className="text-xs text-muted-foreground">
              Drag a pin to correct it. Add pin drops an extra marker at the map centre.
              Apply writes the labelled image into the sales-map slot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div ref={hostRef} className="min-h-[22rem] w-full flex-1 bg-muted" />
        {missing.length > 0 ? (
          <p className="px-4 py-2 text-xs text-amber-800">
            Could not locate: {missing.map((p) => p.label).join(", ")}. Add a pin by hand if needed.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={Boolean(busy) || !ready}
            onClick={() => void addPinHere()}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60"
          >
            Add pin here
          </button>
          <span className="flex-1 text-xs text-muted-foreground">{busy}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input px-3 py-2 text-sm text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !ready}
            onClick={() => void apply()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            Apply to report
          </button>
        </div>
      </div>
    </div>
  );
}
