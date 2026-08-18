import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { extractComparableSales, generateSaleNarrative } from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import {
  ADJUSTMENT_FEATURES,
  RELATIVITY_OPTIONS,
  applyAreaRateAdjustments,
  computeSaleAdjustmentTotals,
  ensureSaleAdjustments,
  formatMoney,
  formatPct,
  salePricePerGla,
  subjectFeatureDisplay,
  type Relativity,
} from "@/lib/report/adjustmentGrid";
import { extractTextFromPdf } from "@/lib/report/extractPdfText";
import { fileToDataUrl } from "@/lib/report/photo-data";
import {
  cmaExtractsToSales,
  mergeCmaExtracts,
  parseCmaTextHeuristic,
  type CmaSaleExtract,
} from "@/lib/report/importSalesCma";
import { importSalesFromCsv } from "@/lib/report/importSalesCsv";
import { MOCK_COTALITY_SALES } from "@/lib/report/mock-sales";
import {
  buildSaleNarrativePrompt,
  loadAutoSaleNarratives,
  saleNarrativeFingerprint,
  saveAutoSaleNarratives,
} from "@/lib/report/saleNarrative";
import { withRelativityNarrative } from "@/lib/report/salesRelativity";
import type { ComparableSale, FeatureAdjustment } from "@/lib/report/types";

function emptySale(): ComparableSale {
  return ensureSaleAdjustments({
    id: `sale-${Math.random().toString(36).slice(2, 10)}`,
    address: "",
    saleDate: "",
    salePrice: "",
    landArea: "",
    comments: "",
  });
}

