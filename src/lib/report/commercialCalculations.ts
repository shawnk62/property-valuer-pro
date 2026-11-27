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
  capitalisedValue: number | null;
  lettingUpRentLoss: number | null;
  lettingUpIncentives: number | null;
  lettingUpCommission: number | null;
  lettingUpTotal: number | null;
  valueAfterLettingUp: number | null;
  capex: number | null;
  rentDifferencePv: number | null;
  nonCoreIncomePv: number | null;
  adoptedValue: number | null;
  effectiveCapRate: number | null;
  indicatedValue: number | null;
  sensitivityPlus: number | null;
  sensitivityMinus: number | null;
}

export function incomeStatement(values: InspectionValues, meta: ReportMeta): IncomeStatement {
  const nla = num(values["comm_nla"]);
  const marketRentPerM2 = num(meta.ciAdoptedRentPerM2) ?? num(meta.ciMarketRent);
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
  const capitalised = noi != null && capRate != null && capRate > 0 ? noi / (capRate / 100) : null;

  const monthsLoss = num(meta.ciLettingUpMonths);
  const monthsIncentive = num(meta.ciIncentiveMonths);
  const commissionPct = num(meta.ciAgentCommissionPct);
  const rentLoss = pgi != null && monthsLoss != null ? (pgi / 12) * monthsLoss : null;
  const incentives = noi != null && monthsIncentive != null ? (noi / 12) * monthsIncentive : null;
  const commission = noi != null && commissionPct != null ? noi * (commissionPct / 100) : null;
  const lettingUp = [rentLoss, incentives, commission].reduce<number | null>(
    (a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)),
    null,
  );
  const afterLetting = capitalised != null && lettingUp != null ? capitalised - lettingUp : capitalised;

  const capex = num(meta.ciCapex);
  const rentDiff = num(meta.ciRentDifferencePv);
  const nonCore = num(meta.ciNonCoreIncomePv);
  const belowLine = [capex, rentDiff, nonCore].reduce<number | null>(
    (a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)),
    null,
  );
  const unrounded = afterLetting != null && belowLine != null ? afterLetting - belowLine : afterLetting;
  const roundTo = num(meta.ciAdoptRoundTo);
  const adopted = unrounded != null && roundTo != null && roundTo > 0
    ? Math.round(unrounded / roundTo) * roundTo
    : unrounded;
  const effective = adopted != null && adopted > 0 && noi != null ? (noi / adopted) * 100 : null;

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
    capitalisedValue: capitalised,
    lettingUpRentLoss: rentLoss,
    lettingUpIncentives: incentives,
    lettingUpCommission: commission,
    lettingUpTotal: lettingUp,
    valueAfterLettingUp: afterLetting,
    capex,
    rentDifferencePv: rentDiff,
    nonCoreIncomePv: nonCore,
    adoptedValue: adopted,
    effectiveCapRate: effective,
    indicatedValue: adopted,
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
  const components = meta.ciCostComponents ?? [];
  const componentTotal = components.reduce<number | null>((sum, c) => {
    const area = num(c.area);
    const rate = num(c.rate);
    const dep = num(c.depreciation);
    if (area == null || rate == null) return sum;
    const gross = area * rate;
    const net = dep != null ? gross * (1 - dep / 100) : gross;
    return (sum ?? 0) + net;
  }, null);

  const gba = num(values["comm_gba"]);
  const rate = num(meta.ciReplacementCostRate);
  const incentivePct = num(meta.ciEntrepreneurialIncentive);
  const physPct = num(meta.ciPhysicalDepreciation);
  const funcPct = num(meta.ciFunctionalObsolescence);
  const extPct = num(meta.ciExternalObsolescence);

  const replacement = componentTotal != null
    ? componentTotal
    : gba != null && rate != null ? gba * rate : null;
  const incentive = replacement != null && incentivePct != null && componentTotal == null
    ? replacement * (incentivePct / 100)
    : null;
  const costNew = replacement != null ? replacement + (incentive ?? 0) : null;
  const phys = componentTotal == null && costNew != null && physPct != null ? costNew * (physPct / 100) : null;
  const func = componentTotal == null && costNew != null && funcPct != null ? costNew * (funcPct / 100) : null;
  const ext = componentTotal == null && costNew != null && extPct != null ? costNew * (extPct / 100) : null;
  const totalDep = [phys, func, ext].reduce<number | null>((a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)), null);
  const depreciated = componentTotal != null
    ? componentTotal
    : costNew != null && totalDep != null ? costNew - totalDep : costNew;
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
  const lines: { label: string; value: string }[] = [
    { label: "Potential gross income", value: money(stmt.potentialGrossIncome) },
    { label: "Less vacancy allowance", value: money(stmt.vacancyAllowance) },
    { label: "Effective gross income", value: money(stmt.effectiveGrossIncome) },
    { label: "Less recoverable outgoings", value: money(stmt.recoverableOutgoings) },
    { label: "Less non-recoverable expenses", value: money(stmt.nonRecoverableExpenses) },
    { label: "Less replacement reserves", value: money(stmt.replacementReserves) },
    { label: "Net operating income", value: money(stmt.netOperatingIncome) },
    { label: "Capitalisation rate", value: pct(stmt.capitalisationRate) },
    { label: "Capitalised value (above the line)", value: money(stmt.capitalisedValue) },
  ];
  if (stmt.lettingUpTotal != null || stmt.capex != null || stmt.rentDifferencePv != null || stmt.nonCoreIncomePv != null) {
    lines.push({ label: "— Below the line —", value: "" });
  }
  if (stmt.lettingUpTotal != null) {
    lines.push(
      { label: "Less rent loss while vacant", value: money(stmt.lettingUpRentLoss) },
      { label: "Less incentives", value: money(stmt.lettingUpIncentives) },
      { label: "Less agent commission", value: money(stmt.lettingUpCommission) },
      { label: "Value after letting-up", value: money(stmt.valueAfterLettingUp) },
    );
  }
  if (stmt.capex != null || stmt.rentDifferencePv != null || stmt.nonCoreIncomePv != null) {
    lines.push(
      { label: "Less capital expenditure", value: money(stmt.capex) },
      { label: "Rent difference (PV)", value: money(stmt.rentDifferencePv) },
      { label: "Non-core income (PV)", value: money(stmt.nonCoreIncomePv) },
    );
  }
  lines.push(
    { label: "Adopted value", value: money(stmt.adoptedValue) },
    { label: "Effective capitalisation rate", value: pct(stmt.effectiveCapRate) },
    { label: "Sensitivity (+0.25%)", value: money(stmt.sensitivityPlus) },
    { label: "Sensitivity (−0.25%)", value: money(stmt.sensitivityMinus) },
  );
  return lines.filter((l) => l.value !== "—" || l.label.includes("Below"));
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

