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
  schema_version: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

function rowToRecord(row: DbRow): InspectionRecord {
  return {
    id: row.id,
    status: row.status,
    values: row.form_values ?? {},
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
    const { error } = await supabase
      .from("inspections")
      .update({
        form_values: values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    emit();
  },

  async submit(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("inspections")
      .update({
        status: "submitted",
        submitted_at: now,
        updated_at: now,
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
};
