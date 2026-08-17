import { useCallback, useEffect, useRef, useState } from "react";
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
  subjectFeatureDisplay,
  type Relativity,
} from "@/lib/report/adjustmentGrid";
import { cmaExtractsToSales, parseCmaTextHeuristic } from "@/lib/report/importSalesCma";
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

  async function fileToBase64(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function onCmaFileSelected(file: File | null) {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isCsv =
      file.type === "text/csv" ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "application/vnd.ms-excel";

    setImporting(true);
    setStatus("Importing…");
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

      // Large CMA PDFs often exceed serverless body limits when base64-encoded (~4MB PDF → ~5.5MB).
      if (isPdf && file.size > 2_500_000) {
        toast.error("CMA PDF is too large to upload directly", {
          description:
            "Paste the Comparable Sales page text into the box below (or use a smaller export). Heuristic extract does not need AI.",
        });
        setStatus("PDF too large for direct upload — paste Comparable Sales text instead.");
        return;
      }

      if (isPdf) {
        const settings = loadAiSettings();
        if (!isAiConfigured(settings)) {
          toast.error("Configure AI in Settings first", {
            description:
              "Or paste Comparable Sales text below — text paste can extract without AI.",
          });
          setStatus("AI not configured for PDF extract.");
          return;
        }

        setStatus("Extracting sales from CMA PDF…");
        const result = await extractComparableSales({
          data: {
            settings: {
              provider: settings.provider,
              model: settings.model,
              apiKey: settings.apiKey,
              ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
            },
            source: "file",
            file: {
              mimeType: file.type || "application/pdf",
              base64: await fileToBase64(file),
            },
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
        const mapped = cmaExtractsToSales(
          Array.isArray(rawSales) ? (rawSales as Parameters<typeof cmaExtractsToSales>[0]) : [],
        );

        if (mapped.length === 0) {
          toast.error("No comparable sales extracted from PDF", {
            description:
              error ||
              "Paste the Comparable Sales pages as text below and click Extract from pasted text.",
          });
          setStatus(error ? `Failed: ${error}` : "No sales extracted from PDF.");
          return;
        }

        fingerprintsRef.current = {};
        replaceSales(mapped.map(ensureSaleAdjustments));
        toast.success(`Extracted ${mapped.length} comparable sale(s) from CMA`);
        setStatus(`Extracted ${mapped.length} sale(s) from CMA PDF.`);
        return;
      }

      // Plain text file
      const text = await file.text();
      await importFromCmaText(text);
    } catch (err) {
      console.error("[CMA import]", err);
      const message = err instanceof Error ? err.message : "CMA import failed";
      toast.error("CMA import failed", { description: message });
      setStatus(`Failed: ${message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function importFromCmaText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Paste CMA text first");
      return;
    }

    setImporting(true);
    setStatus("Parsing CMA text…");
    try {
      // 1) Heuristic (no AI) — works for standard Cotality Comparable Sales layout
      let mapped = cmaExtractsToSales(parseCmaTextHeuristic(trimmed));

      // 2) AI fallback if heuristic found nothing and AI is configured
      if (mapped.length === 0 && isAiConfigured()) {
        setStatus("Heuristic found nothing — trying AI…");
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
            text: trimmed,
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
            "Paste text from the Comparable Sales pages (address, sold price, sold date).",
        });
        setStatus("No sales found in pasted text.");
        return;
      }

      fingerprintsRef.current = {};
      replaceSales(mapped.map(ensureSaleAdjustments));
      toast.success(`Imported ${mapped.length} comparable sale(s)`);
      setStatus(`Imported ${mapped.length} sale(s) from CMA text.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error("CMA import failed", { description: message });
      setStatus(`Failed: ${message}`);
    } finally {
      setImporting(false);
    }
  }

  return (

    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Sales comparison grid</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across all report types. Import a Cotality CMA PDF (primary) or CSV. Relativity
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
          Large PDFs often fail on upload. Copy the Comparable Sales pages (addresses, prices, dates,
          COMPARABLE/SUPERIOR/INFERIOR lines) and paste here. Works without AI when the layout is
          standard Cotality.
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
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="sticky left-0 z-10 min-w-[11rem] bg-muted/95 px-3 py-2.5 font-semibold text-foreground">
                  Feature
                </th>
                <th className="min-w-[12rem] px-3 py-2.5 font-semibold text-foreground">Subject</th>
                {sales.map((sale, idx) => (
                  <th
                    key={sale.id}
                    className="min-w-[14rem] px-3 py-2.5 align-top font-semibold text-foreground"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span>Comparable #{idx + 1}</span>
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
            </thead>
            <tbody>
              {(
                [
                  ["address", "Address"],
                  ["saleDate", "Sale date"],
                  ["salePrice", "Sale price"],
                  ["landArea", "Land area"],
                ] as const
              ).map(([key, label]) => (
                <tr key={key} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                    {label}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {key === "address"
                      ? [draft.values["prop_address"], draft.values["prop_suburb"]]
                          .filter(Boolean)
                          .join(", ") || "—"
                      : key === "salePrice"
                        ? draft.reportMeta.valueAmount
                          ? `Valuation ${draft.reportMeta.valueAmount}`
                          : "—"
                        : key === "landArea"
                          ? [
                              draft.values["prop_sitearea"],
                              draft.values["prop_areaunit"] === "m2"
                                ? "m²"
                                : draft.values["prop_areaunit"],
                            ]
                              .filter(Boolean)
                              .join(" ") || "—"
                          : draft.reportMeta.valueDate || "—"}
                  </td>
                  {sales.map((sale) => (
                    <td key={sale.id} className="px-1 py-1 align-top">
                      <input
                        value={sale[key]}
                        onChange={(e) => patchSale(sale.id, { [key]: e.target.value })}
                        className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none focus:border-input focus:bg-accent/40"
                      />
                    </td>
                  ))}
                </tr>
              ))}

              {ADJUSTMENT_FEATURES.map((feature) => (
                <tr key={feature.id} className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">
                    {feature.label}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {subjectFeatureDisplay(feature, draft.values)}
                  </td>
                  {sales.map((sale) => {
                    const adj = sale.adjustments?.[feature.id] ?? {
                      relativity: "similar" as Relativity,
                      amount: 0,
                    };
                    return (
                      <td key={sale.id} className="px-1 py-1 align-top">
                        <div className="flex flex-col gap-1 px-1">
                          <select
                            value={adj.relativity}
                            onChange={(e) =>
                              patchAdjustment(sale.id, feature.id, {
                                relativity: e.target.value as Relativity,
                              })
                            }
                            className="w-full rounded border border-input bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                          >
                            {RELATIVITY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="$ adj."
                            value={adj.amount === 0 ? "" : String(adj.amount)}
                            onChange={(e) =>
                              patchAdjustment(sale.id, feature.id, {
                                amount: parseAmountInput(e.target.value),
                              })
                            }
                            className="w-full rounded border border-input bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="border-b border-border bg-muted/40">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Net adjustment
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-3 py-2 font-medium">
                    {formatMoney(computeSaleAdjustmentTotals(sale).netAdjustment)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/40">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Net adj. %
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-3 py-2">
                    {formatPct(computeSaleAdjustmentTotals(sale).netPct)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/40">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Gross adj. %
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-3 py-2">
                    {formatPct(computeSaleAdjustmentTotals(sale).grossPct)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/50">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Adjusted sale price
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-3 py-2 font-semibold">
                    {formatMoney(computeSaleAdjustmentTotals(sale).adjustedSalePrice)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-border">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                  Report narrative
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  From grid marks (AI)
                </td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-1 py-1 align-top">
                    <textarea
                      rows={5}
                      value={sale.narrative ?? ""}
                      onChange={(e) => patchSale(sale.id, { narrative: e.target.value })}
                      placeholder="Auto-generated from relativity marks…"
                      className="w-full resize-y rounded border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none focus:border-input focus:bg-accent/40"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                  Source notes
                </td>
                <td className="px-3 py-2 text-muted-foreground">CSV / manual</td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-1 py-1 align-top">
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
