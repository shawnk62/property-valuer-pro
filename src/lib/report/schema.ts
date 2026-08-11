import schema from "@/data/inspection-schema.json";
import type { FieldValue, InspectionValues } from "./types";

interface RawField {
  name: string;
  label: string;
  type: string;
  options?: string[];
  items?: { id: string; label: string }[];
  fields?: RawField[];
}

interface RawSection {
  id: string;
  title: string;
  fields: RawField[];
}

const sections = (schema as unknown as { sections: RawSection[] }).sections;

const fieldLabels: Record<string, string> = {};
const checkboxItemLabels: Record<string, string> = {};
const parentOfChild: Record<string, string> = {};

function walk(field: RawField, parent?: RawField) {
  fieldLabels[field.name] = field.label;
  if (parent) parentOfChild[field.name] = parent.name;
  field.items?.forEach((item) => {
    checkboxItemLabels[item.id] = item.label;
  });
  field.fields?.forEach((child) => walk(child, field));
}

sections.forEach((section) => section.fields.forEach((f) => walk(f)));

/**
 * Human label for a catalogue field key. Child fields of a grouped row carry
 * generic labels ("Type", "Condition"), so they are qualified with the parent
 * label to stay unambiguous in the report. Falls back to the key itself.
 */
export function labelFor(name: string): string {
  const own = fieldLabels[name];
  if (!own) return name;
  const parent = parentOfChild[name];
  if (!parent) return own;
  const parentLabel = fieldLabels[parent];
  if (!parentLabel || own.toLowerCase().includes(parentLabel.toLowerCase())) {
    return own;
  }
  return `${parentLabel} — ${own}`;
}

/** Label for a checkbox-group item id. */
export function itemLabel(id: string): string {
  return checkboxItemLabels[id] ?? id;
}

/** True when the value should appear in the report at all. */
export function hasValue(value: FieldValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return false;
    // Placeholder option used on framing and count selects
    if (t === "Select" || t === "—") return false;
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return true;
}

/** Display string for a stored value; checkbox ids become their labels. */
export function displayValue(value: FieldValue | undefined): string {
  if (!hasValue(value)) return "";
  if (Array.isArray(value)) return value.map(itemLabel).join(", ");
  if (typeof value === "boolean") return "Yes";
  return String(value);
}

export function get(values: InspectionValues, name: string): string {
  return displayValue(values[name]);
}

/** Returns present values only, in the order requested. */
export function pick(
  values: InspectionValues,
  names: string[],
): { name: string; label: string; value: string }[] {
  return names
    .filter((n) => hasValue(values[n]))
    .map((n) => ({ name: n, label: labelFor(n), value: displayValue(values[n]) }));
}

/** Joins present values with a separator, skipping the empty ones. */
export function joinValues(
  values: InspectionValues,
  names: string[],
  separator = ", ",
): string {
  return names
    .filter((n) => hasValue(values[n]))
    .map((n) => displayValue(values[n]))
    .join(separator);
}

export const SCHEMA_VERSION = (schema as unknown as { version: string }).version;
