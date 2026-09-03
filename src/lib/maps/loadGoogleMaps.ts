declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMap;
        Marker: new (opts: Record<string, unknown>) => GoogleMarker;
        InfoWindow: new (opts: Record<string, unknown>) => GoogleInfoWindow;
        LatLngBounds: new () => GoogleLatLngBounds;
        Geocoder: new () => GoogleGeocoder;
        event: { addListener: (t: unknown, n: string, fn: (...a: unknown[]) => void) => unknown };
        Animation?: { DROP: unknown };
      };
    };
    __ppvGmapsReady?: () => void;
  }
}

export type GoogleMap = {
  setCenter: (ll: { lat: number; lng: number }) => void;
  getCenter: () => { lat: () => number; lng: () => number } | null;
  fitBounds: (b: GoogleLatLngBounds) => void;
  addListener: (name: string, fn: (...a: unknown[]) => void) => unknown;
};

export type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  setPosition: (ll: { lat: number; lng: number }) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  addListener: (name: string, fn: (...a: unknown[]) => void) => unknown;
};

export type GoogleInfoWindow = {
  setContent: (html: string) => void;
  open: (opts: { map: GoogleMap; anchor: GoogleMarker }) => void;
};

export type GoogleLatLngBounds = {
  extend: (ll: { lat: number; lng: number }) => void;
  isEmpty: () => boolean;
};

export type GoogleGeocoder = {
  geocode: (
    req: { address: string; region?: string },
    cb: (results: Array<{ geometry?: { location?: { lat: () => number; lng: () => number } } }> | null, status: string) => void,
  ) => void;
};

let pending: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const existing = document.getElementById("ppv-google-maps-js");
    if (existing) {
      const wait = () => {
        if (window.google?.maps?.Map) resolve();
        else window.setTimeout(wait, 50);
      };
      wait();
      return;
    }
    window.__ppvGmapsReady = () => resolve();
    const script = document.createElement("script");
    script.id = "ppv-google-maps-js";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__ppvGmapsReady`;
    script.onerror = () => {
      pending = null;
      reject(new Error("Could not load Google Maps. Check the API key and Maps JavaScript API."));
    };
    document.head.appendChild(script);
  });
  return pending;
}

export function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    const g = window.google;
    if (!g?.maps?.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new g.maps.Geocoder();
    geocoder.geocode({ address, region: "AU" }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng() });
    });
  });
}
