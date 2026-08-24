import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { inspectionStore } from "@/lib/inspection/storage";
import { useInspectionList } from "@/lib/inspection/useInspection";
import { SCHEMA_VERSION } from "@/lib/report/schema";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Report Workspace — Peterson Property Valuations" },
      {
        name: "description",
        content:
          "Select a Queensland residential inspection and build its valuation report.",
      },
      {
        property: "og:title",
        content: "Report Workspace — Peterson Property Valuations",
      },
      {
        property: "og:description",
        content:
          "Select a Queensland residential inspection and build its valuation report.",
      },
    ],
  }),
  component: WorkspaceHome,
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

function addressFromValues(values: Record<string, unknown>): string {
  const parts = [values.prop_address, values.prop_suburb]
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => String(v).trim());
  return parts.join(", ") || "Untitled inspection";
}

function WorkspaceHome() {
  const { records, loading, error } = useInspectionList();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && !user) {
    void navigate({ to: "/login" });
    return null;
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <img
              src="/ppv-logo.jpeg"
              alt="Peterson Property Valuations"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Report Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Queensland residential valuations · Purchase reports
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Inspections
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Inspections</h2>
          <p className="text-sm text-muted-foreground">Field schema v{SCHEMA_VERSION}</p>
        </div>

        {error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : records.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/60" />
            <p className="mt-4 text-sm text-muted-foreground">
              No inspections yet. Complete an inspection first, then return here to build the report.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block text-sm font-medium text-primary underline"
            >
              Go to inspections
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
            {records.map((r) => {
              const label = addressFromValues(r.values);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      void navigate({
                        to: "/report/$inspectionId",
                        params: { inspectionId: r.id },
                      })
                    }
                  >
                    <p className="truncate font-medium text-foreground">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.status === "submitted" ? "Submitted" : "Draft"} · Updated{" "}
                      {formatDate(r.updatedAt)}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                      title="Copy form + report as a new job (another unit or house)"
                      onClick={() => {
                        void (async () => {
                          try {
                            const copy = await inspectionStore.duplicate(r.id);
                            toast.success("Saved as new job — update the unit address");
                            void navigate({
                              to: "/report/$inspectionId",
                              params: { inspectionId: copy.id },
                            });
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Could not save as new job",
                            );
                          }
                        })();
                      }}
                    >
                      Save as new
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary"
                      onClick={() =>
                        void navigate({
                          to: "/report/$inspectionId",
                          params: { inspectionId: r.id },
                        })
                      }
                    >
                      Open report →
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
