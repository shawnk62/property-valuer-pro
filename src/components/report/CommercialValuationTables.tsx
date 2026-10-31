/**
 * Working valuation tables for Shawn Full commercial and industrial only.
 * Subject facts come from the inspection form. Rates and adopted figures are entered here.
 * Residential reports do not use this component.
 */
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import { LeaseEvidenceGrid } from "@/components/report/LeaseEvidenceGrid";
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
}

export function CommercialValuationTables({ values, sales, meta, onSales, onMeta }: Props) {
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
            notes: "",
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-2">Item</th>
                <th className="py-1 pr-2">Subject</th>
                {sales.filter((s) => s.omitFromReport !== true).map((s, idx, arr) => (
                  <th key={s.id} className="py-1 pr-2 min-w-[8rem]">
                    <div className="truncate">{s.address || "Sale"}</div>
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
                <td className="py-1 pr-2 text-slate-500">Photo</td>
                <td className="py-1 pr-2">—</td>
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
                <td className="py-1 pr-2 text-slate-500">Use as lease evidence</td>
                <td className="py-1 pr-2">—</td>
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
                <td className="py-1 pr-2 text-slate-500">Date</td>
                <td className="py-1 pr-2">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.saleDate} onChange={(e) => patchSale(s.id, { saleDate: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Price</td>
                <td className="py-1 pr-2">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.salePrice} onChange={(e) => patchSale(s.id, { salePrice: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Land area m²</td>
                <td className="py-1 pr-2">{subjectLand || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.landArea} onChange={(e) => patchSale(s.id, { landArea: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="py-1 pr-2 text-slate-500">Land rate $/m²</td>
                <td className="py-1 pr-2">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-2">{rate(s.salePrice, s.landArea)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Building area m²</td>
                <td className="py-1 pr-2">{subjectBuilding || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.gla ?? ""} onChange={(e) => patchSale(s.id, { gla: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="py-1 pr-2 text-slate-500">Building rate $/m²</td>
                <td className="py-1 pr-2">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-2">{rate(s.salePrice, s.gla)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Yield %</td>
                <td className="py-1 pr-2">—</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.saleYield ?? ""} onChange={(e) => patchSale(s.id, { saleYield: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Clear height</td>
                <td className="py-1 pr-2">{subjectClear || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.clearHeight ?? ""} onChange={(e) => patchSale(s.id, { clearHeight: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Loading</td>
                <td className="py-1 pr-2">{subjectLoading || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.loading ?? ""} onChange={(e) => patchSale(s.id, { loading: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Office ratio</td>
                <td className="py-1 pr-2">{subjectOffice || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.officeRatio ?? ""} onChange={(e) => patchSale(s.id, { officeRatio: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Condition</td>
                <td className="py-1 pr-2">{String(values["overall_cond"] ?? "") || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.condition ?? ""} onChange={(e) => patchSale(s.id, { condition: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Hardstand</td>
                <td className="py-1 pr-2">{subjectHardstand || "—"}</td>
                {sales.filter((s) => s.omitFromReport !== true).map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.hardstand ?? ""} onChange={(e) => patchSale(s.id, { hardstand: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 pr-2 text-slate-500">Notes</td>
                <td className="py-1 pr-2">—</td>
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
            <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={meta.ciAdoptedBuildingRate ?? ""} onChange={(e) => onMeta({ ciAdoptedBuildingRate: e.target.value })} />
          </label>
          <span className="text-slate-600">→ {money(buildingIndication)}</span>
          <label className="flex items-center gap-1">
            <span className="text-slate-500">Adopted land rate $/m²</span>
            <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={meta.ciAdoptedLandRate ?? ""} onChange={(e) => onMeta({ ciAdoptedLandRate: e.target.value })} />
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

      <LeaseEvidenceGrid meta={meta} onMeta={onMeta} />

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Income capitalisation</h3>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {formatIncomeLines(income).map((row) => (
              <tr key={row.label} className="border-b border-slate-100">
                <td className="py-1 pr-4 text-slate-600">{row.label}</td>
                <td className="py-1 text-right font-medium">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Cost approach — summation</h3>
        <p className="text-xs text-muted-foreground mb-1">Land plus depreciated replacement of components. Used as a check.</p>
        {(meta.ciCostComponents ?? []).length === 0 ? (
          <button type="button" className="text-xs text-slate-600 underline mb-2" onClick={() => onMeta({
            ciCostComponents: [
              { name: "Land (vacant value)", area: subjectLand, rate: "", depreciation: "" },
              { name: "Warehouse / factory", area: "", rate: "", depreciation: "" },
              { name: "Office and amenities", area: "", rate: "", depreciation: "" },
              { name: "Mezzanine", area: "", rate: "", depreciation: "" },
              { name: "Awning", area: "", rate: "", depreciation: "" },
              { name: "Lift (nominal)", area: "", rate: "", depreciation: "" },
              { name: "Outbuildings", area: "", rate: "", depreciation: "" },
              { name: "Hardstand", area: subjectHardstand, rate: "", depreciation: "" },
              { name: "Lights", area: "", rate: "", depreciation: "" },
              { name: "Fencing", area: "", rate: "", depreciation: "" },
              { name: "Bollards", area: "", rate: "", depreciation: "" },
              { name: "Landscaping (nominal)", area: "", rate: "", depreciation: "" },
              { name: "Gate (nominal)", area: "", rate: "", depreciation: "" },
            ],
          })}>
            Start with industrial component list
          </button>
        ) : (
          (meta.ciCostComponents ?? []).map((c, i) => (
            <div key={i} className="grid grid-cols-4 gap-1 mb-1">
              <input className="border border-slate-300 rounded px-1 py-0.5 text-xs" value={c.name} onChange={(e) => {
                const next = [...(meta.ciCostComponents ?? [])];
                next[i] = { ...next[i], name: e.target.value };
                onMeta({ ciCostComponents: next });
              }} />
              <input className="border border-slate-300 rounded px-1 py-0.5 text-xs" placeholder="Qty" value={c.area} onChange={(e) => {
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
          ))
        )}
        <table className="w-full text-sm border-collapse mt-2">
          <tbody>
            {formatCostLines(cost).map((row) => (
              <tr key={row.label} className="border-b border-slate-100">
                <td className="py-1 pr-4 text-slate-600">{row.label}</td>
                <td className="py-1 text-right font-medium">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reconciliation.length ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Reconciliation</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {reconciliation.map((row) => (
                <tr key={row.label} className="border-b border-slate-100">
                  <td className="py-1 pr-4 text-slate-600">{row.label}</td>
                  <td className="py-1 text-right font-medium">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
