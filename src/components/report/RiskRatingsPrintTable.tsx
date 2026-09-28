import {
  parseRiskScore,
  RISK_CATEGORIES,
  RISK_SCALE,
  type RiskCategoryId,
} from "@/lib/report/propertyRiskRatings";
import type { InspectionValues } from "@/lib/inspection/types";

const PRINT_LABEL: Record<RiskCategoryId, string> = {
  location: "Location / Neighbourhood",
  land: "Land (including planning & title)",
  environment: "Environmental issues",
  improvements: "Improvements",
  market_direction: "Recent market direction (price)",
  volatility: "Market volatility",
  local_economy: "Local economy impact",
  segment: "Market segment conditions",
};

/**
 * Kelly Style-3 print table. Working-screen panel is unchanged.
 * Shade 1 through the selected score using brand fill.
 */
export function RiskRatingsPrintTable({ values }: { values: InspectionValues }) {
  return (
    <div className="report-table-keep risk-ratings-print risk-ratings-print--style3">
      <table>
        <colgroup>
          <col className="risk-print-label" />
          {RISK_SCALE.map((col) => (
            <col key={col.score} className="risk-print-band" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Risk Rating Category</th>
            {RISK_SCALE.map((col) => (
              <th key={col.score}>{col.score}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RISK_CATEGORIES.map((cat, i) => {
            const selected = parseRiskScore(values[cat.field]);
            return (
              <tr key={cat.id} className={i % 2 === 0 ? "is-stripe" : undefined}>
                <th scope="row">{PRINT_LABEL[cat.id]}</th>
                {RISK_SCALE.map((col) => (
                  <td
                    key={col.score}
                    className={
                      selected && col.score <= selected ? "is-filled" : undefined
                    }
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
