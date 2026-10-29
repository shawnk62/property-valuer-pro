/**
 * Analytical inputs and calculated tables for commercial / industrial Shawn Full.
 * Subject facts come from the inspection form. Rates and allowances are entered here.
 */
import { useMemo } from "react";
import type { InspectionValues, ReportMeta } from "@/lib/report/types";
import {
  costIndication,
  formatCostLines,
  formatIncomeLines,
  incomeStatement,
} from "@/lib/report/commercialCalculations";

interface Props {
  values: InspectionValues;
  meta: ReportMeta;
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

export function CommercialAnalysisPanel({ values, meta, onMeta, landValue }: Props) {
  const income = useMemo(() => incomeStatement(values, meta), [values, meta]);
  const cost = useMemo(() => costIndication(values, meta, landValue ?? null), [values, meta, landValue]);

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
        <Field label="Replacement cost rate ($/m²)" value={meta.ciReplacementCostRate ?? ""} onChange={(v) => onMeta({ ciReplacementCostRate: v })} />
        <Field label="Entrepreneurial incentive (%)" value={meta.ciEntrepreneurialIncentive ?? ""} onChange={(v) => onMeta({ ciEntrepreneurialIncentive: v })} />
        <Field label="Physical depreciation (%)" value={meta.ciPhysicalDepreciation ?? ""} onChange={(v) => onMeta({ ciPhysicalDepreciation: v })} />
        <Field label="Functional obsolescence (%)" value={meta.ciFunctionalObsolescence ?? ""} onChange={(v) => onMeta({ ciFunctionalObsolescence: v })} />
        <Field label="External obsolescence (%)" value={meta.ciExternalObsolescence ?? ""} onChange={(v) => onMeta({ ciExternalObsolescence: v })} />
      </div>
      <Table title="Income capitalisation" lines={formatIncomeLines(income)} />
      <Table title="Cost approach" lines={formatCostLines(cost)} />
    </div>
  );
}
