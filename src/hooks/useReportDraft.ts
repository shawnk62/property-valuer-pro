import { useCallback, useEffect, useRef, useState } from "react";
import { inspectionStore, type ReportExtras } from "@/lib/inspection/storage";
import { applyRelativityToSales } from "@/lib/report/salesRelativity";
import type {
  ComparableSale,
  FieldValue,
  ReportDraft,
  ReportMeta,
  ReportNarrative,
  ReportPhoto,
} from "@/lib/report/types";
import { resolveValuerProfile } from "@/lib/report/valuerProfiles";
import { objectUrlFromPhotoBlob } from "@/lib/report/photo-idb";

/**
 * Report draft: subject values from Supabase inspection;
 * extras (narrative / photos / sales / meta) synced to inspections.report_extras
 * so desktop and iPad share the same draft. localStorage is a cache only.
 */
const storageKey = (id: string) => `report-draft:${id}`;

function emptyNarrative(): ReportNarrative {
  return {
    brief: "",
    location: "",
    sitePhysical: "",
    servicesAmenities: "",
    improvements: "",
    accommodation: "",
    conditionImprovements: "",
    remarks: "",
  };
}

function normalizeNarrative(raw: Partial<ReportNarrative> | null | undefined): ReportNarrative {
  const base = emptyNarrative();
  if (!raw || typeof raw !== "object") return base;
  return {
    brief: typeof raw.brief === "string" ? raw.brief : "",
    location: typeof raw.location === "string" ? raw.location : "",
    sitePhysical: typeof raw.sitePhysical === "string" ? raw.sitePhysical : "",
    servicesAmenities:
      typeof raw.servicesAmenities === "string" ? raw.servicesAmenities : "",
    improvements: typeof raw.improvements === "string" ? raw.improvements : "",
    accommodation: typeof raw.accommodation === "string" ? raw.accommodation : "",
    conditionImprovements:
      typeof raw.conditionImprovements === "string" ? raw.conditionImprovements : "",
    remarks: typeof raw.remarks === "string" ? raw.remarks : "",
  };
}

