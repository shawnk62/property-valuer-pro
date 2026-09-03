const KEY = "ppv-google-maps-key-v1";

export function loadGoogleMapsKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(KEY) || "").trim();
  } catch {
    return "";
  }
}

export function saveGoogleMapsKey(apiKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, apiKey.trim());
}

export function isGoogleMapsConfigured(apiKey?: string): boolean {
  return (apiKey ?? loadGoogleMapsKey()).trim().length > 10;
}
