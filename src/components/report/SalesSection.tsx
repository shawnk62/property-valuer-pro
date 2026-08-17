import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { extractComparableSales, generateSaleNarrative } from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import {
  ADJUSTMENT_FEATURES,
  RELATIVITY_OPTIONS,
  computeSaleAdjustmentTotals,
  ensureSaleAdjustments,
  formatMoney,
  formatPct,
  salePricePerGla,
  subjectFeatureDisplay,
  type Relativity,
} from "@/lib/report/adjustmentGrid";
import { extractTextFromPdf } from "@/lib/report/extractPdfText";
import {
  cmaExtractsToSales,
  parseCmaTextHeuristic,
  salesFromCmaText,
} from "@/lib/report/importSalesCma";
import { importSalesFromCsv } from "@/lib/report/importSalesCsv";
import { MOCK_COTALITY_SALES } from "@/lib/report/mock-sales";
import {
  buildSaleNarrativePrompt,
  loadAutoSaleNarratives,
  saleNarrativeFingerprint,
  saveAutoSaleNarratives,
} from "@/lib/report/saleNarrative";
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

function parseAmountInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function SalesSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setSales } = controller;
  const sales = draft.sales.map(ensureSaleAdjustments);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [cmaPaste, setCmaPaste] = useState("");
  const [autoNarratives, setAutoNarratives] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fingerprintsRef = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salesRef = useRef(sales);
  salesRef.current = sales;

  useEffect(() => {
    setAutoNarratives(loadAutoSaleNarratives());
  }, []);

  function replaceSales(next: ComparableSale[]) {
    setSales(next.map(ensureSaleAdjustments));
  }

  function patchSale(id: string, patch: Partial<ComparableSale>) {
    replaceSales(sales.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function patchAdjustment(
    saleId: string,
    featureId: string,
    patch: Partial<FeatureAdjustment>,
  ) {
    replaceSales(
      sales.map((s) => {
        if (s.id !== saleId) return s;
        const current = s.adjustments?.[featureId] ?? {
          relativity: "similar" as Relativity,
          amount: 0,
        };
        return {
          ...s,
          adjustments: {
            ...s.adjustments,
            [featureId]: { ...current, ...patch },
          },
        };
      }),
    );
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
        const fp = saleNarrativeFingerprint(s);
        if (!force && fingerprintsRef.current[s.id] === fp && s.narrative?.trim()) {
          return false;
        }
        return true;
      });

      if (todo.length === 0) {
        setStatus("Sale narratives up to date.");
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
            updates[sale.id] = text.trim();
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
   * Heuristic first (supports 9+ sales); optional AI text fallback if zero hits.
   */
  async function importFromCmaText(text: string, sourceLabel = "CMA text") {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("No CMA text to import");
      return;
    }

    setImporting(true);
    setStatus(`Parsing ${sourceLabel}…`);
    try {
      let mapped = salesFromCmaText(trimmed);

      if (mapped.length === 0 && isAiConfigured()) {
        setStatus("Heuristic found no sales — trying AI on text…");
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
        mapped = cmaExtractsToSales(
          Array.isArray(rawSales) ? (rawSales as Parameters<typeof cmaExtractsToSales>[0]) : [],
        );
        if (mapped.length === 0 && error) {
          toast.error("CMA extract failed", { description: error });
          setStatus(`Failed: ${error}`);
          return;
        }
      }

      if (mapped.length === 0) {
        toast.error("No comparable sales found", {
          description:
            "Check the CMA includes Comparable Sales pages with addresses and sold prices.",
        });
        setStatus("No sales found.");
        return;
      }

      fingerprintsRef.current = {};
      replaceSales(mapped.map(ensureSaleAdjustments));
      toast.success(`Imported ${mapped.length} comparable sale(s)`, {
        description: `${sourceLabel}. Relativity marks applied from COMPARABLE/SUPERIOR/INFERIOR where present.`,
      });
      setStatus(`Imported ${mapped.length} sale(s) from ${sourceLabel}.`);
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
        setStatus("Reading PDF text in browser…");
        const text = await extractTextFromPdf(file);
        if (!text.trim()) {
          toast.error("Could not read text from PDF", {
            description: "Try pasting Comparable Sales text into the box below.",
          });
          setStatus("PDF text extraction returned empty.");
          return;
        }
        // Hand off to shared text path (heuristic supports 9+ sales)
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
            Shared across all report types. Import Cotality CMA PDF (text extracted in-browser, supports 9+ sales) or paste text. Relativity
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

      {sales.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No comparable sales yet. Import a Cotality CMA PDF or add a sale.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="sticky left-0 z-10 min-w-[11rem] bg-muted/95 px-2 py-2 font-semibold text-foreground">
                  Feature
                </th>
                <th className="min-w-[9rem] px-2 py-2 font-semibold text-foreground">Subject</th>
                {sales.map((sale, idx) => (
                  <th
                    key={sale.id}
                    colSpan={2}
                    className="min-w-[14rem] border-l border-border px-2 py-2 align-top font-semibold text-foreground"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        Comparable #{idx + 1}
                        {sale.address ? (
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {sale.address}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => replaceSales(sales.filter((s) => s.id !== sale.id))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove sale"
                      >
                        &times;
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-muted/90 px-2 py-1" />
                <th className="px-2 py-1" />
                {sales.map((sale) => (
                  <Fragment key={sale.id}>
                    <th className="border-l border-border px-2 py-1 font-medium">Description</th>
                    <th className="px-2 py-1 font-medium">+/− $</th>
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
                  {sales.map((sale) => (
                    <Fragment key={sale.id}>
                      <td className="border-l border-border px-1 py-1 align-middle">
                        {row.write ? (
                          <input
                            value={row.read(sale)}
                            onChange={(e) => row.write!(sale.id, e.target.value)}
                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none focus:border-input focus:bg-accent/40"
                          />
                        ) : (
                          <span className="px-1.5 text-sm text-muted-foreground">
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
                  colSpan={2 + sales.length * 2}
                  className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Value adjustments
                </td>
              </tr>

              {/* ---- URAR VALUE ADJUSTMENTS: Description | $ side by side ---- */}
              {ADJUSTMENT_FEATURES.map((feature) => (
                <tr key={feature.id} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium text-foreground">
                    {feature.label}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {subjectFeatureDisplay(feature, draft.values)}
                  </td>
                  {sales.map((sale) => {
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
                    return (
                      <Fragment key={sale.id}>
                        <td className="border-l border-border px-1 py-1 align-middle">
                          <div className="flex min-w-[11rem] items-center gap-1">
                            <input
                              value={detail}
                              onChange={(e) =>
                                patchAdjustment(sale.id, feature.id, {
                                  detail: e.target.value,
                                })
                              }
                              placeholder="—"
                              className="min-w-0 flex-1 rounded border border-input bg-card px-1.5 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                            />
                            <select
                              value={adj.relativity}
                              onChange={(e) =>
                                patchAdjustment(sale.id, feature.id, {
                                  relativity: e.target.value as Relativity,
                                })
                              }
                              className="w-[7.5rem] shrink-0 rounded border border-input bg-card px-1 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
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
                        <td className="px-1 py-1 align-middle">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={adj.amount === 0 ? "" : String(adj.amount)}
                            onChange={(e) =>
                              patchAdjustment(sale.id, feature.id, {
                                amount: parseAmountInput(e.target.value),
                              })
                            }
                            className="w-[4.5rem] rounded border border-input bg-card px-1.5 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}

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
                      formatMoney(computeSaleAdjustmentTotals(sale).adjustedSalePrice),
                    strong: true,
                  },
                ] as const
              ).map((row) => (
                <tr key={row.label} className="border-b border-border bg-muted/40">
                  <td className="sticky left-0 z-10 bg-muted/95 px-2 py-1.5 font-semibold">
                    {row.label}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">—</td>
                  {sales.map((sale) => (
                    <Fragment key={sale.id}>
                      <td
                        colSpan={2}
                        className={`border-l border-border px-2 py-1.5 ${
                          "strong" in row && row.strong ? "font-semibold" : "font-medium"
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
                <td className="px-2 py-1.5 text-muted-foreground">From grid marks (AI)</td>
                {sales.map((sale) => (
                  <td key={sale.id} colSpan={2} className="border-l border-border px-1 py-1">
                    <textarea
                      rows={4}
                      value={sale.narrative ?? ""}
                      onChange={(e) => patchSale(sale.id, { narrative: e.target.value })}
                      placeholder="Auto-generated from relativity marks…"
                      className="w-full resize-y rounded border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none focus:border-input focus:bg-accent/40"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">
                  Source notes
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">CSV / CMA</td>
                {sales.map((sale) => (
                  <td key={sale.id} colSpan={2} className="border-l border-border px-1 py-1">
                    <textarea
                      rows={2}
                      value={sale.comments}
                      onChange={(e) => patchSale(sale.id, { comments: e.target.value })}
                      className="w-full resize-y rounded border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none focus:border-input focus:bg-accent/40"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
