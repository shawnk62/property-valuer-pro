import { useState } from "react";
import type { ReportDraftController } from "@/hooks/useReportDraft";
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

  function generate() {
    setNarrative(generateNarrative(draft.values));
    setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">AI narrative</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-filled from the inspection values. Edit any block, or regenerate from the current data.
            {generatedAt ? ` Last generated ${generatedAt}.` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Regenerate from inspection data
        </button>
      </div>

      {BLOCKS.map((block) => (
        <label key={block.key} className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">
            {block.label}
          </span>
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
