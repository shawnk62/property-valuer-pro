/**
 * Printed land sales evidence summary for the cost approach.
 * Same layout pattern as the commercial sales and lease schedules:
 * one mini-table per land sale, with photo and comments underneath.
 */
import type { CSSProperties } from "react";
import type { ReportMeta } from "@/lib/report/types";

type LandSale = NonNullable<ReportMeta["ciLandSales"]>[number];

const HEADERS = ["No.", "Address", "Price", "Date", "Land area", "Price/m²", "Distance", "Overall rating"] as const;

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function money(raw: string | undefined): string {
  const n = num(raw);
  if (n == null) return raw?.trim() || "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function areaText(sale: LandSale): string {
  if (!sale.landArea?.trim()) return "—";
  const unit = sale.landUnit === "ha" ? "ha" : "m²";
  return `${sale.landArea} ${unit}`;
}

function pricePerM2(sale: LandSale): string {
  const p = num(sale.price);
  let a = num(sale.landArea);
  if (sale.landUnit === "ha" && a != null) a *= 10000;
  if (p == null || a == null || a <= 0) return "—";
  return (p / a).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }) + "/m²";
}

function printedAddress(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "—";
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase()).replace(/\bQld\b/g, "QLD");
}

function suggested(saleRate: string, subjectRate?: string): string {
  const sale = Number(String(saleRate).replace(/[^0-9.]/g, ""));
  const subject = Number(String(subjectRate ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(sale) || !Number.isFinite(subject) || sale <= 0 || subject <= 0) return "";
  if (Math.abs(sale - subject) / subject <= 0.02) return "Similar";
  return sale > subject ? "Superior" : "Inferior";
}

export function LandEvidenceSchedule({
  sales,
  subjectLandRate,
  headerStyle,
  cellStyle,
}: {
  sales: LandSale[];
  subjectLandRate?: string;
  headerStyle?: CSSProperties;
  cellStyle?: CSSProperties;
}) {
  const rows = sales.filter((s) => s.omitFromReport !== true && (s.address || s.price));
  if (rows.length === 0) return null;
  const cell = "border px-2 py-1.5 align-top";

  return (
    <div className="sales-evidence-list space-y-3">
      {rows.map((sale, idx) => {
        const comments = (sale.description || sale.notes || "").trim();
        const values = [
          String(idx + 1),
          printedAddress(sale.address),
          money(sale.price),
          sale.date?.trim() || "—",
          areaText(sale),
          pricePerM2(sale),
          sale.proximity?.trim() || "—",
          sale.overallRating?.trim() || suggested(pricePerM2(sale), subjectLandRate) || "—",
        ];
        return (
          <table key={sale.id} className="sales-evidence-item w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr style={headerStyle}>
                {HEADERS.map((h) => (
                  <th key={h} className={`${cell} text-left font-semibold`} style={cellStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {values.map((value, i) => (
                  <td key={HEADERS[i]} className={cell} style={cellStyle}>{value}</td>
                ))}
              </tr>
              {sale.photoUrl || comments ? (
                <tr>
                  <td className={cell} style={cellStyle} colSpan={2}>
                    {sale.photoUrl ? (
                      <img src={sale.photoUrl} alt={`Land sale ${idx + 1}`} className="mx-auto block h-auto max-h-36 w-full object-contain" />
                    ) : null}
                  </td>
                  <td className={cell} style={cellStyle} colSpan={6}>
                    {comments.split(/\n+/).filter(Boolean).map((para, i) => (
                      <p key={i} className={i > 0 ? "mt-2" : undefined}>{para}</p>
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
