/**
 * Working valuation tables for Shawn Full commercial and industrial only.
 * Subject facts come from the inspection form. Rates and adopted figures are entered here.
 * Residential reports do not use this component.
 */
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import {
  costIndication,
  formatCostLines,
  formatIncomeLines,
  incomeStatement,
} from "@/lib/report/commercialCalculations";
import { useMemo } from "react";

function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function landAreaInM2(sale: ComparableSale): string {
  const a = num(sale.landArea);
  if (a == null) return "";
  return (sale.landUnit ?? "m2") === "ha" ? String(a * 10000) : String(a);
}

function formatCurrency(raw: string): string {
  const n = num(raw);
  if (n == null) return raw.trim();
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function rate(price: string | undefined, area: string | undefined): string {
  const p = num(price);
  const a = num(area);
  if (p == null || a == null || a === 0) return "—";
  return `$${(p / a).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

interface Props {
  values: InspectionValues;
  sales: ComparableSale[];
  meta: ReportMeta;
  onSales: (next: ComparableSale[]) => void;
  onMeta: (patch: Partial<ReportMeta>) => void;
  subjectPhotoUrl?: string;
}

export function CommercialValuationTables({ values, sales, meta, onSales, onMeta, subjectPhotoUrl }: Props) {
  const subjectAddress = [values["prop_address"], values["prop_suburb"]].filter(Boolean).join(", ") || "Subject";
  const subjectLand = String(values["prop_usable_sitearea"] ?? values["prop_sitearea"] ?? "");
  const subjectBuilding = String(values["comm_nla"] ?? values["comm_gba"] ?? "");
  const subjectClear = String(values["comm_clear_height"] ?? "");
  const subjectHardstand = String(values["comm_hardstand"] ?? "");
  const subjectLoading = String(values["comm_loading_config"] ?? "");
  const subjectOfficeRaw = String(values["comm_office_split"] ?? "");
  const subjectOffice = /\d|%|office/i.test(subjectOfficeRaw) ? subjectOfficeRaw : "";

  const income = useMemo(() => incomeStatement(values, meta), [values, meta]);
  const cost = useMemo(() => costIndication(values, meta, null), [values, meta]);

  const adoptedBuildingRate = num(meta.ciAdoptedBuildingRate);
  const adoptedLandRate = num(meta.ciAdoptedLandRate);
  const buildingIndication = adoptedBuildingRate != null && num(subjectBuilding) != null
    ? adoptedBuildingRate * num(subjectBuilding)!
    : null;
  const landIndication = adoptedLandRate != null && num(subjectLand) != null
    ? adoptedLandRate * num(subjectLand)!
    : null;

  function patchSale(id: string, patch: Partial<ComparableSale>) {
    onSales(sales.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveSale(id: string, direction: -1 | 1) {
    const visible = sales.filter((s) => s.omitFromReport !== true);
    const idx = visible.findIndex((s) => s.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= visible.length) return;
    const a = visible[idx];
    const b = visible[target];
    const next = [...sales];
    const ia = next.findIndex((s) => s.id === a.id);
    const ib = next.findIndex((s) => s.id === b.id);
    [next[ia], next[ib]] = [next[ib], next[ia]];
    onSales(next);
  }

  function archiveSale(id: string) {
    onSales(sales.map((s) => (s.id === id ? { ...s, omitFromReport: true } : s)));
  }

  function deleteSale(id: string) {
    if (!window.confirm("Delete this comparable from the working file?")) return;
    onSales(sales.filter((s) => s.id !== id));
    onMeta({ ciLeaseComps: (meta.ciLeaseComps ?? []).filter((c) => c.id !== id) });
  }

  function addBlankSale() {
    onSales([
      ...sales,
      {
        id: `sale-${Math.random().toString(36).slice(2, 10)}`,
        address: "",
        proximity: "",
        saleDate: "",
        isListing: false,
        salePrice: "",
        landArea: "",
        landUnit: "m2",
        gla: "",
        clearHeight: "",
        loading: "",
        officeRatio: "",
        condition: "",
        hardstand: "",
        passingRent: "",
        marketRent: "",
        saleYield: "",
        comments: "",
      },
    ]);
  }

  function toggleLeaseEvidence(sale: ComparableSale, checked: boolean) {
    const existing = meta.ciLeaseComps ?? [];
    if (checked) {
      if (existing.some((c) => c.id === sale.id)) return;
      onMeta({
        ciLeaseComps: [
          ...existing,
          {
            id: sale.id,
            address: sale.address,
            date: sale.saleDate,
            nla: sale.gla ?? "",
            netRentPerM2: "",
            term: "",
            incentives: "",
            outgoings: "",
            notes: sale.comments ?? "",
            proximity: sale.proximity ?? "",
            photoUrl: sale.photoUrl,
            clearHeight: sale.clearHeight ?? "",
            loading: sale.loading ?? "",
            officeRatio: sale.officeRatio ?? "",
            condition: sale.condition ?? "",
            hardstand: sale.hardstand ?? "",
          },
        ],
      });
    } else {
      onMeta({ ciLeaseComps: existing.filter((c) => c.id !== sale.id) });
    }
  }

  const reconciliation = [
    { label: "Direct comparison (building rate)", value: money(buildingIndication) },
    { label: "Direct comparison (land rate)", value: money(landIndication) },
    { label: "Income capitalisation", value: money(income.adoptedValue) },
    { label: "Cost approach", value: money(cost.indicatedValue) },
  ].filter((r) => r.value !== "—");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Sales comparison</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Subject facts are from the inspection. Enter sale details. Rates are calculated. Adopt a rate; the table multiplies.
        </p>
        <button
          type="button"
          onClick={addBlankSale}
          className="mb-2 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          Add comparable sale
        </button>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="sticky left-0 z-20 bg-white py-1 pr-2 min-w-[6rem]">Item</th>
                <th className="sticky left-[6rem] z-20 bg-white py-1 pr-2 min-w-[8rem]">
                  <div className="text-xs font-medium text-foreground">{subjectAddress}</div>
                  <div className="text-[0.6rem] text-slate-400">Subject</div>
                </th>
                {sales.filter((s) => s.omitFromReport !== true).map((s, idx, arr) => (
                  <th key={s.id} className="py-1 pr-2 min-w-[8rem]">
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs font-medium text-foreground"
                      value={s.address}
                      placeholder={s.isListing ? "Listing address" : "Sale address"}
                      onChange={(e) => patchSale(s.id, { address: e.target.value })}
                    />
                    <select
                      className="mt-0.5 w-full border border-slate-300 rounded px-0.5 py-0.5 text-[0.6rem]"
                      value={s.isListing ? "listing" : "sale"}
                      onChange={(e) => {
                        const isListing = e.target.value === "listing";
                        patchSale(s.id, isListing ? { isListing: true, saleDate: "" } : { isListing: false });
                      }}
                    >
                      <option value="sale">Sale</option>
                      <option value="listing">Listing</option>
                    </select>
                    <div className="mt-0.5 flex gap-1 text-[0.65rem] font-normal">
                      <button type="button" disabled={idx === 0} className="text-slate-500 disabled:opacity-30" onClick={() => moveSale(s.id, -1)}>←</button>
                      <button type="button" disabled={idx === arr.length - 1} className="text-slate-500 disabled:opacity-30" onClick={() => moveSale(s.id, 1)}>→</button>
                      <button type="button" className="text-slate-500" onClick={() => archiveSale(s.id)} title="Hold in working file">Archive</button>
                      <button type="button" className="text-red-500" onClick={() => deleteSale(s.id)}>×</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Proximity to Subject</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5"
                      value={s.proximity ?? ""}
                      placeholder="e.g. 1.2 km N"
                      onChange={(e) => patchSale(s.id, { proximity: e.target.value })}
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Photo</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                  {subjectPhotoUrl ? <img src={subjectPhotoUrl} alt="Subject" className="w-full max-h-28 rounded object-contain bg-slate-50" /> : "—"}
                </td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    {s.photoUrl ? (
                      <div className="relative">
                        <img src={s.photoUrl} alt={s.address} className="w-full max-h-28 rounded object-contain bg-slate-50" />
                        <button type="button" className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-[0.6rem] text-red-600" onClick={() => patchSale(s.id, { photoUrl: "" })}>Remove</button>
                      </div>
                    ) : (
                      <label className="flex h-20 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[0.65rem] text-slate-400 hover:bg-slate-50">
                        Add photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => patchSale(s.id, { photoUrl: String(reader.result ?? "") });
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Use as lease evidence</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1 text-center">
                    <input
                      type="checkbox"
                      checked={(meta.ciLeaseComps ?? []).some((c) => c.id === s.id)}
                      onChange={(e) => toggleLeaseEvidence(s, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Date</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.saleDate} onChange={(e) => patchSale(s.id, { saleDate: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Price</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                  <select className="mb-0.5 w-full border border-slate-300 rounded px-0.5 py-0.5 text-[0.6rem]" value={meta.subjectValueKind ?? "assessed"} onChange={(e) => onMeta({ subjectValueKind: e.target.value as "sale" | "assessed" })}>
                    <option value="sale">Sale price</option>
                    <option value="assessed">Assessed value</option>
                  </select>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={meta.subjectAskingPrice ?? ""} placeholder="Optional" onChange={(e) => onMeta({ subjectAskingPrice: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) onMeta({ subjectAskingPrice: f }); }} />
                </td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <div className="text-[0.6rem] text-slate-400">{s.isListing ? "Asking price" : "Sale price"}</div>
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5"
                      value={s.salePrice}
                      onChange={(e) => patchSale(s.id, { salePrice: e.target.value })}
                      onBlur={(e) => {
                        const formatted = formatCurrency(e.target.value);
                        if (formatted !== e.target.value) patchSale(s.id, { salePrice: formatted });
                      }}
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Land area</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectLand || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <div className="flex gap-1">
                      <input
                        className="w-full border border-slate-300 rounded px-1 py-0.5"
                        value={s.landArea}
                        onChange={(e) => patchSale(s.id, { landArea: e.target.value })}
                      />
                      <select
                        className="border border-slate-300 rounded px-0.5 py-0.5 text-[0.65rem]"
                        value={s.landUnit ?? "m2"}
                        onChange={(e) => patchSale(s.id, { landUnit: e.target.value as "m2" | "ha" })}
                      >
                        <option value="m2">m²</option>
                        <option value="ha">ha</option>
                      </select>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Land rate $/m²</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{meta.subjectAskingPrice ? rate(meta.subjectAskingPrice, subjectLand) : "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-2">{rate(s.salePrice, landAreaInM2(s))}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Building area</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectBuilding || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <div className="flex items-center gap-1">
                      <input
                        className="w-full border border-slate-300 rounded px-1 py-0.5"
                        value={s.gla ?? ""}
                        onChange={(e) => patchSale(s.id, { gla: e.target.value })}
                      />
                      <span className="text-slate-500 text-[0.65rem] whitespace-nowrap">m²</span>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Building rate $/m²</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{meta.subjectAskingPrice ? rate(meta.subjectAskingPrice, subjectBuilding) : "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-2">{rate(s.salePrice, s.gla)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Passing rent</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.passingRent ?? ""} onChange={(e) => {
                      const passingRent = e.target.value;
                      const price = num(s.salePrice);
                      const rent = num(passingRent);
                      const calculated = price && rent ? ((rent / price) * 100).toFixed(2) : "";
                      patchSale(s.id, s.saleYieldManual ? { passingRent, marketRent: passingRent } : { passingRent, marketRent: passingRent, saleYield: calculated });
                    }} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) patchSale(s.id, { passingRent: f, marketRent: f }); }} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Market rent</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.marketRent ?? ""} onChange={(e) => {
                      const marketRent = e.target.value;
                      const price = num(s.salePrice);
                      const rent = num(marketRent);
                      const calculated = price && rent ? ((rent / price) * 100).toFixed(2) : "";
                      patchSale(s.id, s.saleYieldManual ? { marketRent } : { marketRent, saleYield: calculated });
                    }} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) patchSale(s.id, { marketRent: f }); }} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Yield %</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => {
                  const price = num(s.salePrice);
                  const rent = num(s.marketRent);
                  const calculated = price && rent ? ((rent / price) * 100).toFixed(2) : "";
                  const shown = s.saleYieldManual ? (s.saleYield ?? "") : (calculated || s.saleYield || "");
                  return (
                    <td key={s.id} className="py-1 pr-1">
                      <input
                        className="w-full border border-slate-300 rounded px-1 py-0.5"
                        value={shown}
                        onChange={(e) => patchSale(s.id, { saleYield: e.target.value, saleYieldManual: true })}
                        title={s.saleYieldManual ? "Manual override" : "Calculated from market rent"}
                      />
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Clear height</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectClear || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.clearHeight ?? ""} onChange={(e) => patchSale(s.id, { clearHeight: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Loading</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectLoading || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.loading ?? ""} onChange={(e) => patchSale(s.id, { loading: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Office ratio</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectOffice || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.officeRatio ?? ""} onChange={(e) => patchSale(s.id, { officeRatio: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Condition</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{String(values["overall_cond"] ?? "") || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.condition ?? ""} onChange={(e) => patchSale(s.id, { condition: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Hardstand</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectHardstand || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.hardstand ?? ""} onChange={(e) => patchSale(s.id, { hardstand: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Notes</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <textarea className="w-full min-h-[4rem] border border-slate-300 rounded px-1 py-0.5" value={s.comments} onChange={(e) => patchSale(s.id, { comments: e.target.value })} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Adopted building rate $/m²</span>
            <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={meta.ciAdoptedBuildingRate ?? ""} onChange={(e) => onMeta({ ciAdoptedBuildingRate: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) onMeta({ ciAdoptedBuildingRate: f }); }} />
          </label>
          <span className="text-slate-600">→ {money(buildingIndication)}</span>
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Adopted land rate $/m²</span>
            <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={meta.ciAdoptedLandRate ?? ""} onChange={(e) => onMeta({ ciAdoptedLandRate: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) onMeta({ ciAdoptedLandRate: f }); }} />
          </label>
          <span className="text-slate-600">→ {money(landIndication)}</span>
        </div>
        {sales.some((s) => s.omitFromReport === true) ? (
          <div className="mt-2 text-xs text-slate-500">
            <div className="font-medium mb-1">Archived (not on report)</div>
            {sales.filter((s) => s.omitFromReport === true).map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="truncate">{s.address || "Sale"}</span>
                <button type="button" className="underline" onClick={() => patchSale(s.id, { omitFromReport: false })}>Restore</button>
                <button type="button" className="text-red-500" onClick={() => deleteSale(s.id)}>×</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

    </div>
  );
}
