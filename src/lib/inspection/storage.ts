import { schema } from "./schema";
import type { InspectionRecord, InspectionValues } from "./types";
import {
  getDeviceId,
  isLockStale,
  type EditLockInfo,
} from "@/lib/inspection/editLock";
import { supabase } from "@/lib/supabase";

/**
 * Repository boundary.
 * Phase 1 was localStorage. This implementation uses Supabase so the same
 * authenticated user sees the same inspections on every device.
 */

type DbRow = {
  id: string;
  user_id: string;
  status: "draft" | "submitted";
  form_values: InspectionValues;
  submitted_form_values: InspectionValues | null;
  submitted_schema_version: string | null;
  schema_version: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  report_extras?: ReportExtras | null;
};

/** Report workspace payload stored on the inspection row for cross-device sync. */
export type ReportExtras = {
  narrative?: Record<string, string>;
  photos?: Array<{
    id: string;
    slot: string | null;
    caption: string;
    url: string;
    storagePath?: string;
    capturedAt?: string;
  }>;
  sales?: unknown[];
  reportMeta?: Record<string, string>;
};

function rowToRecord(row: DbRow): InspectionRecord {
  return {
    id: row.id,
    status: row.status,
    values: row.form_values ?? {},
    submittedValues: row.submitted_form_values ?? undefined,
    submittedSchemaVersion: row.submitted_schema_version ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at ?? undefined,
    schemaVersion: row.schema_version,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("Not signed in");
  return user.id;
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}


/** iPad/Safari often keeps an expired access token that still looks readable. */
async function ensureFreshSession(): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message || "Could not read sign-in session");
  }
  if (!sessionData.session) {
    throw new Error("You are signed out. Sign in again on this device.");
  }
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    const msg = refreshError.message || "";
    if (/jwt|expired|session|refresh/i.test(msg)) {
      throw new Error("Session expired. Sign in again on this device.");
    }
  }
}

