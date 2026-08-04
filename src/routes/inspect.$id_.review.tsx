import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Copy, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldKeys, itemLabels, labelForField, sections } from "@/lib/inspection/schema";
import { inspectionStore } from "@/lib/inspection/storage";
import type { InspectionField, InspectionValues } from "@/lib/inspection/types";
import { useInspection } from "@/lib/inspection/useInspection";
import { isFilled, missingFields } from "@/lib/inspection/validation";

export const Route = createFileRoute("/inspect/$id_/review")({
  head: () => ({
    meta: [
      { title: "Review Inspection — QLD Inspections" },
      {
        name: "description",
        content:
          "Review every captured inspection answer by section before submitting the structured record for valuation reporting.",
      },
      { property: "og:title", content: "Review Inspection — QLD Inspections" },
      {
        property: "og:description",
        content:
          "Review every captured inspection answer by section before submitting the structured record for valuation reporting.",
      },
    ],
  }),
  component: ReviewScreen,
});

function displayValue(field: InspectionField, key: string, values: InspectionValues): string {
  const raw = values[key];
  if (field.type === "checkbox_group" && key === field.name) {
    return itemLabels(field, Array.isArray(raw) ? raw : []).join(", ");
  }
  if (typeof raw === "boolean") return raw ? "Yes" : "";
  if (Array.isArray(raw)) return raw.join(", ");
  return raw ?? "";
}

function subLabel(field: InspectionField, key: string): string {
  if (field.type === "checkbox_group") {
    if (key === field.condition_field) return `${field.label} — Condition`;
    if (key === field.notes_field) return `${field.label} — Notes`;
  }
  return labelForField(key);
}

function ReviewScreen() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { record, values, loaded } = useInspection(id);
  const [submitted, setSubmitted] = useState(false);

  const missing = useMemo(() => missingFields(values), [values]);
  const json = useMemo(() => JSON.stringify(values, null, 2), [values]);

  if (loaded && !record) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">This inspection could not be found.</p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-primary underline">
            Back to inspections
          </Link>
        </div>
      </div>
    );
  }

  const isSubmitted = submitted || record?.status === "submitted";

  const submit = () => {
    if (missing.length > 0) {
      toast.error("Complete all required fields before submitting.");
      return;
    }
    inspectionStore.submit(id);
    setSubmitted(true);
    window.scrollTo({ top: 0 });
    toast.success("Inspection submitted");
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(json);
    toast.success("JSON copied");
  };

  const downloadJson = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const address = typeof values["prop_address"] === "string" ? values["prop_address"] : "inspection";
    anchor.download = `${address.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "inspection"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to inspections">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isSubmitted ? "Submitted record" : "Review before submit"}
            </p>
            <h1 className="truncate font-serif text-lg font-semibold text-foreground">
              {typeof values["prop_address"] === "string" && values["prop_address"]
                ? values["prop_address"]
                : "Subject property inspection"}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {isSubmitted ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="font-serif text-base font-semibold text-foreground">Structured record</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stored as one JSON object keyed by schema field names.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copyJson()}>
                <Copy className="size-4" />
                Copy JSON
              </Button>
              <Button variant="outline" onClick={downloadJson}>
                <Download className="size-4" />
                Download JSON
              </Button>
            </div>
            <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-foreground">
              {json}
            </pre>
          </div>
        ) : null}

        {!isSubmitted && missing.length > 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              {missing.length} required field{missing.length === 1 ? "" : "s"} outstanding
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {missing.map((m) => (
                <li key={m.name}>
                  <button
                    type="button"
                    className="text-destructive underline underline-offset-2"
                    onClick={() =>
                      void navigate({
                        to: "/inspect/$id",
                        params: { id },
                        search: { step: m.step },
                      })
                    }
                  >
                    {labelForField(m.name)} — Step {m.step + 1}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {sections.map((section, index) => {
          const rows = section.fields.flatMap((field) =>
            fieldKeys(field)
              .filter((key) => isFilled(values[key]))
              .map((key) => ({
                key,
                label: subLabel(field, key),
                value: displayValue(field, key, values),
              }))
              .filter((row) => row.value !== ""),
          );

          return (
            <section key={section.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="font-serif text-base font-semibold text-foreground">
                  {section.id}. {section.title}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void navigate({ to: "/inspect/$id", params: { id }, search: { step: index } })
                  }
                >
                  Edit
                </Button>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Nothing recorded.</p>
              ) : (
                <dl className="divide-y divide-border">
                  {rows.map((row) => (
                    <div key={row.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-medium text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}
      </main>

      {!isSubmitted ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <Button
              variant="outline"
              size="lg"
              onClick={() => void navigate({ to: "/inspect/$id", params: { id }, search: { step: 0 } })}
              className="flex-1 sm:flex-none"
            >
              Continue editing
            </Button>
            <Button size="lg" onClick={submit} className="flex-1">
              <Send className="size-4" />
              Submit inspection
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
