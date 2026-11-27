import type { CSSProperties } from "react";
import {
  buildLeaseSummaryRow,
  buildSaleSummaryRow,
  printedLeases,
  printDate,
  type EvidenceSummaryKind,
  type EvidenceSummaryRow,
} from "./commercialEvidenceSummary";
import type { SheetPools } from "./comparableSheetHelpers";
import { cleanSaleProse } from "@/lib/report/salesRelativity";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import { salesOnReport } from "@/lib/report/types";

const SALE_HEADERS = [
  "No.",
  "Address",
  "Sale price",
  "Sale date",
  "Distance",
  "Building area",
  "Price/m² bldg",
  "Land area",
  "Price/m² land",
  "Indicated yield",
  "Rating",
] as const;

const LEASE_HEADERS = [
  "No.",
  "Address",
  "Date",
  "Distance",
  "Land area",
  "Building area",
  "Lease amount",
  "Rent/m²",
  "Basis",
  "Term",
] as const;

const COL_CLASSES = [
  "ci-col-num",
  "ci-col-address",
  "ci-col-price",
  "ci-col-date",
  "ci-col-distance",
  "ci-col-bldg",
  "ci-col-bldg-rate",
  "ci-col-land",
  "ci-col-land-rate",
  "ci-col-yield",
  "ci-col-rating",
] as const;

function printedAddress(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "—";
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bQld\b/g, "QLD");
}

function printedComment(raw: string): string {
  return raw
    .replace(/\b(\d+)\s+square metres\b/gi, "$1 square metre")
    .replace(/\bsquare meters\b/gi, "square metres")
    .replace(/\bsquare meter\b/gi, "square metre")
    .replace(/\b(\d+)\s*m2\b/gi, "$1 m²");
}

function commentParagraphs(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((part) => printedComment(cleanSaleProse(part)))
    .filter(Boolean);
}

function dash(value: string): string {
  return value.trim() ? value : "—";
}

/**
 * Printed commercial/industrial sales or lease evidence summary.
 * One mini-table per comparable, matching SalesEvidenceSchedule pagination
 * and Shawn exam header/border styling, with the commercial column set.
 */
export function CommercialEvidenceSchedule({
  kind,
  sales,
  leases,
  values,
  meta,
  pools,
  headerClassName,
  headerStyle,
  cellBorderClassName = "border border-[var(--rule)]",
  cellStyle,
}: {
  kind: EvidenceSummaryKind;
  sales?: ComparableSale[];
  leases?: ReportMeta["ciLeaseComps"];
  values: InspectionValues;
  meta: ReportMeta;
  pools: SheetPools;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  cellBorderClassName?: string;
  cellStyle?: CSSProperties;
}) {
  const rows: EvidenceSummaryRow[] =
    kind === "sales"
      ? salesOnReport(sales).map((sale, idx) => buildSaleSummaryRow(sale, idx + 1, meta, pools))
      : printedLeases(leases).map((lease, idx) => buildLeaseSummaryRow(lease, idx + 1, values, meta, pools));
  if (rows.length === 0) return null;

  const headers = kind === "sales" ? SALE_HEADERS : LEASE_HEADERS;
  const cell = `${cellBorderClassName} px-2 py-1.5 align-top`;
  const label = kind === "sales" ? "Comparable" : "Lease comparable";

  return (
    <div className="sales-evidence-list space-y-3">
      {rows.map((row) => {
        const comments = commentParagraphs(row.comments);
        const valuesRow = kind === "leases"
          ? [
              row.number,
              printedAddress(row.address),
              printDate(row.date),
              dash(row.proximity),
              dash(row.landArea),
              dash(row.buildingArea),
              dash(row.price),
              dash(row.pricePerM2Building),
              dash(row.rentBasis ?? ""),
              dash(row.term ?? ""),
            ]
          : [
              row.number,
              printedAddress(row.address),
              dash(row.price),
              printDate(row.date),
              dash(row.proximity),
              dash(row.buildingArea),
              dash(row.pricePerM2Building),
              dash(row.landArea),
              dash(row.pricePerM2Land),
              dash(row.indicatedYield),
              dash(row.overallRating === "Superior" ? "Sup" : row.overallRating === "Inferior" ? "Inf" : row.overallRating === "Similar" ? "Sim" : row.overallRating),
            ];
        return (
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
              <tr className={headerClassName} style={headerStyle}>
                {headers.map((h) => (
                  <th
                    key={h}
                    className={`${cellBorderClassName} px-2 py-1.5 text-left font-semibold`}
                    style={cellStyle}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {valuesRow.map((value, i) => (
                  <td
                    key={COL_CLASSES[i]}
                    className={`${cell}${i === 0 ? " whitespace-nowrap font-semibold" : i === 2 || i === 4 || i === 10 ? " whitespace-nowrap" : i === 3 || i === 5 || i === 7 || i === 8 ? " ci-wrap-cell" : ""}`}
                    style={cellStyle}
                  >
                    {value}
                  </td>
                ))}
              </tr>
              {row.photoUrl || comments.length ? (
                <tr>
                  <td className={cell} style={cellStyle} colSpan={2}>
                    {row.photoUrl ? (
                      <img
                        src={row.photoUrl}
                        alt={`${label} ${row.number}`}
                        className="mx-auto block h-auto max-h-36 w-full object-contain"
                      />
                    ) : null}
                  </td>
                  <td className={cell} style={cellStyle} colSpan={kind === "leases" ? 8 : 9}>
                    {comments.map((part, i) => (
                      <p key={i} className="report-prose-para text-left leading-relaxed">
                        {part}
                      </p>
                    ))}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
