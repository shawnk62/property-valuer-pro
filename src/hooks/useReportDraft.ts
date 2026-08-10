import { useCallback, useEffect, useRef, useState } from "react";
import { inspectionStore } from "@/lib/inspection/storage";
import { generateNarrative } from "@/lib/report/narrative";
import type {
  ComparableSale,
  FieldValue,
  ReportDraft,
  ReportMeta,
  ReportNarrative,
  ReportPhoto,
} from "@/lib/report/types";

/**
 * Single source of truth for a report draft.
 * Loads subject values from the real Supabase inspection record.
 * Draft extras (narrative / photos / sales / meta) persist in localStorage
 * until a dedicated report_drafts table is added.
 */
const storageKey = (id: string) => `report-draft:${id}`;

function emptyNarrative(): ReportNarrative {
  return { brief: "", improvements: "", accommodation: "", remarks: "" };
}

function emptyMeta(values: Record<string, FieldValue>): ReportMeta {
  const inspDate =
    typeof values.insp_date === "string" ? values.insp_date : "";
  const valuer =
    typeof values.insp_valuer === "string" ? values.insp_valuer : "";
  const firm =
    typeof values.insp_firm === "string" ? values.insp_firm : "Peterson Property Valuations Pty Ltd";
  return {
    valueAmount: "",
    valueDate: inspDate,
    inspectionDate: inspDate,
    valuerName: valuer,
    firmName: firm,
  };
}

function createEmptyDraft(inspectionId: string, values: Record<string, FieldValue> = {}): ReportDraft {
  return {
    inspectionId,
    values,
    narrative: emptyNarrative(),
    photos: [],
    sales: [],
    reportMeta: emptyMeta(values),
  };
}

function isDurablePhotoUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Keep Supabase (and other http) URLs; drop ephemeral blob: object URLs.
  return /^https?:\/\//i.test(url);
}

function loadPersistedExtras(inspectionId: string): Partial<ReportDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(inspectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportDraft;
    const photos = Array.isArray(parsed.photos)
      ? parsed.photos.filter((p) => isDurablePhotoUrl(p?.url))
      : [];
    return {
      narrative: parsed.narrative,
      sales: parsed.sales,
      reportMeta: parsed.reportMeta,
      photos,
    };
  } catch {
    return null;
  }
}

export function useReportDraft(inspectionId: string) {
  const [draft, setDraft] = useState<ReportDraft>(() => createEmptyDraft(inspectionId));
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadError(null);
    hydrated.current = false;

    inspectionStore
      .get(inspectionId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setLoadError("Inspection not found");
          setDraft(createEmptyDraft(inspectionId));
          setLoaded(true);
          return;
        }
        const values = (record.values ?? {}) as Record<string, FieldValue>;
        const base = createEmptyDraft(inspectionId, values);
        const extras = loadPersistedExtras(inspectionId);
        const narrativeEmpty =
          !extras?.narrative ||
          Object.values(extras.narrative).every((s) => !String(s ?? "").trim());
        const narrative = narrativeEmpty
          ? generateNarrative(values)
          : extras!.narrative;
        setDraft({
          ...base,
          ...(extras ?? {}),
          values, // always prefer live inspection values
          narrative,
          photos: extras?.photos ?? [],
        });
        setLoaded(true);
        hydrated.current = true;
        setDirty(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load inspection");
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  const update = useCallback((patch: Partial<ReportDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const setValue = useCallback((name: string, value: FieldValue) => {
    setDraft((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: value },
    }));
    setDirty(true);
  }, []);

  const setMeta = useCallback((patch: Partial<ReportMeta>) => {
    setDraft((prev) => ({ ...prev, reportMeta: { ...prev.reportMeta, ...patch } }));
    setDirty(true);
  }, []);

  const setNarrative = useCallback((patch: Partial<ReportNarrative>) => {
    setDraft((prev) => ({ ...prev, narrative: { ...prev.narrative, ...patch } }));
    setDirty(true);
  }, []);

  const setPhotos = useCallback((next: ReportPhoto[]) => {
    setDraft((prev) => {
      const updated = { ...prev, photos: next };
      // Persist durable photo URLs immediately so uploads survive reload without a manual save.
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(storageKey(prev.inspectionId));
          const base = raw ? (JSON.parse(raw) as ReportDraft) : prev;
          const toStore: ReportDraft = {
            ...base,
            ...updated,
            values: prev.values,
            photos: next.filter((ph) => isDurablePhotoUrl(ph.url)),
          };
          window.localStorage.setItem(storageKey(prev.inspectionId), JSON.stringify(toStore));
        } catch {
          // ignore persistence errors
        }
      }
      return updated;
    });
    setDirty(true);
  }, []);

  const setSales = useCallback((next: ComparableSale[]) => {
    setDraft((prev) => ({ ...prev, sales: next }));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    if (typeof window === "undefined") return;
    // Persist editable extras. Keep only durable photo URLs (Supabase), not blob: previews.
    const toStore: ReportDraft = {
      ...draft,
      photos: draft.photos.filter((p) => isDurablePhotoUrl(p.url)),
    };
    window.localStorage.setItem(storageKey(draft.inspectionId), JSON.stringify(toStore));
    setSavedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
    setDirty(false);
  }, [draft]);

  return {
    draft,
    loaded,
    loadError,
    dirty,
    savedAt,
    update,
    setValue,
    setMeta,
    setNarrative,
    setPhotos,
    setSales,
    save,
  };
}

export type ReportDraftController = ReturnType<typeof useReportDraft>;
