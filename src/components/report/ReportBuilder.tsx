import { useState } from "react";
import {
  downloadBlob,
  generateValuationDocx,
  suggestedDocxFilename,
} from "@/lib/report/generateDocx";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { NarrativeSection } from "@/components/report/NarrativeSection";
import { PhotosSection } from "@/components/report/PhotosSection";
import { ReportPreview } from "@/components/report/ReportPreview";
import { SalesSection } from "@/components/report/SalesSection";
import { SubjectSection } from "@/components/report/SubjectSection";
import { EditLockBanner } from "@/components/EditLockBanner";
import { useEditLock } from "@/hooks/useEditLock";
import { useReportDraft } from "@/hooks/useReportDraft";
import { inspectionStore } from "@/lib/inspection/storage";
import { isAppliedSignature, SignaturePad } from "@/components/SignaturePad";
import { get } from "@/lib/report/schema";

const TABS = [
  { id: "subject", label: "Subject & purpose" },
  { id: "narrative", label: "Narrative" },
  { id: "photos", label: "Photos" },
  { id: "sales", label: "Comparable sales" },
  { id: "signature", label: "Signature" },
  { id: "preview", label: "Preview" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportBuilder({ inspectionId }: { inspectionId: string }) {
  const navigate = useNavigate();
  const lock = useEditLock(inspectionId);
  const controller = useReportDraft(inspectionId, { readOnly: !lock.canEdit });
  const { draft, dirty, savedAt, save, loaded, loadError, setValue } = controller;
  const reportSigned = isAppliedSignature(draft.values["sign_sig"]);
  const editsLocked = !lock.canEdit || reportSigned;
  const [tab, setTab] = useState<TabId>("subject");
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

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

  /**
   * PDF via browser print of the live Preview sheet (always mounted in DOM).
   * Must call window.print() synchronously in the click handler — any await
   * before print() loses the user-gesture token and Safari shows
   * “This webpage is trying to print…” instead of the normal print dialog.
   */
  function handleDownloadPdf() {
    setPrinting(true);

    // Persist in the background; do not block print on network.
    void save().catch(() => {});

    // Preview sheet is always mounted (may be CSS-hidden); print CSS forces it visible.
    // Switching tab is optional UX only — not required for a successful print.
    if (tab !== "preview") {
      setTab("preview");
    }

    const sheet = document.getElementById("report-preview-sheet");
    if (!sheet) {
      toast.error("Report preview is not ready. Open the Preview tab and try again.");
      setPrinting(false);
      return;
    }

    const previousTitle = document.title;
    document.title = "\u00A0";

    // Inject a dedicated @page rule at print time (margin-box page numbers).
    // Do not use position:fixed + counter(page) — that prints "0" in Chrome.
    const pageStyle = document.createElement("style");
    pageStyle.setAttribute("data-ppv-page-numbers", "1");
    pageStyle.textContent = `
      @page {
        size: A4 portrait;
        margin: 14mm 12mm 18mm 12mm;
        @bottom-left {
          content: counter(page);
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          color: #000;
        }
      }
    `;
    document.head.appendChild(pageStyle);

    toast.message("Save as PDF", {
      description:
        "In the print dialog, turn OFF “Headers and footers”. That is the only way to remove the URL and date/time. Page numbers (bottom-left) come from the report and will still print.",
      duration: 14000,
    });

    const restore = () => {
      document.title = previousTitle;
      pageStyle.remove();
      window.removeEventListener("afterprint", restore);
      setPrinting(false);
    };
    window.addEventListener("afterprint", restore);

    // Synchronous — same user-gesture stack as the button click (Safari-safe).
    window.print();
    window.setTimeout(restore, 2000);
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
              disabled={duplicating}
              title="Create a full copy for another unit or house in the same complex"
              onClick={() => {
                void (async () => {
                  setDuplicating(true);
                  try {
                    try {
                      await save();
                    } catch {
                      /* still duplicate current cloud+local state best-effort */
                    }
                    const copy = await inspectionStore.duplicate(inspectionId);
                    toast.success("Saved as new job", {
                      description: "Update the unit/address on the new inspection, then continue the report.",
                    });
                    void navigate({
                      to: "/report/$inspectionId",
                      params: { inspectionId: copy.id },
                    });
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Could not save as new job",
                    );
                  } finally {
                    setDuplicating(false);
                  }
                })();
              }}
              className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {duplicating ? "Copying…" : "Save as new job"}
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
          !lock.canEdit || (reportSigned && tab !== "signature" && tab !== "preview")
            ? " pointer-events-none select-none opacity-70"
            : ""
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
          {tab === "signature" ? (
            <div className="mx-auto max-w-xl space-y-4 rounded-lg border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-foreground">Final signature</h2>
              <p className="text-sm text-muted-foreground">
                Apply your signature to lock this report. Remove the signature to unlock and
                edit again. Same signature is used on the inspection form sign-off.
              </p>
              <SignaturePad
                value={
                  typeof draft.values["sign_sig"] === "string"
                    ? draft.values["sign_sig"]
                    : ""
                }
                onChange={(v) => {
                  setValue("sign_sig", v);
                  if (v) {
                    toast.success("Signature applied — report locked");
                  } else {
                    toast.success("Signature removed — report unlocked");
                  }
                }}
              />
            </div>
          ) : null}
          {/* Always mounted so Download PDF never prints a blank page when another tab is active */}
          <div
            className={
              tab === "preview"
                ? "report-print-host"
                : "report-print-host hidden"
            }
            aria-hidden={tab !== "preview"}
          >
            <ReportPreview draft={draft} />
          </div>
        </div>
      </main>
    </div>
  );
}
