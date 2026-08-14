import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
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
import { importSalesFromCsv } from "@/lib/report/importSalesCsv";
import { MOCK_COTALITY_SALES } from "@/lib/report/mock-sales";
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

  async function onCsvSelected(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = importSalesFromCsv(text);
      if (result.sales.length === 0) {
        toast.error("No sales imported", {
          description: result.warnings.join(" ") || "Check the CSV headers and try again.",
        });
        return;
      }
      replaceSales(result.sales.map(ensureSaleAdjustments));
      toast.success(`Imported ${result.sales.length} sale(s) into adjustment grid`, {
        description: "Relativity defaults to Similar; enter $ adjustments as needed.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read CSV";
      toast.error("CSV import failed", { description: message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Sales comparison grid
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across all report types. Import RP Data CSV, set relativity (default Similar) and
            dollar adjustments per feature. Net / gross % and adjusted sale price calculate
            automatically. Report output format still depends on report type.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onCsvSelected(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {importing ? "Importing…" : "Import CSV"}
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

      {sales.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No comparable sales yet. Import a CSV from RP Data or add a sale.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="sticky left-0 z-10 bg-muted/95 px-3 py-2.5 font-semibold text-foreground min-w-[11rem]">
                  Feature
                </th>
                <th className="px-3 py-2.5 font-semibold text-foreground min-w-[12rem]">
                  Subject
                </th>
                {sales.map((sale, idx) => (
                  <th
                    key={sale.id}
                    className="px-3 py-2.5 font-semibold text-foreground min-w-[14rem] align-top"
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
              {/* Identity rows */}
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

              {/* Adjustment feature rows */}
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

              {/* Totals */}
              <tr className="border-b border-border bg-muted/40">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Net adjustment
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <td key={sale.id} className="px-3 py-2 font-medium">
                      {formatMoney(t.netAdjustment)}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border bg-muted/40">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Net adj. %
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <td key={sale.id} className="px-3 py-2">
                      {formatPct(t.netPct)}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border bg-muted/40">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Gross adj. %
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <td key={sale.id} className="px-3 py-2">
                      {formatPct(t.grossPct)}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border bg-muted/50">
                <td className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-semibold">
                  Adjusted sale price
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <td key={sale.id} className="px-3 py-2 font-semibold">
                      {formatMoney(t.adjustedSalePrice)}
                    </td>
                  );
                })}
              </tr>

              {/* Comments */}
              <tr className="border-b border-border">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Comments</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                {sales.map((sale) => (
                  <td key={sale.id} className="px-1 py-1 align-top">
                    <textarea
                      rows={3}
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
