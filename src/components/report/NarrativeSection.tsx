import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { generateNarrativeBlock } from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import {
  buildPhilRemarks,
  generateNarrative,
  isPhilAssignment,
} from "@/lib/report/narrative";
import type { ReportNarrative } from "@/lib/report/types";
import {
  buildLocationFacts,
  locationFactsFromDraft,
  subjectCoordsFromPins,
} from "@/lib/narrative/locationFacts";
import { subjectAddressLine, type SalesMapPin } from "@/lib/maps/salesMapPins";
import { isGoogleMapsConfigured, loadGoogleMapsKey } from "@/lib/maps/googleSettings";
import { geocodeGoogleAddresses } from "@/lib/maps/maps.functions";
import { CannedCommentsBar } from "@/components/report/CannedCommentsBar";

function narrativeBlocks(murray: boolean): {
  key: keyof ReportNarrative;
  label: string;
  hint: string;
}[] {
  return [
    {
      key: "brief",
      label: "Brief description (valuation summary)",
      hint: "Appears on the summary page DESCRIPTION and sets the tone of the report.",
    },
    {
      key: "location",
      label: "Description of neighbourhood (5.1)",
      hint: "Section 5.1 — location relative to the CBD or nearest centre, then locality from the inspection.",
    },
    {
      key: "sitePhysical",
      label: "Physical description of the allotment (6.1)",
      hint: "Section 6.1 — allotment shape, lot position, topography, dimensions and related site fields.",
    },
    {
      key: "servicesAmenities",
      label: "Services / amenities (6.2)",
      hint: "Section 6.2 — site services. Saved or edited text is not overwritten by AI.",
    },
    {
      key: "improvements",
      label: murray
        ? "Improvements — general description (7.1)"
        : "Improvements — general description (7.1)",
      hint: murray
        ? "Section 7.1 General Description under Improvements."
        : "Section 7.1 of the report.",
    },
    {
      key: "accommodation",
      label: murray
        ? "Accommodation details (7.3)"
        : "Accommodation narrative (8)",
      hint: murray
        ? "Section 7.3 Accommodation Details under Improvements."
        : "Section 8 — accommodation, car accommodation and general.",
    },
    {
      key: "conditionImprovements",
      label: murray
        ? "Condition of improvements (7.5)"
        : "Condition of improvements (9.2)",
      hint: murray
        ? "Section 7.5 Condition of Improvements under Improvements."
        : "Section 9.2 — component conditions and notes.",
    },
    {
      key: "remarks",
      label: murray ? "Remarks (10)" : "Remarks (13)",
      hint: murray
        ? "Section 10 Remarks — structural/pest → brief → sales commentary → value → auction close."
        : "Section 13 Remarks — Phil fixed sequence.",
    },
  ];
}

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
  const murray = /murray/i.test(String(draft.values["prop_assignment"] ?? ""));
  const BLOCKS = narrativeBlocks(murray);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<"template" | "ai" | null>(null);
  const [busy, setBusy] = useState<"template" | "ai" | keyof ReportNarrative | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  // Local mirror so the Remarks textarea always updates even if a parent re-render races
  const [localRemarks, setLocalRemarks] = useState(() =>
    String(draft.narrative.remarks ?? ""),
  );
  /** Last non-empty highlight in each block textarea (survives Save-button blur). */
  const [selectionByKey, setSelectionByKey] = useState<
    Partial<Record<keyof ReportNarrative, string>>
  >({});
  useEffect(() => {
    setLocalRemarks(String(draft.narrative.remarks ?? ""));
  }, [draft.narrative.remarks, draft.inspectionId]);
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

  /** Fill only empty keys from the inspection-data template (never overwrites). */
  function locationFacts() {
    return locationFactsFromDraft({
      values: draft.values,
      pins: (draft.reportMeta.salesMapPins as SalesMapPin[] | undefined) ?? null,
    });
  }

  async function locationFactsResolved() {
    const pins = (draft.reportMeta.salesMapPins as SalesMapPin[] | undefined) ?? null;
    if (subjectCoordsFromPins(pins) || !isGoogleMapsConfigured()) return locationFacts();
    const address = subjectAddressLine(draft.values);
    if (!address) return locationFacts();
    try {
      const geo = await geocodeGoogleAddresses({
        data: { apiKey: loadGoogleMapsKey(), addresses: [address] },
      });
      const hit = geo.results[0];
      if (hit?.lat != null && hit.lng != null) {
        return buildLocationFacts({
          values: draft.values,
          coords: { lat: hit.lat, lng: hit.lng },
        });
      }
    } catch {
      /* keep address-only facts */
    }
    return locationFacts();
  }

  function narrativeOpts() {
    return {
      salesCount: Array.isArray(draft.sales) ? draft.sales.length : 0,
      valueAmount:
        typeof draft.reportMeta?.valueAmount === "string"
          ? draft.reportMeta.valueAmount
          : "",
      brief: String(narrativeRef.current.brief ?? "").trim() || undefined,
      locationSentence: locationFacts().sentence || undefined,
    };
  }

  function applyTemplateToEmptyKeys(
    keys: (keyof ReportNarrative)[],
  ): Partial<ReportNarrative> {
    const full = generateNarrative(draft.values, narrativeOpts());
    const current = narrativeRef.current;
    const patch: Partial<ReportNarrative> = {};
    for (const key of keys) {
      if (!String(current[key] ?? "").trim() && String(full[key] ?? "").trim()) {
        patch[key] = full[key];
      }
    }
    if (Object.keys(patch).length > 0) {
      setNarrative(patch);
    }
    return patch;
  }

  // Auto-fill only truly empty blocks, and only after the draft has loaded from
  // cloud/local cache — never race AI against a reopened report's saved text.
  // Prefer AI when configured; otherwise use the inspection-data template.
  useEffect(() => {
    if (!loaded) return;
    if (autoStarted.current) return;
    let keys = emptyNarrativeKeys(draft.narrative);
    if (keys.length === 0) {
      autoStarted.current = true; // mark done so we don't fire later if user clears a block
      return;
    }
    autoStarted.current = true;
    // Remarks always from local builder when empty
    if (keys.includes("remarks")) {
      generateRemarksNow(false);
      keys = keys.filter((k) => k !== "remarks");
    }
    if (keys.length === 0) return;
    if (isAiConfigured()) {
      void generateWithAi(keys, false);
    } else {
      const patch = applyTemplateToEmptyKeys(keys);
      if (Object.keys(patch).length > 0) {
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        setSource("template");
        setLastStatus(
          `Filled empty blocks from inspection data (AI not configured).`,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once after load when empty blocks exist
  }, [loaded, draft.inspectionId]);

  /** Always fills Remarks from local builder (Phil structure or generic template). */
  function generateRemarksNow(overwrite = true) {
    const opts = narrativeOpts();
    try {
      const full = generateNarrative(draft.values, opts);
      const text = String(full.remarks ?? "").trim();
      if (!text) {
        setLastStatus("Remarks builder returned empty text.");
        toast.error("Remarks could not be generated");
        return false;
      }
      if (!overwrite && String(localRemarks || narrativeRef.current.remarks || "").trim()) {
        setLastStatus("Remarks already has text — not overwritten.");
        return false;
      }
      // Synchronous write: local textarea + draft narrative in one paint
      flushSync(() => {
        setLocalRemarks(text);
        setNarrative({ remarks: text });
      });
      narrativeRef.current = { ...narrativeRef.current, remarks: text };
      setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setSource("template");
      setLastStatus(`Remarks (${text.length} chars): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`);
      toast.success("Remarks filled (local builder v36)");
      return true;
    } catch (err) {
      console.error("[remarks]", err);
      const message = err instanceof Error ? err.message : String(err);
      setLastStatus(`Remarks failed: ${message}`);
      toast.error("Remarks failed", { description: message });
      return false;
    }
  }

  function generateFromTemplate() {
    setBusy("template");
    setLastStatus(null);
    try {
      const full = generateNarrative(draft.values, narrativeOpts());
      setNarrative(full);
      narrativeRef.current = { ...narrativeRef.current, ...full };
      setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setSource("template");
      setLastStatus(
        `Template applied. Remarks length=${String(full.remarks ?? "").length}.`,
      );
      toast.success("Narrative filled from inspection data");
    } catch (err) {
      console.error("[template]", err);
      toast.error(err instanceof Error ? err.message : "Template failed");
    } finally {
      setBusy(null);
    }
  }

  /**
   * @param keys blocks to generate
   * @param overwrite when true (default for single-block), replace existing text
   */
  async function generateWithAi(
    keys: (keyof ReportNarrative)[] = BLOCKS.map((b) => b.key),
    overwrite = keys.length === 1,
  ) {
    // Remarks never go through the AI RPC — always local structured text
    if (keys.length === 1 && keys[0] === "remarks") {
      generateRemarksNow(overwrite);
      return;
    }

    const settings = loadAiSettings();
    const opts = narrativeOpts();

    // If bulk includes remarks, fill it first locally
    if (keys.includes("remarks")) {
      generateRemarksNow(overwrite);
    }
    const remaining = keys.filter((k) => k !== "remarks");
    if (remaining.length === 0) return;

    if (!isAiConfigured(settings)) {
      const emptyKeys = remaining.filter(
        (k) => overwrite || !String(narrativeRef.current[k] ?? "").trim(),
      );
      const patch = emptyKeys.length ? applyTemplateToEmptyKeys(emptyKeys) : {};
      if (Object.keys(patch).length > 0) {
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        setSource("template");
        setLastStatus(`Filled from inspection data: ${Object.keys(patch).join(", ")}.`);
        toast.message("Filled from inspection data");
      } else {
        toast.error("AI is not configured", {
          description: "Open Settings, add an API key, Save, then Test connection.",
        });
      }
      return;
    }

    setBusy(remaining.length === 1 ? remaining[0]! : "ai");
    setLastStatus("Generating…");
    const next: Partial<ReportNarrative> = {};
    const errors: string[] = [];
    const values = serializableValues(draft.values);

    try {
      for (const key of remaining) {
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
              ...(key === "location"
                ? { locationContext: (await locationFactsResolved()).promptBlock }
                : {}),
            },
          });

          const text =
            typeof result === "string"
              ? result
              : result && typeof result === "object" && "text" in result
                ? String((result as { text: unknown }).text ?? "")
                : "";

          if (text.trim()) next[key] = text.trim();
          else errors.push(`${key}: empty response`);
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

      const safe: Partial<ReportNarrative> = {};
      const current = narrativeRef.current;
      for (const [k, v] of Object.entries(next) as [keyof ReportNarrative, string][]) {
        if (!v.trim()) continue;
        if (overwrite || !String(current[k] ?? "").trim()) safe[k] = v;
      }

      if (Object.keys(safe).length > 0) {
        setNarrative(safe);
        narrativeRef.current = { ...narrativeRef.current, ...safe };
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        setSource("ai");
        setLastStatus(`Updated: ${Object.keys(safe).join(", ")}.`);
        toast.success(
          remaining.length === 1
            ? `Generated “${remaining[0]}”`
            : "Narrative generated",
        );
      } else if (errors.length) {
        setLastStatus(`No text returned. ${errors.join(" · ")}`);
        toast.error("Generation failed", { description: errors.join(" · ") });
      } else {
        setLastStatus("Existing text was kept.");
      }
    } catch (err) {
      console.error("[narrative AI]", err);
      const message = err instanceof Error ? err.message : String(err);
      setLastStatus(`Failed: ${message}`);
      toast.error("Generation failed", { description: message });
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
          <h3 className="text-sm font-semibold text-foreground">
            Narrative{" "}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              build 10dd1f6
            </span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Empty sections generate with AI once after the draft loads (Settings required). Saved text is never overwritten on reopen — use Regenerate or AI this block to replace a block.
            Insert canned appends a labelled paragraph; it does not replace the block. Edit any block before exporting the report.
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

      {BLOCKS.map((block) => {
        const blockText =
          block.key === "remarks"
            ? localRemarks
            : String(draft.narrative[block.key] ?? "");
        return (
        <div key={block.key} className="block">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{block.label}</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <CannedCommentsBar
                section={block.key}
                currentText={blockText}
                selectedText={selectionByKey[block.key]}
                onApply={(next) => {
                  if (block.key === "remarks") setLocalRemarks(next);
                  setNarrative({ [block.key]: next });
                }}
              />
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (block.key === "remarks") {
                    generateRemarksNow(true);
                    return;
                  }
                  void generateWithAi([block.key]);
                }}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {busy === block.key ? "Generating…" : "AI this block"}
              </button>
            </div>
          </div>
          <span className="mb-2 block text-sm text-muted-foreground">{block.hint}</span>
          <textarea
            value={blockText}
            onChange={(e) => {
              const val = e.target.value;
              if (block.key === "remarks") setLocalRemarks(val);
              setNarrative({ [block.key]: val });
              const start = e.target.selectionStart ?? 0;
              const end = e.target.selectionEnd ?? 0;
              const sel = val.slice(start, end);
              setSelectionByKey((prev) => ({
                ...prev,
                [block.key]: sel.trim() ? sel : "",
              }));
            }}
            onSelect={(e) => {
              const el = e.currentTarget;
              const sel = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
              if (sel.trim()) {
                setSelectionByKey((prev) => ({ ...prev, [block.key]: sel }));
              }
            }}
            rows={block.key === "remarks" ? 12 : 7}
            className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        );
      })}
    </div>
  );
}
