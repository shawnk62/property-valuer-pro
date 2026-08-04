import schemaJson from "@/data/inspection-schema.json";
import type {
  CheckboxGroupField,
  InspectionField,
  InspectionSchema,
  InspectionSection,
  SingleRowField,
} from "./types";

/**
 * The uploaded schema is the single source of truth for field names, labels
 * and option wording. Never edit it to change app behaviour — add config
 * alongside it (see ./required.ts).
 */
export const schema = schemaJson as unknown as InspectionSchema;

export const sections: InspectionSection[] = schema.sections;

export function sectionByIndex(index: number): InspectionSection | undefined {
  return sections[index];
}

export function sectionIndexById(id: string): number {
  return sections.findIndex((s) => s.id === id);
}

/** Every value key a field owns, in stable order. */
export function fieldKeys(field: InspectionField): string[] {
  switch (field.type) {
    case "checkbox_group": {
      const f = field as CheckboxGroupField;
      return [f.name, f.condition_field, f.notes_field];
    }
    case "single_row": {
      const f = field as SingleRowField;
      return f.fields.map((c) => c.name);
    }
    default:
      return [field.name];
  }
}

const labelIndex = new Map<string, string>();
const sectionIndexForField = new Map<string, number>();

sections.forEach((section, i) => {
  for (const field of section.fields) {
    labelIndex.set(field.name, field.label);
    for (const key of fieldKeys(field)) {
      sectionIndexForField.set(key, i);
      if (!labelIndex.has(key)) labelIndex.set(key, field.label);
    }
    if (field.type === "single_row") {
      for (const child of field.fields) labelIndex.set(child.name, `${field.label} — ${child.label}`);
    }
  }
});

export function labelForField(name: string): string {
  return labelIndex.get(name) ?? name;
}

export function stepForField(name: string): number {
  return sectionIndexForField.get(name) ?? 0;
}

export function itemLabels(field: CheckboxGroupField, selected: string[]): string[] {
  return selected
    .map((id) => field.items.find((item) => item.id === id)?.label)
    .filter((v): v is string => Boolean(v));
}
