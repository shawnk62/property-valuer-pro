import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { generateNarrativeBlock } from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import { generateNarrative } from "@/lib/report/narrative";
import type { ReportNarrative } from "@/lib/report/types";

const BLOCKS: { key: keyof ReportNarrative; label: string; hint: string }[] = [
  {
    key: "brief",
    label: "Brief description (valuation summary)",
    hint: "Appears on the summary page and sets the tone of the report.",
  },
  {
    key: "improvements",
    label: "Improvements — general description",
    hint: "Section 7.1 of the report.",
  },
  {
    key: "accommodation",
    label: "Accommodation narrative",
    hint: "Section 8 — accommodation, car accommodation and general.",
  },
  { key: "remarks", label: "Remarks", hint: "Section 13." },
];

export function NarrativeSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setNarrative } = controller;
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<"template" | "ai" | null>(null);
  const [busy, setBusy] = useState<"template" | "ai" | keyof ReportNarrative | null>(null);

  function generateFromTemplate() {
    setBusy("template");
    try {
      setNarrative(generateNarrative(draft.values));
      setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setSource("template");
      toast.success("Narrative filled from inspection data");
    } finally {
      setBusy(null);
    }
  }

  async function generateWithAi(keys: (keyof ReportNarrative)[] = BLOCKS.map((b) => b.key)) {
    const settings = loadAiSettings();
    if (!isAiConfigured(settings)) {
      toast.error("AI is not configured", {
        description: "Open Settings, choose xAI (Grok), add your API key, Save, then Test connection.",
      });
      return;
    }

    setBusy(keys.length === 1 ? keys[0]! : "ai");
    const next: Partial<ReportNarrative> = {};
    const errors: string[] = [];

    try {
      await Promise.all(
        keys.map(async (key) => {
          try {
            const { text } = await generateNarrativeBlock({
              data: {
                settings: {
                  provider: settings.provider,
                  model: settings.model,
                  apiKey: settings.apiKey,
                  ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
                },
                blockKey: key,
                values: draft.values,
              },
            });
            if (text?.trim()) next[key] = text.trim();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Generation failed";
            errors.push(`${key}: ${message}`);
          }
        }),
      );

      if (Object.keys(next).length > 0) {
        setNarrative(next);
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        setSource("ai");
      }

      if (errors.length && Object.keys(next).length) {
        toast.message("Some blocks failed", { description: errors.join(" · ") });
      } else if (errors.length) {
        toast.error("AI generation failed", { description: errors.join(" · ") });
      } else {
        toast.success(
          keys.length === 1 ? `Generated “${keys[0]}” with AI` : "Narrative generated with AI",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const aiBusy = busy === "ai";
  const templateBusy = busy === "template";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Narrative</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill from inspection data (template) or generate with your configured AI (Settings).
            Edit any block before exporting the report.
            {generatedAt ? (
              <>
                {" "}
                Last generated {generatedAt}
                {source ? ` (${source === "ai" ? "AI" : "template"})` : ""}.
              </>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            AI uses the provider in{" "}
            <Link to="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
              Settings
            </Link>
            . Template does not need an API key.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={generateFromTemplate}
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {templateBusy ? "Filling…" : "Regenerate from inspection data"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void generateWithAi()}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {aiBusy ? "Generating with AI…" : "Generate with AI"}
          </button>
        </div>
      </div>

      {BLOCKS.map((block) => (
        <label key={block.key} className="block">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{block.label}</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void generateWithAi([block.key])}
              className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {busy === block.key ? "Generating…" : "AI this block"}
            </button>
          </div>
          <span className="mb-2 block text-sm text-muted-foreground">{block.hint}</span>
          <textarea
            value={draft.narrative[block.key]}
            onChange={(e) => setNarrative({ [block.key]: e.target.value })}
            rows={7}
            className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      ))}
    </div>
  );
}
