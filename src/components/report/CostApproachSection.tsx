/**
 * Cost approach working table matching the tutorial template.
 * Industrial sheet for Shawn commercial/industrial (except vacant land).
 * Residential sheet for Shawn residential (except vacant land).
 * Fields that exist elsewhere in the report are pre-filled and remain editable.
 */
import { useEffect, useRef } from "react";
import type { InspectionValues, ReportMeta } from "@/lib/report/types";
import { isCommercialType, isIndustrialType, isVacantLand } from "@/lib/inspection/visibility";

type Line = { name: string; area?: string; rate?: string; depreciation?: string; nominal?: string };

const INDUSTRIAL_MAIN: Line[] = [
  { name: "Main warehouse/factory area" },
  { name: "Office and amenities" },
  { name: "Mezzanine storage" },
  { name: "Awning" },
  { name: "Lift in office (nominal)" },
  { name: "Outbuildings" },
];

const INDUSTRIAL_ANCILLARY: Line[] = [
  { name: "Hardstand" },
  { name: "Lights" },
  { name: "Fencing" },
  { name: "Bollards" },
  { name: "Landscaping (nominal amount)" },
  { name: "Gate with motor (nominal amount)" },
];

const RESIDENTIAL_MAIN: Line[] = [
  { name: "Dwelling (includes garage)" },
  { name: "Covered outdoor living area (under main roof)" },
  { name: "Solar" },
];

const RESIDENTIAL_ANCILLARY: Line[] = [
  { name: "Driveway" },
  { name: "Fencing" },
  { name: "Landscaping" },
];

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function str(values: InspectionValues, key: string): string {
  const v = values[key];
  return typeof v === "string" ? v.trim() : "";
}

function lineValue(line: Line): number | null {
  const nominal = num(line.nominal);
  if (nominal != null) {
    const dep = num(line.depreciation);
    return dep != null ? nominal * (1 - dep / 100) : nominal;
  }
  const area = num(line.area);
  const rate = num(line.rate);
  if (area == null || rate == null) return null;
  const gross = area * rate;
  const dep = num(line.depreciation);
  return dep != null ? gross * (1 - dep / 100) : gross;
}

function defaults(variant: "industrial" | "residential"): { main: Line[]; ancillary: Line[] } {
  return variant === "industrial"
    ? { main: INDUSTRIAL_MAIN.map((l) => ({ ...l })), ancillary: INDUSTRIAL_ANCILLARY.map((l) => ({ ...l })) }
    : { main: RESIDENTIAL_MAIN.map((l) => ({ ...l })), ancillary: RESIDENTIAL_ANCILLARY.map((l) => ({ ...l })) };
}

function sumAreas(values: InspectionValues, keys: string[]): string {
  let total = 0;
  let any = false;
  for (const key of keys) {
    const n = num(str(values, key));
    if (n != null && n > 0) {
      total += n;
      any = true;
    }
  }
  return any ? String(Math.round(total)) : "";
}

