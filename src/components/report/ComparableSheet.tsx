/**
 * Full-page comparable sheet for sales, leases and vacant land sales.
 * One comparable per page. Empty photo tiles are omitted.
 * Fields require valuer acceptance. Lot/plan is never pre-filled from the subject.
 */
import type { InspectionValues } from "@/lib/report/types";
import { formatPropertyType } from "@/lib/report/schema";
import { PausedTextarea } from "./PausedTextarea";

export interface SheetPhoto {
  url: string;
  include?: boolean;
}

export interface ComparableSheetData {
  id: string;
  kind: "sale" | "lease" | "land";
  address: string;
  number?: number;
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
  description?: string;
  /** Working-report only. Link to the public source used for a field. */
  verificationLink?: string;
}

interface Props {
  data: ComparableSheetData;
  values: InspectionValues;
  onChange: (patch: Partial<ComparableSheetData>) => void;
}

const FIELDS = [
  { key: "zoning", label: "Zoning", subjectKey: "prop_zoning" },
  { key: "landUse", label: "Land use", subjectKey: "" },
  { key: "feeCode", label: "Fee code", subjectKey: "prop_rights" },
  { key: "topography", label: "Land topography / shape", subjectKey: "prop_shape" },
  { key: "siteCover", label: "Site cover", subjectKey: "prop_site_cover" },
] as const;

export function ComparableSheet({ data, values, onChange, printMode = false }: Props & { printMode?: boolean }) {
  const photos = [
    data.photoUrl ? { url: data.photoUrl, include: true } : null,
    ...(data.extraPhotos ?? []),
  ].filter((p): p is SheetPhoto => Boolean(p?.url && p.include !== false));

  function fieldValue(key: string, subjectKey: string): string {
    if (data.overrides?.[key] != null) return data.overrides[key];
    if (key === "landUse") {
      return formatPropertyType(values) || "";
    }
    const raw = String(values[subjectKey] ?? "");
    if (key === "feeCode") {
      if (/fee\s*simple|freehold/i.test(raw)) return "Freehold";
      if (/leasehold/i.test(raw)) return "Leasehold";
      return raw;
    }
    return raw;
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
          {data.kind === "sale" ? "Comparable sale" : data.kind === "lease" ? "Lease" : "Land sale"} {data.number ?? ""} — {data.address || "Comparable"}
        </div>
        {!printMode ? (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={data.includeSheet !== false}
              onChange={(e) => onChange({ includeSheet: e.target.checked })}
            />
            Include in report
          </label>
        ) : null}
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
        {printMode ? (
          FIELDS.map((f) => {
            const value = fieldValue(f.key, f.subjectKey);
            if (!value) return null;
            return (
              <div key={f.key} className="flex gap-2 text-xs">
                <span className="w-40 font-medium text-slate-600">{f.label}</span>
                <span>{value}</span>
              </div>
            );
          })
        ) : (
          FIELDS.map((f) => {
            const proposed = fieldValue(f.key, f.subjectKey);
            const accepted = isAccepted(f.key);
            return (
              <div key={f.key} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${accepted ? "bg-white" : "bg-amber-50"}`}>
                <span className="w-40 font-medium text-slate-600">{f.label}</span>
                <input
                  className="flex-1 border border-slate-300 rounded px-1 py-0.5"
                  value={proposed}
                  placeholder={proposed ? "" : "Not confirmed"}
                  onChange={(e) => setOverride(f.key, e.target.value)}
                />
                {data.verificationLink ? (
                  <a href={data.verificationLink} target="_blank" rel="noreferrer" className="print:hidden text-[0.65rem] text-blue-600 underline whitespace-nowrap">Verify</a>
                ) : null}
                <label className="flex items-center gap-1 whitespace-nowrap">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(f.key, e.target.checked)} />
                  Accept
                </label>
              </div>
            );
          })
        )}
        {!printMode ? (
          <div className="flex items-center gap-2 rounded px-2 py-1 text-xs">
            <span className="w-40 font-medium text-slate-600">Lot / Plan</span>
            <input
              className="flex-1 border border-slate-300 rounded px-1 py-0.5"
              value={data.overrides?.lotPlan ?? ""}
              placeholder="Enter if known — not taken from subject"
              onChange={(e) => setOverride("lotPlan", e.target.value)}
            />
          </div>
        ) : data.overrides?.lotPlan ? (
          <div className="flex gap-2 text-xs">
            <span className="w-40 font-medium text-slate-600">Lot / Plan</span>
            <span>{data.overrides.lotPlan}</span>
          </div>
        ) : null}
      </div>

      {printMode ? (
        <>
          {data.description?.trim() ? (
            <div className="mt-3 text-xs">
              <div className="font-medium text-slate-600">Description</div>
              <p className="mt-1 whitespace-pre-line">{data.description}</p>
            </div>
          ) : null}
          {data.commentary?.trim() ? (
            <div className="mt-2 text-xs">
              <div className="font-medium text-slate-600">Commentary</div>
              <p className="mt-1 whitespace-pre-line">{data.commentary}</p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-3">
            <div className="text-xs font-medium text-slate-600">Description</div>
            <PausedTextarea
              className="mt-1 w-full min-h-[8rem] rounded border border-slate-300 px-2 py-1 text-xs"
              value={data.description ?? ""}
              placeholder="Factual description of the comparable"
              onCommit={(description) => onChange({ description })}
            />
          </div>
          <div className="mt-2">
            <div className="text-xs font-medium text-slate-600">Commentary</div>
            <PausedTextarea
              className="mt-1 w-full min-h-[8rem] rounded border border-slate-300 px-2 py-1 text-xs"
              value={data.commentary ?? ""}
              placeholder="Valuer’s comparison commentary"
              onCommit={(commentary) => onChange({ commentary })}
            />
          </div>
          <div className="mt-2 text-[0.65rem] text-slate-400">
            Additional photos: empty tiles are omitted from the printed report.
          </div>
        </>
      )}
    </div>
  );
}
