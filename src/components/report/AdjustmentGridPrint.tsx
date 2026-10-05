import { Fragment } from "react";
import {
  adjustmentFeaturesForProperty,
  adjustmentRowPrints,
  computeSaleAdjustmentTotals,
  detailLooksLikeSaleDate,
  formatAdjustmentMoney,
  formatMoney,
  formatAreaWithSqm,
  subjectAskingPriceDisplay,
  subjectFeatureDisplay,
  subjectSiteSizeDisplay,
  subjectTopographyDisplay,
} from "@/lib/report/adjustmentGrid";
import { formatSalePrice } from "@/lib/report/salesRelativity";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";

const COMPS_PER_BLOCK = 3;

function adjOf(sale: ComparableSale, featureId: string) {
  return sale.adjustments?.[featureId];
}

function emptySaleCells(chunkIdx: number, row: string, count: number) {
  return Array.from({ length: COMPS_PER_BLOCK - count }, (_, i) => (
    <Fragment key={`empty-${chunkIdx}-${row}-${i}`}>
      <td />
      <td />
    </Fragment>
  ));
}

function moneyCell(amount: number | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return formatAdjustmentMoney(amount);
}

/**
 * Printed sales-comparison adjustment grid. Working-grid controls stay off the page.
 */
export function AdjustmentGridPrint({
  sales,
  values,
  meta,
  subjectAddress,
}: {
  sales: ComparableSale[];
  values: InspectionValues;
  meta: ReportMeta;
  subjectAddress: string;
}) {
  if (sales.length === 0) return null;
  const features = adjustmentFeaturesForProperty(values).filter(
    (f) => f.id !== "dateOfSale" && adjustmentRowPrints(meta, f.id),
  );
  const chunks: ComparableSale[][] = [];
  for (let i = 0; i < sales.length; i += COMPS_PER_BLOCK) {
    chunks.push(sales.slice(i, i + COMPS_PER_BLOCK));
  }

  return (
    <div className="adjustment-print-grid space-y-5">
      {chunks.map((chunk, chunkIdx) => (
        <div key={`adj-print-${chunkIdx}`} className="report-table-keep">
          <table className="w-full table-fixed border-collapse text-[0.75rem]">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              {Array.from({ length: COMPS_PER_BLOCK }, (_, i) => (
                <Fragment key={`cols-${chunkIdx}-${i}`}>
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Subject</th>
                {Array.from({ length: COMPS_PER_BLOCK }, (_, i) => {
                  const sale = chunk[i];
                  return (
                    <Fragment key={sale?.id ?? `empty-head-${chunkIdx}-${i}`}>
                      <th>{sale ? `Sale ${chunkIdx * COMPS_PER_BLOCK + i + 1}` : ""}</th>
                      <th className="adj-money">{sale ? "Adjustment" : ""}</th>
                    </Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Address</th>
                <td>{subjectAddress || "—"}</td>
                {chunk.map((sale) => (
                  <Fragment key={sale.id}>
                    <td>{sale.address || "—"}</td>
                    <td className="adj-money" />
                  </Fragment>
                ))}
                {emptySaleCells(chunkIdx, "address", chunk.length)}
              </tr>
              <tr>
                <th scope="row">Sale Price</th>
                <td>{subjectAskingPriceDisplay(values, meta.subjectAskingPrice) || "—"}</td>
                {chunk.map((sale) => (
                  <Fragment key={sale.id}>
                    <td>{formatSalePrice(sale.salePrice) || "—"}</td>
                    <td className="adj-money" />
                  </Fragment>
                ))}
                {emptySaleCells(chunkIdx, "price", chunk.length)}
              </tr>
              <tr className="is-stripe">
                <th scope="row">Date of Sale</th>
                <td>—</td>
                {chunk.map((sale) => (
                  <Fragment key={sale.id}>
                    <td>{sale.saleDate || "—"}</td>
                    <td className="adj-money">{moneyCell(adjOf(sale, "dateOfSale")?.amount)}</td>
                  </Fragment>
                ))}
                {emptySaleCells(chunkIdx, "date", chunk.length)}
              </tr>
              {features.map((feature, idx) => (
                <tr key={feature.id} className={idx % 2 === 0 ? "is-stripe" : undefined}>
                  <th scope="row">{feature.label}</th>
                  <td>
                    {feature.id === "other1"
                      ? meta.subjectOther1 || "—"
                      : feature.id === "other2"
                        ? meta.subjectOther2 || "—"
                        : feature.id === "site"
                          ? subjectSiteSizeDisplay(values)
                          : feature.id === "topography"
                            ? subjectTopographyDisplay(values, meta.subjectTopography)
                            : subjectFeatureDisplay(feature, values) || "—"}
                  </td>
                  {chunk.map((sale) => {
                    const adj = adjOf(sale, feature.id);
                    let detail = (adj?.detail ?? "").trim();
                    if (feature.id === "site") {
                      detail = formatAreaWithSqm(detail || sale.landArea);
                    } else if (
                      feature.id === "saleOrFinancing" &&
                      detailLooksLikeSaleDate(detail, sale.saleDate)
                    ) {
                      detail = "";
                    }
                    const shown =
                      feature.id === "site"
                        ? detail
                        : [detail, adj?.relativity].filter(Boolean).join(" · ") || "similar";
                    return (
                      <Fragment key={sale.id}>
                        <td>{shown}</td>
                        <td className="adj-money">{moneyCell(adj?.amount)}</td>
                      </Fragment>
                    );
                  })}
                  {emptySaleCells(chunkIdx, feature.id, chunk.length)}
                </tr>
              ))}
              <tr>
                <th scope="row">Net adjustment</th>
                <td />
                {chunk.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <Fragment key={sale.id}>
                      <td />
                      <td className="adj-money">{formatAdjustmentMoney(t.netAdjustment)}</td>
                    </Fragment>
                  );
                })}
                {emptySaleCells(chunkIdx, "net", chunk.length)}
              </tr>
              <tr className="is-stripe">
                <th scope="row">Gross adjustment</th>
                <td />
                {chunk.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <Fragment key={sale.id}>
                      <td />
                      <td className="adj-money">{formatAdjustmentMoney(t.grossAdjustment)}</td>
                    </Fragment>
                  );
                })}
                {emptySaleCells(chunkIdx, "gross", chunk.length)}
              </tr>
              <tr>
                <th scope="row">Adjusted sale price</th>
                <td />
                {chunk.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <Fragment key={sale.id}>
                      <td />
                      <td className="adj-money">
                        {t.adjustedSalePrice == null
                          ? "—"
                          : formatMoney(Math.abs(t.adjustedSalePrice))}
                      </td>
                    </Fragment>
                  );
                })}
                {emptySaleCells(chunkIdx, "adjusted", chunk.length)}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
