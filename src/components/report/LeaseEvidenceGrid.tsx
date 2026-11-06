/**
 * Lease evidence grid for commercial / industrial Shawn Full.
 * Column-per-comparable layout matching the sales comparison table.
 * No sale price and no yield. Subject facts come from the inspection form.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { InspectionValues, ReportMeta } from "@/lib/report/types";
import { attachComparablePhoto } from "@/lib/report/attachComparablePhoto";

export interface LeaseComp {
  id: string;
  address: string;
  date: string;
  nla: string;
  netRentPerM2: string;
  term: string;
  incentives: string;
  outgoings: string;
  notes: string;
  proximity?: string;
  photoUrl?: string;
  photoLocalKey?: string;
  photoStoragePath?: string;
  clearHeight?: string;
  loading?: string;
  officeRatio?: string;
  condition?: string;
  hardstand?: string;
}

function blank(): LeaseComp {
  return {
    id: crypto.randomUUID(),
    address: "",
    date: "",
    nla: "",
    netRentPerM2: "",
    term: "",
    incentives: "",
    outgoings: "",
    notes: "",
    proximity: "",
    photoUrl: "",
    clearHeight: "",
    loading: "",
    officeRatio: "",
    condition: "",
    hardstand: "",
  };
}

export function LeaseEvidenceGrid({
  values,
  meta,
  onMeta,
  subjectPhotoUrl,
}: {
  values: InspectionValues;
  meta: ReportMeta;
  onMeta: (patch: Partial<ReportMeta>) => void;
  subjectPhotoUrl?: string;
  inspectionId?: string;
}) {
  const comps = meta.ciLeaseComps ?? [];
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string | null>(null);
  const subjectAddress = [values["prop_address"], values["prop_suburb"]].filter(Boolean).join(", ") || "Subject";
  const subjectBuilding = String(values["comm_nla"] ?? values["comm_gba"] ?? "");
  const subjectClear = String(values["comm_clear_height"] ?? "");
  const subjectHardstand = String(values["comm_hardstand"] ?? "");
  const subjectLoading = String(values["comm_loading_config"] ?? "");
  const subjectOfficeRaw = String(values["comm_office_split"] ?? "");
  const subjectOffice = /\d|%|office/i.test(subjectOfficeRaw) ? subjectOfficeRaw : "";
  const subjectCondition = String(values["overall_cond"] ?? "");

  function update(id: string, patch: Partial<LeaseComp>) {
    onMeta({
      ciLeaseComps: comps.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function move(id: string, direction: -1 | 1) {
    const idx = comps.findIndex((c) => c.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= comps.length) return;
    const next = [...comps];
    [next[idx], next[target]] = [next[target], next[idx]];
    onMeta({ ciLeaseComps: next });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this lease comparable from the working file?")) return;
    onMeta({ ciLeaseComps: comps.filter((c) => c.id !== id) });
  }

  return (
    <div className="mt-2">
      <div className="text-sm font-semibold text-slate-700 mb-1">Lease evidence</div>
      <p className="text-xs text-slate-500 mb-2">
        Subject facts are from the inspection. Enter lease details. Adopt a net equivalent market rent from the evidence.
      </p>
      <button
        type="button"
        onClick={() => onMeta({ ciLeaseComps: [...comps, blank()] })}
        className="mb-2 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        Add lease comparable
      </button>
      {comps.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">No lease comparables yet.</p>
      ) : (
        <input ref={photoInputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = photoTargetRef.current;
          if (!file || !inspectionId || !targetId) return;
          void (async () => {
            try {
              const result = await attachComparablePhoto({ inspectionId, photoId: `lease-${targetId}-front`, file });
              update(targetId, { photoUrl: result.photoUrl, photoLocalKey: result.photoLocalKey, photoStoragePath: result.photoStoragePath });
              toast[result.synced ? "success" : "message"](result.synced ? "Photo attached and synced" : "Photo saved on this device only");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not read photo");
            }
          })();
        }} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="sticky left-0 z-20 bg-white py-1 pr-2 min-w-[6rem]">Item</th>
                <th className="sticky left-[6rem] z-20 bg-white py-1 pr-2 min-w-[8rem]">
                  <div className="text-xs font-medium text-foreground">{subjectAddress}</div>
                  <div className="text-[0.6rem] text-slate-400">Subject</div>
                </th>
                {comps.map((c, idx) => (
                  <th key={c.id} className="py-1 pr-2 min-w-[8rem]">
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs font-medium text-foreground"
                      value={c.address}
                      placeholder="Lease address"
                      onChange={(e) => update(c.id, { address: e.target.value })}
                    />
                    <div className="mt-0.5 flex gap-1 text-[0.65rem] font-normal">
                      <button type="button" disabled={idx === 0} className="text-slate-500 disabled:opacity-30" onClick={() => move(c.id, -1)}>←</button>
                      <button type="button" disabled={idx === comps.length - 1} className="text-slate-500 disabled:opacity-30" onClick={() => move(c.id, 1)}>→</button>
                      <button type="button" className="text-red-500" onClick={() => remove(c.id)}>×</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Photo</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                  {subjectPhotoUrl ? <img src={subjectPhotoUrl} alt="Subject" className="w-full max-h-28 rounded object-contain bg-slate-50" /> : "—"}
                </td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    {c.photoUrl ? (
                      <div className="relative">
                        <img src={c.photoUrl} alt={c.address} className="w-full max-h-28 rounded object-contain bg-slate-50" />
                        <button type="button" className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-[0.6rem] text-red-600" onClick={() => update(c.id, { photoUrl: "" })}>Remove</button>
                      </div>
                    ) : (
                      <button type="button" className="flex h-20 w-full cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[0.65rem] text-slate-400 hover:bg-slate-50" onClick={() => { photoTargetRef.current = c.id; photoInputRef.current?.click(); }}>
                        Add photo
                      </button>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Proximity to Subject</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.proximity ?? ""} placeholder="e.g. 1.2 km N" onChange={(e) => update(c.id, { proximity: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Lease date</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.date} onChange={(e) => update(c.id, { date: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Building area</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectBuilding || "—"}</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <div className="flex items-center gap-1">
                      <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.nla} onChange={(e) => update(c.id, { nla: e.target.value })} />
                      <span className="text-slate-500 text-[0.65rem] whitespace-nowrap">m²</span>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Net rent $/m²</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.netRentPerM2} onChange={(e) => update(c.id, { netRentPerM2: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) update(c.id, { netRentPerM2: f }); }} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Term</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.term} onChange={(e) => update(c.id, { term: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Incentives</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.incentives} onChange={(e) => update(c.id, { incentives: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Outgoings</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.outgoings} onChange={(e) => update(c.id, { outgoings: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Clear height</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectClear || "—"}</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.clearHeight ?? ""} onChange={(e) => update(c.id, { clearHeight: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Loading</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectLoading || "—"}</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.loading ?? ""} onChange={(e) => update(c.id, { loading: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Office ratio</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectOffice || "—"}</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.officeRatio ?? ""} onChange={(e) => update(c.id, { officeRatio: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Condition</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectCondition || "—"}</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.condition ?? ""} onChange={(e) => update(c.id, { condition: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Hardstand</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectHardstand || "—"}</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.hardstand ?? ""} onChange={(e) => update(c.id, { hardstand: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500 min-w-[6rem]">Notes</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {comps.map((c) => (
                  <td key={c.id} className="py-1 pr-1">
                    <textarea
                      className={`border border-slate-300 rounded px-1 py-0.5 ${expandedNotesId === c.id ? "fixed inset-4 z-50 min-h-[50vh] bg-white shadow-lg" : "w-full min-h-[4rem]"}`}
                      value={c.notes}
                      onFocus={() => setExpandedNotesId(c.id)}
                      onBlur={() => setExpandedNotesId(null)}
                      onChange={(e) => update(c.id, { notes: e.target.value })}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs">
          <span className="text-slate-500">Adopted net rent $/m²</span>
          <input
            className="w-20 border border-slate-300 rounded px-1 py-0.5"
            value={meta.ciAdoptedRentPerM2 ?? ""}
            onChange={(e) => onMeta({ ciAdoptedRentPerM2: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) onMeta({ ciAdoptedRentPerM2: f }); }}
          />
        </label>
      </div>
      <div className="mt-3">
        <div className="text-xs font-medium text-slate-600 mb-1">Lease evidence map</div>
        {meta.ciLeaseMapUrl ? (
          <div className="relative">
            <img src={meta.ciLeaseMapUrl} alt="Lease evidence map" className="max-h-48 w-full rounded object-contain bg-slate-50" />
            <button type="button" className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[0.65rem] text-red-600" onClick={() => onMeta({ ciLeaseMapUrl: "" })}>Remove</button>
          </div>
        ) : (
          <label className="flex h-20 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400 hover:bg-slate-50">
            Add lease map
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onMeta({ ciLeaseMapUrl: String(reader.result ?? "") });
              reader.readAsDataURL(file);
            }} />
          </label>
        )}
      </div>
    </div>
  );
}
