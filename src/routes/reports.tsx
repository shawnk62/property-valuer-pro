import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { SCHEMA_VERSION } from "@/lib/report/schema";
import { useInspectionList } from "@/lib/inspection/useInspection";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

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
                <li key={r.id}>
                  <Link
                    to="/report/$inspectionId"
                    params={{ inspectionId: r.id }}
                    className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.status === "submitted" ? "Submitted" : "Draft"} · Updated{" "}
                        {formatDate(r.updatedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-primary">Open report →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
