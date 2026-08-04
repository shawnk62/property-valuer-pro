import { schema } from "./schema";
import type { InspectionRecord, InspectionValues } from "./types";

/**
 * Repository boundary. Phase 1 persists to the device; Phase 2 swaps the
 * implementation for Lovable Cloud without touching the form components.
 */

const KEY = "qld-inspections-v1";

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function read(): InspectionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InspectionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(records: InspectionRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(records));
  emit();
}

export const inspectionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  list(): InspectionRecord[] {
    return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  get(id: string): InspectionRecord | undefined {
    return read().find((r) => r.id === id);
  },
  create(): InspectionRecord {
    const now = new Date().toISOString();
    const record: InspectionRecord = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `insp-${Date.now()}`,
      status: "draft",
      values: {},
      createdAt: now,
      updatedAt: now,
      schemaVersion: schema.version,
    };
    write([record, ...read()]);
    return record;
  },
  save(id: string, values: InspectionValues) {
    const records = read();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return;
    records[index] = { ...records[index], values, updatedAt: new Date().toISOString() };
    write(records);
  },
  submit(id: string) {
    const records = read();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return;
    const now = new Date().toISOString();
    records[index] = { ...records[index], status: "submitted", submittedAt: now, updatedAt: now };
    write(records);
  },
  remove(id: string) {
    write(read().filter((r) => r.id !== id));
  },
};
