/**
 * Mechanical calculations for commercial and industrial Shawn Full reports.
 * The valuer supplies the analytical inputs (rates, allowances). This module
 * only performs the arithmetic and returns display-ready figures.
 * Subject facts come from the inspection form. Analytical inputs come from reportMeta.
 */
import type { InspectionValues, ReportMeta } from "./types";

function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function money(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export interface IncomeStatement {
  potentialGrossIncome: number | null;
  vacancyAllowance: number | null;
  effectiveGrossIncome: number | null;
  recoverableOutgoings: number | null;
  nonRecoverableExpenses: number | null;
  replacementReserves: number | null;
  totalExpenses: number | null;
  netOperatingIncome: number | null;
  capitalisationRate: number | null;
  indicatedValue: number | null;
  sensitivityPlus: number | null;
  sensitivityMinus: number | null;
}

export function incomeStatement(values: InspectionValues, meta: ReportMeta): IncomeStatement {
  const nla = num(values["comm_nla"]);
  const marketRentPerM2 = num(meta.ciMarketRent);
  const passingRent = num(values["comm_passing_rent"]);
  const vacancyPct = num(meta.ciVacancyAllowance);
  const recoverable = num(meta.ciRecoverableOutgoings);
  const nonRecoverable = num(meta.ciNonRecoverableExpenses);
  const reserves = num(meta.ciReplacementReserves);
  const capRate = num(meta.ciCapRate);

  const pgi = marketRentPerM2 != null && nla != null
    ? marketRentPerM2 * nla
    : passingRent;

  const vacancy = pgi != null && vacancyPct != null ? pgi * (vacancyPct / 100) : null;
  const egi = pgi != null && vacancy != null ? pgi - vacancy : pgi;
  const totalExp = [recoverable, nonRecoverable, reserves].reduce<number | null>((a, b) => {
    if (a == null && b == null) return null;
    return (a ?? 0) + (b ?? 0);
  }, null);
  const noi = egi != null && totalExp != null ? egi - totalExp : egi;
  const indicated = noi != null && capRate != null && capRate > 0 ? noi / (capRate / 100) : null;
  const sensPlus = noi != null && capRate != null ? noi / ((capRate + 0.25) / 100) : null;
  const sensMinus = noi != null && capRate != null && capRate > 0.25 ? noi / ((capRate - 0.25) / 100) : null;

  return {
    potentialGrossIncome: pgi,
    vacancyAllowance: vacancy,
    effectiveGrossIncome: egi,
    recoverableOutgoings: recoverable,
    nonRecoverableExpenses: nonRecoverable,
    replacementReserves: reserves,
    totalExpenses: totalExp,
    netOperatingIncome: noi,
    capitalisationRate: capRate,
    indicatedValue: indicated,
    sensitivityPlus: sensPlus,
    sensitivityMinus: sensMinus,
  };
}

export interface CostIndication {
  landValue: number | null;
  replacementCost: number | null;
  entrepreneurialIncentive: number | null;
  physicalDepreciation: number | null;
  functionalObsolescence: number | null;
  externalObsolescence: number | null;
  totalDepreciation: number | null;
  depreciatedImprovements: number | null;
  indicatedValue: number | null;
}

export function costIndication(values: InspectionValues, meta: ReportMeta, landValue: number | null): CostIndication {
  const gba = num(values["comm_gba"]);
  const rate = num(meta.ciReplacementCostRate);
  const incentivePct = num(meta.ciEntrepreneurialIncentive);
  const physPct = num(meta.ciPhysicalDepreciation);
  const funcPct = num(meta.ciFunctionalObsolescence);
  const extPct = num(meta.ciExternalObsolescence);

  const replacement = gba != null && rate != null ? gba * rate : null;
  const incentive = replacement != null && incentivePct != null ? replacement * (incentivePct / 100) : null;
  const costNew = replacement != null ? replacement + (incentive ?? 0) : null;
  const phys = costNew != null && physPct != null ? costNew * (physPct / 100) : null;
  const func = costNew != null && funcPct != null ? costNew * (funcPct / 100) : null;
  const ext = costNew != null && extPct != null ? costNew * (extPct / 100) : null;
  const totalDep = [phys, func, ext].reduce<number | null>((a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)), null);
  const depreciated = costNew != null && totalDep != null ? costNew - totalDep : costNew;
  const indicated = depreciated != null && landValue != null ? depreciated + landValue : depreciated;

  return {
    landValue,
    replacementCost: replacement,
    entrepreneurialIncentive: incentive,
    physicalDepreciation: phys,
    functionalObsolescence: func,
    externalObsolescence: ext,
    totalDepreciation: totalDep,
    depreciatedImprovements: depreciated,
    indicatedValue: indicated,
  };
}

export function formatIncomeLines(stmt: IncomeStatement): { label: string; value: string }[] {
  return [
    { label: "Potential gross income", value: money(stmt.potentialGrossIncome) },
    { label: "Less vacancy allowance", value: money(stmt.vacancyAllowance) },
    { label: "Effective gross income", value: money(stmt.effectiveGrossIncome) },
    { label: "Less recoverable outgoings", value: money(stmt.recoverableOutgoings) },
    { label: "Less non-recoverable expenses", value: money(stmt.nonRecoverableExpenses) },
    { label: "Less replacement reserves", value: money(stmt.replacementReserves) },
    { label: "Net operating income", value: money(stmt.netOperatingIncome) },
    { label: "Capitalisation rate", value: pct(stmt.capitalisationRate) },
    { label: "Indicated value", value: money(stmt.indicatedValue) },
    { label: "Sensitivity (+0.25%)", value: money(stmt.sensitivityPlus) },
    { label: "Sensitivity (−0.25%)", value: money(stmt.sensitivityMinus) },
  ];
}

export function formatCostLines(cost: CostIndication): { label: string; value: string }[] {
  return [
    { label: "Land value", value: money(cost.landValue) },
    { label: "Replacement cost", value: money(cost.replacementCost) },
    { label: "Entrepreneurial incentive", value: money(cost.entrepreneurialIncentive) },
    { label: "Less physical depreciation", value: money(cost.physicalDepreciation) },
    { label: "Less functional obsolescence", value: money(cost.functionalObsolescence) },
    { label: "Less external obsolescence", value: money(cost.externalObsolescence) },
    { label: "Depreciated improvements", value: money(cost.depreciatedImprovements) },
    { label: "Indicated value", value: money(cost.indicatedValue) },
  ];
}