export const MARKET_BOILERPLATE =
  "${{rate}} per square metre applied to the subject building area of {{area}} m² produces ${{unrounded}}. Rounded to the nearest ${{rounding}}, ${{adopted}} is adopted for the market approach.";

export function marketApproachCalc(
  meta: ReportMeta,
  values: InspectionValues,
): { area: number; rate: number; rounding: number; calculated: number; adopted: number } | null {
  const area = num(meta.marketBuildingArea) ?? num(values["comm_nla"]) ?? num(values["comm_gba"]);
  const rate = num(meta.marketAdoptedRate);
  if (area == null || rate == null) return null;
  const rounding = num(meta.marketRounding) ?? 10000;
  const calculated = Math.round(area * rate);
  const step = rounding > 0 ? rounding : 1;
  const adopted = Math.round(calculated / step) * step;
  return { area, rate, rounding: step, calculated, adopted };
}

export function marketBoilerplate(meta: ReportMeta, values: InspectionValues, template?: string): string {
  const calc = marketApproachCalc(meta, values);
  const source = (template ?? "").trim() || MARKET_BOILERPLATE;
  if (!calc) return source.replace(/\{\{[^}]+\}\}/g, "—");
  const money = (n: number) => n.toLocaleString("en-AU");
  return source
    .replace(/\{\{rate\}\}/g, money(calc.rate))
    .replace(/\{\{area\}\}/g, calc.area.toLocaleString("en-AU"))
    .replace(/\{\{unrounded\}\}/g, money(calc.calculated))
    .replace(/\{\{rounding\}\}/g, money(calc.rounding))
    .replace(/\{\{adopted\}\}/g, money(calc.adopted));
}

export function marketCalculationSentence(meta: ReportMeta, values: InspectionValues): string {
  return marketBoilerplate(meta, values, MARKET_BOILERPLATE);
}

export const INCOME_BOILERPLATE =
  "The capitalisation of the net market rent of ${{rent}} at {{capRate}}% indicates ${{capitalised}}. After allowing ${{adjustment}} for the difference between the passing rent and the market rent over the remaining term, the income approach indicates ${{adopted}}, rounded to the nearest ${{rounding}}.";