function seedFromReport(values: InspectionValues, variant: "industrial" | "residential", current: NonNullable<ReportMeta["costApproach"]>): NonNullable<ReportMeta["costApproach"]> {
  const next = { ...current };
  if (!next.landArea) {
    next.landArea = str(values, "prop_usable_sitearea") || str(values, "prop_sitearea");
  }
  if (!next.landValue) {
    next.landValue = str(values, "prop_site_value");
  }
  if (variant === "industrial") {
    const main = next.mainBuilding?.length ? [...next.mainBuilding] : defaults("industrial").main;
    const byName = (name: string) => main.findIndex((l) => l.name === name);
    const setArea = (name: string, value: string) => {
      const i = byName(name);
      if (i >= 0 && !main[i].area && value) main[i] = { ...main[i], area: value };
    };
    setArea("Main warehouse/factory area", str(values, "comm_gba") || str(values, "comm_nla"));
    setArea("Awning", /yes/i.test(str(values, "comm_awning")) ? "" : "");
    const ancillary = next.ancillary?.length ? [...next.ancillary] : defaults("industrial").ancillary;
    const hard = ancillary.findIndex((l) => l.name === "Hardstand");
    if (hard >= 0 && !ancillary[hard].area) {
      const hs = str(values, "comm_hardstand");
      if (hs) ancillary[hard] = { ...ancillary[hard], area: hs };
    }
    next.mainBuilding = main;
    next.ancillary = ancillary;
  } else {
    const main = next.mainBuilding?.length ? [...next.mainBuilding] : defaults("residential").main;
    const dwelling = main.findIndex((l) => l.name.startsWith("Dwelling"));
    if (dwelling >= 0 && !main[dwelling].area) {
      const gla = str(values, "imp_gla") || sumAreas(values, ["area_living_upstairs", "area_living_downstairs", "area_garage"]);
      if (gla) main[dwelling] = { ...main[dwelling], area: gla };
    }
    const outdoor = main.findIndex((l) => l.name.startsWith("Covered outdoor"));
    if (outdoor >= 0 && !main[outdoor].area) {
      const covered = sumAreas(values, ["area_verandahs", "area_covered_front_patio", "area_covered_rear_patio"]);
      if (covered) main[outdoor] = { ...main[outdoor], area: covered };
    }
    next.mainBuilding = main;
  }
  return next;
}

