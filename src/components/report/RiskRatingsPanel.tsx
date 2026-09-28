import { useMemo, useState } from "react";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import {
  buildRiskAnalysis,
  criteriaParagraph,
  hintForCategory,
  noteIsStock,
  parseRiskScore,
  RISK_CATEGORIES,
  RISK_SCALE,
  riskNoteField,
  scoreLabel,
  type RiskCategory,
  type RiskScore,
} from "@/lib/report/propertyRiskRatings";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function RiskRatingsPanel({ controller }: { controller: ReportDraftController }) {
  const { draft, setValue, setNarrative } = controller;
  const [openId, setOpenId] = useState<string | null>(null);

  const openCat = useMemo(
    () => RISK_CATEGORIES.find((c) => c.id === openId) ?? null,
    [openId],
  );

  function rebuildCombined(values: typeof draft.values) {
    const next = buildRiskAnalysis(values);
    const current = String(draft.narrative.riskAnalysis ?? "").trim();
    const previousAuto = buildRiskAnalysis(draft.values).trim();
    if (!current || current === previousAuto) {
      setNarrative({ riskAnalysis: next });
    }
  }

  function applyBand(cat: RiskCategory, score: RiskScore) {
    const noteKey = riskNoteField(cat.id);
    const existing = String(draft.values[noteKey] ?? "");
    const seed = criteriaParagraph(cat, score);
    const nextNote = noteIsStock(cat, existing) ? seed : existing;
    setValue(cat.field, String(score));
    if (nextNote !== existing) setValue(noteKey, nextNote);
    rebuildCombined({
      ...draft.values,
      [cat.field]: String(score),
      [noteKey]: nextNote,
    });
    setOpenId(null);
  }

  function saveNote(cat: RiskCategory, text: string) {
    const noteKey = riskNoteField(cat.id);
    setValue(noteKey, text);
    rebuildCombined({
      ...draft.values,
      [noteKey]: text,
    });
  }

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Property risk ratings</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap a heading to open the API criteria for that row. Tap the band that applies. That
        wording is copied into the comment for the heading. Edited comments are not overwritten.
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
                onOpen={() => setOpenId(cat.id)}
                onSelect={(score) => applyBand(cat, score)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        {RISK_CATEGORIES.map((cat) => {
          const score = parseRiskScore(draft.values[cat.field]);
          const note = String(draft.values[riskNoteField(cat.id)] ?? "");
          if (!score && !note.trim()) return null;
          return (
            <label key={cat.id} className="block text-sm">
              <span className="font-medium text-foreground">
                {cat.heading}
                {score ? ` — ${score} ${scoreLabel(score)}` : ""}
              </span>
              <textarea
                className="mt-1 min-h-[4.5rem] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={note}
                onChange={(e) => saveNote(cat, e.target.value)}
              />
            </label>
          );
        })}
      </div>

      <Sheet open={openCat != null} onOpenChange={(on) => !on && setOpenId(null)}>
        {openCat ? (
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{openCat.heading}</SheetTitle>
              <SheetDescription>{openCat.purpose}</SheetDescription>
            </SheetHeader>
            <OpenHint category={openCat} values={draft.values} />
            <ul className="mt-4 space-y-2">
              {RISK_SCALE.map((col) => {
                const selected = parseRiskScore(draft.values[openCat.field]) === col.score;
                const hint = hintForCategory(openCat, draft.values);
                const inHint =
                  hint != null && col.score >= hint.min && col.score <= hint.max;
                return (
                  <li key={col.score}>
                    <button
                      type="button"
                      onClick={() => applyBand(openCat, col.score)}
                      className={
                        "w-full rounded-md border px-3 py-2 text-left text-sm " +
                        (selected
                          ? "border-sky-700 bg-sky-100"
                          : inHint
                            ? "border-sky-300 bg-sky-50"
                            : "border-border bg-background hover:bg-muted")
                      }
                    >
                      <div className="font-semibold">
                        {col.score}. {col.label}
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {openCat.criteria[col.score].map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
    </section>
  );
}

function OpenHint({
  category,
  values,
}: {
  category: RiskCategory;
  values: ReportDraftController["draft"]["values"];
}) {
  const hint = hintForCategory(category, values);
  if (!hint) return null;
  return (
    <p className="mt-3 text-sm text-sky-800">
      Suggested band {hint.min}
      {hint.max !== hint.min ? `–${hint.max}` : ""}: {hint.reason}. This does not set the score.
    </p>
  );
}

function RiskRow({
  category,
  selected,
  hint,
  onOpen,
  onSelect,
}: {
  category: RiskCategory;
  selected: RiskScore | null;
  hint: ReturnType<typeof hintForCategory>;
  onOpen: () => void;
  onSelect: (score: RiskScore) => void;
}) {
  return (
    <tr>
      <th className="border-b border-border py-2 pr-2 text-left font-normal">
        <button type="button" className="text-left font-medium underline-offset-2 hover:underline" onClick={onOpen}>
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
        const inHint = hint != null && col.score >= hint.min && col.score <= hint.max;
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
