import { REQUIRED_SET } from "./required";
import { fieldKeys, sections, stepForField } from "./schema";
import type { InspectionValues } from "./types";

export function isFilled(value: InspectionValues[string]): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || t === "Select" || t === "—") return false;
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

export interface MissingField {
  name: string;
  step: number;
}

/** All required fields that are still empty, across every step. */
export function missingFields(values: InspectionValues): MissingField[] {
  const missing: MissingField[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      for (const key of fieldKeys(field)) {
        if (REQUIRED_SET.has(key) && !isFilled(values[key])) {
          missing.push({ name: key, step: stepForField(key) });
        }
      }
    }
  }
  return missing;
}

export function missingForStep(values: InspectionValues, step: number): MissingField[] {
  return missingFields(values).filter((m) => m.step === step);
}

/** Rough completion of a step, used for the progress indicator. */
export function stepProgress(values: InspectionValues, step: number): number {
  const section = sections[step];
  if (!section) return 0;
  const keys = section.fields.flatMap(fieldKeys);
  if (keys.length === 0) return 0;
  const filled = keys.filter((k) => isFilled(values[k])).length;
  return filled / keys.length;
}
