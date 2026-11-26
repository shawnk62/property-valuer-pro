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
  const remainingYears = num(meta.ciRemainingYears) ?? remainingFromInspection;
  const passing = num(meta.ciPassingRentOverride) ?? passingFromInspection;
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
  const adopted =
    roundTo != null && roundTo > 0 && beforeAdopt != null
      ? Math.round(beforeAdopt / roundTo) * roundTo
      : beforeAdopt;
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

      {/* Consolidated input list */}
      <div className="border border-slate-200 rounded-md divide-y divide-slate-100 text-xs">
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
            <button
              type="button"
              className={`px-3 py-1 ${basis === "net" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}
              onClick={() => onMeta({ ciRentBasis: "net" })}
            >
              Net
            </button>
            <button
              type="button"
              className={`px-3 py-1 ${basis === "gross" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}
              onClick={() => onMeta({ ciRentBasis: "gross" })}
            >
              Gross
            </button>
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

        <InputRow
          label="Outgoings ($/m²)"
          value={meta.ciRecoverableOutgoings ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciRecoverableOutgoings: v })}
        />

        <InputRow
          label="Vacancy allowance (% of gross)"
          value={meta.ciVacancyAllowance ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciVacancyAllowance: v })}
          hint="Typically 2–5 %"
        />

        <InputRow
          label="Capitalisation rate (%)"
          value={meta.ciCapRate ?? ""}
          source="sales analysis / working report"
          onChange={(v) => onMeta({ ciCapRate: v })}
          hint="Rate assessed from the comparable sales"
        />

        <InputRow
          label="Passing rent (total $ p.a.)"
          value={meta.ciPassingRentOverride ?? (passingFromInspection != null ? String(passingFromInspection) : "")}
          source="inspection – comm_passing_rent"
          overridden={overridden.has("passing")}
          onChange={(v) =>
            requestChange(
              "passing",
              "Passing rent",
              "inspection – comm_passing_rent",
              String(passingFromInspection ?? ""),
              meta.ciPassingRentOverride,
              v,
              () => onMeta({ ciPassingRentOverride: v }),
            )
          }
          onReset={() =>
            onMeta({
              ciPassingRentOverride: undefined,
              ciOverriddenFields: (meta.ciOverriddenFields ?? []).filter((k) => k !== "passing"),
            })
          }
        />

        <InputRow
          label="Years to next market review"
          value={meta.ciRemainingYears ?? (remainingFromInspection != null ? String(remainingFromInspection) : "")}
          source={remainingSource || "not found on inspection"}
          overridden={overridden.has("remaining")}
          onChange={(v) =>
            requestChange(
              "remaining",
              "Remaining term",
              remainingSource,
              String(remainingFromInspection ?? ""),
              meta.ciRemainingYears,
              v,
              () => onMeta({ ciRemainingYears: v }),
            )
          }
          onReset={() =>
            onMeta({
              ciRemainingYears: undefined,
              ciOverriddenFields: (meta.ciOverriddenFields ?? []).filter((k) => k !== "remaining"),
            })
          }
        />

        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-slate-600 w-56 shrink-0">Include option term?</span>
          <input
            type="checkbox"
            checked={includeOption}
            onChange={(e) => onMeta({ ciIncludeOption: e.target.checked })}
          />
          <span className="text-slate-400">Only if the option rent is not a market review</span>
        </div>

        {includeOption && (
          <>
            <InputRow
              label="Option years"
              value={meta.ciOptionYears ?? ""}
              source="user entered"
              onChange={(v) => onMeta({ ciOptionYears: v })}
            />
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="text-slate-600 w-56 shrink-0">Option rent basis</span>
              <select
                className="border border-slate-300 rounded px-2 py-1"
                value={optionBasis}
                onChange={(e) => onMeta({ ciOptionRentBasis: e.target.value as OptionBasis })}
              >
                <option value="market">Market (no further adjustment)</option>
                <option value="fixed-pct">Fixed % increase</option>
                <option value="fixed-dollar">Fixed $ increase</option>
                <option value="cpi">CPI</option>
              </select>
            </div>
          </>
        )}

        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-slate-600 w-56 shrink-0">Contractual increases</span>
          <select
            className="border border-slate-300 rounded px-2 py-1"
            value={increaseType}
            onChange={(e) => onMeta({ ciIncreaseType: e.target.value as IncreaseType })}
          >
            <option value="none">None (constant difference)</option>
            <option value="fixed-pct">Fixed % per year</option>
            <option value="fixed-dollar">Fixed $ per year</option>
            <option value="cpi">CPI</option>
            <option value="manual">Manual steps</option>
          </select>
        </div>

        {(increaseType === "fixed-pct" || increaseType === "cpi" || (includeOption && (optionBasis === "fixed-pct" || optionBasis === "cpi"))) && (
          <InputRow
            label="Increase % per year"
            value={meta.ciIncreasePct ?? ""}
            source="user entered"
            onChange={(v) => onMeta({ ciIncreasePct: v })}
          />
        )}
        {(increaseType === "fixed-dollar" || (includeOption && optionBasis === "fixed-dollar")) && (
          <InputRow
            label="Increase $ per year"
            value={meta.ciIncreaseDollar ?? ""}
            source="user entered"
            onChange={(v) => onMeta({ ciIncreaseDollar: v })}
          />
        )}

        {increaseType === "manual" && (
          <div className="px-3 py-2 space-y-1">
            <div className="text-slate-600">Manual contractual rent steps (year → total $ p.a.)</div>
            {manualSteps.map((step, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="border border-slate-300 rounded px-1 py-0.5 w-16"
                  placeholder="Year"
                  value={step.year}
                  onChange={(e) => {
                    const next = manualSteps.map((s, j) => (j === i ? { ...s, year: e.target.value } : s));
                    onMeta({ ciManualSteps: next });
                  }}
                />
                <input
                  className="border border-slate-300 rounded px-1 py-0.5 w-32"
                  placeholder="Rent $"
                  value={step.rent}
                  onChange={(e) => {
                    const next = manualSteps.map((s, j) => (j === i ? { ...s, rent: e.target.value } : s));
                    onMeta({ ciManualSteps: next });
                  }}
                />
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => onMeta({ ciManualSteps: manualSteps.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </div>
            ))}
            {manualSteps.length < 8 && (
              <button
                type="button"
                className="text-slate-600 underline"
                onClick={() => onMeta({ ciManualSteps: [...manualSteps, { year: "", rent: "" }] })}
              >
                Add step
              </button>
            )}
          </div>
        )}

        <InputRow
          label="Letting-up months (gross rent loss)"
          value={meta.ciLettingUpMonths ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciLettingUpMonths: v })}
        />
        <InputRow
          label="Incentive months (net)"
          value={meta.ciIncentiveMonths ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciIncentiveMonths: v })}
        />
        <InputRow
          label="Agent commission (% of first-year net)"
          value={meta.ciAgentCommissionPct ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciAgentCommissionPct: v })}
        />

        <div className="flex items-center gap-3 px-3 py-2">
          <span className="text-slate-600 w-56 shrink-0">Discount rate for PV (%)</span>
          <input
            className="border border-slate-300 rounded px-1 py-0.5 w-24"
            value={meta.ciDiscountManual ? (meta.ciExitCapRate ?? "") : (capRate != null ? String(capRate) : "")}
            onChange={(e) => onMeta({ ciExitCapRate: e.target.value, ciDiscountManual: true })}
          />
          <span className="text-slate-400">
            {meta.ciDiscountManual ? "Manual override" : "Defaults to capitalisation rate"}
          </span>
          {meta.ciDiscountManual && (
            <button
              type="button"
              className="text-slate-500 underline"
              onClick={() => onMeta({ ciDiscountManual: false })}
            >
              Reset to cap rate
            </button>
          )}
        </div>

        <InputRow
          label="Capex (below the line, deducted)"
          value={meta.ciCapex ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciCapex: v })}
        />
        <InputRow
          label="Non-core income (PV, added)"
          value={meta.ciNonCoreIncomePv ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciNonCoreIncomePv: v })}
        />
        <InputRow
          label="Round adopted value to nearest"
          value={meta.ciAdoptRoundTo ?? ""}
          source="working report"
          onChange={(v) => onMeta({ ciAdoptRoundTo: v })}
          hint="e.g. 50000"
        />
      </div>

      {/* Results table */}
      <table className="w-full text-xs border-collapse">
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Gross annual income</td>
            <td className="py-1 text-right font-medium">{money(grossIncome)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Less outgoings</td>
            <td className="py-1 text-right font-medium">{money(outgoings || null)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Net annual income</td>
            <td className="py-1 text-right font-medium">{money(netIncome)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Less vacancy allowance</td>
            <td className="py-1 text-right font-medium">{money(vacancy)}</td>
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50 font-medium">
            <td className="py-1">Adjusted net income</td>
            <td className="py-1 text-right">{money(adjustedNet)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Capitalised at {pct(capRate)}</td>
            <td className="py-1 text-right font-medium">{money(capitalised)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Less letting-up — rent loss</td>
            <td className="py-1 text-right">{money(rentLoss)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Less letting-up — incentives</td>
            <td className="py-1 text-right">{money(incentives)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Less letting-up — commission</td>
            <td className="py-1 text-right">{money(commission)}</td>
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50 font-medium">
            <td className="py-1">Value after letting-up</td>
            <td className="py-1 text-right">{money(afterLetting)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Less capex</td>
            <td className="py-1 text-right">{money(capex != null ? -Math.abs(capex) : null)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">
              Market rent adjustment (PV)
              {annualDiff != null ? ` — ${money(annualDiff)} p.a. ${annualDiff > 0 ? "(below market)" : annualDiff < 0 ? "(above market)" : ""}` : ""}
              {useDetailed ? " — detailed" : ""}
            </td>
            <td className="py-1 text-right">{money(rentAdjustment)}</td>
          </tr>
          <tr className="border-b border-slate-100">
            <td className="py-1 text-slate-600">Add non-core income (PV)</td>
            <td className="py-1 text-right">{money(nonCore)}</td>
          </tr>
          <tr className="border-b border-slate-300 font-semibold">
            <td className="py-1">Adopt for practical purposes</td>
            <td className="py-1 text-right">{money(adopted)}</td>
          </tr>
          <tr>
            <td className="py-1 text-slate-600">Effective capitalisation rate</td>
            <td className="py-1 text-right">{pct(effective)}</td>
          </tr>
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