/** Parse adjustment $ input. Returns null while the user is mid-typing (e.g. "-" or "-."). */
function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return 0;
  // Allow typing a leading minus / decimal without wiping the field
  if (cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function SalesSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setSales, setMeta } = controller;
  const sales = draft.sales.map(ensureSaleAdjustments);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [cmaPaste, setCmaPaste] = useState("");
  const [autoNarratives, setAutoNarratives] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** In-progress amount text so "-" can be typed before digits. */
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const fingerprintsRef = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salesRef = useRef(sales);
  salesRef.current = sales;

  useEffect(() => {
    setAutoNarratives(loadAutoSaleNarratives());
  }, []);

  function replaceSales(next: ComparableSale[]) {
    // Collapse near-duplicate addresses (street number + name + type)
    const streetTypes =
      "STREET|ST|ROAD|RD|CRESCENT|CRES|CR|COURT|CT|AVENUE|AVE|DRIVE|DR|PLACE|PL|WAY|CLOSE|CL|TERRACE|TCE|PARADE|PDE|BOULEVARD|BLVD|LANE|LN|CIRCUIT|CCT";
    const sk = (addr: string) => {
      const a = addr.replace(/\s+/g, " ").trim().toUpperCase();
      const m = a.match(
        new RegExp(
          String.raw`(?:UNIT\s+\d+[A-Z]?\s*)?(?:\d+[A-Z]?\s*\/\s*)?(\d+[A-Z]?)\s+([A-Z][A-Z0-9'./ -]*?)\s+\b(${streetTypes})\b`,
        ),
      );
      if (!m) return a.replace(/[^A-Z0-9]/g, "");
      return `${m[1]}${m[2].replace(/[^A-Z0-9]/g, "")}${m[3]}`;
    };
    const deduped: ComparableSale[] = [];
    const seen = new Set<string>();
    for (const s of next) {
      const key = sk(s.address || "") || s.id;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(s);
    }
    const ensured = deduped.map(ensureSaleAdjustments);
    const withRates = applyAreaRateAdjustments(
      ensured,
      draft.values,
      draft.reportMeta.glaRatePerM2,
      draft.reportMeta.siteRatePerM2,
    );
    setSales(withRates);
  }

  function setAreaRate(kind: "gla" | "site", raw: string) {
    const patch =
      kind === "gla" ? { glaRatePerM2: raw } : { siteRatePerM2: raw };
    setMeta(patch);
    const meta = { ...draft.reportMeta, ...patch };
    const ensured = sales.map(ensureSaleAdjustments);
    setSales(
      applyAreaRateAdjustments(
        ensured,
        draft.values,
        meta.glaRatePerM2,
        meta.siteRatePerM2,
      ),
    );
  }

  /**
   * Line 1: house number + street name + street type
   * Line 2: suburb / city + state + postcode (zip)
   */
  function addressLines(addr: string): { line1: string; line2?: string } {
    const a = addr.replace(/\s+/g, " ").trim();
    if (!a) return { line1: "" };
    const streetTypes =
      "STREET|ST|ROAD|RD|CRESCENT|CRES|CR|COURT|CT|AVENUE|AVE|DRIVE|DR|PLACE|PL|WAY|CLOSE|CL|TERRACE|TCE|PARADE|PDE|BOULEVARD|BLVD|LANE|LN|CIRCUIT|CCT|HIGHWAY|HWY|ESPLANADE|ESP|GROVE|GR|RISE|MEWS|WALK|ROW|QUAY|POINT|PT|CIRCLE|CIR|TRAIL|LINK|VISTA|PARK|GARDENS|SQUARE|SQ";
    const typeRe = new RegExp(`^(?:${streetTypes})$`, "i");
    const parts = a.split(" ");
    let typeIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (typeRe.test(parts[i]!.replace(/,$/, ""))) typeIdx = i;
    }
    if (typeIdx >= 0 && typeIdx < parts.length - 1) {
      return {
        line1: parts.slice(0, typeIdx + 1).join(" "),
        line2: parts.slice(typeIdx + 1).join(" "),
      };
    }
    // "12 Example St, Suburb QLD 4000"
    const comma = a.indexOf(",");
    if (comma > 0 && comma < a.length - 1) {
      return { line1: a.slice(0, comma).trim(), line2: a.slice(comma + 1).trim() };
    }
    // Trailing QLD + postcode without a recognised street type
    const qld = a.match(/^(.+?)\s+((?:[A-Za-z'-]+\s+)*(?:QLD|QUEENSLAND)\s*\d{4})$/i);
    if (qld) return { line1: qld[1]!.trim(), line2: qld[2]!.trim() };
    return { line1: a };
  }

  function patchSale(id: string, patch: Partial<ComparableSale>) {
    replaceSales(sales.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function onSalesMapFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the sales map");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setMeta({ salesMapUrl: url });
      toast.success("Sales map attached");
    } catch (err) {
      toast.error("Could not read map image", {
        description: err instanceof Error ? err.message : "Try another file",
      });
    }
  }

  function clearSalesMap() {
    setMeta({ salesMapUrl: "" });
  }

  async function onSalePhotoFile(saleId: string, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the front photo");
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      patchSale(saleId, { photoUrl: url });
      toast.success("Front photo attached");
    } catch (err) {
      toast.error("Could not read photo", {
        description: err instanceof Error ? err.message : "Try another file",
      });
    }
  }

  function clearSalePhoto(saleId: string) {
    patchSale(saleId, { photoUrl: "" });
  }


  function patchAdjustment(
    saleId: string,
    featureId: string,
    patch: Partial<FeatureAdjustment>,
  ) {
    const next = sales.map((s) => {
      if (s.id !== saleId) return s;
      const current = s.adjustments?.[featureId] ?? {
        relativity: "similar" as Relativity,
        amount: 0,
        detail: "",
      };
      return {
        ...s,
        adjustments: {
          ...s.adjustments,
          [featureId]: { ...current, ...patch },
        },
      };
    });
    // When Site/GLA description changes, recompute $ from rate × (subject − comp)
    if (featureId === "site" || featureId === "grossLivingArea") {
      replaceSales(next);
    } else {
      replaceSales(next);
    }
  }

  const runNarratives = useCallback(
    async (force = false) => {
      const settings = loadAiSettings();
      if (!isAiConfigured(settings)) {
        setStatus("AI not configured — open Settings to enable sale narratives.");
        return;
      }

      const current = salesRef.current;
      const todo = current.filter((s) => {
        if (!s.address.trim() && !s.salePrice.trim()) return false;
        // Manual lock: never overwrite, including Regenerate narratives
        if (s.narrativeManual) return false;
        const fp = saleNarrativeFingerprint(s);
        if (!force && fingerprintsRef.current[s.id] === fp && s.narrative?.trim()) {
          return false;
        }
        return true;
      });

      if (todo.length === 0) {
        const locked = current.filter((s) => s.narrativeManual).length;
        setStatus(
          locked
            ? `Sale narratives up to date (${locked} locked as manual).`
            : "Sale narratives up to date.",
        );
        return;
      }

      setGenerating(true);
      setStatus(`Generating narratives for ${todo.length} sale(s)…`);
      const updates: Record<string, string> = {};
      const errors: string[] = [];

      for (const sale of todo) {
        try {
          const { system, prompt } = buildSaleNarrativePrompt(
            sale,
            draft.values,
            draft.reportMeta,
          );
          const result = await generateSaleNarrative({
            data: {
              settings: {
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKey,
                ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
              },
              system,
              prompt,
            },
          });
          const text =
            typeof result === "string"
              ? result
              : result && typeof result === "object" && "text" in result
                ? String((result as { text: unknown }).text ?? "")
                : "";
          if (text.trim()) {
            // Deterministic overall superior/inferior from sale price vs valuation
            updates[sale.id] = withRelativityNarrative(
              text.trim(),
              sale.salePrice,
              draft.reportMeta.valueAmount || "",
            );
            fingerprintsRef.current[sale.id] = saleNarrativeFingerprint(sale);
          } else {
            errors.push(sale.address || sale.id);
          }
        } catch (err) {
          console.error("[sale narrative]", err);
          errors.push(sale.address || sale.id);
        }
      }

      if (Object.keys(updates).length) {
        replaceSales(
          salesRef.current.map((s) =>
            updates[s.id] ? { ...s, narrative: updates[s.id] } : s,
          ),
        );
      }

      if (errors.length && Object.keys(updates).length) {
        setStatus(`Updated ${Object.keys(updates).length}; failed: ${errors.join(", ")}`);
        toast.message("Some sale narratives failed", { description: errors.join(", ") });
      } else if (errors.length) {
        setStatus(`Failed: ${errors.join(", ")}`);
        toast.error("Sale narrative generation failed");
      } else {
        setStatus(`Generated ${Object.keys(updates).length} sale narrative(s).`);
        toast.success("Sale narratives updated");
      }
      setGenerating(false);
    },
    [draft.values, draft.reportMeta],
  );

  // Auto-generate when sales / adjustments change (debounced). Default on.
  useEffect(() => {
    if (!autoNarratives) return;
    if (!isAiConfigured()) return;
    if (sales.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runNarratives(false);
    }, 1600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // fingerprint via sales content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNarratives, sales, runNarratives]);

  /**
   * Import sales from CMA text (paste or PDF-extracted).
   * Heuristic first (supports 9+ sales). When AI is configured and the heuristic
   * finds zero or fewer than three sales, run AI and merge by address so a
   * missing third (or more) is recovered instead of stopping at a partial parse.
   */
  async function importFromCmaText(
    text: string,
    sourceLabel = "CMA text",
    media?: { salesMapUrl: string | null; frontPhotoUrls: string[] },
  ) {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("No CMA text to import");
      return;
    }

    setImporting(true);
    setStatus(`Parsing ${sourceLabel}…`);
    try {
      const heuristicExtracts = parseCmaTextHeuristic(trimmed);
      let extracts: CmaSaleExtract[] = heuristicExtracts;

      // Only call AI when heuristic found nothing. Partial results are preferred
      // over AI merges that previously created duplicate / mangled addresses.
      const needsAiEnrichment = isAiConfigured() && heuristicExtracts.length === 0;

      if (needsAiEnrichment) {
        setStatus(
          heuristicExtracts.length === 0
            ? "Heuristic found no sales — trying AI on text…"
            : `Heuristic found ${heuristicExtracts.length} — enriching with AI for missing comps…`,
        );
        const settings = loadAiSettings();
        const result = await extractComparableSales({
          data: {
            settings: {
              provider: settings.provider,
              model: settings.model,
              apiKey: settings.apiKey,
              ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
            },
            source: "text",
            text: trimmed.slice(0, 120_000),
          },
        });
        const error =
          result && typeof result === "object" && "error" in result
            ? (result as { error?: string | null }).error
            : null;
        const rawSales =
          result && typeof result === "object" && "sales" in result
            ? (result as { sales: unknown[] }).sales
            : [];
        const aiExtracts = Array.isArray(rawSales)
          ? (rawSales as CmaSaleExtract[])
          : [];

        if (aiExtracts.length > 0) {
          extracts = mergeCmaExtracts(heuristicExtracts, aiExtracts);
        } else if (heuristicExtracts.length === 0 && error) {
          toast.error("CMA extract failed", { description: error });
          setStatus(`Failed: ${error}`);
          return;
        }
      }

      let mapped = cmaExtractsToSales(extracts);

      if (mapped.length === 0) {
        toast.error("No comparable sales found", {
          description:
            "Check the CMA includes Comparable Sales pages with addresses and sold prices.",
        });
        setStatus("No sales found.");
        return;
      }

      // Attach front photos in CMA page order (same order as extracts)
      if (media?.frontPhotoUrls?.length) {
        mapped = mapped.map((sale, i) => ({
          ...sale,
          photoUrl: media.frontPhotoUrls[i] || sale.photoUrl,
        }));
      }
      if (media?.salesMapUrl) {
        setMeta({ salesMapUrl: media.salesMapUrl });
      }

      fingerprintsRef.current = {};
      replaceSales(mapped.map(ensureSaleAdjustments));
      const photoNote = media?.frontPhotoUrls?.length
        ? ` · ${media.frontPhotoUrls.length} front photo(s)`
        : "";
      const mapNote = media?.salesMapUrl ? " · sales map" : "";
      toast.success(`Imported ${mapped.length} comparable sale(s)`, {
        description: `${sourceLabel}${mapNote}${photoNote}. Relativity marks applied where present.`,
      });
      setStatus(`Imported ${mapped.length} sale(s) from ${sourceLabel}${mapNote}${photoNote}.`);
    } catch (err) {
      console.error("[CMA text import]", err);
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error("CMA import failed", { description: message });
      setStatus(`Failed: ${message}`);
    } finally {
      setImporting(false);
    }
  }

  async function onCmaFileSelected(file: File | null) {
    if (!file) return;

    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isCsv =
      file.type === "text/csv" ||
      name.endsWith(".csv") ||
      file.type === "application/vnd.ms-excel";

    setImporting(true);
    try {
      if (isCsv) {
        const text = await file.text();
        const result = importSalesFromCsv(text);
        if (result.sales.length === 0) {
          toast.error("No sales in CSV", {
            description: result.warnings.join(" ") || "Check headers.",
          });
          setStatus("No sales in CSV.");
          return;
        }
        fingerprintsRef.current = {};
        replaceSales(result.sales.map(ensureSaleAdjustments));
        toast.success(`Imported ${result.sales.length} sale(s) from CSV`);
        setStatus(`Imported ${result.sales.length} from CSV.`);
        return;
      }

      if (isPdf) {
        // Text only from CMA PDF. Map + front photos are attached manually
        // (Cotality embeds do not crop cleanly in-browser).
        setStatus("Reading PDF text…");
        const text = await extractTextFromPdf(file);
        if (!text.trim()) {
          toast.error("Could not read text from PDF", {
            description: "Try pasting Comparable Sales text into the box below.",
          });
          setStatus("PDF text extraction returned empty.");
          return;
        }
        setStatus("Parsing sales data…");
        await importFromCmaText(text, "CMA PDF");
        return;
      }

      // .txt or other
      const text = await file.text();
      await importFromCmaText(text, file.name || "file");
    } catch (err) {
      console.error("[CMA file import]", err);
      const message = err instanceof Error ? err.message : "CMA import failed";
      toast.error("CMA import failed", { description: message });
      setStatus(`Failed: ${message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (


    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Sales comparison grid (URAR)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across all report types. Import Cotality CMA PDF for sale data (text). Attach sales map and front photos below. Relativity
            marks and $ adjustments feed report narratives (editable per sale).
          </p>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={autoNarratives}
              onChange={(e) => {
                const on = e.target.checked;
                setAutoNarratives(on);
                saveAutoSaleNarratives(on);
                if (on) void runNarratives(false);
              }}
              className="size-4 rounded border-input"
            />
            <span>
              Automatically generate sale narratives from grid marks
              <span className="text-muted-foreground"> (default on — uncheck to turn off)</span>
            </span>
          </label>
          {status ? (
            <p className="mt-2 text-xs text-muted-foreground">{status}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,text/csv,application/pdf"
            className="hidden"
            onChange={(e) => void onCmaFileSelected(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {importing ? "Importing…" : "Import CMA PDF"}
          </button>
          <button
            type="button"
            disabled={generating || sales.length === 0}
            onClick={() => void runNarratives(true)}
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {generating ? "Generating…" : "Regenerate narratives"}
          </button>
          <button
            type="button"
            onClick={() =>
              replaceSales(
                MOCK_COTALITY_SALES.map((s, i) =>
                  ensureSaleAdjustments({ ...s, id: `cotality-${i + 1}` }),
                ),
              )
            }
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Load sample sales
          </button>
          <button
            type="button"
            onClick={() => replaceSales([...sales, emptySale()])}
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Add sale
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="cma-paste">
          Or paste Comparable Sales text from the CMA
        </label>
        <p className="text-xs text-muted-foreground">
          Optional: paste Comparable Sales text if PDF import misses a sale. Standard Cotality
          layout parses without AI. No limit of three — nine or more sales are supported.
        </p>
        <textarea
          id="cma-paste"
          rows={5}
          value={cmaPaste}
          onChange={(e) => setCmaPaste(e.target.value)}
          placeholder="9 ROBINSON CRESCENT RUNCORN QLD 4113&#10;Sold Price $1,050,000&#10;Sold Date 16-Jun-26&#10;…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          disabled={importing || !cmaPaste.trim()}
          onClick={() => void importFromCmaText(cmaPaste)}
          className="rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          Extract from pasted text
        </button>
      </div>

      {/* Manual sales map + front photos — reliable path for report placement */}
      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Sales map &amp; front photos</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Attach the Cotality sales map and each comparable&apos;s front elevation manually.
            These appear in the grid and in §12 Sales Evidence (Preview and Word).
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Sales map</p>
            {draft.reportMeta.salesMapUrl ? (
              <div className="relative inline-block">
                <img
                  src={draft.reportMeta.salesMapUrl}
                  alt="Sales map"
                  className="max-h-40 max-w-xs rounded border border-border object-contain"
                />
                <button
                  type="button"
                  onClick={clearSalesMap}
                  className="absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-xs text-destructive shadow"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex h-28 w-44 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-border bg-muted/30 text-center text-xs text-muted-foreground hover:bg-muted/50">
                <span>Upload map</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onSalesMapFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {draft.reportMeta.salesMapUrl ? (
              <label className="block text-xs text-primary cursor-pointer hover:underline">
                Replace map
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onSalesMapFile(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : null}
          </div>
        </div>

        {sales.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sales.map((sale, idx) => (
              <div
                key={sale.id}
                className="rounded border border-border bg-background p-2 space-y-1.5"
              >
                <p className="text-xs font-semibold text-foreground truncate">
                  Comp #{idx + 1}
                  {sale.address ? (
                    <span className="font-normal text-muted-foreground"> — {sale.address}</span>
                  ) : null}
                </p>
                {sale.photoUrl ? (
                  <div className="relative">
                    <img
                      src={sale.photoUrl}
                      alt={sale.address || `Comparable ${idx + 1}`}
                      className="max-h-28 w-full rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => clearSalePhoto(sale.id)}
                      className="absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[0.65rem] text-destructive shadow"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex h-20 cursor-pointer items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground hover:bg-muted/40">
                    Upload front photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        void onSalePhotoFile(sale.id, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                )}
                {sale.photoUrl ? (
                  <label className="text-[0.65rem] text-primary cursor-pointer hover:underline">
                    Replace photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        void onSalePhotoFile(sale.id, e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Import sales first, then attach a front photo to each comparable.
          </p>
        )}
      </div>

      {sales.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No comparable sales yet. Import a Cotality CMA PDF or add a sale.
        </div>
      ) : (
        (() => {
          const COMPS_PER_GRID = 3;
          const chunks: (typeof sales)[] = [];
          for (let i = 0; i < sales.length; i += COMPS_PER_GRID) {
            chunks.push(sales.slice(i, i + COMPS_PER_GRID));
          }
          return (
            <div className="space-y-6">
              {chunks.map((chunk, chunkIdx) => {
                const startNum = chunkIdx * COMPS_PER_GRID;
                return (
                  <div
                    key={`grid-${chunkIdx}`}
                    className="overflow-x-auto rounded-md border border-border"
                  >
                    <table className="w-full min-w-[36rem] border-collapse text-left text-sm table-fixed">
                      <colgroup>
                        <col className="w-[8.5rem]" />
                        <col className="w-[6.5rem]" />
                        {chunk.map((sale) => (
                          <Fragment key={sale.id}>
                            <col className="w-[7.25rem]" />
                            <col className="w-[3.5rem]" />
                          </Fragment>
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border bg-muted/60">
                          <th className="sticky left-0 z-10 bg-muted/95 px-1.5 py-1.5 text-xs font-semibold text-foreground">
                            Feature
                          </th>
                          <th className="px-1.5 py-1.5 text-xs font-semibold text-foreground">
                            Subject
                          </th>
                          {chunk.map((sale, idx) => {
                            const lines = addressLines(sale.address || "");
                            return (
                              <th
                                key={sale.id}
                                colSpan={2}
                                className="border-l border-border px-1 py-1.5 align-top text-xs font-semibold text-foreground"
                              >
                                <div className="flex items-start justify-between gap-0.5">
                                  <span className="min-w-0 leading-tight">
                                    Comparable #{startNum + idx + 1}
                                    {lines.line1 ? (
                                      <span className="mt-0.5 block text-[0.65rem] font-normal text-muted-foreground">
                                        {lines.line1}
                                        {lines.line2 ? (
                                          <>
                                            <br />
                                            {lines.line2}
                                          </>
                                        ) : null}
                                      </span>
                                    ) : null}
                                    {sale.photoUrl ? (
                                      <label className="mt-1 block cursor-pointer" title="Replace front photo">
                                        <img
                                          src={sale.photoUrl}
                                          alt=""
                                          className="max-h-14 w-auto max-w-full rounded border border-border object-cover"
                                        />
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) =>
                                            void onSalePhotoFile(
                                              sale.id,
                                              e.target.files?.[0] ?? null,
                                            )
                                          }
                                        />
                                      </label>
                                    ) : (
                                      <label className="mt-1 flex cursor-pointer items-center justify-center rounded border border-dashed border-border px-1 py-2 text-[0.6rem] font-normal text-muted-foreground hover:bg-muted/40">
                                        + Photo
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) =>
                                            void onSalePhotoFile(
                                              sale.id,
                                              e.target.files?.[0] ?? null,
                                            )
                                          }
                                        />
                                      </label>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      replaceSales(sales.filter((s) => s.id !== sale.id))
                                    }
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                    aria-label="Remove sale"
                                  >
                                    &times;
                                  </button>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                          <th className="sticky left-0 z-10 bg-muted/90 px-2 py-1" />
                          <th className="px-2 py-1" />
                          {chunk.map((sale) => (
                            <Fragment key={sale.id}>
                              <th className="border-l border-border px-1.5 py-1 font-medium">
                                Description
                              </th>
                              <th className="px-1 py-1 font-medium">+/− $</th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* ---- URAR identity rows ---- */}
                        {(
                          [
                            {
                              key: "address",
                              label: "Address",
                              subject: () =>
                                [draft.values["prop_address"], draft.values["prop_suburb"]]
                                  .filter(Boolean)
                                  .join(", ") || "—",
                              read: (s: (typeof sales)[0]) => s.address,
                              write: (id: string, v: string) => patchSale(id, { address: v }),
                            },
                            {
                              key: "proximity",
                              label: "Proximity to Subject",
                              subject: () => "—",
                              read: (s: (typeof sales)[0]) => s.proximity ?? "",
                              write: (id: string, v: string) => patchSale(id, { proximity: v }),
                            },
                            {
                              key: "salePrice",
                              label: "Sale Price",
                              subject: () =>
                                draft.reportMeta.valueAmount
                                  ? `Subject value ${draft.reportMeta.valueAmount}`
                                  : "—",
                              read: (s: (typeof sales)[0]) => s.salePrice,
                              write: (id: string, v: string) => patchSale(id, { salePrice: v }),
                            },
                            {
                              key: "priceGla",
                              label: "Sale Price/Gross Liv. Area",
                              subject: () => "—",
                              read: (s: (typeof sales)[0]) => salePricePerGla(s),
                              write: null as null | ((id: string, v: string) => void),
                            },
                            {
                              key: "dataSource",
                              label: "Data Source(s)",
                              subject: () => "—",
                              read: (s: (typeof sales)[0]) => s.dataSource ?? "",
                              write: (id: string, v: string) => patchSale(id, { dataSource: v }),
                            },
                            {
                              key: "verificationSource",
                              label: "Verification Source(s)",
                              subject: () => "—",
                              read: (s: (typeof sales)[0]) => s.verificationSource ?? "",
                              write: (id: string, v: string) =>
                                patchSale(id, { verificationSource: v }),
                            },
                          ] as const
                        ).map((row) => (
                          <tr key={row.key} className="border-b border-border">
                            <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium text-foreground">
                              {row.label}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">{row.subject()}</td>
                            {chunk.map((sale) => (
                              <Fragment key={sale.id}>
                                <td className="border-l border-border px-1 py-1 align-middle">
                                  {row.write ? (
                                    <input
                                      value={row.read(sale)}
                                      onChange={(e) => row.write!(sale.id, e.target.value)}
                                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none focus:border-input focus:bg-accent/40"
                                    />
                                  ) : (
                                    <span className="px-1 text-xs text-muted-foreground">
                                      {row.read(sale)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-1 py-1 text-center text-muted-foreground">—</td>
                              </Fragment>
                            ))}
                          </tr>
                        ))}

                        <tr className="border-b border-border bg-muted/30">
                          <td
                            colSpan={2 + chunk.length * 2}
                            className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            Value adjustments
                          </td>
                        </tr>

                        {/* ---- URAR VALUE ADJUSTMENTS: Description | $ side by side ---- */}
                        {ADJUSTMENT_FEATURES.map((feature) => {
                          const isSite = feature.id === "site";
                          const isGla = feature.id === "grossLivingArea";
                          const isAreaRateRow = isSite || isGla;
                          const subjectDisplay = subjectFeatureDisplay(
                            feature,
                            draft.values,
                          );
                          const rateValue = isGla
                            ? (draft.reportMeta.glaRatePerM2 ?? "")
                            : isSite
                              ? (draft.reportMeta.siteRatePerM2 ?? "")
                              : "";

                          return (
                          <tr key={feature.id} className="border-b border-border">
                            <td className="sticky left-0 z-10 bg-card px-1.5 py-1 text-xs font-medium text-foreground">
                              {feature.label}
                            </td>
                            <td className="px-1 py-1 text-[0.7rem] text-muted-foreground align-top">
                              <div>{subjectDisplay}</div>
                              {isAreaRateRow ? (
                                <label className="mt-1 flex flex-col gap-0.5">
                                  <span className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    $/m² rate
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="e.g. 2500"
                                    value={rateValue}
                                    onChange={(e) =>
                                      setAreaRate(isGla ? "gla" : "site", e.target.value)
                                    }
                                    title={
                                      isGla
                                        ? "GLA adjustment = rate × (subject GLA − comp GLA), nearest $1,000"
                                        : "Site adjustment = rate × (subject site − comp site), nearest $1,000"
                                    }
                                    className="w-full rounded border border-input bg-card px-1 py-0.5 text-[0.7rem] text-foreground outline-none focus:ring-1 focus:ring-ring"
                                  />
                                </label>
                              ) : null}
                            </td>
                            {chunk.map((sale) => {
                              const adj = sale.adjustments?.[feature.id] ?? {
                                relativity: "similar" as Relativity,
                                amount: 0,
                                detail: "",
                              };
                              // Prefer stored detail; fall back to known sale facts for key lines
                              let detail = adj.detail ?? "";
                              if (!detail.trim()) {
                                if (feature.id === "site") detail = sale.landArea || "";
                                if (feature.id === "grossLivingArea") detail = sale.gla || "";
                                if (feature.id === "dateOfSale") detail = sale.saleDate || "";
                                if (feature.id === "aboveGradeRoomCount") {
                                  detail = [
                                    sale.beds ? `${sale.beds} bd` : null,
                                    sale.baths ? `${sale.baths} ba` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" / ");
                                }
                                if (feature.id === "garageCarport" && sale.cars) {
                                  detail = `${sale.cars} car`;
                                }
                              }
                              const rateActive =
                                isAreaRateRow &&
                                rateValue.trim() !== "" &&
                                detail.trim() !== "";
                              return (
                                <Fragment key={sale.id}>
                                  <td className="border-l border-border px-0.5 py-1 align-middle">
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                      <input
                                        value={detail}
                                        onChange={(e) =>
                                          patchAdjustment(sale.id, feature.id, {
                                            detail: e.target.value,
                                          })
                                        }
                                        placeholder="—"
                                        className="min-w-0 w-full rounded border border-input bg-card px-1 py-0.5 text-[0.65rem] text-foreground outline-none focus:ring-1 focus:ring-ring"
                                      />
                                      <select
                                        value={adj.relativity}
                                        onChange={(e) =>
                                          patchAdjustment(sale.id, feature.id, {
                                            relativity: e.target.value as Relativity,
                                          })
                                        }
                                        className="w-full rounded border border-input bg-card px-0.5 py-0.5 text-[0.6rem] text-foreground outline-none focus:ring-1 focus:ring-ring"
                                        title="Relativity vs subject"
                                      >
                                        {RELATIVITY_OPTIONS.map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </td>
                                  <td className="px-0.5 py-1 align-middle">
                                    <input
                                      type="text"
                                      inputMode="text"
                                      placeholder="0"
                                      value={
                                        amountDrafts[`${sale.id}:${feature.id}`] !== undefined
                                          ? amountDrafts[`${sale.id}:${feature.id}`]
                                          : adj.amount === 0
                                            ? ""
                                            : String(adj.amount)
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const key = `${sale.id}:${feature.id}`;
                                        setAmountDrafts((prev) => ({ ...prev, [key]: raw }));
                                        const parsed = parseAmountInput(raw);
                                        if (parsed !== null) {
                                          patchAdjustment(sale.id, feature.id, {
                                            amount: parsed,
                                          });
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const key = `${sale.id}:${feature.id}`;
                                        const raw = e.currentTarget.value;
                                        setAmountDrafts((prev) => {
                                          if (prev[key] === undefined) return prev;
                                          const next = { ...prev };
                                          delete next[key];
                                          return next;
                                        });
                                        const parsed = parseAmountInput(raw);
                                        patchAdjustment(sale.id, feature.id, {
                                          amount: parsed ?? 0,
                                        });
                                      }}
                                      title={
                                        rateActive
                                          ? "Auto-filled from $/m² rate when rate/area changes — you can still override (negative = inferior to subject)"
                                          : "Dollar adjustment (use leading − for negative)"
                                      }
                                      className="w-full rounded border border-input bg-card px-1 py-0.5 text-[0.65rem] text-foreground outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  </td>
                                </Fragment>
                              );
                            })}
                          </tr>
                          );
                        })}

                        {/* ---- Totals ---- */}
                        {(
                          [
                            {
                              label: "Net Adjustment (Total)",
                              cell: (sale: (typeof sales)[0]) =>
                                formatMoney(computeSaleAdjustmentTotals(sale).netAdjustment),
                            },
                            {
                              label: "Net Adj. %",
                              cell: (sale: (typeof sales)[0]) =>
                                formatPct(computeSaleAdjustmentTotals(sale).netPct),
                            },
                            {
                              label: "Gross Adj. %",
                              cell: (sale: (typeof sales)[0]) =>
                                formatPct(computeSaleAdjustmentTotals(sale).grossPct),
                            },
                            {
                              label: "Adjusted Sale Price",
                              cell: (sale: (typeof sales)[0]) =>
                                formatMoney(
                                  computeSaleAdjustmentTotals(sale).adjustedSalePrice,
                                ),
                              strong: true,
                            },
                          ] as const
                        ).map((row) => (
                          <tr key={row.label} className="border-b border-border bg-muted/40">
                            <td className="sticky left-0 z-10 bg-muted/95 px-2 py-1.5 font-semibold">
                              {row.label}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">—</td>
                            {chunk.map((sale) => (
                              <Fragment key={sale.id}>
                                <td
                                  colSpan={2}
                                  className={`border-l border-border px-1.5 py-1.5 text-xs ${
                                    "strong" in row && row.strong
                                      ? "font-semibold"
                                      : "font-medium"
                                  }`}
                                >
                                  {row.cell(sale)}
                                </td>
                              </Fragment>
                            ))}
                          </tr>
                        ))}

                        <tr className="border-b border-border">
                          <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">
                            Report narrative
                          </td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">
                            AI or manual (lock to keep)
                          </td>
                          {chunk.map((sale) => (
                            <td
                              key={sale.id}
                              colSpan={2}
                              className="border-l border-border px-1 py-1"
                            >
                              <div className="space-y-1">
                                <textarea
                                  rows={3}
                                  value={sale.narrative ?? ""}
                                  onChange={(e) =>
                                    patchSale(sale.id, {
                                      narrative: e.target.value,
                                      // Editing locks the text so auto/regenerate will not wipe it
                                      narrativeManual: true,
                                    })
                                  }}
                                  placeholder="Auto-generated from relativity marks…"
                                  className={`w-full resize-y rounded border bg-transparent px-1.5 py-1 text-[0.7rem] outline-none focus:bg-accent/40 ${
                                    sale.narrativeManual
                                      ? "border-amber-500/60 focus:border-amber-500"
                                      : "border-transparent focus:border-input"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchSale(sale.id, {
                                      narrativeManual: !sale.narrativeManual,
                                    })
                                  }
                                  className={`rounded px-1.5 py-0.5 text-[0.65rem] font-medium transition-colors ${
                                    sale.narrativeManual
                                      ? "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200"
                                      : "bg-muted text-muted-foreground hover:bg-accent"
                                  }`}
                                  title={
                                    sale.narrativeManual
                                      ? "Manual lock on — AI will not overwrite this narrative"
                                      : "Click to lock as manual so AI will not overwrite"
                                  }
                                >
                                  {sale.narrativeManual ? "Manual ✓" : "Allow AI"}
                                </button>
                              </div>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-border">
                          <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">
                            Source notes
                          </td>
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">CSV / CMA</td>
                          {chunk.map((sale) => (
                            <td
                              key={sale.id}
                              colSpan={2}
                              className="border-l border-border px-1 py-1"
                            >
                              <textarea
                                rows={2}
                                value={sale.comments}
                                onChange={(e) =>
                                  patchSale(sale.id, { comments: e.target.value })
                                }}
                                className="w-full resize-y rounded border border-transparent bg-transparent px-1.5 py-1 text-[0.7rem] outline-none focus:border-input focus:bg-accent/40"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}