export const inspectionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async list(): Promise<InspectionRecord[]> {
    const { data, error } = await supabase
      .from("inspections")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as DbRow[]).map(rowToRecord);
  },

  async get(id: string): Promise<InspectionRecord | undefined> {
    const { data, error } = await supabase
      .from("inspections")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToRecord(data as DbRow) : undefined;
  },

  async create(): Promise<InspectionRecord> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("inspections")
      .insert({
        user_id: userId,
        status: "draft",
        form_values: {},
        schema_version: schema.version,
      })
      .select("*")
      .single();
    if (error) throw error;
    const record = rowToRecord(data as DbRow);
    emit();
    return record;
  },

  async save(id: string, values: InspectionValues): Promise<void> {
    // Live form_values stay editable after submit so answers can be corrected.
    // submitted_form_values (first-submit snapshot) is left unchanged.
    await ensureFreshSession();
    const existing = await this.get(id);
    if (!existing) throw new Error("Inspection not found");
    const { error } = await supabase
      .from("inspections")
      .update({
        form_values: values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      const msg = error.message || "Failed to save";
      if (/jwt|expired|session|not authorized|401|403/i.test(msg)) {
        throw new Error("Session expired or blocked. Sign in again on this device, then save.");
      }
      if (/network|fetch|Failed to fetch|timeout/i.test(msg)) {
        throw new Error("Network error while saving. Check the hotspot connection and try again.");
      }
      throw error;
    }
    emit();
  },

  /**
   * Marks the inspection submitted and freezes a one-time copy of form_values
   * into submitted_form_values when that column exists.
   * Refreshes the auth session first (iPad Safari often has a stale JWT).
   */
  async submit(id: string): Promise<void> {
    await ensureFreshSession();

    const existing = await this.get(id);
    if (!existing) throw new Error("Inspection not found");
    if (existing.status === "submitted") {
      return;
    }

    const now = new Date().toISOString();
    const snapshot = existing.values ?? {};

    // Ensure latest answers are on the server before locking status
    const { error: saveError } = await supabase
      .from("inspections")
      .update({
        form_values: snapshot,
        updated_at: now,
      })
      .eq("id", id)
      .eq("status", "draft");
    if (saveError) {
      throw new Error(saveError.message || "Could not save answers before submit");
    }

    const withSnapshot = {
      status: "submitted" as const,
      submitted_at: now,
      updated_at: now,
      submitted_form_values: existing.submittedValues ?? snapshot,
      submitted_schema_version:
        existing.submittedSchemaVersion ?? existing.schemaVersion,
    };

    let { data, error } = await supabase
      .from("inspections")
      .update(withSnapshot)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    // Column missing (SQL not run yet) — still allow status-only submit
    if (error && /submitted_form_values|submitted_schema_version|column/i.test(error.message)) {
      ({ data, error } = await supabase
        .from("inspections")
        .update({
          status: "submitted",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", id)
        .select("id")
        .maybeSingle());
    }

    if (error) {
      throw new Error(error.message || "Submit failed");
    }
    if (!data) {
      throw new Error(
        "Submit did not update this inspection. Sign in again, or check you still have access.",
      );
    }
    emit();
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("inspections").delete().eq("id", id);
    if (error) throw error;
    emit();
  },

  async getReportExtras(id: string): Promise<ReportExtras | null> {
    const { data, error } = await supabase
      .from("inspections")
      .select("report_extras")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    const extras = (data as { report_extras?: ReportExtras | null } | null)?.report_extras;
    return extras ?? null;
  },

  async saveReportExtras(id: string, extras: ReportExtras): Promise<void> {
    await ensureFreshSession();
    const { error } = await supabase
      .from("inspections")
      .update({
        report_extras: extras,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      const msg = error.message || "Failed to save report draft";
      if (/jwt|expired|session|not authorized|401|403/i.test(msg)) {
        throw new Error("Session expired. Sign in again on this device, then save.");
      }
      if (/network|fetch|Failed to fetch|timeout/i.test(msg)) {
        throw new Error("Network error while saving the report. Check the hotspot and try Save again.");
      }
      if (/too large|payload|value too long|json/i.test(msg)) {
        throw new Error(
          "Report draft is too large to sync (often large photo data). Use cloud photo upload, or remove data-URL map/photos and save again.",
        );
      }
      throw error;
    }
    emit();
  },

  /**
   * Read current edit lock (device columns). Returns null if unlocked or columns
   * not installed yet.
   */
  async getEditLock(id: string): Promise<EditLockInfo | null> {
    const { data, error } = await supabase
      .from("inspections")
      .select("edit_lock_device_id, edit_lock_label, edit_lock_at")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (/edit_lock_|column/i.test(error.message)) return null;
      throw error;
    }
    const row = data as {
      edit_lock_device_id?: string | null;
      edit_lock_label?: string | null;
      edit_lock_at?: string | null;
    } | null;
    if (!row?.edit_lock_device_id || !row.edit_lock_at) return null;
    return {
      deviceId: row.edit_lock_device_id,
      label: row.edit_lock_label?.trim() || "Another device",
      at: row.edit_lock_at,
    };
  },

  /**
   * Try to become the sole editor. Succeeds if unlocked, held by this device,
   * or the existing lock is stale. Returns { ok, lock, readOnly }.
   */
  async tryAcquireEditLock(
    id: string,
    opts?: { label?: string; force?: boolean },
  ): Promise<{ ok: boolean; lock: EditLockInfo | null; readOnly: boolean; setupRequired?: boolean }> {
    await ensureFreshSession();
    const deviceId = getDeviceId();
    let label = opts?.label?.trim() || "";
    if (!label) {
      try {
        const { data } = await supabase.auth.getUser();
        label = data.user?.email?.trim() || "Valuer";
      } catch {
        label = "Valuer";
      }
    }

    const existing = await this.getEditLock(id);
    // getEditLock returns null both for unlocked and for missing columns —
    // probe write to detect missing columns.
    const now = new Date().toISOString();

    if (existing && existing.deviceId !== deviceId && !isLockStale(existing.at) && !opts?.force) {
      return { ok: false, lock: existing, readOnly: true };
    }

    const { error } = await supabase
      .from("inspections")
      .update({
        edit_lock_device_id: deviceId,
        edit_lock_label: label,
        edit_lock_at: now,
      })
      .eq("id", id);

    if (error) {
      if (/edit_lock_|column/i.test(error.message)) {
        return { ok: true, lock: null, readOnly: false, setupRequired: true };
      }
      throw error;
    }

    return {
      ok: true,
      lock: { deviceId, label, at: now },
      readOnly: false,
    };
  },

  async heartbeatEditLock(id: string): Promise<void> {
    const deviceId = getDeviceId();
    const { error } = await supabase
      .from("inspections")
      .update({ edit_lock_at: new Date().toISOString() })
      .eq("id", id)
      .eq("edit_lock_device_id", deviceId);
    if (error && !/edit_lock_|column/i.test(error.message)) {
      console.warn("[editLock] heartbeat failed", error.message);
    }
  },

  async releaseEditLock(id: string): Promise<void> {
    const deviceId = getDeviceId();
    const { error } = await supabase
      .from("inspections")
      .update({
        edit_lock_device_id: null,
        edit_lock_label: null,
        edit_lock_at: null,
      })
      .eq("id", id)
      .eq("edit_lock_device_id", deviceId);
    if (error && !/edit_lock_|column/i.test(error.message)) {
      console.warn("[editLock] release failed", error.message);
    }
  },
};
