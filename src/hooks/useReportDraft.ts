import { useCallback, useEffect, useRef, useState } from "react";
import { inspectionStore, type ReportExtras } from "@/lib/inspection/storage";
import { generateNarrative } from "@/lib/report/narrative";
import { applyRelativityToSales } from "@/lib/report/salesRelativity";
import type {
  ComparableSale,
  FieldValue,
  ReportDraft,
  ReportMeta,
  ReportNarrative,
  ReportPhoto,
} from "@/lib/report/types";

/**
 * Report draft: subject values from Supabase inspection;
 * extras (narrative / photos / sales / meta) synced to inspections.report_extras
 * so desktop and iPad share the same draft. localStorage is a cache only.
 */
const storageKey = (id: string) => `report-draft:${id}`;

function emptyNarrative(): ReportNarrative {
  return { brief: "", location: "", improvements: "", accommodation: "", remarks: "" };
}

function normalizeNarrative(raw: Partial<ReportNarrative> | null | undefined): ReportNarrative {
  const base = emptyNarrative();
  if (!raw || typeof raw !== "object") return base;
  return {
    brief: typeof raw.brief === "string" ? raw.brief : "",
    location: typeof raw.location === "string" ? raw.location : "",
    improvements: typeof raw.improvements === "string" ? raw.improvements : "",
    accommodation: typeof raw.accommodation === "string" ? raw.accommodation : "",
    remarks: typeof raw.remarks === "string" ? raw.remarks : "",
  };
}

function emptyMeta(values: Record<string, FieldValue>): ReportMeta {
  const inspDate = typeof values.insp_date === "string" ? values.insp_date : "";
  const valuer = typeof values.insp_valuer === "string" ? values.insp_valuer : "";
  const firm =
    typeof values.insp_firm === "string"
      ? values.insp_firm
      : "Peterson Property Valuations Pty Ltd";
  return {
    valueAmount: "",
    valueDate: inspDate,
    inspectionDate: inspDate,
    valuerName: valuer,
    firmName: firm,
    glaRatePerM2: "",
    siteRatePerM2: "",
  };
}

function createEmptyDraft(
  inspectionId: string,
  values: Record<string, FieldValue> = {},
): ReportDraft {
  return {
    inspectionId,
    values,
    narrative: emptyNarrative(),
    photos: [],
    sales: [],
    reportMeta: emptyMeta(values),
  };
}

