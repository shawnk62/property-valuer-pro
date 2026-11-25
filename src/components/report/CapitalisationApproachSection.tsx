/**
 * Capitalisation approach working table matching the workshop sheet.
 * Used on Shawn commercial and industrial reports (not vacant land).
 * Fields are pre-filled from the inspection, lease evidence, and sales yields.
 * All fields remain editable. The present value of above/below market rent
 * is calculated from the market rent and the passing rent.
 */
import { useEffect, useRef } from "react";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import { isCommercialType, isIndustrialType, isVacantLand } from "@/lib/inspection/visibility";

function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

function str(values: InspectionValues, key: string): string {
  const v = values[key];
  return typeof v === "string" ? v.trim() : "";
}

function pvAnnuity(annual: number, rate: number, years: number): number | null {
  if (!Number.isFinite(annual) || !Number.isFinite(rate) || !Number.isFinite(years) || rate <= 0 || years <= 0) return null;
  return annual * (1 - Math.pow(1 + rate, -years)) / rate;
}

function averageYield(sales: ComparableSale[]): number | null {
  const yields = sales
    .filter((s) => s.omitFromReport !== true && s.saleYield)
    .map((s) => num(s.saleYield))
    .filter((n): n is number => n != null && n > 0);
  if (yields.length === 0) return null;
  return yields.reduce((a, b) => a + b, 0) / yields.length;
}

function averageLeaseRent(meta: ReportMeta): number | null {
  const rents = (meta.ciLeaseComps ?? [])
    .map((c) => num(c.netRentPerM2))
    .filter((n): n is number => n != null && n > 0);
  if (rents.length === 0) return null;
  return rents.reduce((a, b) => a + b, 0) / rents.length;
}

