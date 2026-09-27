import { useState } from "react";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import {
  hintForCategory,
  parseRiskScore,
  RISK_CATEGORIES,
  RISK_SCALE,
  type RiskCategory,
  type RiskScore,
} from "@/lib/report/propertyRiskRatings";

export function RiskRatingsPanel({ controller }: { controller: ReportDraftController }) {
  const { draft, setValue } = controller;
  const [openId, setOpenId] = useState<string | null>(RISK_CATEGORIES[0]?.id ?? null);

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Property risk ratings</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap a score. Criteria for that heading appear below. Suggested bands come from flood,
        overlays and inspection notes — they do not set the score.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border py-2 pr-2 text-left font-medium">Heading</th>
              {RISK_SCALE.map((col) => (
                <th
                  key={col.score}
                  className="border-b border-border px-1 py-2 text-center font-medium"
                >
                  <div>{col.score}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">{col.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RISK_CATEGORIES.map((cat) => (
              <RiskRow
                key={cat.id}
                category={cat}
                selected={parseRiskScore(draft.values[cat.field])}
                hint={hintForCategory(cat, draft.values)}
                active={openId === cat.id}
                onFocus={() => setOpenId(cat.id)}
                onSelect={(score) => {
                  setOpenId(cat.id);
                  setValue(cat.field, String(score));
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {RISK_CATEGORIES.filter((c) => c.id === openId).map((cat) => (
        <CriteriaCard
          key={cat.id}
          category={cat}
          selected={parseRiskScore(draft.values[cat.field])}
          hint={hintForCategory(cat, draft.values)}
        />
      ))}
    </section>
  );
}

function RiskRow({
  category,
  selected,
  hint,
  active,
  onFocus,
  onSelect,
}: {
  category: RiskCategory;
  selected: RiskScore | null;
  hint: ReturnType<typeof hintForCategory>;
  active: boolean;
  onFocus: () => void;
  onSelect: (score: RiskScore) => void;
}) {
  return (
    <tr className={active ? "bg-muted/40" : undefined}>
      <th className="border-b border-border py-2 pr-2 text-left font-normal">
        <button type="button" className="text-left" onClick={onFocus}>
          {category.heading}
        </button>
        {hint ? (
          <div className="mt-0.5 text-[11px] text-sky-800">
            Suggested {hint.min}
            {hint.max !== hint.min ? `–${hint.max}` : ""}
          </div>
        ) : null}
      </th>
      {RISK_SCALE.map((col) => {
        const on = selected === col.score;
        const inHint =
          hint != null && col.score >= hint.min && col.score <= hint.max;
        return (
          <td key={col.score} className="border-b border-border px-1 py-1 text-center">
            <button
              type="button"
              aria-label={`${category.heading} ${col.score} ${col.label}`}
              onClick={() => onSelect(col.score)}
              className={
                "h-9 w-full rounded-sm border text-sm " +
                (on
                  ? "border-sky-700 bg-sky-200 font-semibold text-sky-950"
                  : inHint
                    ? "border-sky-300 bg-sky-50 text-sky-900"
                    : "border-transparent bg-transparent text-foreground hover:bg-muted")
              }
            >
              {col.score}
            </button>
          </td>
        );
      })}
    </tr>
  );
}

function CriteriaCard({
  category,
  selected,
  hint,
}: {
  category: RiskCategory;
  selected: RiskScore | null;
  hint: ReturnType<typeof hintForCategory>;
}) {
  return (
    <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
      <p className="font-medium">{category.heading}</p>
      <p className="mt-1 text-muted-foreground">{category.purpose}</p>
      {hint ? (
        <p className="mt-2 text-sky-800">
          Suggested band {hint.min}
          {hint.max !== hint.min ? `–${hint.max}` : ""}: {hint.reason}. This is not a score.
        </p>
      ) : (
        <p className="mt-2 text-muted-foreground">
          No overlay or inspection hint for this heading. Market headings are not hinted from maps.
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {RISK_SCALE.map((col) => (
          <li
            key={col.score}
            className={
              selected === col.score
                ? "rounded-sm bg-sky-100 px-2 py-1"
                : "px-2 py-1"
            }
          >
            <span className="font-medium">
              {col.score}. {col.label}
            </span>
            {" — "}
            {category.criteria[col.score].join(" ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
