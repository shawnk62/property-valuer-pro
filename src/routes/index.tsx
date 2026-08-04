import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { schema } from "@/lib/inspection/schema";
import { inspectionStore } from "@/lib/inspection/storage";
import { useInspectionList } from "@/lib/inspection/useInspection";
import { missingFields } from "@/lib/inspection/validation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QLD Inspections — Subject Property Inspection Records" },
      {
        name: "description",
        content:
          "Capture Queensland subject property inspections on site and manage saved inspection records ready for valuation reporting.",
      },
      { property: "og:title", content: "QLD Inspections — Subject Property Inspection Records" },
      {
        property: "og:description",
        content:
          "Capture Queensland subject property inspections on site and manage saved inspection records ready for valuation reporting.",
      },
    ],
  }),
  component: InspectionsIndex,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InspectionsIndex() {
  const records = useInspectionList();
  const navigate = useNavigate();

  const startNew = () => {
    const record = inspectionStore.create();
    void navigate({ to: "/inspect/$id", params: { id: record.id } });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-6 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Queensland Registered Valuers
          </p>
          <h1 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
            {schema.form_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Schema version {schema.version} · {schema.sections.length} sections
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Button onClick={startNew} size="lg" className="w-full sm:w-auto">
          <Plus className="size-4" />
          New inspection
        </Button>

        <section className="mt-8">
          <h2 className="font-serif text-lg font-semibold text-foreground">Saved inspections</h2>

          {records.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No inspections yet. Start one on site and it will save as you go.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {records.map((record) => {
                const address =
                  typeof record.values["prop_address"] === "string" &&
                  record.values["prop_address"].trim()
                    ? record.values["prop_address"]
                    : "Untitled inspection";
                const suburb =
                  typeof record.values["prop_suburb"] === "string" ? record.values["prop_suburb"] : "";
                const assignment =
                  typeof record.values["prop_assignment"] === "string"
                    ? record.values["prop_assignment"]
                    : "";
                const outstanding = missingFields(record.values).length;

                return (
                  <li
                    key={record.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void navigate({
                          to: record.status === "submitted" ? "/inspect/$id_/review" : "/inspect/$id",
                          params: { id: record.id },
                        })
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium text-foreground">
                        {address}
                        {suburb ? `, ${suburb}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {formatDate(record.updatedAt)}
                        {assignment ? ` · ${assignment}` : ""}
                      </p>
                      <span
                        className={
                          record.status === "submitted"
                            ? "mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            : "mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {record.status === "submitted"
                          ? "Submitted"
                          : `Draft · ${outstanding} required field${outstanding === 1 ? "" : "s"} outstanding`}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete inspection"
                      onClick={() => inspectionStore.remove(record.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
