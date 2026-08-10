import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus, Settings, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { schema } from "@/lib/inspection/schema";
import { inspectionStore } from "@/lib/inspection/storage";
import { useInspectionList } from "@/lib/inspection/useInspection";
import { missingFields } from "@/lib/inspection/validation";
import { useAuth } from "@/lib/auth";

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
  const { records, loading, error } = useInspectionList();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { user, loading: authLoading, signOut } = useAuth();

  const pendingDelete = pendingDeleteId
    ? records.find((r) => r.id === pendingDeleteId)
    : undefined;

  if (!authLoading && !user) {
    void navigate({ to: "/login" });
    return null;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }

  const startNew = async () => {
    setCreating(true);
    try {
      const record = await inspectionStore.create();
      void navigate({ to: "/inspect/$id", params: { id: record.id } });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to create inspection");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-6 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
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
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/reports">Reports</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void signOut().then(() => navigate({ to: "/login" }))}
              >
                Sign out
              </Button>
              <Button variant="ghost" size="icon" asChild aria-label="AI settings">
                <Link to="/settings">
                  <Settings className="size-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Button onClick={() => void startNew()} disabled={creating} size="lg" className="w-full sm:w-auto">
          <Plus className="size-4" />
          New inspection
        </Button>

        <section className="mt-8">
          <h2 className="font-serif text-lg font-semibold text-foreground">Saved inspections</h2>

          {loading ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              Loading inspections…
            </div>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-card px-6 py-12 text-center text-sm text-destructive">
              {error}
            </div>
          ) : records.length === 0 ? (
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
                          to: record.status === "submitted" ? "/inspect/$id/review" : "/inspect/$id",
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
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void navigate({
                          to: "/report/$inspectionId",
                          params: { inspectionId: record.id },
                        })
                      }
                    >
                      <FileText className="size-4" />
                      Report
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete inspection"
                      onClick={() => setPendingDeleteId(record.id)}
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

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this inspection?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This will permanently delete the inspection for ${
                    String(pendingDelete.values.prop_address ?? "").trim() || "this property"
                  }${
                    String(pendingDelete.values.prop_suburb ?? "").trim()
                      ? `, ${String(pendingDelete.values.prop_suburb).trim()}`
                      : ""
                  }. This cannot be undone.`
                : "This will permanently delete the inspection. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDeleteId) return;
                const id = pendingDeleteId;
                setPendingDeleteId(null);
                void inspectionStore.remove(id).catch(console.error);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
