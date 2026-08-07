import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CheckboxRow,
  ConditionSelect,
  FieldLabel,
  SelectInput,
  TextInput,
} from "./primitives";
import { REQUIRED_SET } from "@/lib/inspection/required";
import { isFilled } from "@/lib/inspection/validation";
import type { InspectionField, InspectionValues } from "@/lib/inspection/types";
import { cn } from "@/lib/utils";

interface Props {
  field: InspectionField;
  values: InspectionValues;
  showErrors: boolean;
  onChange: (key: string, value: InspectionValues[string]) => void;
}

function asString(v: InspectionValues[string]): string {
  return typeof v === "string" ? v : "";
}

function asArray(v: InspectionValues[string]): string[] {
  return Array.isArray(v) ? v : [];
}

export function FieldRenderer({ field, values, showErrors, onChange }: Props) {
  const required = REQUIRED_SET.has(field.name);
  const invalid = showErrors && required && !isFilled(values[field.name]);

  if (field.type === "text") {
    return (
      <div className="space-y-2">
        <FieldLabel htmlFor={field.name} required={required}>
          {field.label}
        </FieldLabel>
        <TextInput
          id={field.name}
          value={asString(values[field.name])}
          multiline={field.multiline === true}
          invalid={invalid}
          onChange={(v) => onChange(field.name, v)}
        />
      </div>
    );
  }

  if (field.type === "select") {
    const isDesign = field.name === "imp_design";
    const isLocation = field.name === "nbhd_location";
    return (
      <div className="space-y-2">
        <FieldLabel htmlFor={field.name} required={required}>
          {field.label}
        </FieldLabel>
        <SelectInput
          id={field.name}
          value={asString(values[field.name])}
          options={field.options}
          invalid={invalid}
          onChange={(v) => onChange(field.name, v)}
        />
        {isDesign ? (
          <p className="text-xs text-muted-foreground">
            Selecting a style pre-fills typical construction features (foundations, cladding, roof, linings, verandahs, etc.). You can change or clear any item afterwards.
          </p>
        ) : null}
        {isLocation ? (
          <p className="text-xs text-muted-foreground">
            Selecting a location pre-fills typical neighbourhood, street and site features (built-up density, roads, lighting, services, fencing, etc.). You can change or clear any item afterwards.
          </p>
        ) : null}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <CheckboxRow
        id={field.name}
        label={field.label}
        checked={values[field.name] === true}
        onChange={(v) => onChange(field.name, v)}
      />
    );
  }

  if (field.type === "single_row") {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="font-serif text-base font-medium text-foreground">{field.label}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {field.fields.map((child) =>
            child.type === "select" ? (
              <div key={child.name} className="space-y-1.5">
                <FieldLabel htmlFor={child.name} className="text-xs uppercase tracking-wide text-muted-foreground">
                  {child.label}
                </FieldLabel>
                <SelectInput
                  id={child.name}
                  value={asString(values[child.name])}
                  options={child.options}
                  onChange={(v) => onChange(child.name, v)}
                />
              </div>
            ) : (
              <div key={child.name} className="space-y-1.5">
                <FieldLabel htmlFor={child.name} className="text-xs uppercase tracking-wide text-muted-foreground">
                  {child.label}
                </FieldLabel>
                <TextInput
                  id={child.name}
                  value={asString(values[child.name])}
                  onChange={(v) => onChange(child.name, v)}
                />
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  return <CheckboxGroup field={field} values={values} onChange={onChange} />;
}

function CheckboxGroup({
  field,
  values,
  onChange,
}: {
  field: Extract<InspectionField, { type: "checkbox_group" }>;
  values: InspectionValues;
  onChange: (key: string, value: InspectionValues[string]) => void;
}) {
  const selected = asArray(values[field.name]);
  const [open, setOpen] = useState(selected.length > 0 || field.items.length <= 12);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    // Keep stored order identical to schema order, not tap order.
    const ordered = field.items.map((i) => i.id).filter((i) => next.includes(i));
    onChange(field.name, ordered);
  };

  const runs = splitIntoRuns(field);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-serif text-base font-medium text-foreground">{field.label}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {selected.length > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {selected.length} selected
            </span>
          ) : null}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-4">
            {runs.map((run, i) => (
              <div key={run.heading ?? i} className="space-y-2">
                {run.heading ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {run.heading}
                  </p>
                ) : null}
                {/* Column flow: reading down each column follows schema order. */}
                <div className="gap-2 [column-fill:balance] sm:columns-2 lg:columns-3">
                  {run.items.map((item) => (
                    <div key={item.id} className="mb-2 break-inside-avoid">
                      <CheckboxRow
                        id={item.id}
                        label={item.label}
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel
                htmlFor={field.condition_field}
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Condition
              </FieldLabel>
              <ConditionSelect
                id={field.condition_field}
                value={asString(values[field.condition_field])}
                onChange={(v) => onChange(field.condition_field, v)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel
                htmlFor={field.notes_field}
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Notes
              </FieldLabel>
              <TextInput
                id={field.notes_field}
                value={asString(values[field.notes_field])}
                multiline
                onChange={(v) => onChange(field.notes_field, v)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CheckboxItem = Extract<InspectionField, { type: "checkbox_group" }>["items"][number];
type Run = { heading?: string; items: CheckboxItem[] };

/**
 * Purely presentational grouping: keeps related runs of options together on
 * screen. Item ids, labels and their schema order are never changed.
 */
const RUN_HEADINGS: Record<string, Record<string, string>> = {
  fence: {
    fence_fenced: "General",
    fence_colorbond: "Materials",
    fence_two_wire: "Rural wire",
    fence_star_picket: "Posts & yards",
    fence_front: "Boundaries",
    fence_vehicle_gates: "Gates",
    fence_other: "Other",
  },
};

function splitIntoRuns(field: Extract<InspectionField, { type: "checkbox_group" }>): Run[] {
  const headings = RUN_HEADINGS[field.name];
  if (!headings) return [{ items: field.items }];

  const runs: Run[] = [];
  for (const item of field.items) {
    const heading = headings[item.id];
    if (heading || runs.length === 0) runs.push({ ...(heading ? { heading } : {}), items: [] });
    runs[runs.length - 1]!.items.push(item);
  }
  return runs;
}
