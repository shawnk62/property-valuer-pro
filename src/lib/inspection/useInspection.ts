import { useCallback, useEffect, useRef, useState } from "react";
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const found = inspectionStore.get(id) ?? null;
    setRecord(found);
    setValues(applyMirrors(found?.values ?? {}));
    setLoaded(true);
  }, [id]);

  const flush = useCallback(
    (next: InspectionValues) => {
      inspectionStore.save(id, next);
      setSavedAt(new Date().toISOString());
    },
    [id],
  );

  const setValue = useCallback(
    (key: string, value: InspectionValues[string]) => {
      setValues((prev) => {
        let next: InspectionValues = { ...prev, [key]: value };
        const target = MIRRORED_FIELDS[key];
        if (target) {
          // Keep the sign-off copy in sync unless it was edited by hand.
          const current = asText(prev[target]);
          if (!current || current === asText(prev[key])) {
            next = { ...next, [target]: typeof value === "string" ? value : "" };
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


  return { record, values, setValue, saveNow, savedAt, loaded };
}

export function useInspectionList() {
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  useEffect(() => {
    const sync = () => setRecords(inspectionStore.list());
    sync();
    return inspectionStore.subscribe(sync);
  }, []);
  return records;
}
