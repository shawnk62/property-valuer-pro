/**
 * Lease evidence grid for commercial / industrial Shawn Full.
 * Subject facts stay on the inspection form. These are market lettings.
 */
import type { ReportMeta } from "@/lib/report/types";

interface LeaseComp {
  id: string;
  address: string;
  date: string;
  nla: string;
  netRentPerM2: string;
  term: string;
  incentives: string;
  outgoings: string;
  notes: string;
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
    photoUrl: "",
  };
}

export function LeaseEvidenceGrid({
  meta,
  onMeta,
}: {
  meta: ReportMeta;
  onMeta: (patch: Partial<ReportMeta>) => void;
}) {
  const comps = meta.ciLeaseComps ?? [];

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
    onMeta({ ciLeaseComps: comps.filter((c) => c.id !== id) });
  }

  return (
    <div className="mt-2">
      <div className="text-sm font-semibold text-slate-700 mb-1">Lease evidence</div>
      <p className="text-xs text-slate-500 mb-2">
        Record comparable lettings. Adopt a net equivalent market rent from the evidence.
      </p>
      {comps.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">No lease comparables yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-2">Address</th>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">NLA m²</th>
                <th className="py-1 pr-2">Net rent $/m²</th>
                <th className="py-1 pr-2">Term</th>
                <th className="py-1 pr-2">Incentives</th>
                <th className="py-1 pr-2">Outgoings</th>
                <th className="py-1 pr-2">Photo</th>
                <th className="py-1 pr-2">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={c.address} onChange={(e) => update(c.id, { address: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={c.date} onChange={(e) => update(c.id, { date: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    <input className="w-16 border border-slate-300 rounded px-1 py-0.5" value={c.nla} onChange={(e) => update(c.id, { nla: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    <input className="w-16 border border-slate-300 rounded px-1 py-0.5" value={c.netRentPerM2} onChange={(e) => update(c.id, { netRentPerM2: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={c.term} onChange={(e) => update(c.id, { term: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={c.incentives} onChange={(e) => update(c.id, { incentives: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    <input className="w-20 border border-slate-300 rounded px-1 py-0.5" value={c.outgoings} onChange={(e) => update(c.id, { outgoings: e.target.value })} />
                  </td>
                  <td className="py-1 pr-1">
                    {c.photoUrl ? (
                      <div className="relative">
                        <img src={c.photoUrl} alt={c.address} className="w-full max-h-20 rounded object-contain bg-slate-50" />
                        <button type="button" className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-[0.6rem] text-red-600" onClick={() => update(c.id, { photoUrl: "" })}>Remove</button>
                      </div>
                    ) : (
                      <label className="flex h-14 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[0.65rem] text-slate-400 hover:bg-slate-50">
                        Add
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => update(c.id, { photoUrl: String(reader.result ?? "") });
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    )}
                  </td>
                  <td className="py-1 pr-1">
                    <textarea className="w-28 min-h-[3rem] border border-slate-300 rounded px-1 py-0.5" value={c.notes} onChange={(e) => update(c.id, { notes: e.target.value })} />
                  </td>
                  <td className="py-1 whitespace-nowrap">
                    <button type="button" className="text-slate-500 mr-1" onClick={() => move(c.id, -1)}>←</button>
                    <button type="button" className="text-slate-500 mr-1" onClick={() => move(c.id, 1)}>→</button>
                    <button type="button" className="text-red-500" onClick={() => remove(c.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="text-xs text-slate-600 underline"
          onClick={() => onMeta({ ciLeaseComps: [...comps, blank()] })}
        >
          Add lease comparable
        </button>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-slate-500">Adopted net rent $/m²</span>
          <input
            className="w-20 border border-slate-300 rounded px-1 py-0.5"
            value={meta.ciAdoptedRentPerM2 ?? ""}
            onChange={(e) => onMeta({ ciAdoptedRentPerM2: e.target.value })}
          />
        </label>
      </div>

      {comps.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-600 mb-1">Lease evidence photos</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {comps.map((c, idx) => (
              <div key={c.id} className="rounded border border-slate-200 p-1.5">
                <p className="text-[0.65rem] font-medium truncate">{c.address || `Lease ${idx + 1}`}</p>
                {c.photoUrl ? (
                  <div className="relative mt-1">
                    <img src={c.photoUrl} alt={c.address} className="max-h-24 w-full rounded object-contain bg-slate-50" />
                    <button type="button" className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-[0.6rem] text-red-600" onClick={() => update(c.id, { photoUrl: "" })}>Remove</button>
                  </div>
                ) : (
                  <label className="mt-1 flex h-16 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[0.65rem] text-slate-400 hover:bg-slate-50">
                    Add photo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => update(c.id, { photoUrl: String(reader.result ?? "") });
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
