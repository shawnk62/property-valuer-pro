/**
 * Capitalisation approach working table.
 * Used on commercial and industrial reports (not vacant land).
 *
 * All required inputs are collected in one ordered list so nothing is missed.
 * Figures are pre-filled from the inspection form and working-report meta,
 * remain editable, and show a confirmation when a pre-filled value is overridden.
 *
 * Calculations follow the basic capitalisation method:
 * - Assessed market rent (net or gross) → net income after outgoings
 * - Vacancy allowance on gross
 * - Capitalise adjusted net at the adopted capitalisation rate
 * - Deduct letting-up costs
 * - Adjust for the present value of any market-versus-passing rent difference
 *   (discounted at the capitalisation rate, or a manual override)
 * - Optional detailed modelling of remaining term, non-market options,
 *   and contractual increases
 */
import { useState } from "react";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import { isCommercialType, isIndustrialType, isVacantLand } from "@/lib/inspection/visibility";

function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function str(values: InspectionValues, key: string): string {
  const v = values[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Present value of a constant annual amount for `years` at decimal `rate`. */
function pvAnnuity(annual: number, rate: number, years: number): number | null {
  if (!Number.isFinite(annual) || !Number.isFinite(rate) || !Number.isFinite(years) || rate <= 0 || years <= 0) {
    return null;
  }
  return (annual * (1 - Math.pow(1 + rate, -years))) / rate;
}


function parseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // Accept ISO, dd/mm/yyyy, dd-mm-yyyy
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (dmy) {
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function yearsBetween(from: Date, to: Date): number | null {
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, ms / (365.25 * 24 * 60 * 60 * 1000));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Contractual rent at `asAt`, after applying annual increases that have already occurred since `start`. */
function contractualRentAt(
  start: Date | null,
  asAt: Date,
  startingRent: number | null,
  increaseType: IncreaseType,
  increasePct: number | null,
  increaseDollar: number | null,
  manualSteps: Array<{ year: string; rent: string }>,
): number | null {
  if (startingRent == null) return null;
  if (!start || asAt < start) return startingRent;
  // Number of full anniversary increases that have occurred
  const yearsElapsed = yearsBetween(start, asAt) ?? 0;
  const anniversaries = Math.floor(yearsElapsed);
  let rent = startingRent;
  for (let y = 1; y <= anniversaries; y++) {
    if (increaseType === "fixed-pct" && increasePct != null) {
      rent *= 1 + increasePct / 100;
    } else if (increaseType === "fixed-dollar" && increaseDollar != null) {
      rent += increaseDollar;
    } else if (increaseType === "cpi" && increasePct != null) {
      rent *= 1 + increasePct / 100;
    } else if (increaseType === "manual") {
      const step = manualSteps.find((s) => num(s.year) === y);
      if (step && num(step.rent) != null) rent = num(step.rent)!;
    }
  }
  return rent;
}

/** Present value of a series of year-end differences discounted at decimal rate. */
function pvSeries(diffs: number[], rate: number): number | null {
  if (!diffs.length || !Number.isFinite(rate) || rate <= 0) return null;
  let total = 0;
  for (let t = 1; t <= diffs.length; t++) {
    const d = diffs[t - 1];
    if (!Number.isFinite(d)) continue;
    total += d / Math.pow(1 + rate, t);
  }
  return total;
}

type IncreaseType = "none" | "fixed-pct" | "fixed-dollar" | "cpi" | "manual";
type OptionBasis = "market" | "fixed-pct" | "fixed-dollar" | "cpi";

export function CapitalisationApproachSection({
  values,
  meta,
  sales: _sales,
  onMeta,
}: {
  values: InspectionValues;
  meta: ReportMeta;
  sales: ComparableSale[];
  onMeta: (patch: Partial<ReportMeta>) => void;
}) {
  if (isVacantLand(values) || (!isCommercialType(values) && !isIndustrialType(values))) return null;

  const [pending, setPending] = useState<{
    key: string;
    label: string;
    source: string;
    sourceValue: string;
    newValue: string;
    apply: () => void;
  } | null>(null);

  // ── Sources from inspection ──────────────────────────────────────────────
  const areaFromInspection = num(str(values, "comm_nla")) ?? num(str(values, "comm_gba"));
  const areaSource = str(values, "comm_nla") ? "inspection – comm_nla" : str(values, "comm_gba") ? "inspection – comm_gba" : "";
  const passingFromInspection = num(str(values, "comm_passing_rent"));
  const remainingFromInspection = num(str(values, "comm_wale")) ?? num(str(values, "comm_lease_term"));
  const remainingSource = str(values, "comm_wale") ? "inspection – comm_wale" : str(values, "comm_lease_term") ? "inspection – comm_lease_term" : "";

  // ── Effective inputs (override wins) ─────────────────────────────────────
  const basis: "net" | "gross" = meta.ciRentBasis === "gross" ? "gross" : "net";
  const area = num(meta.ciAreaOverride) ?? areaFromInspection;
  const marketRate = num(meta.ciAdoptedRentPerM2) ?? num(meta.ciMarketRent);
  const outgoingsRate = num(meta.ciRecoverableOutgoings);
  const vacancyPct = num(meta.ciVacancyAllowance);
  const capRate = num(meta.ciCapRate);
  const monthsLoss = num(meta.ciLettingUpMonths);
  const monthsIncentive = num(meta.ciIncentiveMonths);
  const commissionPct = num(meta.ciAgentCommissionPct);
  // Remaining term: explicit override, else calculated from lease end date to valuation/inspection date
  const valuationDate = parseDate(str(values, "insp_date")) ?? new Date();
  const leaseEnd = parseDate(meta.ciLeaseEndDate);
  const calculatedRemaining = leaseEnd ? yearsBetween(valuationDate, leaseEnd) : null;
  const remainingYears = num(meta.ciRemainingYears) ?? calculatedRemaining ?? remainingFromInspection;
  const leaseStart = parseDate(meta.ciLeaseStartDate);
  const startingRent = num(meta.ciStartingRent);
  const calculatedPassing = contractualRentAt(
    leaseStart,
    valuationDate,
    startingRent,
    meta.ciIncreaseType ?? "none",
    num(meta.ciIncreasePct),
    num(meta.ciIncreaseDollar),
    meta.ciManualSteps ?? [],
  );
  const passing = num(meta.ciPassingRentOverride) ?? calculatedPassing ?? passingFromInspection;
  const includeOption = meta.ciIncludeOption === true;
  const optionYears = num(meta.ciOptionYears) ?? 0;
  const optionBasis: OptionBasis = meta.ciOptionRentBasis ?? "market";
  const increaseType: IncreaseType = meta.ciIncreaseType ?? "none";
  const increasePct = num(meta.ciIncreasePct);
  const increaseDollar = num(meta.ciIncreaseDollar);
  const manualSteps = meta.ciManualSteps ?? [];
  const capex = num(meta.ciCapex);
  const nonCore = num(meta.ciNonCoreIncomePv);
  const roundTo = num(meta.ciAdoptRoundTo);

  // Discount rate: manual override (ciExitCapRate) or the capitalisation rate
  const discountPct = meta.ciDiscountManual && num(meta.ciExitCapRate) != null
    ? num(meta.ciExitCapRate)!
    : capRate ?? num(meta.ciExitCapRate) ?? null;
  const discountRate = discountPct != null ? discountPct / 100 : null;

  // ── Core income figures ──────────────────────────────────────────────────
  const outgoings = outgoingsRate != null && area != null ? outgoingsRate * area : 0;
  const rateTimesArea = marketRate != null && area != null ? marketRate * area : null;

  const grossIncome =
    rateTimesArea != null
      ? basis === "gross"
        ? rateTimesArea
        : rateTimesArea + outgoings
      : passing;

  const netIncome =
    rateTimesArea != null
      ? basis === "net"
        ? rateTimesArea
        : Math.max(0, rateTimesArea - outgoings)
      : grossIncome != null
        ? grossIncome - outgoings
        : null;

  const vacancy = grossIncome != null && vacancyPct != null ? grossIncome * (vacancyPct / 100) : null;
  const adjustedNet = netIncome != null && vacancy != null ? netIncome - vacancy : netIncome;
  const capitalised =
    adjustedNet != null && capRate != null && capRate > 0 ? adjustedNet / (capRate / 100) : null;

  // Letting-up
  const rentLoss = grossIncome != null && monthsLoss != null ? (grossIncome / 12) * monthsLoss : null;
  const incentives = netIncome != null && monthsIncentive != null ? (netIncome / 12) * monthsIncentive : null;
  const commission = netIncome != null && commissionPct != null ? netIncome * (commissionPct / 100) : null;
  const lettingUp = [rentLoss, incentives, commission].reduce<number | null>(
    (a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)),
    null,
  );
  const afterLetting = capitalised != null && lettingUp != null ? capitalised - lettingUp : capitalised;

  // ── Rent-difference PV ───────────────────────────────────────────────────
  // Positive annualDiff = below market (shortfall) → reduces value
  const marketNetAnnual = netIncome;
  const annualDiff =
    marketNetAnnual != null && passing != null ? marketNetAnnual - passing : null;

  function buildDiffSeries(): number[] | null {
    if (annualDiff == null || remainingYears == null || remainingYears <= 0 || discountRate == null) return null;
    const totalYears = Math.min(30, Math.ceil(remainingYears + (includeOption ? optionYears : 0)));
    if (totalYears <= 0) return null;

    const diffs: number[] = [];
    let contractual = passing ?? 0;
    const market = marketNetAnnual ?? 0;

    for (let y = 1; y <= totalYears; y++) {
      const inOption = includeOption && y > (remainingYears ?? 0);
      if (inOption && optionBasis === "market") {
        diffs.push(0); // reverts to market
        continue;
      }
      // Apply contractual increase at the start of the year (after year 1)
      if (y > 1 && !inOption) {
        if (increaseType === "fixed-pct" && increasePct != null) {
          contractual *= 1 + increasePct / 100;
        } else if (increaseType === "fixed-dollar" && increaseDollar != null) {
          contractual += increaseDollar;
        } else if (increaseType === "cpi" && increasePct != null) {
          contractual *= 1 + increasePct / 100;
        } else if (increaseType === "manual") {
          const step = manualSteps.find((s) => num(s.year) === y);
          if (step && num(step.rent) != null) contractual = num(step.rent)!;
        }
      }
      if (inOption && optionBasis !== "market") {
        if (optionBasis === "fixed-pct" && increasePct != null) {
          contractual *= 1 + increasePct / 100;
        } else if (optionBasis === "fixed-dollar" && increaseDollar != null) {
          contractual += increaseDollar;
        } else if (optionBasis === "cpi" && increasePct != null) {
          contractual *= 1 + increasePct / 100;
        }
      }
      diffs.push(market - contractual);
    }
    return diffs;
  }

  const useDetailed =
    includeOption || (increaseType !== "none" && increaseType !== undefined);

  let rentDiffPv: number | null = null;
  if (annualDiff != null && remainingYears != null && discountRate != null) {
    if (useDetailed) {
      const series = buildDiffSeries();
      rentDiffPv = series ? pvSeries(series, discountRate) : null;
    } else {
      rentDiffPv = pvAnnuity(annualDiff, discountRate, remainingYears);
    }
  }

  // Value impact: subtract the PV of the shortfall (positive when below market)
  const rentAdjustment = rentDiffPv != null ? -rentDiffPv : null;

  const below = [capex != null ? -Math.abs(capex) : null, rentAdjustment, nonCore].reduce<number | null>(
    (a, b) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0)),
    null,
  );
  const beforeAdopt = afterLetting != null && below != null ? afterLetting + below : afterLetting;
  const calculatedAdopted =
    roundTo != null && roundTo > 0 && beforeAdopt != null
      ? Math.round(beforeAdopt / roundTo) * roundTo
      : beforeAdopt;
  const adopted = num(meta.ciAdoptedValueOverride) ?? calculatedAdopted;
  const effective =
    adopted != null && adopted > 0 && adjustedNet != null ? (adjustedNet / adopted) * 100 : null;

  // ── Override helpers ─────────────────────────────────────────────────────
  const overridden = new Set(meta.ciOverriddenFields ?? []);

  function markOverridden(key: string) {
    if (overridden.has(key)) return;
    onMeta({ ciOverriddenFields: [...overridden, key] });
  }

  function requestChange(
    key: string,
    label: string,
    source: string,
    sourceValue: string,
    currentStored: string | undefined,
    newValue: string,
    apply: () => void,
  ) {
    const isPrefilled = !overridden.has(key) && source && (currentStored == null || currentStored === "" || currentStored === sourceValue);
    if (isPrefilled && newValue !== sourceValue && newValue !== "") {
      setPending({ key, label, source, sourceValue, newValue, apply });
      return;
    }
    apply();
    if (source) markOverridden(key);
  }

  function confirmPending() {
    if (!pending) return;
    pending.apply();
    markOverridden(pending.key);
    setPending(null);
  }

  // ── Input list ───────────────────────────────────────────────────────────
  const rateLabel = basis === "gross" ? "Assessed gross rent ($/m²)" : "Assessed net rent ($/m²)";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-700">Capitalisation method</div>
        <p className="text-xs text-slate-500 mt-1">
          All inputs are listed below. Pre-filled figures come from the inspection form or earlier working-report fields.
          Changing a pre-filled figure asks for confirmation and marks it as overridden for this report only.
          Vacancy is a percentage of gross rent. The rent-difference adjustment uses the capitalisation rate unless overridden.
        </p>
      </div>

      {/* Consolidated input list — market rent, then existing lease, then options, then capitalisation */}
      <div className="border border-slate-200 rounded-md divide-y divide-slate-100 text-xs">
        <div className="px-3 py-1.5 bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Market rent</div>
        <InputRow
          label="Lettable / building area (m²)"
          value={meta.ciAreaOverride ?? (areaFromInspection != null ? String(areaFromInspection) : "")}
          source={areaSource || "not found on inspection"}
          overridden={overridden.has("area")}
          onChange={(v) =>
            requestChange("area", "Area", areaSource, String(areaFromInspection ?? ""), meta.ciAreaOverride, v, () =>
              onMeta({ ciAreaOverride: v }),
            )
          }
          onReset={() => onMeta({ ciAreaOverride: undefined, ciOverriddenFields: (meta.ciOverriddenFields ?? []).filter((k) => k !== "area") })}
        />

        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-slate-600 w-56 shrink-0">Rent basis</span>
          <div className="flex rounded border border-slate-300 overflow-hidden">
            <button type="button" className={`px-3 py-1 ${basis === "net" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`} onClick={() => onMeta({ ciRentBasis: "net" })}>Net</button>
            <button type="button" className={`px-3 py-1 ${basis === "gross" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`} onClick={() => onMeta({ ciRentBasis: "gross" })}>Gross</button>
          </div>
          <span className="text-slate-400">Default: Net</span>
        </div>

        <InputRow
          label={rateLabel}
          value={meta.ciAdoptedRentPerM2 ?? ""}
          source="lease evidence / working report"
          overridden={overridden.has("rate")}
          onChange={(v) => onMeta({ ciAdoptedRentPerM2: v })}
          hint="Rate assessed from the lease evidence"
        />
        <InputRow label="Outgoings ($/m²)" value={meta.ciRecoverableOutgoings ?? ""} source="working report" onChange={(v) => onMeta({ ciRecoverableOutgoings: v })} />
        <InputRow label="Vacancy allowance (% of gross)" value={meta.ciVacancyAllowance ?? ""} source="working report" onChange={(v) => onMeta({ ciVacancyAllowance: v })} />

        <div className="px-3 py-1.5 bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Existing lease</div>
        <InputRow
          label="Lease start date"
          value={meta.ciLeaseStartDate ?? ""}
          source="user entered"
          onChange={(v) => {
            const start = parseDate(v);
            const term = num(meta.ciLeaseTermYears);
            const patch: Partial<typeof meta> = { ciLeaseStartDate: v };
            if (start && term != null && !meta.ciLeaseEndDate) {
              const end = new Date(start);
              end.setFullYear(end.getFullYear() + Math.floor(term));
              end.setMonth(end.getMonth() + Math.round((term % 1) * 12));
              patch.ciLeaseEndDate = formatDate(end);
            }
            onMeta(patch);
          }}
          hint="dd/mm/yyyy or yyyy-mm-dd"
        />
        <InputRow
          label="Lease term (years)"
          value={meta.ciLeaseTermYears ?? ""}
          source="user entered"
          onChange={(v) => {
            const patch: Partial<typeof meta> = { ciLeaseTermYears: v };
            const start = parseDate(meta.ciLeaseStartDate);
            const term = num(v);
            if (start && term != null && !meta.ciLeaseEndDate) {
              const end = new Date(start);
              end.setFullYear(end.getFullYear() + Math.floor(term));
              end.setMonth(end.getMonth() + Math.round((term % 1) * 12));
              patch.ciLeaseEndDate = formatDate(end);
            }
            onMeta(patch);
          }}
        />
        <InputRow
          label="Lease end date"
          value={meta.ciLeaseEndDate ?? ""}
          source="user entered or calculated"
          onChange={(v) => onMeta({ ciLeaseEndDate: v })}
          hint="Remaining term is calculated from this date"
        />
        <InputRow
          label="Starting rent ($ p.a.)"
          value={meta.ciStartingRent ?? ""}
          source="user entered"
          onChange={(v) => onMeta({ ciStartingRent: v })}
          hint="Rent at commencement"
        />

        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-slate-600 w-56 shrink-0">Contractual increases</span>
          <select className="border border-slate-300 rounded px-2 py-1" value={increaseType} onChange={(e) => onMeta({ ciIncreaseType: e.target.value as IncreaseType })}>
            <option value="none">None</option>
            <option value="fixed-pct">Fixed % per year</option>
            <option value="fixed-dollar">Fixed $ per year</option>
            <option value="cpi">CPI</option>
            <option value="manual">Manual steps</option>
          </select>
        </div>
        {(increaseType === "fixed-pct" || increaseType === "cpi") && (
          <InputRow label="Increase % per year" value={meta.ciIncreasePct ?? ""} source="user entered" onChange={(v) => onMeta({ ciIncreasePct: v })} />
        )}
        {increaseType === "fixed-dollar" && (
          <InputRow label="Increase $ per year" value={meta.ciIncreaseDollar ?? ""} source="user entered" onChange={(v) => onMeta({ ciIncreaseDollar: v })} />
        )}
        {increaseType === "manual" && (
          <div className="px-3 py-2 space-y-1">
            <div className="text-slate-600">Manual contractual rent steps (year → total $ p.a.)</div>
            {manualSteps.map((step, i) => (
              <div key={i} className="flex gap-2">
                <input className="border border-slate-300 rounded px-1 py-0.5 w-16" placeholder="Year" value={step.year} onChange={(e) => { const next = manualSteps.map((s, j) => (j === i ? { ...s, year: e.target.value } : s)); onMeta({ ciManualSteps: next }); }} />
                <input className="border border-slate-300 rounded px-1 py-0.5 w-32" placeholder="Rent $" value={step.rent} onChange={(e) => { const next = manualSteps.map((s, j) => (j === i ? { ...s, rent: e.target.value } : s)); onMeta({ ciManualSteps: next }); }} />
                <button type="button" className="text-red-600" onClick={() => onMeta({ ciManualSteps: manualSteps.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            {manualSteps.length < 8 && (
              <button type="button" className="text-slate-600 underline" onClick={() => onMeta({ ciManualSteps: [...manualSteps, { year: "", rent: "" }] })}>Add step</button>
            )}
          </div>
        )}

        <InputRow
          label="Current / passing rent ($ p.a.)"
          value={meta.ciPassingRentOverride ?? (calculatedPassing != null ? String(Math.round(calculatedPassing)) : passingFromInspection != null ? String(passingFromInspection) : "")}
          source={calculatedPassing != null ? "calculated from starting rent and increases" : "inspection – comm_passing_rent"}
          overridden={overridden.has("passing")}
          onChange={(v) => requestChange("passing", "Passing rent", calculatedPassing != null ? "calculated from starting rent and increases" : "inspection – comm_passing_rent", String(calculatedPassing != null ? Math.round(calculatedPassing) : passingFromInspection ?? ""), meta.ciPassingRentOverride, v, () => onMeta({ ciPassingRentOverride: v }))}
          onReset={() => onMeta({ ciPassingRentOverride: undefined, ciOverriddenFields: (meta.ciOverriddenFields ?? []).filter((k) => k !== "passing") })}
          hint={calculatedPassing != null ? `Auto-calculated current rent: ${Math.round(calculatedPassing).toLocaleString("en-AU")}` : "Enter starting rent and increases to calculate"}
        />
        <InputRow
          label="Remaining term (years)"
          value={meta.ciRemainingYears ?? (calculatedRemaining != null ? calculatedRemaining.toFixed(2) : remainingFromInspection != null ? String(remainingFromInspection) : "")}
          source={calculatedRemaining != null ? "calculated from lease end date" : remainingSource || "not found on inspection"}
          overridden={overridden.has("remaining")}
          onChange={(v) => requestChange("remaining", "Remaining term", calculatedRemaining != null ? "calculated from lease end date" : remainingSource, String(calculatedRemaining ?? remainingFromInspection ?? ""), meta.ciRemainingYears, v, () => onMeta({ ciRemainingYears: v }))}
          onReset={() => onMeta({ ciRemainingYears: undefined, ciOverriddenFields: (meta.ciOverriddenFields ?? []).filter((k) => k !== "remaining") })}
          hint={calculatedRemaining != null ? `Auto-calculated: ${calculatedRemaining.toFixed(2)} years to lease end` : undefined}
        />

        <div className="px-3 py-1.5 bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Options</div>
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-slate-600 w-56 shrink-0">Include option term?</span>
          <input type="checkbox" checked={includeOption} onChange={(e) => onMeta({ ciIncludeOption: e.target.checked })} />
          <span className="text-slate-400">Only if the option rent is not a market review</span>
        </div>
        {includeOption && (
          <>
            <InputRow label="Option years" value={meta.ciOptionYears ?? ""} source="user entered" onChange={(v) => onMeta({ ciOptionYears: v })} />
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="text-slate-600 w-56 shrink-0">Option rent basis</span>
              <select className="border border-slate-300 rounded px-2 py-1" value={optionBasis} onChange={(e) => onMeta({ ciOptionRentBasis: e.target.value as OptionBasis })}>
                <option value="market">Market (no further adjustment)</option>
                <option value="fixed-pct">Fixed % increase</option>
                <option value="fixed-dollar">Fixed $ increase</option>
                <option value="cpi">CPI</option>
              </select>
            </div>
          </>
        )}

        <div className="px-3 py-1.5 bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Capitalisation and adjustments</div>
        <InputRow label="Capitalisation rate (%)" value={meta.ciCapRate ?? ""} source="working report" onChange={(v) => onMeta({ ciCapRate: v })} hint="Rate assessed from the comparable sales" />
        <InputRow label="Letting-up months (gross rent loss)" value={meta.ciLettingUpMonths ?? ""} source="working report" onChange={(v) => onMeta({ ciLettingUpMonths: v })} />
        <InputRow label="Incentive months (net)" value={meta.ciIncentiveMonths ?? ""} source="working report" onChange={(v) => onMeta({ ciIncentiveMonths: v })} />
        <InputRow label="Agent commission (% of first-year net)" value={meta.ciAgentCommissionPct ?? ""} source="working report" onChange={(v) => onMeta({ ciAgentCommissionPct: v })} />
        <InputRow label="Capex (below the line, deducted)" value={meta.ciCapex ?? ""} source="working report" onChange={(v) => onMeta({ ciCapex: v })} />
        <InputRow label="Non-core income (PV, added)" value={meta.ciNonCoreIncomePv ?? ""} source="working report" onChange={(v) => onMeta({ ciNonCoreIncomePv: v })} />
        <InputRow label="Round adopted value to nearest" value={meta.ciAdoptRoundTo ?? ""} source="working report" onChange={(v) => onMeta({ ciAdoptRoundTo: v })} hint="e.g. 50000" />
      </div>

      {/* Results table — only elements that were considered */}
      <table className="w-full text-xs border-collapse">
        <tbody>
          {marketRate != null && area != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Market rent ({money(marketRate)}/m² × {area.toLocaleString("en-AU")} m², {basis})</td>
              <td className="py-1 text-right font-medium">{money(rateTimesArea)}</td>
            </tr>
          ) : null}
          {passing != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Current / passing rent</td>
              <td className="py-1 text-right font-medium">{money(passing)}</td>
            </tr>
          ) : null}
          {grossIncome != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Gross annual income</td>
              <td className="py-1 text-right font-medium">{money(grossIncome)}</td>
            </tr>
          ) : null}
          {outgoings ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Less outgoings</td>
              <td className="py-1 text-right font-medium">{money(outgoings)}</td>
            </tr>
          ) : null}
          {netIncome != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Net annual income</td>
              <td className="py-1 text-right font-medium">{money(netIncome)}</td>
            </tr>
          ) : null}
          {vacancy != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Less vacancy allowance ({vacancyPct}%)</td>
              <td className="py-1 text-right font-medium">{money(vacancy)}</td>
            </tr>
          ) : null}
          {adjustedNet != null ? (
            <tr className="border-b border-slate-200 bg-slate-50 font-medium">
              <td className="py-1">Adjusted net income</td>
              <td className="py-1 text-right">{money(adjustedNet)}</td>
            </tr>
          ) : null}
          {capitalised != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Capitalised at {pct(capRate)}</td>
              <td className="py-1 text-right font-medium">{money(capitalised)}</td>
            </tr>
          ) : null}
          {rentLoss != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Less letting-up — rent loss ({monthsLoss} months)</td>
              <td className="py-1 text-right">{money(rentLoss)}</td>
            </tr>
          ) : null}
          {incentives != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Less letting-up — incentives ({monthsIncentive} months)</td>
              <td className="py-1 text-right">{money(incentives)}</td>
            </tr>
          ) : null}
          {commission != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Less letting-up — commission ({commissionPct}%)</td>
              <td className="py-1 text-right">{money(commission)}</td>
            </tr>
          ) : null}
          {afterLetting != null && (rentLoss != null || incentives != null || commission != null) ? (
            <tr className="border-b border-slate-200 bg-slate-50 font-medium">
              <td className="py-1">Value after letting-up</td>
              <td className="py-1 text-right">{money(afterLetting)}</td>
            </tr>
          ) : null}
          {capex != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Less capex</td>
              <td className="py-1 text-right">{money(-Math.abs(capex))}</td>
            </tr>
          ) : null}
          {rentAdjustment != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">
                Market rent adjustment (PV)
                {annualDiff != null ? ` — ${money(annualDiff)} p.a. ${annualDiff > 0 ? "(below market)" : annualDiff < 0 ? "(above market)" : ""}` : ""}
                {remainingYears != null ? ` over ${remainingYears.toFixed(2)} years` : ""}
                {useDetailed ? " — detailed" : ""}
              </td>
              <td className="py-1 text-right">{money(rentAdjustment)}</td>
            </tr>
          ) : null}
          {nonCore != null ? (
            <tr className="border-b border-slate-100">
              <td className="py-1 text-slate-600">Add non-core income (PV)</td>
              <td className="py-1 text-right">{money(nonCore)}</td>
            </tr>
          ) : null}
          <tr className="border-b border-slate-300 font-semibold">
            <td className="py-1">Adopt for practical purposes</td>
            <td className="py-1 text-right">
              <input
                className="w-36 border border-slate-300 rounded px-2 py-0.5 text-right"
                value={meta.ciAdoptedValueOverride ?? (calculatedAdopted != null ? String(Math.round(calculatedAdopted)) : "")}
                placeholder={calculatedAdopted != null ? String(Math.round(calculatedAdopted)) : ""}
                onChange={(e) => onMeta({ ciAdoptedValueOverride: e.target.value })}
              />
              {meta.ciAdoptedValueOverride ? (
                <button type="button" className="ml-2 text-[10px] text-slate-500 underline" onClick={() => onMeta({ ciAdoptedValueOverride: undefined })}>Reset</button>
              ) : calculatedAdopted != null ? (
                <span className="ml-2 text-[10px] text-slate-400">calculated</span>
              ) : null}
            </td>
          </tr>
          {effective != null ? (
            <tr>
              <td className="py-1 text-slate-600">Effective capitalisation rate</td>
              <td className="py-1 text-right">{pct(effective)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p className="text-xs text-slate-400">
        The market-rent adjustment is the present value of the difference between market net rent and passing rent,
        discounted at the capitalisation rate (or the manual override). A shortfall (passing below market) reduces value;
        a surplus increases it. Detailed mode projects contractual increases and non-market option terms year by year.
      </p>

      {/* Override confirmation */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-md text-sm space-y-3">
            <div className="font-semibold">Override pre-filled figure?</div>
            <p>
              <strong>{pending.label}</strong> was pre-filled from <em>{pending.source || "a linked field"}</em>
              {pending.sourceValue ? ` (${pending.sourceValue})` : ""}.
            </p>
            <p>Changing it to <strong>{pending.newValue}</strong> will override the linked value for this report only.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-3 py-1 border rounded" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="px-3 py-1 bg-slate-700 text-white rounded" onClick={confirmPending}>
                Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputRow({
  label,
  value,
  source,
  overridden,
  onChange,
  onReset,
  hint,
}: {
  label: string;
  value: string;
  source?: string;
  overridden?: boolean;
  onChange: (v: string) => void;
  onReset?: () => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <div className="w-56 shrink-0">
        <div className="text-slate-600">{label}</div>
        {source && (
          <div className="text-[10px] text-slate-400 mt-0.5">
            {overridden ? "manually overridden" : source}
            {overridden && onReset && (
              <>
                {" · "}
                <button type="button" className="underline" onClick={onReset}>
                  Reset
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex-1">
        <input
          className="border border-slate-300 rounded px-2 py-1 w-full max-w-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