export const COST_BOILERPLATE =
  "The land value of ${{land}} and the depreciated replacement cost of the improvements of ${{improvements}} total ${{unrounded}}. For practical purposes, and rounding to the nearest ${{rounding}}, a value of ${{adopted}} is adopted for the cost approach.";

export const FINAL_LEASED =
  "The market approach indicates ${{market}}. The income approach, having regard to the existing lease, indicates ${{income}}. The cost approach indicates ${{cost}}. Having regard to the evidence, {{weight}}, and a value of ${{adopted}} is adopted as at {{date}}.";

export const FINAL_VACANT =
  "The market approach indicates ${{market}}. The cost approach indicates ${{cost}}. The property is vacant at the date of valuation, and primary weight has been given to the market approach. A value of ${{adopted}} is adopted as at {{date}}.";

function costLine(line: { area?: string; rate?: string; depreciation?: string; nominal?: string }): number | null {
  const nominal = num(line.nominal);
  const area = num(line.area);
  const rate = num(line.rate);
  const gross = nominal ?? (area != null && rate != null ? area * rate : null);
  if (gross == null) return null;
  const dep = num(line.depreciation);
  return dep != null ? gross * (1 - dep / 100) : gross;
}

export function costApproachCalc(meta: ReportMeta): { land: number; improvements: number; calculated: number; rounding: number; adopted: number } | null {
  const cost = meta.costApproach;
  if (!cost) return null;
  const land = num(cost.landValue) ?? ((num(cost.landArea) != null && num(cost.landRate) != null) ? num(cost.landArea)! * num(cost.landRate)! : null);
  const improvements = [...(cost.mainBuilding ?? []), ...(cost.ancillary ?? [])].reduce<number>((sum, line) => sum + (costLine(line) ?? 0), 0);
  if (land == null && improvements === 0) return null;
  const calculated = Math.round((land ?? 0) + improvements);
  const rounding = num(meta.costRounding) ?? 10000;
  const step = rounding > 0 ? rounding : 1;
  const adopted = Math.round(calculated / step) * step;
  return { land: land ?? 0, improvements, calculated, rounding: step, adopted };
}

export function propertyIsLeased(meta: ReportMeta): boolean {
  if (meta.occupancyStatus === "leased") return true;
  if (meta.occupancyStatus === "vacant") return false;
  return Boolean(meta.ciLeaseStartDate || meta.ciStartingRent || meta.ciPassingRentOverride || meta.ciLeaseEndDate);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "—");
}

function moneyOf(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-AU");
}

export function incomeBoilerplate(meta: ReportMeta, template?: string): string {
  const adopted = num(meta.incomeApproachValue) ?? num(meta.ciAdoptedValueOverride);
  return fill((template ?? "").trim() || INCOME_BOILERPLATE, {
    rent: moneyOf(num(meta.ciAdoptedRentPerM2)),
    capRate: meta.ciCapRate || "—",
    capitalised: "—",
    adjustment: "—",
    adopted: moneyOf(adopted),
    rounding: moneyOf(num(meta.ciAdoptRoundTo) ?? 10000),
  });
}

export function costBoilerplate(meta: ReportMeta, template?: string): string {
  const calc = costApproachCalc(meta);
  return fill((template ?? "").trim() || COST_BOILERPLATE, {
    land: moneyOf(calc?.land),
    improvements: moneyOf(calc?.improvements),
    unrounded: moneyOf(calc?.calculated),
    rounding: moneyOf(calc?.rounding),
    adopted: moneyOf(calc?.adopted),
  });
}

export function finalBoilerplate(meta: ReportMeta, values: InspectionValues, template?: string): string {
  const market = marketApproachCalc(meta, values)?.adopted ?? num(meta.marketApproachValue);
  const income = num(meta.incomeApproachValue) ?? num(meta.ciAdoptedValueOverride);
  const cost = costApproachCalc(meta)?.adopted ?? num(meta.costApproachValue);
  const adopted = num(meta.valueAmount) ?? market ?? income ?? cost;
  const leased = propertyIsLeased(meta);
  const source = (template ?? "").trim() || (leased ? FINAL_LEASED : FINAL_VACANT);
  return fill(source, {
    market: moneyOf(market),
    income: moneyOf(income),
    cost: moneyOf(cost),
    adopted: moneyOf(adopted),
    date: meta.valueDate || String(values["insp_date"] ?? "") || "the date of valuation",
    weight: "primary weight has been given to the market approach, supported by the income approach",
  });
}
