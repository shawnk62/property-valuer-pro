/**
 * Analytical inputs and calculated tables for commercial / industrial Shawn Full.
 * Subject facts come from the inspection form. Rates and allowances are entered here.
 */
import { useMemo } from "react";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import { comparableBuildingRate, comparableSiteRate } from "@/lib/report/adjustmentGrid";
import { LeaseEvidenceGrid } from "@/components/report/LeaseEvidenceGrid";
import {
  costIndication,
  formatCostLines,
  formatIncomeLines,
  incomeStatement,
} from "@/lib/report/commercialCalculations";

interface Props {
  values: InspectionValues;
  meta: ReportMeta;
  sales?: ComparableSale[];
  onMeta: (patch: Partial<ReportMeta>) => void;
  landValue?: number | null;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        className="border border-slate-300 rounded px-2 py-1 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Table({ title, lines }: { title: string; lines: { label: string; value: string }[] }) {
  return (
    <div className="mt-3">
      <div className="text-sm font-semibold text-slate-700 mb-1">{title}</div>
      <table className="w-full text-sm border-collapse">
        <tbody>
          {lines.map((row) => (
            <tr key={row.label} className="border-b border-slate-100">
              <td className="py-1 pr-4 text-slate-600">{row.label}</td>
              <td className="py-1 text-right font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommercialAnalysisPanel({ values, meta, sales, onMeta, landValue }: Props) {
  const income = useMemo(() => incomeStatement(values, meta), [values, meta]);
  const cost = useMemo(() => costIndication(values, meta, landValue ?? null), [values, meta, landValue]);
  const rateLines = useMemo(() => {
    return (sales ?? [])
      .filter((s) => s.omitFromReport !== true && (s.address || s.salePrice))
      .map((s) => {
        const land = comparableSiteRate(s);
        const building = comparableBuildingRate(s);
        return {
          label: s.address || "Sale",
          value: `Land ${land.rate} · Building ${building.rate}`,
        };
      });
  }, [sales]);

  return (
    <div className="border border-slate-200 rounded p-3 mt-2 bg-slate-50">
      <div className="text-sm font-semibold text-slate-800 mb-2">
        Commercial / industrial analysis inputs
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Market rent ($/m² p.a.)" value={meta.ciMarketRent ?? ""} onChange={(v) => onMeta({ ciMarketRent: v })} placeholder="e.g. 180" />
        <Field label="Vacancy allowance (%)" value={meta.ciVacancyAllowance ?? ""} onChange={(v) => onMeta({ ciVacancyAllowance: v })} placeholder="e.g. 5" />
        <Field label="Recoverable outgoings (p.a.)" value={meta.ciRecoverableOutgoings ?? ""} onChange={(v) => onMeta({ ciRecoverableOutgoings: v })} />
        <Field label="Non-recoverable expenses (p.a.)" value={meta.ciNonRecoverableExpenses ?? ""} onChange={(v) => onMeta({ ciNonRecoverableExpenses: v })} />
        <Field label="Replacement reserves (p.a.)" value={meta.ciReplacementReserves ?? ""} onChange={(v) => onMeta({ ciReplacementReserves: v })} />
        <Field label="Capitalisation rate (%)" value={meta.ciCapRate ?? ""} onChange={(v) => onMeta({ ciCapRate: v })} placeholder="e.g. 6.5" />
        <Field label="Letting-up months (rent loss)" value={meta.ciLettingUpMonths ?? ""} onChange={(v) => onMeta({ ciLettingUpMonths: v })} placeholder="e.g. 6" />
        <Field label="Incentive months" value={meta.ciIncentiveMonths ?? ""} onChange={(v) => onMeta({ ciIncentiveMonths: v })} placeholder="e.g. 3" />
        <Field label="Agent commission (%)" value={meta.ciAgentCommissionPct ?? ""} onChange={(v) => onMeta({ ciAgentCommissionPct: v })} placeholder="e.g. 10" />
        <Field label="Capital expenditure" value={meta.ciCapex ?? ""} onChange={(v) => onMeta({ ciCapex: v })} />
        <Field label="Rent difference PV" value={meta.ciRentDifferencePv ?? ""} onChange={(v) => onMeta({ ciRentDifferencePv: v })} placeholder="negative = loss" />
        <Field label="Non-core income PV" value={meta.ciNonCoreIncomePv ?? ""} onChange={(v) => onMeta({ ciNonCoreIncomePv: v })} />
        <Field label="Round adopted value to" value={meta.ciAdoptRoundTo ?? ""} onChange={(v) => onMeta({ ciAdoptRoundTo: v })} placeholder="e.g. 25000" />
        <Field label="Exit capitalisation rate (%)" value={meta.ciExitCapRate ?? ""} onChange={(v) => onMeta({ ciExitCapRate: v })} placeholder="e.g. 7.0" />
        <Field label="DCF horizon (years)" value={meta.ciDcfHorizon ?? ""} onChange={(v) => onMeta({ ciDcfHorizon: v })} placeholder="e.g. 10" />
        <Field label="Replacement cost rate ($/m²)" value={meta.ciReplacementCostRate ?? ""} onChange={(v) => onMeta({ ciReplacementCostRate: v })} />
        <Field label="Entrepreneurial incentive (%)" value={meta.ciEntrepreneurialIncentive ?? ""} onChange={(v) => onMeta({ ciEntrepreneurialIncentive: v })} />
        <Field label="Physical depreciation (%)" value={meta.ciPhysicalDepreciation ?? ""} onChange={(v) => onMeta({ ciPhysicalDepreciation: v })} />
        <Field label="Functional obsolescence (%)" value={meta.ciFunctionalObsolescence ?? ""} onChange={(v) => onMeta({ ciFunctionalObsolescence: v })} />
        <Field label="External obsolescence (%)" value={meta.ciExternalObsolescence ?? ""} onChange={(v) => onMeta({ ciExternalObsolescence: v })} />
      </div>
      {rateLines.length ? <Table title="Direct comparison rates (land and building)" lines={rateLines} /> : null}
      <LeaseEvidenceGrid meta={meta} onMeta={onMeta} />
      <Table title="Income capitalisation" lines={formatIncomeLines(income)} />
      <div className="mt-3">
        <div className="text-sm font-semibold text-slate-700 mb-1">Cost approach — summation</div>
        <p className="text-xs text-slate-500 mb-1">
          Land value plus depreciated replacement of building components and ancillary items. Leave empty to use the single rate above.
        </p>
        {(meta.ciCostComponents ?? []).length === 0 ? (
          <button
            type="button"
            className="text-xs text-slate-600 underline mb-2"
            onClick={() =>
              onMeta({
                ciCostComponents: [
                  { name: "Land (vacant value)", area: "", rate: "", depreciation: "" },
                  { name: "Warehouse / factory", area: "", rate: "", depreciation: "" },
                  { name: "Office and amenities", area: "", rate: "", depreciation: "" },
                  { name: "Mezzanine", area: "", rate: "", depreciation: "" },
                  { name: "Awning", area: "", rate: "", depreciation: "" },
                  { name: "Lift (nominal)", area: "", rate: "", depreciation: "" },
                  { name: "Outbuildings", area: "", rate: "", depreciation: "" },
                  { name: "Hardstand", area: "", rate: "", depreciation: "" },
                  { name: "Lights", area: "", rate: "", depreciation: "" },
                  { name: "Fencing", area: "", rate: "", depreciation: "" },
                  { name: "Bollards", area: "", rate: "", depreciation: "" },
                  { name: "Landscaping (nominal)", area: "", rate: "", depreciation: "" },
                  { name: "Gate (nominal)", area: "", rate: "", depreciation: "" },
                ],
              })
            }
          >
            Start with industrial component list
          </button>
        ) : null}
        {(meta.ciCostComponents ?? []).map((c, i) => (
          <div key={i} className="grid grid-cols-4 gap-1 mb-1">
            <input className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Component" value={c.name} onChange={(e) => {
              const next = [...(meta.ciCostComponents ?? [])];
              next[i] = { ...next[i], name: e.target.value };
              onMeta({ ciCostComponents: next });
            }} />
            <input className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Qty / m²" value={c.area} onChange={(e) => {
              const next = [...(meta.ciCostComponents ?? [])];
              next[i] = { ...next[i], area: e.target.value };
              onMeta({ ciCostComponents: next });
            }} />
            <input className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Rate" value={c.rate} onChange={(e) => {
              const next = [...(meta.ciCostComponents ?? [])];
              next[i] = { ...next[i], rate: e.target.value };
              onMeta({ ciCostComponents: next });
            }} />
            <input className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Dep %" value={c.depreciation} onChange={(e) => {
              const next = [...(meta.ciCostComponents ?? [])];
              next[i] = { ...next[i], depreciation: e.target.value };
              onMeta({ ciCostComponents: next });
            }} />
          </div>
        ))}
        <button type="button" className="text-xs text-slate-600 underline" onClick={() => onMeta({ ciCostComponents: [...(meta.ciCostComponents ?? []), { name: "", area: "", rate: "", depreciation: "" }] })}>
          Add component
        </button>
      </div>
      <Table title="Cost approach" lines={formatCostLines(cost)} />
    </div>
  );
}