export function CostApproachSection({
  values,
  meta,
  onMeta,
}: {
  values: InspectionValues;
  meta: ReportMeta;
  onMeta: (patch: Partial<ReportMeta>) => void;
}) {
  if (isVacantLand(values)) return null;

  const industrial = isIndustrialType(values) || isCommercialType(values);
  const variant: "industrial" | "residential" = industrial ? "industrial" : "residential";
  const stored = meta.costApproach ?? {};
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    if (stored.variant && stored.mainBuilding?.length) return;
    seeded.current = true;
    const seed = defaults(variant);
    const filled = seedFromReport(values, variant, {
      ...stored,
      variant,
      mainBuilding: stored.mainBuilding?.length ? stored.mainBuilding : seed.main,
      ancillary: stored.ancillary?.length ? stored.ancillary : seed.ancillary,
    });
    onMeta({ costApproach: filled });
  }, [values, variant, stored, onMeta]);

  const main = stored.mainBuilding?.length ? stored.mainBuilding : defaults(variant).main;
  const ancillary = stored.ancillary?.length ? stored.ancillary : defaults(variant).ancillary;

  function patch(next: Partial<NonNullable<ReportMeta["costApproach"]>>) {
    onMeta({ costApproach: { ...stored, variant, ...next } });
  }

  function updateLine(list: "mainBuilding" | "ancillary", index: number, field: keyof Line, value: string) {
    const current = list === "mainBuilding" ? main : ancillary;
    const next = current.map((line, i) => (i === index ? { ...line, [field]: value } : line));
    patch({ [list]: next });
  }

  const landArea = num(stored.landArea);
  const landRate = num(stored.landRate);
  const landDirect = num(stored.landValue);
  const landValue = landDirect != null ? landDirect : landArea != null && landRate != null ? landArea * landRate : null;
  const mainTotal = main.reduce<number | null>((sum, line) => {
    const v = lineValue(line);
    return v == null ? sum : (sum ?? 0) + v;
  }, null);
  const ancillaryTotal = ancillary.reduce<number | null>((sum, line) => {
    const v = lineValue(line);
    return v == null ? sum : (sum ?? 0) + v;
  }, null);
  const total = [landValue, mainTotal, ancillaryTotal].reduce<number | null>((sum, v) => (v == null ? sum : (sum ?? 0) + v), null);

  function LineRow({ line, index, list }: { line: Line; index: number; list: "mainBuilding" | "ancillary" }) {
    const value = lineValue(line);
    return (
      <tr className="border-b border-slate-100">
        <td className="py-1 pr-2 text-slate-600">{line.name}</td>
        <td className="py-1 pr-1">
          <input className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={line.area ?? ""} placeholder="Area" onChange={(e) => updateLine(list, index, "area", e.target.value)} />
        </td>
        <td className="py-1 pr-1">
          <input className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={line.rate ?? ""} placeholder="$/m² or rate" onChange={(e) => updateLine(list, index, "rate", e.target.value)} />
        </td>
        <td className="py-1 pr-1">
          <input className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={line.depreciation ?? ""} placeholder="Dep %" onChange={(e) => updateLine(list, index, "depreciation", e.target.value)} />
        </td>
        <td className="py-1 pr-1">
          <input className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs" value={line.nominal ?? ""} placeholder="Nominal $" onChange={(e) => updateLine(list, index, "nominal", e.target.value)} />
        </td>
        <td className="py-1 text-right text-xs font-medium">{money(value)}</td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Using the {variant === "industrial" ? "industrial" : "residential"} template. Areas pre-filled from the inspection where available. All fields remain editable.
      </div>
      <div className="text-sm font-semibold text-slate-700">The cost approach to valuation</div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-1 pr-2">Item</th>
            <th className="py-1 pr-1">Area / qty</th>
            <th className="py-1 pr-1">Rate</th>
            <th className="py-1 pr-1">Dep %</th>
            <th className="py-1 pr-1">Nominal</th>
            <th className="py-1 text-right">$</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200 bg-slate-50">
            <td className="py-1 pr-2 font-medium">Assessed market vacant land value</td>
            <td className="py-1 pr-1"><input className="w-full border border-slate-300 rounded px-1 py-0.5" value={stored.landArea ?? ""} placeholder="Land area m²" onChange={(e) => patch({ landArea: e.target.value })} /></td>
            <td className="py-1 pr-1"><input className="w-full border border-slate-300 rounded px-1 py-0.5" value={stored.landRate ?? ""} placeholder="$/m²" onChange={(e) => patch({ landRate: e.target.value })} /></td>
            <td colSpan={2} className="py-1 pr-1"><input className="w-full border border-slate-300 rounded px-1 py-0.5" value={stored.landValue ?? ""} placeholder="Or enter value" onChange={(e) => patch({ landValue: e.target.value })} /></td>
            <td className="py-1 text-right font-medium">{money(landValue)}</td>
          </tr>
          <tr><td colSpan={6} className="pt-2 pb-1 text-xs font-semibold text-slate-600">Add — replacement costs of main building</td></tr>
          {main.map((line, i) => <LineRow key={`main-${i}`} line={line} index={i} list="mainBuilding" />)}
          <tr className="border-b border-slate-200 bg-slate-50 font-medium">
            <td colSpan={5} className="py-1 pr-2">Total main building improvements</td>
            <td className="py-1 text-right">{money(mainTotal)}</td>
          </tr>
          <tr><td colSpan={6} className="pt-2 pb-1 text-xs font-semibold text-slate-600">Add — ancillary improvements</td></tr>
          {ancillary.map((line, i) => <LineRow key={`anc-${i}`} line={line} index={i} list="ancillary" />)}
          <tr className="border-b border-slate-200 bg-slate-50 font-medium">
            <td colSpan={5} className="py-1 pr-2">Total ancillary</td>
            <td className="py-1 text-right">{money(ancillaryTotal)}</td>
          </tr>
          <tr className="border-b border-slate-300 font-semibold">
            <td colSpan={5} className="py-1 pr-2">Total</td>
            <td className="py-1 text-right">{money(total)}</td>
          </tr>
        </tbody>
      </table>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">Adopted value (rounded)</span>
        <input className="w-32 border border-slate-300 rounded px-2 py-1" value={stored.adoptedValue ?? ""} placeholder={money(total)} onChange={(e) => patch({ adoptedValue: e.target.value })} />
      </label>
      <label className="block text-xs text-slate-500">
        Notes
        <textarea className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={3} value={stored.notes ?? ""} placeholder="Hardstand calculation, fencing specification, nominal amounts used…" onChange={(e) => patch({ notes: e.target.value })} />
      </label>
    </div>
  );
}
