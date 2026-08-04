import { useCallback, useEffect, useRef, useState } from "react";
import { inspectionStore } from "@/lib/inspection/storage";
import type { InspectionRecord, InspectionValues } from "@/lib/inspection/types";

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
    setValues(found?.values ?? {});
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
        const next = { ...prev, [key]: value };
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
