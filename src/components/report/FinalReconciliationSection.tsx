import type { ReportDraftController } from "@/hooks/useReportDraft";
import { PausedTextarea } from "@/components/report/PausedTextarea";
import { narrativePrints } from "@/lib/narrative/neighbourhoodAssist";
import {
  FINAL_LEASED,
  FINAL_VACANT,
  costApproachCalc,
  finalBoilerplate,
  marketApproachCalc,
  propertyIsLeased,
} from "@/lib/report/commercialCalculations";
import { formatCurrencyInput } from "@/lib/report/salesRelativity";

function money(raw: string | number | null | undefined): string {
  const n = Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? `$${n.toLocaleString("en-AU")}` : "—";
}

export function FinalReconciliationSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setMeta, setNarrative } = controller;
  const { reportMeta } = draft;
  const market = marketApproachCalc(reportMeta, draft.values)?.adopted ?? reportMeta.marketApproachValue;
  const income = reportMeta.incomeApproachValue ?? reportMeta.ciAdoptedValueOverride;
  const cost = costApproachCalc(reportMeta)?.adopted ?? reportMeta.costApproachValue;

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Indicated values</h3>
        <p className="text-xs text-muted-foreground">Taken from the three approaches. Not entered here.</p>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p>Market: {money(market)}</p>
          <p>Income: {money(income)}</p>
          <p>Cost: {money(cost)}</p>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Final reconciliation</h3>
        <label className="flex items-center gap-2 text-xs">
          <span className="w-40">Occupancy</span>
          <select
            className="rounded border border-input px-2 py-1"
            value={reportMeta.occupancyStatus ?? ""}
            onChange={(e) => setMeta({ occupancyStatus: (e.target.value || undefined) as "leased" | "vacant" | undefined })}
          >
            <option value="">As indicated by the lease ({propertyIsLeased(reportMeta) ? "leased" : "vacant"})</option>
            <option value="leased">Leased</option>
            <option value="vacant">Vacant</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={narrativePrints(reportMeta, "valueReconciliation")}
            onChange={(e) => setMeta({ printNarrative: { ...(reportMeta.printNarrative ?? {}), valueReconciliation: e.target.checked } })}
          />
          Include final reconciliation
        </label>
        <PausedTextarea
          value={draft.narrative.valueReconciliation ?? ""}
          onCommit={(v) => setNarrative({ valueReconciliation: v })}
          placeholder={propertyIsLeased(reportMeta) ? FINAL_LEASED : FINAL_VACANT}
          className="min-h-[6rem] w-full rounded-md border border-input bg-background p-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">Prints as: {finalBoilerplate(reportMeta, draft.values, draft.narrative.valueReconciliation, draft.narrative.finalValueReason)}</p>
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Final estimate of value</h3>
        <p className="text-xs text-muted-foreground">Entered here only. This figure and this date fill every statement of value in the report.</p>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-40">Date of valuation</span>
          <input className="flex-1 rounded border border-input px-2 py-1" value={reportMeta.valueDate ?? ""} onChange={(e) => setMeta({ valueDate: e.target.value })} placeholder={String(draft.values["insp_date"] ?? "dd/mm/yyyy")} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-40">GST</span>
          <select className="rounded border border-input px-2 py-1" value={reportMeta.gstTreatment ?? "exclusive"} onChange={(e) => setMeta({ gstTreatment: e.target.value as "exclusive" | "inclusive" | "not-applicable" })}>
            <option value="exclusive">Exclusive of GST</option>
            <option value="inclusive">Inclusive of GST</option>
            <option value="not-applicable">GST not applicable</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-40">Weight</span>
          <select className="rounded border border-input px-2 py-1" value={reportMeta.approachWeight ?? ""} onChange={(e) => setMeta({ approachWeight: (e.target.value || undefined) as "market" | "income" | "equal" | undefined })}>
            <option value="">As appropriate to the property</option>
            <option value="market">Primary weight to the market approach</option>
            <option value="income">Primary weight to the income approach</option>
            <option value="equal">Equal weight</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-40">Interest valued</span>
          <input className="flex-1 rounded border border-input px-2 py-1" value={reportMeta.interestValued ?? "the unencumbered fee simple"} onChange={(e) => setMeta({ interestValued: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-40">Market value</span>
          <input
            className="flex-1 rounded border border-input px-2 py-1"
            value={formatCurrencyInput(reportMeta.valueAmount)}
            onChange={(e) => setMeta({ valueAmount: formatCurrencyInput(e.target.value) })}
            placeholder="3,500,000"
          />
        </label>
        {(() => {
          const adopted = Number(String(reportMeta.valueAmount ?? "").replace(/[^0-9.]/g, ""));
          const indicated = [market, income, cost].map((n) => Number(String(n ?? "").replace(/[^0-9.]/g, ""))).filter((n) => n > 0);
          const needsReason = adopted > 0 && !indicated.includes(adopted) && !draft.narrative.finalValueReason?.trim();
          return (
            <label className={`block text-sm ${needsReason ? "rounded border border-amber-400 bg-amber-50 p-2" : ""}`}>
              <span className="mb-1 block text-xs">Why this figure, given the three indicated values</span>
              <textarea className="min-h-[4rem] w-full rounded border border-input px-2 py-1" value={draft.narrative.finalValueReason ?? ""} placeholder="e.g. the income approach reflects the existing lease, which a purchaser would assume" onChange={(e) => setNarrative({ finalValueReason: e.target.value })} />
              {needsReason ? <span className="mt-1 block text-xs text-amber-700">The adopted figure is not one of the three indicated values. A reader cannot see why it was chosen unless this is completed.</span> : null}
            </label>
          );
        })()}
      </section>

      <section className="space-y-3 rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Valuation result</h3>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={narrativePrints(reportMeta, "valuationResult")}
            onChange={(e) => setMeta({ printNarrative: { ...(reportMeta.printNarrative ?? {}), valuationResult: e.target.checked } })}
          />
          Include opinion of value
        </label>
        <PausedTextarea
          value={draft.narrative.valuationResult ?? ""}
          onCommit={(v) => setNarrative({ valuationResult: v })}
          placeholder="Opinion of value…"
          className="min-h-[5rem] w-full rounded-md border border-input bg-background p-2 text-sm"
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={narrativePrints(reportMeta, "valuationReliance")}
            onChange={(e) => setMeta({ printNarrative: { ...(reportMeta.printNarrative ?? {}), valuationReliance: e.target.checked } })}
          />
          Include reliance note
        </label>
        <PausedTextarea
          value={draft.narrative.valuationReliance ?? ""}
          onCommit={(v) => setNarrative({ valuationReliance: v })}
          placeholder="Reliance note…"
          className="min-h-[4rem] w-full rounded-md border border-input bg-background p-2 text-sm"
        />
      </section>
    </div>
  );
}
