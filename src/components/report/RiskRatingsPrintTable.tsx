import {
  parseRiskScore,
  RISK_CATEGORIES,
  RISK_SCALE,
  type RiskCategoryId,
} from "@/lib/report/propertyRiskRatings";
import type { InspectionValues } from "@/lib/inspection/types";

const PRINT_LABEL: Record<RiskCategoryId, string> = {
  location: "Location/neighbourhood",
  land: "Land (including planning & title)",
  environment: "Environmental issues",
  improvements: "Improvements",
  market_direction: "Recent market direction (price)",
  volatility: "Market volatility",
  local_economy: "Local economy impact",
  segment: "Market segment conditions",
};

const FILL = "#7ec8d9";

/**
 * PropertyPRO-style print table. Working-screen RiskRatingsPanel is unchanged.
 * Cells 1 through the selected score are shaded; empty if no score is recorded.
 */
export function RiskRatingsPrintTable({ values }: { values: InspectionValues }) {
  return (
    <div className="report-table-keep risk-ratings-print">
      <table>
        <colgroup>
          <col className="risk-print-label" />
          {RISK_SCALE.map((col) => (
            <col key={col.score} className="risk-print-band" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th colSpan={6}>Property Risk Ratings</th>
          </tr>
          <tr>
            <th>Risk rating</th>
            {RISK_SCALE.map((col) => (
              <th key={col.score}>
                <span className="risk-print-num">{col.score}.</span>
                <span className="risk-print-band-label">{col.label.toLowerCase()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RISK_CATEGORIES.map((cat) => {
            const selected = parseRiskScore(values[cat.field]);
            return (
              <tr key={cat.id}>
                <th scope="row">{PRINT_LABEL[cat.id]}</th>
                {RISK_SCALE.map((col) => (
                  <td
                    key={col.score}
                    style={
                      selected && col.score <= selected
                        ? { background: FILL }
                        : undefined
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