function emptyMeta(values: Record<string, FieldValue>): ReportMeta {
  const inspDate = typeof values.insp_date === "string" ? values.insp_date : "";
  const assignment =
    typeof values.prop_assignment === "string" ? values.prop_assignment : "";
  const profile = resolveValuerProfile(assignment);
  const valuerFromForm =
    typeof values.insp_valuer === "string" ? values.insp_valuer.trim() : "";
  const firmFromForm =
    typeof values.insp_firm === "string" ? values.insp_firm.trim() : "";
  const valuer =
    valuerFromForm ||
    (profile.id === "phil" || profile.id === "murray" ? profile.displayName : "");
  const firm =
    firmFromForm ||
    (profile.id === "phil" || profile.id === "murray"
      ? profile.firm
      : "PETERSON PROPERTY VALUATIONS PTY LTD");
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

/** Cloud payload: only HTTPS media (data: is device-local and too large for JSON rows / mobile). */
function toCloudExtras(draft: ReportDraft): ReportExtras {
  const sales = (draft.sales ?? []).map((s) => {
    const next = { ...s };
    if (next.photoUrl && !isHttpUrl(next.photoUrl)) {
      // Keep photo on-device only; do not push multi-MB data URLs through report_extras
      const { photoUrl: _drop, ...rest } = next;
      return rest;
    }
    return next;
  });
  const reportMeta = { ...draft.reportMeta };
  if (reportMeta.salesMapUrl && !isHttpUrl(reportMeta.salesMapUrl)) {
    delete reportMeta.salesMapUrl;
  }
  return {
    narrative: draft.narrative,
    sales,
    reportMeta,
    photos: draft.photos
      .filter((p) => isHttpUrl(p.url))
      .map((p) => ({
        id: p.id,
        slot: p.slot,
        caption: p.caption,
        url: p.url,
        storagePath: p.storagePath,
        ...(p.capturedAt ? { capturedAt: p.capturedAt } : {}),
        ...(p.kind ? { kind: p.kind } : {}),
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
      ...((p as { capturedAt?: string }).capturedAt
        ? { capturedAt: String((p as { capturedAt?: string }).capturedAt) }
        : {}),
      ...((p as { kind?: string }).kind === "map" || (p as { kind?: string }).kind === "photo"
        ? { kind: (p as { kind?: "map" | "photo" }).kind }
        : {}),
    }));
}

async function hydrateLocalBlobs(draft: ReportDraft): Promise<ReportDraft> {
  const photos = await Promise.all(
    draft.photos.map(async (p) => {
      if (isDurablePhotoUrl(p.url)) return p;
      if (!p.localBlobKey) return p;
      const url = await objectUrlFromPhotoBlob(p.localBlobKey);
      return url ? { ...p, url } : p;
    }),
  );
  const sales = await Promise.all(
    (draft.sales ?? []).map(async (s) => {
      if (isDurablePhotoUrl(s.photoUrl)) return s;
      if (!s.photoLocalKey) return s;
      const url = await objectUrlFromPhotoBlob(s.photoLocalKey);
      return url ? { ...s, photoUrl: url } : s;
    }),
  );
  return { ...draft, photos, sales };
}

function loadLocalExtras(inspectionId: string): Partial<ReportDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(inspectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportDraft;
    const photos = Array.isArray(parsed.photos)
      ? parsed.photos.filter((p) => isDurablePhotoUrl(p?.url) || Boolean(p?.localBlobKey))
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
      photos: draft.photos.map((p) => ({
        ...p,
        url: isHttpUrl(p.url) ? p.url : "",
      })),
      sales: (draft.sales ?? []).map((s) => ({
        ...s,
        photoUrl: isHttpUrl(s.photoUrl) ? s.photoUrl : undefined,
      })),
      reportMeta: {
        ...draft.reportMeta,
        salesMapUrl: isHttpUrl(draft.reportMeta.salesMapUrl)
          ? draft.reportMeta.salesMapUrl
          : undefined,
      },
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

export function useReportDraft(
  inspectionId: string,
  opts?: { readOnly?: boolean },
) {
  const readOnly = Boolean(opts?.readOnly);
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

        // Per-key merge: keep any non-empty text from cloud or local (never wipe a reopened report)
        const cloudNarrative = normalizeNarrative(cloud?.narrative as ReportNarrative | undefined);
        const localNarrative = normalizeNarrative(local?.narrative);
        const narrative: ReportNarrative = emptyNarrative();
        for (const key of Object.keys(narrative) as (keyof ReportNarrative)[]) {
          const c = cloudNarrative[key]?.trim() ?? "";
          const l = localNarrative[key]?.trim() ?? "";
          // Prefer longer/non-empty; cloud wins on equal non-empty to stay multi-device consistent
          if (c) narrative[key] = c;
          else if (l) narrative[key] = l;
        }

        const storedMeta =
          (cloud?.reportMeta as ReportMeta | undefined) ||
          local?.reportMeta ||
          undefined;
        // emptyMeta supplies Phil/Murray defaults; stored empty strings must not wipe them
        const defaults = emptyMeta(values);
        const reportMeta: ReportMeta = {
          ...defaults,
          ...(storedMeta || {}),
          valuerName:
            (storedMeta?.valuerName || "").trim() ||
            defaults.valuerName ||
            "",
          firmName:
            (storedMeta?.firmName || "").trim() ||
            defaults.firmName ||
            "",
        };

        const cloudSales = Array.isArray(cloud?.sales) ? (cloud!.sales as ComparableSale[]) : null;
        const localSales = Array.isArray(local?.sales) ? (local!.sales as ComparableSale[]) : null;
        let sales: ComparableSale[] = [];
        if (cloudSales && cloudSales.length > 0 && localSales && localSales.length > 0) {
          // Merge by index / address — restore local-only photoUrl when cloud stripped data URLs
          const n = Math.max(cloudSales.length, localSales.length);
          for (let i = 0; i < n; i++) {
            const c = cloudSales[i];
            const l = localSales[i];
            if (c && l) {
              sales.push({
                ...l,
                ...c,
                photoUrl: isHttpUrl(c.photoUrl) ? c.photoUrl : l.photoUrl || c.photoUrl,
                narrativeManual: c.narrativeManual ?? l.narrativeManual,
                narrative: (c.narrative && c.narrative.trim()) || l.narrative || "",
              });
            } else {
              sales.push((c || l)!);
            }
          }
        } else {
          sales = cloudSales?.length ? cloudSales : localSales || [];
        }

        // Ensure form values also carry Phil/Murray identity when still blank
        const profile = resolveValuerProfile(
          typeof values.prop_assignment === "string" ? values.prop_assignment : "",
        );
        let nextValues = values;
        if (profile.id === "phil" || profile.id === "murray") {
          const patch: Record<string, FieldValue> = {};
          if (!(typeof values.insp_valuer === "string" && values.insp_valuer.trim())) {
            patch.insp_valuer = profile.displayName;
          }
          if (!(typeof values.insp_firm === "string" && values.insp_firm.trim())) {
            patch.insp_firm = profile.firm;
          }
          if (!(typeof values.sign_member === "string" && values.sign_member.trim())) {
            patch.sign_member = profile.membershipLine;
          }
          if (Object.keys(patch).length) {
            nextValues = { ...values, ...patch };
            // Persist identity onto the inspection so future opens stay filled
            void inspectionStore
              .save(inspectionId, nextValues as import("@/lib/inspection/types").InspectionValues)
              .catch(() => {});
          }
        }

        const next: ReportDraft = {
          ...base,
          values: nextValues,
          narrative,
          photos,
          sales,
          reportMeta: {
            ...reportMeta,
            valuerName: reportMeta.valuerName || profile.displayName || "",
            firmName: reportMeta.firmName || profile.firm || "",
          },
        };
        const hydratedDraft = await hydrateLocalBlobs(next);
        if (cancelled) return;
        setDraft(hydratedDraft);
        writeLocalCache(hydratedDraft);
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
    if (readOnly) {
      setDirty(true);
      return;
    }
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
          /* leave dirty — online handler will retry */
        });
      }, 900);
    },
    [persistCloud],
  );

  // iPad / hotspot: flush when backgrounded or when connectivity returns
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (!hydrated.current) return;
      const d = draftRef.current;
      writeLocalCache(d);
      void persistCloud(d).catch(() => {
        /* leave dirty */
      });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", flush);
    };
  }, [persistCloud]);

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
        let values = { ...prev.values, [name]: value };
        let reportMeta = prev.reportMeta;
        // Report type Phil/Murray → fill Valuer + Firm (and membership) when chosen
        if (name === "prop_assignment" && typeof value === "string") {
          const profile = resolveValuerProfile(value);
          if (profile.id === "phil" || profile.id === "murray") {
            values = {
              ...values,
              insp_valuer: profile.displayName,
              insp_firm: profile.firm,
              sign_member: profile.membershipLine,
            };
            reportMeta = {
              ...reportMeta,
              valuerName: profile.displayName,
              firmName: profile.firm,
            };
          }
        }
        const next = { ...prev, values, reportMeta };
        scheduleCloudSave(next);
        return next;
      });
      setDirty(true);
      // Signature lives on the inspection form — persist form_values so lock
      // state is shared between form and report across devices.
      if (name === "sign_sig") {
        void (async () => {
          try {
            const rec = await inspectionStore.get(inspectionId);
            const base = rec?.values ?? {};
            await inspectionStore.save(inspectionId, {
              ...base,
              sign_sig: typeof value === "string" ? value : "",
            });
          } catch (err) {
            console.error("sign_sig form save failed", err);
          }
        })();
      }
      // Persist Phil/Murray identity onto the inspection form values
      if (name === "prop_assignment" && typeof value === "string") {
        const profile = resolveValuerProfile(value);
        if (profile.id === "phil" || profile.id === "murray") {
          void (async () => {
            try {
              const rec = await inspectionStore.get(inspectionId);
              const base = rec?.values ?? {};
              await inspectionStore.save(inspectionId, {
                ...base,
                prop_assignment: value,
                insp_valuer: profile.displayName,
                insp_firm: profile.firm,
                sign_member: profile.membershipLine,
              });
            } catch (err) {
              console.error("valuer identity form save failed", err);
            }
          })();
        }
      }
    },
    [scheduleCloudSave, inspectionId],
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
