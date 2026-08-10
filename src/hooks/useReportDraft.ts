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

function loadPersistedExtras(inspectionId: string): Partial<ReportDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(inspectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportDraft;
    // Photos use object URLs which do not survive a reload.
    return {
      narrative: parsed.narrative,
      sales: parsed.sales,
      reportMeta: parsed.reportMeta,
      photos: [],
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
    setDraft((prev) => ({ ...prev, photos: next }));
    setDirty(true);
  }, []);

  const setSales = useCallback((next: ComparableSale[]) => {
    setDraft((prev) => ({ ...prev, sales: next }));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    if (typeof window === "undefined") return;
    // Persist only the editable extras — values stay owned by the inspection record.
    const toStore: ReportDraft = {
      ...draft,
      photos: [], // object URLs are not durable
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
