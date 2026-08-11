import { schema } from "./schema";
import type { InspectionRecord, InspectionValues } from "./types";
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
    // Do not alter answers after submit — statutory notes stay fixed.
    const existing = await this.get(id);
    if (existing?.status === "submitted") {
      throw new Error("This inspection is submitted. Original notes are locked.");
    }
    const { error } = await supabase
      .from("inspections")
      .update({
        form_values: values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "draft");
    if (error) throw error;
    emit();
  },

  /**
   * Marks the inspection submitted and freezes a one-time copy of form_values
   * into submitted_form_values (statutory inspection record).
   */
  async submit(id: string): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error("Inspection not found");
    if (existing.status === "submitted" && existing.submittedValues) {
      return;
    }

    const now = new Date().toISOString();
    const snapshot = existing.values ?? {};
    const { error } = await supabase
      .from("inspections")
      .update({
        status: "submitted",
        submitted_at: now,
        updated_at: now,
        // Only set snapshot if not already frozen
        submitted_form_values: existing.submittedValues ?? snapshot,
        submitted_schema_version:
          existing.submittedSchemaVersion ?? existing.schemaVersion,
      })
      .eq("id", id);
    if (error) throw error;
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
    const { error } = await supabase
      .from("inspections")
      .update({
        report_extras: extras,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    emit();
  },
};
