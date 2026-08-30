import { supabase } from "@/lib/supabase";
import type { ReportNarrative } from "@/lib/report/types";

export type NarrativeSectionKey = keyof ReportNarrative;

export type CannedComment = {
  id: string;
  section: NarrativeSectionKey;
  label: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const LOCAL_KEY = "ppv-canned-comments-v1";

const SECTION_KEYS: NarrativeSectionKey[] = [
  "brief",
  "location",
  "sitePhysical",
  "servicesAmenities",
  "improvements",
  "accommodation",
  "conditionImprovements",
  "remarks",
];

export function isNarrativeSectionKey(value: string): value is NarrativeSectionKey {
  return (SECTION_KEYS as string[]).includes(value);
}

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `canned_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readLocal(): CannedComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is CannedComment => {
        if (!x || typeof x !== "object") return false;
        const row = x as CannedComment;
        return (
          typeof row.id === "string" &&
          isNarrativeSectionKey(String(row.section)) &&
          typeof row.body === "string" &&
          row.body.trim().length > 0
        );
      })
      .map((x) => ({
        id: x.id,
        section: x.section,
        label: String(x.label || "General").trim() || "General",
        body: x.body,
        createdAt: x.createdAt || new Date().toISOString(),
        updatedAt: x.updatedAt || x.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function writeLocal(list: CannedComment[]) {
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

function sortComments(list: CannedComment[]): CannedComment[] {
  return [...list].sort((a, b) => {
    const labelCmp = a.label.localeCompare(b.label, "en-AU", {
      sensitivity: "base",
    });
    if (labelCmp !== 0) return labelCmp;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function groupCannedByLabel(
  items: CannedComment[],
): { label: string; items: CannedComment[] }[] {
  const map = new Map<string, { label: string; items: CannedComment[] }>();
  for (const item of sortComments(items)) {
    const key = item.label.trim().toLocaleLowerCase("en-AU") || "general";
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, { label: item.label.trim() || "General", items: [item] });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "en-AU", { sensitivity: "base" }),
  );
}

export function appendCannedText(existing: string, canned: string): string {
  const base = existing.replace(/\s+$/, "");
  const add = canned.trim();
  if (!add) return existing;
  if (!base) return add;
  return `${base}\n\n${add}`;
}

/**
 * List canned comments for one narrative section.
 * Prefers Supabase when signed in; merges localStorage so offline saves remain.
 */
export async function listCannedComments(
  section: NarrativeSectionKey,
): Promise<CannedComment[]> {
  const local = readLocal().filter((c) => c.section === section);
  const userId = await currentUserId();
  if (!userId) return sortComments(local);

  try {
    const { data, error } = await supabase
      .from("canned_comments")
      .select("id, section, label, body, created_at, updated_at")
      .eq("user_id", userId)
      .eq("section", section)
      .order("label", { ascending: true });

    if (error) return sortComments(local);

    const remote: CannedComment[] = (data ?? [])
      .map((row) => ({
        id: String(row.id),
        section: isNarrativeSectionKey(String(row.section))
          ? (row.section as NarrativeSectionKey)
          : section,
        label: String(row.label || "General").trim() || "General",
        body: String(row.body || ""),
        createdAt: String(row.created_at || new Date().toISOString()),
        updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
      }))
      .filter((c) => c.body.trim());

    const byId = new Map<string, CannedComment>();
    for (const c of local) byId.set(c.id, c);
    for (const c of remote) byId.set(c.id, c);
    return sortComments(Array.from(byId.values()).filter((c) => c.section === section));
  } catch {
    return sortComments(local);
  }
}

export async function saveCannedComment(
  section: NarrativeSectionKey,
  label: string,
  body: string,
): Promise<CannedComment> {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error("Type or generate the comment first, then save it.");
  }
  const entry: CannedComment = {
    id: uid(),
    section,
    label: label.trim() || "General",
    body: trimmedBody,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const all = readLocal();
  writeLocal([entry, ...all.filter((c) => c.id !== entry.id)]);

  const userId = await currentUserId();
  if (userId) {
    try {
      const { data, error } = await supabase
        .from("canned_comments")
        .insert({
          id: entry.id,
          user_id: userId,
          section: entry.section,
          label: entry.label,
          body: entry.body,
        })
        .select("id, section, label, body, created_at, updated_at")
        .single();
      if (!error && data) {
        return {
          id: String(data.id),
          section: entry.section,
          label: String(data.label || entry.label),
          body: String(data.body || entry.body),
          createdAt: String(data.created_at || entry.createdAt),
          updatedAt: String(data.updated_at || entry.updatedAt),
        };
      }
    } catch {
      // local save still succeeded
    }
  }

  return entry;
}

export async function updateCannedComment(
  id: string,
  patch: { label?: string; body?: string },
): Promise<void> {
  const all = readLocal();
  const next = all.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      label: patch.label !== undefined ? patch.label.trim() || "General" : c.label,
      body: patch.body !== undefined ? patch.body.trim() || c.body : c.body,
      updatedAt: new Date().toISOString(),
    };
  });
  writeLocal(next);

  const userId = await currentUserId();
  if (!userId) return;
  try {
    const payload: Record<string, string> = { updated_at: new Date().toISOString() };
    if (patch.label !== undefined) payload.label = patch.label.trim() || "General";
    if (patch.body !== undefined) payload.body = patch.body.trim();
    await supabase
      .from("canned_comments")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId);
  } catch {
    // local update still succeeded
  }
}

export async function deleteCannedComment(id: string): Promise<void> {
  writeLocal(readLocal().filter((c) => c.id !== id));
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await supabase.from("canned_comments").delete().eq("id", id).eq("user_id", userId);
  } catch {
    // ignore
  }
}
