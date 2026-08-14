import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { importSalesFromCsv } from "@/lib/report/importSalesCsv";
import { MOCK_COTALITY_SALES } from "@/lib/report/mock-sales";
import type { ComparableSale } from "@/lib/report/types";

const COLUMNS: { key: keyof Omit<ComparableSale, "id">; label: string; width: string }[] =
  [
    { key: "address", label: "Address", width: "w-[26%]" },
    { key: "saleDate", label: "Sale date", width: "w-[12%]" },
    { key: "salePrice", label: "Sale price", width: "w-[14%]" },
    { key: "landArea", label: "Land area", width: "w-[12%]" },
    { key: "comments", label: "Comments", width: "w-[36%]" },
  ];

function emptySale(): ComparableSale {
  return {
    id: `sale-${Math.random().toString(36).slice(2, 10)}`,
    address: "",
    saleDate: "",
    salePrice: "",
    landArea: "",
    comments: "",
  };
}

export function SalesSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setSales } = controller;
  const sales = draft.sales;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function patch(id: string, key: keyof ComparableSale, value: string) {
    setSales(sales.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
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

      // Replace existing list with imported rows (shared across all report types)
      setSales(result.sales);

      const mappedList = Object.entries(result.mapped)
        .map(([k, v]) => `${k}←${v}`)
        .join(", ");
      toast.success(`Imported ${result.sales.length} sale${result.sales.length === 1 ? "" : "s"}`, {
        description: [
          mappedList ? `Mapped: ${mappedList}` : null,
          result.skippedRows ? `Skipped ${result.skippedRows} empty row(s)` : null,
          result.warnings[0] ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
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
          <h3 className="text-sm font-semibold text-foreground">Sales evidence</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared for all report types. Import an RP Data CSV (sold search export), edit rows, then set
            the valuation amount so inferior/superior comments update automatically. How sales appear in
            the PDF depends on report type; this list does not.
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
              setSales(
                MOCK_COTALITY_SALES.map((s, i) => ({ ...s, id: `cotality-${i + 1}` })),
              )
            }
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Load sample sales
          </button>
          <button
            type="button"
            onClick={() => setSales([...sales, emptySale()])}
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Add sale
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${col.width} px-3 py-2.5 text-sm font-semibold text-foreground`}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-[4%] px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-b border-border last:border-0">
                {COLUMNS.map((col) => (
                  <td key={col.key} className="align-top">
                    <textarea
                      rows={col.key === "comments" ? 2 : 1}
                      value={sale[col.key]}
                      onChange={(e) => patch(sale.id, col.key, e.target.value)}
                      className="w-full resize-y bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus:bg-accent/40"
                    />
                  </td>
                ))}
                <td className="px-3 py-2.5 align-top">
                  <button
                    type="button"
                    onClick={() => setSales(sales.filter((s) => s.id !== sale.id))}
                    aria-label={`Remove ${sale.address || "sale"}`}
                    className="text-sm text-muted-foreground hover:text-destructive"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No sales evidence yet. Import a CSV from RP Data or add a row.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