export function CapitalisationApproachSection({
  values,
  meta,
  sales,
  onMeta,
}: {
  values: InspectionValues;
  meta: ReportMeta;
  sales: ComparableSale[];
  onMeta: (patch: Partial<ReportMeta>) => void;
}) {
  if (isVacantLand(values) || (!isCommercialType(values) && !isIndustrialType(values))) return null;

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const patch: Partial<ReportMeta> = {};
    if (!meta.ciAdoptedRentPerM2) {
      const fromLease = averageLeaseRent(meta);
      if (fromLease != null) patch.ciAdoptedRentPerM2 = String(Math.round(fromLease));
    }
    if (!meta.ciCapRate) {
      const fromSales = averageYield(sales);
      if (fromSales != null) patch.ciCapRate = fromSales.toFixed(2);
    }
    if (!meta.ciVacancyAllowance) patch.ciVacancyAllowance = "3.5";
    if (!meta.ciLettingUpMonths) patch.ciLettingUpMonths = "6";
    if (!meta.ciIncentiveMonths) patch.ciIncentiveMonths = "3";
    if (!meta.ciAgentCommissionPct) patch.ciAgentCommissionPct = "13";
    if (Object.keys(patch).length) onMeta(patch);
  }, [meta, sales, onMeta]);

  const nla = num(str(values, "comm_nla")) ?? num(str(values, "comm_gba"));
  const marketRent = num(meta.ciAdoptedRentPerM2) ?? num(meta.ciMarketRent);
  const passing = num(str(values, "comm_passing_rent"));
  const outgoingsRate = num(meta.ciRecoverableOutgoings);
  const vacancyPct = num(meta.ciVacancyAllowance);
  const capRate = num(meta.ciCapRate);
  const monthsLoss = num(meta.ciLettingUpMonths);
  const monthsIncentive = num(meta.ciIncentiveMonths);
  const commissionPct = num(meta.ciAgentCommissionPct);
  const remainingYears = num(str(values, "comm_wale")) ?? num(str(values, "comm_lease_term"));
  const discountRate = num(meta.ciExitCapRate) ?? 0.06;

  const grossIncome = marketRent != null && nla != null ? marketRent * nla : passing;
  const outgoings = outgoingsRate != null && nla != null ? outgoingsRate * nla : null;
  const netIncome = grossIncome != null && outgoings != null ? grossIncome - outgoings : marketRent != null && nla != null ? marketRent * nla : grossIncome;
  const vacancy = grossIncome != null && vacancyPct != null ? grossIncome * (vacancyPct / 100) : null;
  const adjustedNet = netIncome != null && vacancy != null ? netIncome - vacancy : netIncome;
  const capitalised = adjustedNet != null && capRate != null && capRate > 0 ? adjustedNet / (capRate / 100) : null;

  const rentLoss = grossIncome != null && monthsLoss != null ? (grossIncome / 12) * monthsLoss : null;
  const incentives = netIncome != null && monthsIncentive != null ? (netIncome / 12) * monthsIncentive : null;
  const commission = netIncome != null && commissionPct != null ? netIncome * (commissionPct / 100) : null;
  const lettingUp = [rentLoss, incentives, commission].reduce<number | null>((a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)), null);
  const afterLetting = capitalised != null && lettingUp != null ? capitalised - lettingUp : capitalised;

  const rentDiffAnnual = marketRent != null && passing != null && nla != null && nla > 0
    ? (passing / nla - marketRent) * nla
    : null;
  const rentDiffPv = rentDiffAnnual != null && remainingYears != null
    ? pvAnnuity(rentDiffAnnual, discountRate, remainingYears)
    : null;

  const capex = num(meta.ciCapex);
  const nonCore = num(meta.ciNonCoreIncomePv);
  const below = [capex, rentDiffPv != null ? -rentDiffPv : null, nonCore].reduce<number | null>(
    (a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)),
    null,
  );
  const beforeAdopt = afterLetting != null && below != null ? afterLetting + below : afterLetting;
  const adopted = num(meta.ciAdoptRoundTo) != null && beforeAdopt != null
    ? Math.round(beforeAdopt / num(meta.ciAdoptRoundTo)!) * num(meta.ciAdoptRoundTo)!
    : beforeAdopt;
  const effective = adopted != null && adopted > 0 && adjustedNet != null ? (adjustedNet / adopted) * 100 : null;

  function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
    return (
      <label className="flex flex-col gap-0.5 text-xs">
        <span className="text-slate-500">{label}</span>
        <input className="border border-slate-300 rounded px-1 py-0.5" value={value} onChange={(e) => onChange(e.target.value)} />
        {hint ? <span className="text-slate-400">{hint}</span> : null}
      </label>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-700">The capitalisation approach</div>
      <p className="text-xs text-slate-500">
        Start with net rent from analysed transactions. Vacancy is a percentage of gross rent. Letting-up assumes the property is vacant. Below-the-line items apply only when relevant.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Field label="Assessed net rent ($/m²)" value={meta.ciAdoptedRentPerM2 ?? ""} onChange={(v) => onMeta({ ciAdoptedRentPerM2: v })} hint="From lease evidence or sales" />
        <Field label="Outgoings ($/m²)" value={meta.ciRecoverableOutgoings ?? ""} onChange={(v) => onMeta({ ciRecoverableOutgoings: v })} />
        <Field label="Vacancy allowance (% of gross)" value={meta.ciVacancyAllowance ?? ""} onChange={(v) => onMeta({ ciVacancyAllowance: v })} />
        <Field label="Capitalisation rate (%)" value={meta.ciCapRate ?? ""} onChange={(v) => onMeta({ ciCapRate: v })} hint="From analysed sales yields" />
        <Field label="Letting-up months (gross rent loss)" value={meta.ciLettingUpMonths ?? ""} onChange={(v) => onMeta({ ciLettingUpMonths: v })} />
        <Field label="Incentive months (net)" value={meta.ciIncentiveMonths ?? ""} onChange={(v) => onMeta({ ciIncentiveMonths: v })} />
        <Field label="Agent commission (% of first year net)" value={meta.ciAgentCommissionPct ?? ""} onChange={(v) => onMeta({ ciAgentCommissionPct: v })} />
        <Field label="Discount rate for PV (%)" value={meta.ciExitCapRate ?? "6"} onChange={(v) => onMeta({ ciExitCapRate: v })} hint="Default 6%" />
        <Field label="Capex (below the line)" value={meta.ciCapex ?? ""} onChange={(v) => onMeta({ ciCapex: v })} />
        <Field label="Non-core income (annual)" value={meta.ciNonCoreIncomePv ?? ""} onChange={(v) => onMeta({ ciNonCoreIncomePv: v })} />
        <Field label="Round adopted to" value={meta.ciAdoptRoundTo ?? ""} onChange={(v) => onMeta({ ciAdoptRoundTo: v })} placeholder="e.g. 50000" />
      </div>
      <table className="w-full text-xs border-collapse">
        <tbody>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Gross annual income</td><td className="py-1 text-right font-medium">{money(grossIncome)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Less outgoings</td><td className="py-1 text-right font-medium">{money(outgoings)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Net annual income (GLA × net rent)</td><td className="py-1 text-right font-medium">{money(netIncome)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Less vacancy allowance</td><td className="py-1 text-right font-medium">{money(vacancy)}</td></tr>
          <tr className="border-b border-slate-200 bg-slate-50 font-medium"><td className="py-1">Adjusted net income</td><td className="py-1 text-right">{money(adjustedNet)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Capitalised at {pct(capRate)}</td><td className="py-1 text-right font-medium">{money(capitalised)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Less letting-up — rent loss</td><td className="py-1 text-right">{money(rentLoss)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Less letting-up — incentives</td><td className="py-1 text-right">{money(incentives)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Less letting-up — commission</td><td className="py-1 text-right">{money(commission)}</td></tr>
          <tr className="border-b border-slate-200 bg-slate-50 font-medium"><td className="py-1">Value (unadjusted)</td><td className="py-1 text-right">{money(afterLetting)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Less capex</td><td className="py-1 text-right">{money(capex)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Market rent adjustment (PV){rentDiffAnnual != null ? ` — ${money(rentDiffAnnual)} p.a.` : ""}</td><td className="py-1 text-right">{money(rentDiffPv)}</td></tr>
          <tr className="border-b border-slate-100"><td className="py-1 text-slate-600">Add non-core income (PV)</td><td className="py-1 text-right">{money(nonCore)}</td></tr>
          <tr className="border-b border-slate-300 font-semibold"><td className="py-1">Adopt for practical purposes</td><td className="py-1 text-right">{money(adopted)}</td></tr>
          <tr><td className="py-1 text-slate-600">Effective capitalisation rate</td><td className="py-1 text-right">{pct(effective)}</td></tr>
        </tbody>
      </table>
      <p className="text-xs text-slate-400">
        Rent difference PV is calculated from assessed market rent versus passing rent over the remaining lease term at the discount rate. A positive figure is a cost (below market). Edit any input to override.
      </p>
    </div>
  );
}
