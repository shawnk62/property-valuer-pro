/**
 * Comparable land sales for the cost approach (commercial / industrial Shawn Full).
 * Separate from the improved sales comparison grid.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ComparableSale, InspectionValues, ReportMeta } from "@/lib/report/types";
import { attachComparablePhoto } from "@/lib/report/attachComparablePhoto";
import { RELATIVITY_OPTIONS, relativitySelectClass, type Relativity } from "@/lib/report/adjustmentGrid";
import { ComparableSheet } from "@/components/report/ComparableSheet";
import { effectiveLandSheet, landFromSheetPatch } from "@/components/report/comparableSheetHelpers";
import { geocodeGoogleAddresses } from "@/lib/maps/maps.functions";
import { proximityForRecords } from "@/lib/maps/distance";
import { pinsFromLandSales, pinsNeedingGeocode } from "@/lib/maps/salesMapPins";
import { isGoogleMapsConfigured, loadGoogleMapsKey } from "@/lib/maps/googleSettings";

function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function landAreaM2(area: string, unit?: string): number | null {
  const n = num(area);
  if (n == null) return null;
  return unit === "ha" ? n * 10000 : n;
}

function suggestedLandRating(saleRate: string, subjectRate: string): string {
  const sale = Number(String(saleRate).replace(/[^0-9.]/g, ""));
  const subject = Number(String(subjectRate).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(sale) || !Number.isFinite(subject) || sale <= 0 || subject <= 0) return "";
  if (Math.abs(sale - subject) / subject <= 0.02) return "Similar";
  return sale > subject ? "Superior" : "Inferior";
}

function ratePerM2(price: string, area: string, unit?: string): string {
  const p = num(price);
  const a = landAreaM2(area, unit);
  if (p == null || a == null || a <= 0) return "";
  return (p / a).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

function formatCurrency(raw: string): string {
  const n = num(raw);
  if (n == null) return raw.trim();
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

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
  concession?: string;
  landArea: string;
  landUnit?: "m2" | "ha";
  notes: string;
  proximity?: string;
  photoUrl?: string;
  photoLocalKey?: string;
  photoStoragePath?: string;
  topography?: string;
  zoning?: string;
  services?: string;
  shape?: string;
  rateAdjustments?: Record<string, string>;
  adjustments?: Record<string, { relativity: string; amount?: number; detail?: string }>;
  description?: string;
  extraPhotos?: Array<{ url: string; include?: boolean }>;
  includeSheet?: boolean;
  acceptedFields?: Record<string, boolean>;
  fieldOverrides?: Record<string, string>;
  verificationLink?: string;
  omitFromReport?: boolean;
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
  comparableSales,
}: {
  meta: ReportMeta;
  values: InspectionValues;
  onMeta: (patch: Partial<ReportMeta>) => void;
  subjectPhotoUrl?: string;
  inspectionId?: string;
  comparableSales?: ComparableSale[];
}) {
  const sales = meta.ciLandSales ?? [];
  const visibleSales = sales.filter((s) => s.omitFromReport !== true);
  const archivedSales = sales.filter((s) => s.omitFromReport === true);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [agentCallId, setAgentCallId] = useState<string | null>(null);
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

  function move(id: string, direction: -1 | 1) {
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
    onMeta({ ciLandSales: next });
  }

  function archive(id: string) {
    update(id, { omitFromReport: true });
  }

  const [distancesBusy, setDistancesBusy] = useState(false);
  const distancesTried = useRef(false);
  async function calculateDistances() {
    if (!isGoogleMapsConfigured()) {
      toast.error("Add a Google Maps API key in Settings first");
      return;
    }
    const key = loadGoogleMapsKey();
    setDistancesBusy(true);
    try {
      const pins = pinsFromLandSales({ values, landSales: sales, saved: null });
      const need = pinsNeedingGeocode(pins).filter((p) => p.address);
      let resolved = pins;
      if (need.length > 0) {
        const geo = await geocodeGoogleAddresses({ data: { apiKey: key, addresses: need.map((p) => p.address!) } });
        const byId = new Map(need.map((p, i) => [p.id, geo.results[i]]));
        resolved = pins.map((p) => {
          const hit = byId.get(p.id);
          return hit?.lat != null && hit.lng != null ? { ...p, lat: hit.lat, lng: hit.lng } : p;
        });
      }
      const next = proximityForRecords(sales, resolved, true);
      const filled = next.filter((s, i) => s.proximity && s.proximity !== sales[i]?.proximity).length;
      onMeta({ ciLandSales: next });
      toast.success(filled ? `Distance filled for ${filled} land sale${filled === 1 ? "" : "s"}` : "No distances could be calculated. Check the addresses.");
    } catch (err) {
      toast.error("Could not calculate distances", { description: err instanceof Error ? err.message : "Geocoding failed" });
    } finally {
      setDistancesBusy(false);
    }
  }

  useEffect(() => {
    if (distancesTried.current || distancesBusy) return;
    const missing = sales.some((s) => s.omitFromReport !== true && s.address?.trim() && !s.proximity?.trim());
    if (!missing) return;
    distancesTried.current = true;
    void calculateDistances();
  }, [sales]);

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
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={meta.printLandEvidence !== false}
          onChange={(e) => onMeta({ printLandEvidence: e.target.checked })}
        />
        Include land sales evidence table on report
      </label>
      <button type="button" className="mb-2 rounded border border-slate-300 px-2 py-0.5 text-xs" disabled={distancesBusy} onClick={() => void calculateDistances()}>{distancesBusy ? "Calculating…" : "Calculate distances"}</button>
      <button
        type="button"
        onClick={() => onMeta({ ciLandSales: [...sales, blank()] })}
        className="mb-2 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
      >
        Add land sale
      </button>
      {sales.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">No land sales yet.</p>
      ) : visibleSales.length > 0 ? (
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
                {visibleSales.map((s, idx) => (
                  <th key={s.id} className="py-1 pr-2 min-w-[8rem]">
                    <div className="text-[0.65rem] font-semibold text-slate-500 uppercase">Land sale {idx + 1}</div>
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs font-medium"
                      value={s.address}
                      placeholder="Land sale address"
                      onChange={(e) => update(s.id, { address: e.target.value })}
                    />
                    <div className="mt-0.5 flex gap-1 text-[0.65rem]">
                      <button type="button" className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-slate-600" onClick={() => setAgentCallId(s.id)}>Agent call</button>
                      <button type="button" disabled={idx === 0} className="text-slate-500 disabled:opacity-30" onClick={() => move(s.id, -1)}>←</button>
                      <button type="button" disabled={idx === visibleSales.length - 1} className="text-slate-500 disabled:opacity-30" onClick={() => move(s.id, 1)}>→</button>
                      <button type="button" className="text-slate-500" onClick={() => archive(s.id)} title="Hold in working file">Archive</button>
                      <button type="button" className="text-red-500" onClick={() => remove(s.id)}>×</button>
                    </div>
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
                {visibleSales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    {s.photoUrl ? (
                      <div className="relative">
                        <img src={s.photoUrl} alt={s.address} className="w-full max-h-28 rounded object-contain bg-slate-50" />
                        <button type="button" className="absolute right-0.5 top-0.5 rounded bg-white/90 px-1 text-[0.6rem] text-red-600" onClick={() => update(s.id, { photoUrl: "" })}>Remove</button>
                      </div>
                    ) : (
                      <div role="button" tabIndex={0} className="flex h-20 w-full cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-[0.65rem] text-slate-400 hover:bg-slate-50" onClick={() => { photoTargetRef.current = s.id; photoInputRef.current?.click(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photoTargetRef.current = s.id; photoInputRef.current?.click(); } }} onPaste={(e) => { const f = imageFileFromClipboard(e); if (f) { e.preventDefault(); e.stopPropagation(); void attachLandPhoto(s.id, f); return; } e.preventDefault(); e.stopPropagation(); void (async () => { try { if (!navigator.clipboard?.read) { toast.error("Paste not available — tap the tile, then paste, or choose a file."); return; } const items = await navigator.clipboard.read(); for (const item of items) { for (const type of item.types) { if (type.startsWith("image/")) { const blob = await item.getType(type); const file = new File([blob], "pasted.png", { type }); void attachLandPhoto(s.id, file); return; } } } toast.error("No image on the clipboard"); } catch { toast.error("Could not read clipboard"); } })(); }}>
                        Add photo
                      </div>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Proximity</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {visibleSales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.proximity ?? ""} placeholder="e.g. 1.2 km N" onChange={(e) => update(s.id, { proximity: e.target.value })} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Date</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {visibleSales.map((s) => (
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
                {visibleSales.map((s) => (
                  <td key={s.id} className="py-1 pr-1">
                    <input className="w-full border border-slate-300 rounded px-1 py-0.5" value={s.price} onChange={(e) => update(s.id, { price: e.target.value })} onBlur={(e) => { const f = formatCurrency(e.target.value); if (f !== e.target.value) update(s.id, { price: f }); }} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Land area</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">{subjectLand || "—"}</td>
                {visibleSales.map((s) => (
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
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Rate $/m²</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                  <input
                    className="w-full border border-slate-300 rounded px-1 py-0.5"
                    value={meta.ciAdoptedLandRate ?? ""}
                    placeholder="Adopted"
                    onChange={(e) => onMeta({ ciAdoptedLandRate: e.target.value })}
                  />
                </td>
                {visibleSales.map((s) => (
                  <td key={s.id} className="py-1 pr-1 text-right font-medium">
                    {ratePerM2(s.price, s.landArea, s.landUnit) || "—"}
                  </td>
                ))}
              </tr>
              {[
                { id: "location", label: "Location / access", subject: "", key: "proximity" as const },
                { id: "topography", label: "Topography", subject: String(values["topo"] ?? ""), key: "topography" as const },
                { id: "zoning", label: "Zoning", subject: String(values["prop_zoning"] ?? ""), key: "zoning" as const },
                { id: "services", label: "Services", subject: "", key: "services" as const },
                { id: "shape", label: "Shape / frontage", subject: String(values["prop_shape"] ?? ""), key: "shape" as const },
              ].map((feature) => (
                <tr key={feature.id} className="border-b border-slate-100">
                  <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">{feature.label}</td>
                  <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">
                    <input
                      className="w-full border border-slate-300 rounded px-1 py-0.5"
                      value={meta.ciSubjectFeatures?.[feature.id] ?? feature.subject}
                      placeholder={feature.subject || "Subject"}
                      onChange={(e) => onMeta({ ciSubjectFeatures: { ...(meta.ciSubjectFeatures ?? {}), [feature.id]: e.target.value } })}
                    />
                  </td>
                  {visibleSales.map((s) => (
                    <td key={s.id} className="py-1 pr-1">
                      <div className="flex flex-col gap-0.5">
                        <input
                          className="w-full border border-slate-300 rounded px-1 py-0.5"
                          value={(s[feature.key] as string | undefined) ?? ""}
                          placeholder={feature.label}
                          onChange={(e) => update(s.id, { [feature.key]: e.target.value })}
                        />
                        <select
                          className={relativitySelectClass(s.adjustments?.[feature.id]?.relativity)}
                          value={s.adjustments?.[feature.id]?.relativity ?? "similar"}
                          onChange={(e) => update(s.id, { adjustments: { ...(s.adjustments ?? {}), [feature.id]: { ...(s.adjustments?.[feature.id] ?? {}), relativity: e.target.value as Relativity } } })}
                        >
                          {RELATIVITY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            className="w-full border border-slate-300 rounded px-1 py-0.5"
                            value={s.rateAdjustments?.[feature.id] ?? ""}
                            placeholder="0"
                            onChange={(e) => update(s.id, { rateAdjustments: { ...(s.rateAdjustments ?? {}), [feature.id]: e.target.value } })}
                          />
                          <span className="text-slate-500 text-[0.65rem]">%</span>
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white py-1 pr-2 text-slate-500">Notes</td>
                <td className="sticky left-[6rem] z-10 bg-white py-1 pr-2 min-w-[8rem]">—</td>
                {visibleSales.map((s) => (
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
      ) : null}
      {archivedSales.length > 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Working file — omitted from report
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              These land sales stay on the job with notes, photos and adjustments. They
              are not printed and do not leave a gap in the grid. Tick Include on report
              to put one back.
            </p>
          </div>
          <ul className="space-y-2">
            {archivedSales.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start gap-3 rounded border border-border bg-card p-2"
              >
                {s.photoUrl ? (
                  <img
                    src={s.photoUrl}
                    alt=""
                    className="h-14 w-16 shrink-0 rounded border border-border object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {s.address.trim() || "Untitled land sale"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[s.date, s.price, s.landArea ? `${s.landArea} ${s.landUnit === "ha" ? "ha" : "m²"}` : ""].filter(Boolean).join(" · ") ||
                      "No land sale facts entered"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => update(s.id, { omitFromReport: false })}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Include on report
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {visibleSales.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Land sales table</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-left">
                {["No.", "Address", "Price", "Date", "Land area", "Price/m²", "Distance", "Overall rating"].map((h) => (
                  <th key={h} className="border border-slate-300 px-2 py-1.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((s, idx) => (
                <tr key={s.id}>
                  <td className="border border-slate-300 px-2 py-1">{idx + 1}</td>
                  <td className="border border-slate-300 px-1 py-1"><input className="w-full rounded border border-slate-300 px-1 py-0.5" value={s.address} onChange={(e) => update(s.id, { address: e.target.value })} /></td>
                  <td className="border border-slate-300 px-1 py-1"><input className="w-full rounded border border-slate-300 px-1 py-0.5" value={s.price} onChange={(e) => update(s.id, { price: e.target.value })} /></td>
                  <td className="border border-slate-300 px-1 py-1"><input className="w-full rounded border border-slate-300 px-1 py-0.5" value={s.date} onChange={(e) => update(s.id, { date: e.target.value })} /></td>
                  <td className="border border-slate-300 px-1 py-1"><input className="w-full rounded border border-slate-300 px-1 py-0.5" value={s.landArea} onChange={(e) => update(s.id, { landArea: e.target.value })} /></td>
                  <td className="border border-slate-300 px-2 py-1">{ratePerM2(s.price, s.landArea, s.landUnit) || "—"}</td>
                  <td className="border border-slate-300 px-1 py-1"><input className="w-full rounded border border-slate-300 px-1 py-0.5" value={s.proximity ?? ""} placeholder="e.g. 1.2 km N" onChange={(e) => update(s.id, { proximity: e.target.value })} /></td>
                  <td className="border border-slate-300 px-1 py-1"><input className="w-full rounded border border-slate-300 px-1 py-0.5" value={s.overallRating ?? ""} placeholder={suggestedLandRating(ratePerM2(s.price, s.landArea, s.landUnit), meta.costApproach?.landRate ?? "") || "Similar"} onChange={(e) => update(s.id, { overallRating: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {visibleSales.filter((s) => s.address || s.price).map((s, idx) => (
        <ComparableSheet
          key={s.id}
          inspectionId={inspectionId}
          data={effectiveLandSheet(s, idx + 1, {
            sales: comparableSales,
            leases: meta.ciLeaseComps,
            landSales: sales,
          })}
          values={values}
          onChange={(patch) => update(s.id, landFromSheetPatch(s, patch))}
        />
      ))}
      {agentCallId ? (
        <LandAgentSheet
          sale={sales.find(s => s.id === agentCallId)!}
          onChange={(patch) => update(agentCallId, patch)}
          onClose={() => setAgentCallId(null)}
        />
      ) : null}
    </div>
  );
}


function LandAgentSheet({
  sale,
  onChange,
  onClose,
}: {
  sale: LandSale;
  onChange: (patch: Partial<LandSale>) => void;
  onClose: () => void;
}) {
  const f = (label: string, value: string, key: keyof LandSale, placeholder?: string) => (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-base" value={value} placeholder={placeholder} onChange={(e) => onChange({ [key]: e.target.value })} />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-800">Agent call — {sale.address || "Land sale"}</div>
          <button type="button" className="rounded border border-slate-300 px-3 py-1 text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="space-y-3">
          {f("Address", sale.address, "address")}
          {f("Sale date", sale.date, "date")}
          {f("Sale price", sale.price, "price")}
          {f("Sales or financing concession", sale.concession ?? "", "concession")}
          {f("Land area", sale.landArea, "landArea")}
          {f("Notes", sale.notes, "notes")}
        </div>
        <div className="mt-4 text-right">
          <button type="button" className="rounded bg-slate-800 px-4 py-2 text-sm text-white" onClick={onClose}>Save and close</button>
        </div>
      </div>
    </div>
  );
}
