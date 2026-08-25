import { supabase } from "@/lib/supabase";

export type SavedSignature = {
  id: string;
  label: string;
  dataUrl: string;
  createdAt: string;
};

const LOCAL_KEY = "ppv-saved-signatures-v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readLocal(): SavedSignature[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is SavedSignature =>
          Boolean(
            x &&
              typeof x === "object" &&
              typeof (x as SavedSignature).id === "string" &&
              typeof (x as SavedSignature).dataUrl === "string" &&
              (x as SavedSignature).dataUrl.startsWith("data:image"),
          ),
      )
      .map((x) => ({
        id: x.id,
        label: String(x.label || "Signature").trim() || "Signature",
        dataUrl: x.dataUrl,
        createdAt: x.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function writeLocal(list: SavedSignature[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * List saved signatures. Prefers Supabase when signed in and table exists;
 * always merges localStorage so offline saves are not lost.
 */
export async function listSavedSignatures(): Promise<SavedSignature[]> {
  const local = readLocal();
  const userId = await currentUserId();
  if (!userId) return local;

  try {
    const { data, error } = await supabase
      .from("saved_signatures")
      .select("id, label, image_data, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // Table missing or RLS — local only
      return local;
    }

    const remote: SavedSignature[] = (data ?? []).map((row) => ({
      id: String(row.id),
      label: String(row.label || "Signature"),
      dataUrl: String(row.image_data || ""),
      createdAt: String(row.created_at || new Date().toISOString()),
    })).filter((s) => s.dataUrl.startsWith("data:image"));

    // Merge by id; remote wins on conflict
    const byId = new Map<string, SavedSignature>();
    for (const s of local) byId.set(s.id, s);
    for (const s of remote) byId.set(s.id, s);
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return local;
  }
}

export async function saveSignature(
  dataUrl: string,
  label?: string,
): Promise<SavedSignature> {
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("Not a valid signature image");
  }
  const entry: SavedSignature = {
    id: uid(),
    label: (label || "My signature").trim() || "My signature",
    dataUrl,
    createdAt: new Date().toISOString(),
  };

  const local = readLocal();
  writeLocal([entry, ...local.filter((s) => s.dataUrl !== dataUrl)]);

  const userId = await currentUserId();
  if (userId) {
    try {
      const { data, error } = await supabase
        .from("saved_signatures")
        .insert({
          id: entry.id,
          user_id: userId,
          label: entry.label,
          image_data: entry.dataUrl,
        })
        .select("id, label, image_data, created_at")
        .single();
      if (!error && data) {
        return {
          id: String(data.id),
          label: String(data.label || entry.label),
          dataUrl: String(data.image_data || entry.dataUrl),
          createdAt: String(data.created_at || entry.createdAt),
        };
      }
    } catch {
      // local save still succeeded
    }
  }

  return entry;
}

export async function deleteSavedSignature(id: string): Promise<void> {
  writeLocal(readLocal().filter((s) => s.id !== id));
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await supabase.from("saved_signatures").delete().eq("id", id).eq("user_id", userId);
  } catch {
    // ignore
  }
}
