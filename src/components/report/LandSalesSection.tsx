/**
 * Comparable land sales for the cost approach (commercial / industrial Shawn Full).
 * Separate from the improved sales comparison grid.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { InspectionValues, ReportMeta } from "@/lib/report/types";
import { attachComparablePhoto } from "@/lib/report/attachComparablePhoto";

function imageFileFromClipboard(e: React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue;
      const f = item.getAsFile();
      if (f && (f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name))) return f;
      if (item.type.startsWith("image/") && f && f.size > 0) {
        const ext = item.type.split("/")[1] || "png";
        return new File([f], `screenshot.${ext}`, { type: item.type });
      }
    }
  }
  const files = e.clipboardData?.files;
  if (files) {
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) return f;
    }
  }
  return null;
}


interface LandSale {
  id: string;
  address: string;
  date: string;
  price: string;
  landArea: string;
  landUnit?: "m2" | "ha";
  notes: string;
  proximity?: string;
  photoUrl?: string;
  photoLocalKey?: string;
  photoStoragePath?: string;
}

function blank(): LandSale {
  return {
    id: crypto.randomUUID(),
    address: "",
    date: "",
    price: "",
    landArea: "",
    landUnit: "m2",
    notes: "",
    proximity: "",
    photoUrl: "",
  };
}

export function LandSalesSection({
  meta,
  values,
  onMeta,
  subjectPhotoUrl,
  inspectionId,
}: {
  meta: ReportMeta;
  values: InspectionValues;
  onMeta: (patch: Partial<ReportMeta>) => void;
  subjectPhotoUrl?: string;
  inspectionId?: string;
}) {
  const sales = meta.ciLandSales ?? [];
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string | null>(null);
  const subjectAddress = [values["prop_address"], values["prop_suburb"]].filter(Boolean).join(", ") || "Subject";
  const subjectLand = String(values["prop_usable_sitearea"] ?? values["prop_sitearea"] ?? "");


  async function attachLandPhoto(saleId: string, file: File) {
    if (!inspectionId) return;
    try {
      const result = await attachComparablePhoto({ inspectionId, photoId: `land-${saleId}-front`, file });
      update(saleId, { photoUrl: result.photoUrl, photoLocalKey: result.photoLocalKey, photoStoragePath: result.photoStoragePath });
      toast[result.synced ? "success" : "message"](result.synced ? "Photo attached and synced" : "Photo saved on this device only");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read photo");
    }
  }

  function update(id: string, patch: Partial<LandSale>) {
    onMeta({
      ciLandSales: sales.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this land sale from the working file?")) return;
    onMeta({ ciLandSales: sales.filter((s) => s.id !== id) });
  }

  return (
    <div className="mt-2">
      <div className="text-sm font-semibold text-slate-700 mb-1">Comparable land sales</div>
      <p className="text-xs text-slate-500 mb-2">
        Land sales support the land value in the cost approach. Improved sales stay in the sales comparison grid.
      </p>
      <button
        type="button"
        onClick={() => onMeta({ ciLandSales: [...sales, blank()] })}
        className="mb-2 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        Add land sale
      </button>
      {sales.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">No land sales yet.</p>
      ) : (
        <>
        <input ref={photoInputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = photoTargetRef.current;
          if (file && targetId) void attachLandPhoto(targetId, file);
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
                {sales.map((s) => (
                  <th key={s.id} className="py-1 pr-2 min-w-[8rem]">
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs font-medium"
                      value={s.address}
                      placeholder="Land sale address"
                      onChange={(e) => update(s.id, { address: e.target.value })}
                    />
                    <button type="button" className="mt-0.5 text-red-500 text-[0.65rem]" onClick={() => remove(s.id)}>×</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Photo</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                  {subjectPhotoUrl ? <img src={subjectPhotoUrl} alt="Subject" className="w-full max-h-28 rounded object-contain bg-slate-50" /> : "—"}
                </td>
                {sales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    {s.photoUrl ? (
                      <div className="relative">
                        <img src={s.photoUrl} alt={s.address} className="w-full max-h-28 rounded object-contain bg-slate-50" />
                        <button type="button" className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-[0.6rem] text-red-600" onClick={() => update(s.id, { photoUrl: "" })}>Remove</button>
                      </div>
                    ) : (
                      <button type="button" tabIndex={0} className="flex h-20 w-full cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[0.65rem] text-slate-400 hover:bg-slate-50" onClick={() => { photoTargetRef.current = s.id; photoInputRef.current?.click(); }} onPaste={(e) => { const f = imageFileFromClipboard(e); if (f) { e.preventDefault(); void attachLandPhoto(s.id, f); } }}>
                        Add photo
                      </button>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Proximity</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.proximity ?? ""} placeholder="e.g. 1.2 km N" onChange={(e) => update(s.id, { proximity: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Date</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.date} onChange={(e) => update(s.id, { date: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Price</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                  <select className="mb-0.5 w-full border border-slate-300 rounded px-0.5 py-0.5 text-[0.6rem]" value={meta.subjectValueKind ?? "assessed"} onChange={(e) => onMeta({ subjectValueKind: e.target.value as "sale" | "assessed" })}>
                    <option value="sale">Sale price</option>
                    <option value="assessed">Assessed value</option>
                  </select>
                  <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={meta.subjectAskingPrice ?? ""} placeholder="Optional" onChange={(e) => onMeta({ subjectAskingPrice: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) onMeta({ subjectAskingPrice: f }); }} />
                </td>
                {sales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.price} onChange={(e) => update(s.id, { price: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) update(s.id, { price: f }); }} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Land area</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectLand || "—"}</td>
                {sales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <div className="flex items-center gap-1">
                      <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.landArea} onChange={(e) => update(s.id, { landArea: e.target.value })} />
                      <select className="border border-slate-300 rounded px-1 py-0.5" value={s.landUnit ?? "m2"} onChange={(e) => update(s.id, { landUnit: e.target.value as "m2" | "ha" })}>
                        <option value="m2">m²</option>
                        <option value="ha">ha</option>
                      </select>
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Notes</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {sales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <textarea
                      className={`border border-slate-300 rounded px-1 py-0.5 ${expandedNotesId === s.id ? "fixed inset-4 z-50 min-h-[50vh] bg-white shadow-lg" : "w-full min-h-[3rem]"}`}
                      value={s.notes}
                      onFocus={() => setExpandedNotesId(s.id)}
                      onBlur={() => setExpandedNotesId(null)}
                      onChange={(e) => update(s.id, { notes: e.target.value })}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
