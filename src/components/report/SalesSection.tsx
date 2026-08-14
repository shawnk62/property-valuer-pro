import type { ReportDraftController } from "@/hooks/useReportDraft";
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

  function patch(id: string, key: keyof ComparableSale, value: string) {
    setSales(sales.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sales evidence</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter sale prices and the valuation amount (Subject / meta). Comments auto-add
            “Overall inferior/superior to the subject” from price vs valuation. Cotality import later —
            sample SE QLD sales button below is for testing only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setSales(
                MOCK_COTALITY_SALES.map((s, i) => ({ ...s, id: `cotality-${i + 1}` })),
              )
            }
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Import from Cotality (mock)
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

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[56rem] border-collapse text-left">
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
                  No sales evidence yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