function isHttpUrl(url: string | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

function isDurablePhotoUrl(url: string | undefined): boolean {
  if (!url) return false;
  return isHttpUrl(url) || url.startsWith("data:image/");
}

/** Cloud payload: only HTTPS photo URLs (data: is device-local and too large for rows). */
function toCloudExtras(draft: ReportDraft): ReportExtras {
  return {
    narrative: draft.narrative,
    sales: draft.sales,
    reportMeta: draft.reportMeta,
    photos: draft.photos
      .filter((p) => isHttpUrl(p.url))
      .map((p) => ({
        id: p.id,
        slot: p.slot,
        caption: p.caption,
        url: p.url,
        storagePath: p.storagePath,
      })),
  };
}

function photosFromCloud(extras: ReportExtras | null | undefined): ReportPhoto[] {
  if (!extras?.photos || !Array.isArray(extras.photos)) return [];
  return extras.photos
    .filter((p) => p && isHttpUrl(p.url))
    .map((p) => ({
      id: p.id,
      slot: (p.slot as ReportPhoto["slot"]) ?? null,
      caption: p.caption ?? "",
      url: p.url,
      storagePath: p.storagePath,
    }));
}

function loadLocalExtras(inspectionId: string): Partial<ReportDraft> | null {
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

function writeLocalCache(draft: ReportDraft) {
  if (typeof window === "undefined") return;
  try {
    const toStore: ReportDraft = {
      ...draft,
      photos: draft.photos.filter((p) => isDurablePhotoUrl(p.url)),
    };
    window.localStorage.setItem(storageKey(draft.inspectionId), JSON.stringify(toStore));
  } catch {
    // quota / private mode
  }
}

/** Prefer HTTPS over data: for the same slot/id so cloud wins across devices. */
function mergePhotos(cloud: ReportPhoto[], local: ReportPhoto[]): ReportPhoto[] {
  const byKey = new Map<string, ReportPhoto>();
  const keyOf = (p: ReportPhoto) => (p.slot ? `slot:${p.slot}` : `id:${p.id}`);

  for (const p of local) byKey.set(keyOf(p), p);
  for (const p of cloud) {
    const k = keyOf(p);
    const existing = byKey.get(k);
    if (!existing || isHttpUrl(p.url)) byKey.set(k, p);
  }
  return Array.from(byKey.values());
}

export function useReportDraft(inspectionId: string) {
  const [draft, setDraft] = useState<ReportDraft>(() => createEmptyDraft(inspectionId));
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadError(null);
    hydrated.current = false;

    (async () => {
      try {
        const record = await inspectionStore.get(inspectionId);
        if (cancelled) return;
        if (!record) {
          setLoadError("Inspection not found");
          setDraft(createEmptyDraft(inspectionId));
          setLoaded(true);
          return;
        }

        const values = (record.values ?? {}) as Record<string, FieldValue>;
        const base = createEmptyDraft(inspectionId, values);
        const local = loadLocalExtras(inspectionId);

        let cloud: ReportExtras | null = null;
        try {
          cloud = await inspectionStore.getReportExtras(inspectionId);
        } catch {
          cloud = null;
        }

        const cloudPhotos = photosFromCloud(cloud);
        const localPhotos = local?.photos ?? [];
        const photos = mergePhotos(cloudPhotos, localPhotos);

        const cloudNarrative = cloud?.narrative as ReportNarrative | undefined;
        const narrativeEmpty =
          !cloudNarrative ||
          Object.values(cloudNarrative).every((s) => !String(s ?? "").trim());
        const localNarrativeEmpty =
          !local?.narrative ||
          Object.values(local.narrative).every((s) => !String(s ?? "").trim());

        let narrative: ReportNarrative;
        if (!narrativeEmpty && cloudNarrative) narrative = normalizeNarrative(cloudNarrative);
        else if (!localNarrativeEmpty && local?.narrative) narrative = normalizeNarrative(local.narrative);
        else narrative = generateNarrative(values);

        const reportMeta =
          (cloud?.reportMeta as ReportMeta | undefined) ||
          local?.reportMeta ||
          emptyMeta(values);

        const sales =
          (Array.isArray(cloud?.sales) ? (cloud!.sales as ComparableSale[]) : null) ||
          local?.sales ||
          [];

        const next: ReportDraft = {
          ...base,
          values,
          narrative,
          photos,
          sales,
          reportMeta: { ...emptyMeta(values), ...reportMeta },
        };
        setDraft(next);
        writeLocalCache(next);
        setLoaded(true);
        hydrated.current = true;
        setDirty(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load inspection");
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  const persistCloud = useCallback(async (d: ReportDraft) => {
    writeLocalCache(d);
    try {
      await inspectionStore.saveReportExtras(d.inspectionId, toCloudExtras(d));
      setSavedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setDirty(false);
    } catch (err: unknown) {
      // Keep local cache; surface soft failure via dirty flag remaining true
      console.error("report_extras save failed", err);
      throw err;
    }
  }, []);

  const scheduleCloudSave = useCallback(
    (d: ReportDraft) => {
      writeLocalCache(d);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persistCloud(d).catch(() => {
          /* leave dirty */
        });
      }, 600);
    },
    [persistCloud],
  );

  const update = useCallback(
    (patch: Partial<ReportDraft>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch };
        scheduleCloudSave(next);
        return next;
      });
      setDirty(true);
    },
    [scheduleCloudSave],
  );

  const setValue = useCallback(
    (name: string, value: FieldValue) => {
      setDraft((prev) => {
        const next = { ...prev, values: { ...prev.values, [name]: value } };
        scheduleCloudSave(next);
        return next;
      });
      setDirty(true);
    },
    [scheduleCloudSave],
  );

  const setMeta = useCallback(
    (patch: Partial<ReportMeta>) => {
      setDraft((prev) => {
        const reportMeta = { ...prev.reportMeta, ...patch };
        // When valuation amount changes, refresh inferior/superior on all comps
        const sales =
          patch.valueAmount !== undefined
            ? applyRelativityToSales(prev.sales, reportMeta.valueAmount)
            : prev.sales;
        const next = { ...prev, reportMeta, sales };
        scheduleCloudSave(next);
        return next;
      });
      setDirty(true);
    },
    [scheduleCloudSave],
  );

  const setNarrative = useCallback(
    (patch: Partial<ReportNarrative>) => {
      setDraft((prev) => {
        const next = { ...prev, narrative: { ...prev.narrative, ...patch } };
        scheduleCloudSave(next);
        return next;
      });
      setDirty(true);
    },
    [scheduleCloudSave],
  );

  const setPhotos = useCallback(
    (next: ReportPhoto[] | ((prev: ReportPhoto[]) => ReportPhoto[])) => {
      setDraft((prev) => {
        const photos = typeof next === "function" ? next(prev.photos) : next;
        const updated = { ...prev, photos };
        scheduleCloudSave(updated);
        return updated;
      });
      setDirty(true);
    },
    [scheduleCloudSave],
  );

  const setSales = useCallback(
    (next: ComparableSale[]) => {
      setDraft((prev) => {
        const sales = applyRelativityToSales(next, prev.reportMeta.valueAmount);
        const updated = { ...prev, sales };
        scheduleCloudSave(updated);
        return updated;
      });
      setDirty(true);
    },
    [scheduleCloudSave],
  );

  const save = useCallback(async () => {
    const d = draftRef.current;
    writeLocalCache(d);
    try {
      await persistCloud(d);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      // Column missing is the usual first-run case
      if (/report_extras|column/i.test(msg)) {
        throw new Error(
          "Run supabase-report-extras-setup.sql in Supabase SQL Editor, then save again.",
        );
      }
      throw err;
    }
  }, [persistCloud]);

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
