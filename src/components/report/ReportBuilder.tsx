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
  const controller = useReportDraft(inspectionId);
  const { draft, dirty, savedAt, save, loaded, loadError } = controller;
  const [tab, setTab] = useState<TabId>("subject");
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadWord() {
    setDownloading(true);
    try {
      save();
      const blob = await generateValuationDocx(draft);
      downloadBlob(blob, suggestedDocxFilename(draft));
      toast.success("Word report downloaded");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate Word report");
    } finally {
      setDownloading(false);
    }
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
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
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
              {dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt}` : "Draft"}
            </span>
            <button
              type="button"
              onClick={() => {
                save();
                toast.success("Draft saved");
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
              disabled={downloading}
              onClick={() => void handleDownloadWord()}
              className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
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

      <main className={tab === "preview" ? "bg-muted/50 py-8" : "py-8"}>
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
