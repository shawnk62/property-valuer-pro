import { PausedInput, PausedTextarea } from "./PausedTextarea";
import {
  buildLeaseSummaryRow,
  buildSaleSummaryRow,
  patchSummaryOverride,
  printedLeases,
  type EvidenceSummaryKind,
  type EvidenceSummaryRow,
  type SummaryOverrideKey,
} from "./commercialEvidenceSummary";
import type { SheetPools } from "./comparableSheetHelpers";
import type {
  ComparableSale,
  EvidenceSummaryOverrides,
  InspectionValues,
  ReportMeta,
} from "@/lib/report/types";
import { salesOnReport } from "@/lib/report/types";

const SALE_HEADERS = [
  "No.",
  "Address",
  "Sale price",
  "Sale date",
  "Building area",
  "Price/m² bldg",
  "Land area",
  "Price/m² land",
  "Indicated yield",
  "Overall rating",
] as const;

const LEASE_HEADERS = [
  "No.",
  "Address",
  "Lease amount",
  "Lease date",
  "Building area",
  "Price/m² bldg",
  "Land area",
  "Price/m² land",
  "Indicated yield",
  "Overall rating",
] as const;

const COL_CLASSES = [
  "ci-col-num",
  "ci-col-address",
  "ci-col-price",
  "ci-col-date",
  "ci-col-bldg",
  "ci-col-bldg-rate",
  "ci-col-land",
  "ci-col-land-rate",
  "ci-col-yield",
  "ci-col-rating",
] as const;

const EDIT_KEYS: SummaryOverrideKey[] = [
  "price",
  "date",
  "buildingArea",
  "pricePerM2Building",
  "landArea",
  "pricePerM2Land",
  "indicatedYield",
  "overallRating",
];

const INPUT_CLASS =
  "w-full min-w-0 rounded border border-slate-300 bg-white px-1 py-0.5 text-[0.7rem] text-slate-800";

function fieldValue(row: EvidenceSummaryRow, key: SummaryOverrideKey): string {
  return row[key];
}

export function CommercialEvidenceSummaryEditor({
  kind,
  sales,
  leases,
  values,
  meta,
  pools,
  onSalePatch,
  onLeasePatch,
}: {
  kind: EvidenceSummaryKind;
  sales?: ComparableSale[];
  leases?: NonNullable<ReportMeta["ciLeaseComps"]>;
  values: InspectionValues;
  meta: ReportMeta;
  pools: SheetPools;
  onSalePatch?: (id: string, summaryOverrides: EvidenceSummaryOverrides) => void;
  onLeasePatch?: (id: string, summaryOverrides: EvidenceSummaryOverrides) => void;
}) {
  const records =
    kind === "sales"
      ? salesOnReport(sales).map((sale, idx) => ({
          row: buildSaleSummaryRow(sale, idx + 1, meta, pools),
          overrides: sale.summaryOverrides,
        }))
      : printedLeases(leases).map((lease, idx) => ({
          row: buildLeaseSummaryRow(lease, idx + 1, values, meta, pools),
          overrides: lease.summaryOverrides,
        }));
  if (records.length === 0) return null;

  const headers = kind === "sales" ? SALE_HEADERS : LEASE_HEADERS;
  const title = kind === "sales" ? "Sales evidence summary" : "Lease evidence summary";
  const photoAlt = kind === "sales" ? "Comparable" : "Lease comparable";

  function commit(id: string, current: EvidenceSummaryOverrides | undefined, key: SummaryOverrideKey, value: string) {
    const next = patchSummaryOverride(current, key, value);
    if (kind === "sales") onSalePatch?.(id, next);
    else onLeasePatch?.(id, next);
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Figures fill from the comparable record, linked evidence and the subject’s indicated value.
          Every cell stays editable. Comments come from the full-page sheet description.
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="sales-evidence-list min-w-[52rem] space-y-3">
          {records.map(({ row, overrides }) => (
            <table
              key={row.id}
              className="sales-evidence-item sales-evidence-ci w-full border-collapse text-[0.8125rem]"
            >
              <colgroup>
                {COL_CLASSES.map((cls) => (
                  <col key={cls} className={cls} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="border border-slate-300 bg-[#324758] px-2 py-1.5 text-left font-semibold text-white"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-2 py-1.5 align-top whitespace-nowrap font-semibold">
                    {row.number}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 align-top">{row.address || "—"}</td>
                  {EDIT_KEYS.map((key) => (
                    <td key={key} className="border border-slate-300 px-1 py-1 align-top">
                      <PausedInput
                        className={INPUT_CLASS}
                        value={fieldValue(row, key)}
                        onCommit={(value) => commit(row.id, overrides, key, value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-slate-300 px-2 py-1.5 align-top" colSpan={2}>
                    {row.photoUrl ? (
                      <img
                        src={row.photoUrl}
                        alt={`${photoAlt} ${row.number}`}
                        className="mx-auto block h-auto max-h-36 w-full object-contain"
                      />
                    ) : (
                      <span className="text-[0.7rem] text-slate-400">No photo</span>
                    )}
                  </td>
                  <td className="border border-slate-300 px-1 py-1 align-top" colSpan={8}>
                    <PausedTextarea
                      className="min-h-[5rem] w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[0.75rem] leading-relaxed text-slate-800"
                      value={row.comments}
                      placeholder="Comments (from the full-page sheet description)"
                      onCommit={(value) => commit(row.id, overrides, "comments", value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>
      </div>
    </div>
  );
}
