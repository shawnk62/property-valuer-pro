import { useState } from "react";
import {
  downloadBlob,
  generateValuationDocx,
  suggestedDocxFilename,
} from "@/lib/report/generateDocx";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { NarrativeSection } from "@/components/report/NarrativeSection";
import { PhotosSection } from "@/components/report/PhotosSection";
import { ReportPreview } from "@/components/report/ReportPreview";
import { SalesSection } from "@/components/report/SalesSection";
import { SubjectSection } from "@/components/report/SubjectSection";
import { EditLockBanner } from "@/components/EditLockBanner";
import { useEditLock } from "@/hooks/useEditLock";
import { useReportDraft } from "@/hooks/useReportDraft";
import { get } from "@/lib/report/schema";

const TABS = [
  { id: "subject", label: "Subject & purpose" },
  { id: "narrative", label: "Narrative" },
  { id: "photos", label: "Photos" },
  { id: "sales", label: "Comparable sales" },
  { id: "preview", label: "Preview" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportBuilder({ inspectionId }: { inspectionId: string }) {
  const lock = useEditLock(inspectionId);
  const controller = useReportDraft(inspectionId, { readOnly: !lock.canEdit || lock.checking });
  const { draft, dirty, savedAt, save, loaded, loadError } = controller;
  const [tab, setTab] = useState<TabId>("subject");
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function handleDownloadWord() {
    setDownloading(true);
    try {
      try {
        await save();
      } catch {
        /* still export current in-memory draft */
      }
      const blob = await generateValuationDocx(controller.draft);
      downloadBlob(blob, suggestedDocxFilename(controller.draft));
      toast.success("Word report downloaded");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate Word report");
    } finally {
      setDownloading(false);
    }
  }

  /** PDF via browser print of the live Preview sheet (matches on-screen report). */
  async function handleDownloadPdf() {
    setPrinting(true);
    save();
    const previousTab = tab;
    if (tab !== "preview") {
      setTab("preview");
    }
    // Wait for Preview to paint with current draft, then open the system print dialog.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
    // Extra tick for images
    await new Promise((r) => setTimeout(r, 150));

    const sheet = document.getElementById("report-preview-sheet");
    if (!sheet) {
      toast.error("Report preview is not ready. Open the Preview tab and try again.");
      setTab(previousTab);
      setPrinting(false);
      return;
    }

    const onAfterPrint = () => {
      window.removeEventListener("afterprint", onAfterPrint);
      setPrinting(false);
      toast.message("In the print dialog: Save as PDF, A4, and turn off Headers and footers if shown.");
    };
    window.addEventListener("afterprint", onAfterPrint);
    window.print();
    // Fallback if afterprint does not fire (some browsers)
    window.setTimeout(() => {
      setPrinting(false);
    }, 1000);
  }

  const heading =
    [get(draft.values, "prop_address"), get(draft.values, "prop_suburb")]
      .filter(Boolean)
      .join(", ") || "Untitled inspection";

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading inspection…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Link to="/reports" className="mt-3 inline-block text-sm font-medium text-primary underline">
            Back to report workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print">
        <EditLockBanner
          checking={lock.checking}
          canEdit={lock.canEdit}
          heldBy={lock.heldBy}
          setupRequired={lock.setupRequired}
          onTakeOver={() => void lock.takeOver()}
          onRefresh={() => void lock.refresh()}
        />
      </div>
      <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <img
            src="/ppv-logo.jpeg"
            alt="Peterson Property Valuations"
            className="h-10 w-auto object-contain"
          />
          <div className="min-w-0 flex-1">
            <Link
              to="/reports"
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              &larr; Report workspace
            </Link>
            <h1 className="truncate text-lg font-semibold text-foreground">{heading}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {dirty
                ? "Unsaved changes"
                : savedAt
                  ? `Saved ${savedAt}`
                  : draft.photos.length || draft.sales.length || Object.values(draft.narrative).some((s) => String(s || "").trim())
                    ? "Saved report — edit and re-export anytime"
                    : "New draft"}
            </span>
            <button
              type="button"
              onClick={() => {
                void save()
                  .then(() => toast.success("Draft saved — available on all devices"))
                  .catch((err: unknown) =>
                    toast.error(err instanceof Error ? err.message : "Save failed"),
                  );
              }}
              className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Refresh preview
            </button>
            <button
              type="button"
              disabled={printing}
              onClick={() => void handleDownloadPdf()}
              className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              title="Opens the print dialog — choose Save as PDF for a file matching the Preview"
            >
              {printing ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownloadWord()}
              className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              title="Editable Word document (layout is approximate vs Preview)"
            >
              {downloading ? "Preparing Word…" : "Download Word"}
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main
        className={`${tab === "preview" ? "bg-muted/50 py-8" : "py-8"}${
          !lock.canEdit || lock.checking ? " pointer-events-none select-none opacity-70" : ""
        }`}
      >
        <div
          className={
            tab === "preview" ? "px-2 sm:px-6" : "mx-auto max-w-7xl px-4 sm:px-6"
          }
        >
          {tab === "subject" ? <SubjectSection controller={controller} /> : null}
          {tab === "narrative" ? <NarrativeSection controller={controller} /> : null}
          {tab === "photos" ? <PhotosSection controller={controller} /> : null}
          {tab === "sales" ? <SalesSection controller={controller} /> : null}
          {tab === "preview" ? <ReportPreview draft={draft} /> : null}
        </div>
      </main>
    </div>
  );
}
