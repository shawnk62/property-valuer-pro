import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { applyDesignPreset, DESIGN_PRESETS } from "@/lib/inspection/design-presets";
import { applyLocationPreset, LOCATION_PRESETS } from "@/lib/inspection/location-presets";
import { inspectionStore } from "@/lib/inspection/storage";
import type { InspectionRecord, InspectionValues } from "@/lib/inspection/types";

/**
 * Sign-off fields that mirror an earlier answer until the valuer edits them
 * by hand. Source field name -> sign-off field name.
 */
const MIRRORED_FIELDS: Record<string, string> = {
  insp_valuer: "sign_name",
  insp_date: "sign_date",
};

function asText(v: InspectionValues[string]): string {
  return typeof v === "string" ? v : "";
}

/** Pre-fills empty sign-off fields from their source field. */
function applyMirrors(values: InspectionValues): InspectionValues {
  let next = values;
  for (const [source, target] of Object.entries(MIRRORED_FIELDS)) {
    const from = asText(values[source]);
    if (from && !asText(values[target])) next = { ...next, [target]: from };
  }
  return next;
}

/** Loads a record on the client and autosaves value changes. */
export function useInspection(id: string) {
  const [record, setRecord] = useState<InspectionRecord | null>(null);
  const [values, setValues] = useState<InspectionValues>({});
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    inspectionStore
      .get(id)
      .then((found) => {
        if (cancelled) return;
        setRecord(found ?? null);
        setValues(applyMirrors(found?.values ?? {}));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load inspection");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flush = useCallback(
    (next: InspectionValues) => {
      void inspectionStore
        .save(id, next)
        .then(() => setSavedAt(new Date().toISOString()))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to save");
        });
    },
    [id],
  );

  const setValue = useCallback(
    (key: string, value: InspectionValues[string]) => {
      setValues((prev) => {
        let next: InspectionValues = { ...prev, [key]: value };

        // Mirror selected source fields into sign-off until the user edits them.
        const target = MIRRORED_FIELDS[key];
        if (target) {
          const current = asText(prev[target]);
          if (!current || current === asText(prev[key])) {
            next = { ...next, [target]: typeof value === "string" ? value : "" };
          }
        }

        // When Design / Style is chosen, pre-fill typical construction features
        // that are still empty. Existing answers are never overwritten.
        if (key === "imp_design" && typeof value === "string" && value && DESIGN_PRESETS[value]) {
          const before = next;
          next = applyDesignPreset(next, value);
          if (next !== before) {
            toast.success(`Typical features for “${value}” pre-selected. Adjust any that do not apply.`);
          }
        }

        // When Location is chosen, pre-fill typical neighbourhood / site features.
        if (key === "nbhd_location" && typeof value === "string" && value && LOCATION_PRESETS[value]) {
          const before = next;
          next = applyLocationPreset(next, value);
          if (next !== before) {
            toast.success(`Typical ${value.toLowerCase()} neighbourhood and site features pre-selected. Adjust any that do not apply.`);
          }
        }

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(next), 400);
        return next;
      });
    },
    [flush],
  );

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    flush(values);
  }, [flush, values]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { record, values, setValue, saveNow, savedAt, loaded, error };
}

export function useInspectionList() {
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      setLoading(true);
      inspectionStore
        .list()
        .then((list) => {
          if (cancelled) return;
          setRecords(list);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Failed to list inspections");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    sync();
    return inspectionStore.subscribe(sync);
  }, []);

  return { records, loading, error };
}
