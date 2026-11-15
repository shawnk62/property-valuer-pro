/**
 * Full-page comparable sheet for sales, leases and vacant land sales.
 * One comparable per page. Empty photo tiles are omitted.
 * Fields require valuer acceptance. Lot/plan is never pre-filled from the subject.
 */
import type { InspectionValues } from "@/lib/report/types";

export interface SheetPhoto {
  url: string;
  include?: boolean;
}

export interface ComparableSheetData {
  id: string;
  kind: "sale" | "lease" | "land";
  address: string;
  proximity?: string;
  price?: string;
  date?: string;
  landArea?: string;
  buildingArea?: string;
  photoUrl?: string;
  extraPhotos?: SheetPhoto[];
  includeSheet?: boolean;
  accepted?: Record<string, boolean>;
  overrides?: Record<string, string>;
  commentary?: string;
}

interface Props {
  data: ComparableSheetData;
  values: InspectionValues;
  onChange: (patch: Partial<ComparableSheetData>) => void;
}

const FIELDS = [
  { key: "zoning", label: "Zoning", subjectKey: "prop_zoning" },
  { key: "landUse", label: "Land use", subjectKey: "prop_landuse" },
  { key: "feeCode", label: "Fee code", subjectKey: "prop_title" },
  { key: "topography", label: "Land topography / shape", subjectKey: "prop_shape" },
  { key: "siteCover", label: "Site cover", subjectKey: "prop_site_cover" },
] as const;

export function ComparableSheet({ data, values, onChange }: Props) {
  const photos = [
    data.photoUrl ? { url: data.photoUrl, include: true } : null,
    ...(data.extraPhotos ?? []),
  ].filter((p): p is SheetPhoto => Boolean(p?.url && p.include !== false));

  function fieldValue(key: string, subjectKey: string): string {
    if (data.overrides?.[key] != null) return data.overrides[key];
    return String(values[subjectKey] ?? "");
  }

  function isAccepted(key: string): boolean {
    return Boolean(data.accepted?.[key]);
  }

  function setAccepted(key: string, accepted: boolean) {
    onChange({ accepted: { ...(data.accepted ?? {}), [key]: accepted } });
  }

  function setOverride(key: string, value: string) {
    onChange({
      overrides: { ...(data.overrides ?? {}), [key]: value },
      accepted: { ...(data.accepted ?? {}), [key]: true },
    });
  }

  return (
    <div className="comparable-sheet break-before-page break-after-page border border-slate-300 bg-white p-6 text-sm text-slate-800 print:shadow-none">
      <div className="mb-3 flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5">
        <div className="text-base font-semibold uppercase tracking-wide text-slate-700">
          {data.kind === "sale" ? "Sale" : data.kind === "lease" ? "Lease" : "Land sale"} — {data.address || "Comparable"}
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={data.includeSheet !== false}
            onChange={(e) => onChange({ includeSheet: e.target.checked })}
          />
          Include in report
        </label>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span className="font-medium">Address:</span> {data.address || "—"}</div>
        <div><span className="font-medium">Distance from subject:</span> {data.proximity || "—"}</div>
        <div><span className="font-medium">{data.kind === "lease" ? "Lease amount" : "Price"}:</span> {data.price || "—"}</div>
        <div><span className="font-medium">Date:</span> {data.date || "—"}</div>
        <div className="col-span-2"><span className="font-medium">Area:</span> {data.landArea || "—"} land{data.buildingArea ? ` and ${data.buildingArea} building` : ""}</div>
      </div>

      {photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <img key={i} src={p.url} alt="" className="max-h-40 w-full rounded border border-slate-200 object-contain bg-slate-50" />
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-1">
        {FIELDS.map((f) => {
          const proposed = fieldValue(f.key, f.subjectKey);
          const accepted = isAccepted(f.key);
          return (
            <div key={f.key} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${accepted ? "bg-white" : "bg-amber-50"}`}>
              <span className="w-40 font-medium text-slate-600">{f.label}</span>
              <input
                className="flex-1 border border-slate-300 rounded px-1 py-0.5"
                value={accepted ? proposed : ""}
                placeholder={accepted ? "" : `Proposed: ${proposed || "blank"} — tick to accept`}
                onChange={(e) => setOverride(f.key, e.target.value)}
              />
              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(f.key, e.target.checked)} />
                Accept
              </label>
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded px-2 py-1 text-xs">
          <span className="w-40 font-medium text-slate-600">Lot / Plan</span>
          <input
            className="flex-1 border border-slate-300 rounded px-1 py-0.5"
            value={data.overrides?.lotPlan ?? ""}
            placeholder="Enter if known — not taken from subject"
            onChange={(e) => setOverride("lotPlan", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-slate-600">Commentary</div>
        <textarea
          className="mt-1 w-full min-h-[4rem] rounded border border-slate-300 px-2 py-1 text-xs"
          value={data.commentary ?? ""}
          onChange={(e) => onChange({ commentary: e.target.value })}
        />
      </div>

      <div className="mt-2 text-[0.65rem] text-slate-400">
        Additional photos: empty tiles are omitted from the printed report.
      </div>
    </div>
  );
}
