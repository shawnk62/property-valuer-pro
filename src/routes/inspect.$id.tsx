import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { FieldRenderer } from "@/components/inspection/fields/FieldRenderer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { labelForField, sections } from "@/lib/inspection/schema";
import { useInspection } from "@/lib/inspection/useInspection";
import { missingForStep } from "@/lib/inspection/validation";

export const Route = createFileRoute("/inspect/$id")({
  validateSearch: (search: Record<string, unknown>): { step?: number } => {
    const raw = Number(search["step"]);
    return Number.isFinite(raw) && raw >= 0 ? { step: Math.floor(raw) } : {};
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
  const { step: initialStep } = Route.useSearch();
  const navigate = useNavigate();
  const { record, values, setValue, saveNow, loaded } = useInspection(id);
  const [step, setStep] = useState(Math.min(initialStep ?? 0, sections.length - 1));
  const [showErrors, setShowErrors] = useState(false);

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
    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(`Complete ${missing.length} required field${missing.length === 1 ? "" : "s"} on this step.`);
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
                Step {step + 1} of {sections.length} · Section {section?.id}
              </p>
              <h1 className="truncate font-serif text-lg font-semibold text-foreground">
                {section?.title}
              </h1>
            </div>
            <Button variant="ghost" size="icon" aria-label="Save draft" onClick={() => { saveNow(); toast.success("Draft saved"); }}>
              <Save className="size-4" />
            </Button>
          </div>
          <Progress value={((step + 1) / sections.length) * 100} className="mt-3 h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
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
      </main>

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
                Review
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
    </div>
  );
}
