/**
 * Single-active-editor lock: one device may edit an inspection/report at a time.
 * Prevents office + field from overwriting the same form_values / report_extras blob.
 */

export type EditLockInfo = {
  deviceId: string;
  label: string;
  /** ISO timestamp of last heartbeat */
  at: string;
};

export const EDIT_LOCK_STALE_MS = 45 * 60 * 1000;
export const EDIT_LOCK_HEARTBEAT_MS = 2 * 60 * 1000;

const DEVICE_KEY = "pvp-edit-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

export function isLockStale(atIso: string | null | undefined, now = Date.now()): boolean {
  if (!atIso) return true;
  const t = new Date(atIso).getTime();
  if (Number.isNaN(t)) return true;
  return now - t > EDIT_LOCK_STALE_MS;
}

export function formatLockAge(atIso: string): string {
  const t = new Date(atIso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
}
