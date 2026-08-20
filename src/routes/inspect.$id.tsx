import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Check, ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { FieldRenderer } from "@/components/inspection/fields/FieldRenderer";
import { ImportPanel } from "@/components/inspection/ImportPanel";
import { InspectionPhotosPanel } from "@/components/inspection/InspectionPhotosPanel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { labelForField, sections } from "@/lib/inspection/schema";
import { useInspection } from "@/lib/inspection/useInspection";
import { missingForStep } from "@/lib/inspection/validation";

export const Route = createFileRoute("/inspect/$id")({
  validateSearch: (search: Record<string, unknown>): {
    step?: number;
    photos?: boolean;
    focusSlot?: string;
    returnTo?: string;
  } => {
    const raw = Number(search["step"]);
    const out: { step?: number; photos?: boolean; focusSlot?: string; returnTo?: string } = {};
    if (Number.isFinite(raw) && raw >= 0) out.step = Math.floor(raw);
    if (search["photos"] === true || search["photos"] === "1" || search["photos"] === 1) {
      out.photos = true;
    }
    if (typeof search["focusSlot"] === "string" && search["focusSlot"].trim()) {
      out.focusSlot = search["focusSlot"].trim();
    }
    if (typeof search["returnTo"] === "string" && search["returnTo"].trim()) {
      out.returnTo = search["returnTo"].trim();
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Subject Property Inspection — QLD Inspections" },
      {
        name: "description",
        content:
          "Step-by-step on-site capture of subject property identification, site, construction, services and condition details.",
      },
      { property: "og:title", content: "Subject Property Inspection — QLD Inspections" },
      {
        property: "og:description",
        content:
          "Step-by-step on-site capture of subject property identification, site, construction, services and condition details.",
      },
    ],
  }),
  component: InspectionWizard,
});

function InspectionWizard() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const initialStep = search.step;
  const navigate = useNavigate();
  const { record, values, setValue, saveNow, loaded } = useInspection(id);
  const [step, setStep] = useState(Math.min(initialStep ?? 0, sections.length - 1));
  const [showErrors, setShowErrors] = useState(false);
  /** Photo grid overlay — return target is the form step + scroll position. */
  const [photosOpen, setPhotosOpen] = useState(() => Boolean(search.photos));
  const [focusSlot, setFocusSlot] = useState<string | null>(search.focusSlot ?? null);
  const returnTargetRef = useRef<{ step: number; scrollY: number } | null>(null);
  const isSubmitted = record?.status === "submitted";

  const section = sections[step];
  const missing = useMemo(() => missingForStep(values, step), [values, step]);


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

  const goNext = () => {
    if (!isSubmitted && missing.length > 0) {
      setShowErrors(true);
      toast.error(`Complete ${missing.length} required field${missing.length === 1 ? "" : "s"} on this step.`);
      requestAnimationFrame(() => {
        const first = missing[0];
        const el = first ? document.getElementById(first.name) : null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (el instanceof HTMLElement) el.focus({ preventScroll: true });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
      return;
    }

    setShowErrors(false);
    saveNow();
    if (step === sections.length - 1) {
      void navigate({ to: "/inspect/$id/review", params: { id } });
      return;
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };

  const goBack = () => {
    setShowErrors(false);
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0 });
  };

  const openPhotos = () => {
    returnTargetRef.current = { step, scrollY: window.scrollY };
    setPhotosOpen(true);
    window.scrollTo({ top: 0 });
  };

  const returnToForm = () => {
    // Deep-link from review submit: return to submit after a photo is saved
    if (search.returnTo === "review") {
      setPhotosOpen(false);
      setFocusSlot(null);
      void navigate({ to: "/inspect/$id/review", params: { id } });
      return;
    }
    const target = returnTargetRef.current;
    setPhotosOpen(false);
    setFocusSlot(null);
    if (target) {
      setStep(target.step);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: target.scrollY });
        });
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to inspections">
              <ChevronLeft className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {photosOpen
                  ? "Subject photos"
                  : `${isSubmitted ? "Submitted · editable · " : ""}Step ${step + 1} of ${sections.length} · Section ${section?.id ?? ""}`}
              </p>
              <h1 className="truncate font-serif text-lg font-semibold text-foreground">
                {photosOpen ? "Photos" : section?.title}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={isSubmitted ? "Save changes" : "Save draft"}
              onClick={() => {
                saveNow();
                toast.success(isSubmitted ? "Changes saved" : "Draft saved");
              }}
            >
              <Save className="size-4" />
            </Button>
          </div>
          <Progress value={((step + 1) / sections.length) * 100} className="mt-3 h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {photosOpen ? (
          <InspectionPhotosPanel
            inspectionId={id}
            focusSlot={focusSlot}
            onPhotoSaved={returnToForm}
            onClose={returnToForm}
          />
        ) : (
          <>
            {isSubmitted ? (
              <div className="mb-5 rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">Submitted inspection — editable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Same form as on site. You can change any answer; saves update the live record used by the report.
                  A snapshot from the first submit is kept separately for reference.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => void navigate({ to: "/inspect/$id/review", params: { id } })}
                >
                  Back to review / report
                </Button>
              </div>
            ) : null}
            {showErrors && missing.length > 0 ? (
              <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  Required on this step
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-destructive/90">
                  {missing.map((m) => (
                    <li key={m.name}>{labelForField(m.name)}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {step === 0 ? (
              <div className="mb-6">
                <ImportPanel values={values} onApply={(patch) => { for (const [k, v] of Object.entries(patch)) setValue(k, v); }} />
              </div>
            ) : null}

            <div className="space-y-4">
              {section?.fields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  values={values}
                  showErrors={showErrors}
                  onChange={setValue}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Persistent Photos entry — above bottom nav, does not cover form controls */}
      {!photosOpen ? (
        <button
          type="button"
          onClick={openPhotos}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-lg hover:bg-accent"
          aria-label="Photos"
        >
          <Camera className="size-4" />
          Photos
        </button>
      ) : null}

      {!photosOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <Button variant="outline" size="lg" onClick={goBack} disabled={step === 0} className="flex-1 sm:flex-none">
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button size="lg" onClick={goNext} className="flex-1">
              {step === sections.length - 1 ? (
                <>
                  <Check className="size-4" />
                  {isSubmitted ? "Back to review" : "Review"}
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
