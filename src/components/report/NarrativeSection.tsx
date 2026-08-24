import { useEffect, useRef, useState } from "react";
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
    key: "location",
    label: "Description of neighbourhood (5.1)",
    hint: "Locality and neighbourhood character for section 5.1. Generated from neighbourhood inspection fields.",
  },
  {
    key: "servicesAmenities",
    label: "Services / amenities (6.2)",
    hint: "Short paragraph for section 6.2 from site services fields. Saved or edited text is not overwritten by AI.",
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

/** Make inspection values safe for the server function (JSON-serializable, no proxies). */
function serializableValues(
  values: ReportDraftController["draft"]["values"],
): Record<string, string | boolean | string[] | number | null | undefined> {
  const raw = JSON.parse(JSON.stringify(values ?? {})) as Record<string, unknown>;
  const out: Record<string, string | boolean | string[] | number | null | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) {
      out[k] = v as null | undefined;
    } else if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) => String(x));
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

export function NarrativeSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setNarrative, loaded } = controller;
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<"template" | "ai" | null>(null);
  const [busy, setBusy] = useState<"template" | "ai" | keyof ReportNarrative | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const narrativeRef = useRef(draft.narrative);
  narrativeRef.current = draft.narrative;

  function emptyNarrativeKeys(
    narrative: ReportDraftController["draft"]["narrative"] = narrativeRef.current,
  ): (keyof ReportNarrative)[] {
    return BLOCKS.map((b) => b.key).filter(
      (key) => !String(narrative[key] ?? "").trim(),
    );
  }

  // Auto-fill only truly empty blocks, and only after the draft has loaded from
  // cloud/local cache — never race AI against a reopened report's saved text.
  useEffect(() => {
    if (!loaded) return;
    if (autoStarted.current) return;
    if (!isAiConfigured()) return;
    const keys = emptyNarrativeKeys(draft.narrative);
    if (keys.length === 0) {
      autoStarted.current = true; // mark done so we don't fire later if user clears a block
      return;
    }
    autoStarted.current = true;
    void generateWithAi(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once after load when empty blocks exist
  }, [loaded, draft.inspectionId]);

  function generateFromTemplate() {
    setBusy("template");
    setLastStatus(null);
    try {
      setNarrative(generateNarrative(draft.values));
      setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setSource("template");
      setLastStatus("Template applied.");
      toast.success("Narrative filled from inspection data");
    } finally {
      setBusy(null);
    }
  }

  async function generateWithAi(keys: (keyof ReportNarrative)[] = BLOCKS.map((b) => b.key)) {
    const settings = loadAiSettings();
    if (!isAiConfigured(settings)) {
      const msg =
        "AI is not configured. Open Settings, choose xAI (Grok), add your API key, Save, then Test connection.";
      setLastStatus(msg);
      toast.error("AI is not configured", { description: msg });
      return;
    }

    setBusy(keys.length === 1 ? keys[0]! : "ai");
    setLastStatus(`Calling ${settings.provider} / ${settings.model}…`);
    const next: Partial<ReportNarrative> = {};
    const errors: string[] = [];
    const values = serializableValues(draft.values);

    try {
      for (const key of keys) {
        try {
          setLastStatus(`Generating “${key}”…`);
          const result = await generateNarrativeBlock({
            data: {
              settings: {
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKey,
                ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
              },
              blockKey: key,
              values,
            },
          });

          // Support both { text } and unexpected shapes from the RPC layer
          const text =
            typeof result === "string"
              ? result
              : result && typeof result === "object" && "text" in result
                ? String((result as { text: unknown }).text ?? "")
                : "";

          if (text.trim()) {
            next[key] = text.trim();
          } else {
            errors.push(`${key}: empty response`);
          }
        } catch (err) {
          console.error("[narrative AI]", key, err);
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : JSON.stringify(err);
          errors.push(`${key}: ${message}`);
        }
      }

      // Never overwrite blocks the user (or a prior save) already filled while AI was running
      const safe: Partial<ReportNarrative> = {};
      const current = narrativeRef.current;
      for (const [k, v] of Object.entries(next) as [keyof ReportNarrative, string][]) {
        if (!String(current[k] ?? "").trim() && v.trim()) safe[k] = v;
      }

      if (Object.keys(safe).length > 0) {
        setNarrative(safe);
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        setSource("ai");
        const preview = Object.entries(safe)
          .map(([k, v]) => `${k}: ${v.slice(0, 60)}…`)
          .join(" | ");
        setLastStatus(`AI updated: ${Object.keys(safe).join(", ")}. ${preview}`);
      } else {
        setLastStatus(
          Object.keys(next).length && !Object.keys(safe).length
            ? "Saved narrative kept — AI did not overwrite existing text."
            : `No text returned. ${errors.join(" · ")}`,
        );
      }

      if (errors.length && Object.keys(safe).length) {
        toast.message("Some blocks failed", { description: errors.join(" · ") });
      } else if (errors.length) {
        toast.error("AI generation failed", { description: errors.join(" · ") });
      } else {
        toast.success(
          keys.length === 1 ? `Generated “${keys[0]}” with AI` : "Narrative generated with AI",
        );
      }
    } catch (err) {
      console.error("[narrative AI]", err);
      const message = err instanceof Error ? err.message : String(err);
      setLastStatus(`Failed: ${message}`);
      toast.error("AI generation failed", { description: message });
    } finally {
      setBusy(null);
    }
  }

  const aiBusy = busy === "ai" || (busy !== null && busy !== "template");
  const templateBusy = busy === "template";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Narrative</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Empty sections generate with AI once after the draft loads (Settings required). Saved text is never overwritten on reopen — use Regenerate to replace a block.
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
          {lastStatus ? (
            <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs text-foreground whitespace-pre-wrap break-words">
              {lastStatus}
            </p>
          ) : null}
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
            {busy === "ai" ? "Generating with AI…" : "Generate with AI"}
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
