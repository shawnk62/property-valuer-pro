import type { CSSProperties } from "react";
import { cleanSaleProse } from "@/lib/report/salesRelativity";
import type { ComparableSale } from "@/lib/report/types";

const HEADERS = ["#", "Address", "Sale date", "Sale price", "Land area", "Comments"] as const;

/**
 * One mini-table per comparable so printed columns stay aligned down the list.
 * Date / price / area are fixed minimum widths; comments take the remainder.
 */
export function SalesEvidenceSchedule({
  sales,
  headerClassName,
  headerStyle,
  cellBorderClassName = "border border-[var(--rule)]",
  cellStyle,
}: {
  sales: ComparableSale[];
  headerClassName?: string;
  headerStyle?: CSSProperties;
  cellBorderClassName?: string;
  cellStyle?: CSSProperties;
}) {
  if (sales.length === 0) return null;
  return (
    <div className="sales-evidence-list space-y-3">
      {sales.map((s, idx) => (
        <table
          key={s.id}
          className="sales-evidence-item w-full border-collapse text-[0.8125rem]"
        >
          <colgroup>
            <col className="sales-col-num" />
            <col className="sales-col-address" />
            <col className="sales-col-date" />
            <col className="sales-col-price" />
            <col className="sales-col-area" />
            <col className="sales-col-comments" />
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
            <tr className="align-top">
              <td
                className={`${cellBorderClassName} px-2 py-1.5 whitespace-nowrap font-semibold`}
                style={cellStyle}
              >
                {idx + 1}
              </td>
              <td className={`${cellBorderClassName} px-2 py-1.5`} style={cellStyle}>
                <div>{s.address}</div>
                {s.photoUrl ? (
                  <img
                    src={s.photoUrl}
                    alt={`Comparable ${idx + 1}`}
                    className="mt-1.5 h-12 w-auto max-w-[5.5rem] border border-[var(--rule)] object-cover"
                    style={
                      cellStyle?.borderColor
                        ? { border: `1px solid ${String(cellStyle.borderColor)}` }
                        : undefined
                    }
                  />
                ) : null}
              </td>
              <td
                className={`${cellBorderClassName} px-2 py-1.5 whitespace-nowrap`}
                style={cellStyle}
              >
                {s.saleDate}
              </td>
              <td
                className={`${cellBorderClassName} px-2 py-1.5 whitespace-nowrap`}
                style={cellStyle}
              >
                {s.salePrice}
              </td>
              <td
                className={`${cellBorderClassName} px-2 py-1.5 whitespace-nowrap`}
                style={cellStyle}
              >
                {s.landArea}
              </td>
              <td className={`${cellBorderClassName} px-2 py-1.5`} style={cellStyle}>
                {cleanSaleProse(s.narrative?.trim() || s.comments || "")}
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}
