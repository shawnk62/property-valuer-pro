import { Fragment } from "react";
import {
  ADJUSTMENT_FEATURES,
  adjustmentFeaturesForProperty,
  adjustmentRowPrints,
  computeSaleAdjustmentTotals,
  formatAdjustmentMoney,
  subjectFeatureDisplay,
} from "@/lib/report/adjustmentGrid";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";

const COMPS_PER_BLOCK = 3;

function adjOf(sale: ComparableSale, featureId: string) {
  return sale.adjustments?.[featureId];
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
          <table className="w-full border-collapse text-[0.75rem]">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Subject</th>
                {chunk.map((sale, i) => (
                  <Fragment key={sale.id}>
                    <th>
                      Sale {chunkIdx * COMPS_PER_BLOCK + i + 1}
                      {sale.address ? ` — ${sale.address}` : ""}
                    </th>
                    <th className="adj-money">$</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Sale date</th>
                <td>—</td>
                {chunk.map((sale) => (
                  <Fragment key={sale.id}>
                    <td>{sale.saleDate || "—"}</td>
                    <td className="adj-money">—</td>
                  </Fragment>
                ))}
              </tr>
              <tr className="is-stripe">
                <th scope="row">Sale price</th>
                <td>—</td>
                {chunk.map((sale) => (
                  <Fragment key={sale.id}>
                    <td>{sale.salePrice || "—"}</td>
                    <td className="adj-money">—</td>
                  </Fragment>
                ))}
              </tr>
              <tr>
                <th scope="row">Land area</th>
                <td>
                  {subjectFeatureDisplay(
                    ADJUSTMENT_FEATURES.find((f) => f.id === "site") ?? {
                      id: "site",
                      label: "Site",
                    },
                    values,
                  ) || "—"}
                </td>
                {chunk.map((sale) => (
                  <Fragment key={sale.id}>
                    <td>{sale.landArea || "—"}</td>
                    <td className="adj-money">—</td>
                  </Fragment>
                ))}
              </tr>
              {features.map((feature, idx) => (
                <tr key={feature.id} className={idx % 2 === 0 ? "is-stripe" : undefined}>
                  <th scope="row">{feature.label}</th>
                  <td>
                    {feature.id === "other1"
                      ? meta.subjectOther1 || "—"
                      : feature.id === "other2"
                        ? meta.subjectOther2 || "—"
                        : subjectFeatureDisplay(feature, values) || "—"}
                  </td>
                  {chunk.map((sale) => {
                    const adj = adjOf(sale, feature.id);
                    const detail = [adj?.detail, adj?.relativity].filter(Boolean).join(" · ");
                    return (
                      <Fragment key={sale.id}>
                        <td>{detail || "similar"}</td>
                        <td className="adj-money">{moneyCell(adj?.amount)}</td>
                      </Fragment>
                    );
                  })}
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
              </tr>
              <tr>
                <th scope="row">Adjusted sale price</th>
                <td>{subjectAddress || "—"}</td>
                {chunk.map((sale) => {
                  const t = computeSaleAdjustmentTotals(sale);
                  return (
                    <Fragment key={sale.id}>
                      <td />
                      <td className="adj-money">{formatAdjustmentMoney(t.adjustedSalePrice)}</td>
                    </Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
