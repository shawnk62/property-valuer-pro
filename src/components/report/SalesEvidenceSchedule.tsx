import type { CSSProperties } from "react";
import {
  comparableSiteRate,
  computeSaleAdjustmentTotals,
} from "@/lib/report/adjustmentGrid";
import { cleanSaleProse, formatSalePrice } from "@/lib/report/salesRelativity";
import { printedSaleComment } from "@/lib/report/sourceNotes";
import { formatNarrativeDateOr } from "@/lib/report/dates";
import type { ComparableSale } from "@/lib/report/types";

const HEADERS = [
  "No.",
  "Address",
  "Land area",
  "Sale price",
  "Rate",
  "Sale date",
  "Rating",
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
    .replace(/\bsquare meters\b/gi, "square metres")
    .replace(/\bsquare meter\b/gi, "square metres")
    .replace(/\b(\d+)\s*m2\b/gi, "$1 m²");
}
function saleRating(sale: ComparableSale): string {
  const chosen = sale.printRating?.trim();
  if (chosen) return chosen;
  const net = computeSaleAdjustmentTotals(sale).netAdjustment;
  if (!Number.isFinite(net) || net === 0) return "Similar";
  return net < 0 ? "Superior" : "Inferior";
}

/**
 * Printed sales schedule without dollar adjustments.
 * Column set follows the comparable-sales table; colours and type follow the report style.
 */
export function SalesEvidenceSchedule({
  sales,
  headerClassName,
  headerStyle,
  cellBorderClassName = "border border-[var(--rule)]",
  cellStyle,
  omitSourceNotes = false,
}: {
  sales: ComparableSale[];
  headerClassName?: string;
  headerStyle?: CSSProperties;
  cellBorderClassName?: string;
  cellStyle?: CSSProperties;
  /** Shawn reports: source notes are internal and must not print. */
  omitSourceNotes?: boolean;
}) {
  if (sales.length === 0) return null;
  const cell = `${cellBorderClassName} px-2 py-1.5 align-top`;
  return (
    <div className="sales-evidence-list space-y-3">
      {sales.map((s, idx) => {
        const site = comparableSiteRate(s);
        const comment = omitSourceNotes
          ? printedSaleComment(s)
          : s.narrative?.trim() || s.comments || "";
        const commentParagraphs = comment
          .replace(/\r\n/g, "\n")
          .split(/\n+/)
          .map((part) => printedComment(cleanSaleProse(part)))
          .filter(Boolean);
        return (
          <table
            key={s.id}
            className="sales-evidence-item w-full border-collapse text-[0.8125rem]"
          >
            <colgroup>
              <col className="sales-col-num" />
              <col className="sales-col-address" />
              <col className="sales-col-area" />
              <col className="sales-col-price" />
              <col className="sales-col-rate" />
              <col className="sales-col-date" />
              <col className="sales-col-rating" />
            </colgroup>
            <thead>
              <tr className={headerClassName} style={headerStyle}>
                {HEADERS.map((h) => (
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
                <td className={`${cell} whitespace-nowrap font-semibold`} style={cellStyle}>
                  {idx + 1}
                </td>
                <td className={cell} style={cellStyle}>
                  {printedAddress(s.address)}
                </td>
                <td className={`${cell} whitespace-nowrap`} style={cellStyle}>
                  {site.area}
                </td>
                <td className={`${cell} whitespace-nowrap`} style={cellStyle}>
                  {formatSalePrice(s.salePrice) || "—"}
                </td>
                <td className={`${cell} sales-rate-cell`} style={cellStyle}>
                  {site.rate}
                </td>
                <td className={`${cell} sales-date-cell`} style={cellStyle}>
                  {formatNarrativeDateOr(s.saleDate, s.saleDate || "—")}
                </td>
                <td className={`${cell} whitespace-nowrap`} style={cellStyle}>
                  {saleRating(s)}
                </td>
              </tr>
              {s.photoUrl || commentParagraphs.length ? (
                <tr>
                  <td className={cell} style={cellStyle} colSpan={2}>
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={`Comparable ${idx + 1}`}
                        className="mx-auto block h-auto max-h-36 w-full object-contain"
                      />
                    ) : null}
                  </td>
                  <td className={cell} style={cellStyle} colSpan={5}>
                    {commentParagraphs.map((part, i) => (
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
