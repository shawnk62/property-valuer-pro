/**
 * Full-page comparable sheet for sales, leases and vacant land sales.
 * One comparable per page. Empty photo tiles are omitted.
 * Fields require valuer acceptance. Lot/plan is never pre-filled from the subject.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { InspectionValues } from "@/lib/report/types";
import { attachComparablePhoto } from "@/lib/report/attachComparablePhoto";
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
  /** Formatted net rent rate for lease sheets, e.g. $232/m². */
  rentPerM2?: string;
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
  printMode?: boolean;
  inspectionId?: string;
}

const FIELDS = [
  { key: "zoning", label: "Zoning", subjectKey: "prop_zoning" },
  { key: "landUse", label: "Land use", subjectKey: "" },
  { key: "feeCode", label: "Fee code", subjectKey: "prop_rights" },
  { key: "topography", label: "Land topography / shape", subjectKey: "prop_shape" },
  { key: "siteCover", label: "Site cover", subjectKey: "prop_site_cover" },
] as const;

/** Printed tiles must have a URL and must not be explicitly excluded. */
function isPrintedSheetPhoto(p: { url?: string; include?: boolean } | null | undefined): p is SheetPhoto {
  return Boolean(p?.url?.trim()) && p!.include !== false;
}

function isImageFile(f: File | null | undefined): f is File {
  if (!f || f.size <= 0) return false;
  if (f.type.startsWith("image/")) return true;
  if (!f.type && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) return true;
  if (!f.type && /^image$/i.test(f.name)) return true;
  return false;
}

function imageFileFromClipboard(e: React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (items) {
    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue;
      const f = item.getAsFile();
      if (isImageFile(f)) return f;
      if (item.type.startsWith("image/")) {
        const blob = f ?? null;
        if (blob && blob.size > 0) {
          const ext = item.type.split("/")[1] || "png";
          return new File([blob], `screenshot.${ext}`, { type: item.type || "image/png" });
        }
      }
    }
  }
  const files = e.clipboardData?.files;
  if (files) {
    for (const f of Array.from(files)) {
      if (isImageFile(f)) return f;
    }
  }
  return null;
}

function ExtraPhotoTile({
  photo,
  uploading,
  onFile,
  onInclude,
  onRemove,
}: {
  photo: SheetPhoto;
  uploading: boolean;
  onFile: (file: File) => void;
  onInclude: (include: boolean) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUrl = Boolean(photo.url?.trim());

  function acceptFile(file: File | null) {
    if (file) onFile(file);
  }

  return (
    <div className="rounded border border-slate-200 bg-slate-50">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={uploading || undefined}
        onClick={() => {
          if (!uploading) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (uploading) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={(e) => {
          if (uploading) return;
          const sync = imageFileFromClipboard(e);
          if (sync) {
            e.preventDefault();
            e.stopPropagation();
            acceptFile(sync);
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          void (async () => {
            try {
              if (!navigator.clipboard?.read) {
                toast.error("Paste not available — click the tile, then paste, or choose a file.");
                return;
              }
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const type = item.types.find((x) => x.startsWith("image/"));
                if (!type) continue;
                const blob = await item.getType(type);
                if (!blob || blob.size <= 0) continue;
                const ext = type.split("/")[1] || "png";
                acceptFile(new File([blob], `screenshot.${ext}`, { type }));
                return;
              }
              toast.error("No image on the clipboard", {
                description: "Copy a screenshot, click this tile, then press ⌘V.",
              });
            } catch {
              toast.error("Could not read clipboard", {
                description: "Click the tile and press ⌘V, or tap to choose a file.",
              });
            }
          })();
        }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).focus?.()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (uploading) return;
          const file = Array.from(e.dataTransfer.files ?? []).find((f) => isImageFile(f)) ?? null;
          acceptFile(file);
        }}
        className="relative flex min-h-[8rem] max-h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-t bg-slate-50 text-[0.65rem] text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
      >
        {hasUrl ? (
          <img src={photo.url} alt="" className="pointer-events-none max-h-40 w-full object-contain" />
        ) : (
          <span className="px-3 text-center">
            {uploading ? "Reading…" : "Paste (⌘V), drop, or tap to choose"}
          </span>
        )}
        {uploading && hasUrl ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[0.65rem] font-medium text-slate-700">
            Saving…
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          acceptFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <div className="flex items-center justify-between gap-1 border-t border-slate-200 px-1.5 py-1 text-[0.65rem]">
        {hasUrl ? (
          <label className="flex items-center gap-1 text-slate-600" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={photo.include !== false}
              onChange={(e) => onInclude(e.target.checked)}
            />
            Include in report
          </label>
        ) : (
          <span className="text-slate-400">Empty — not printed</span>
        )}
        <button
          type="button"
          className="text-red-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function ComparableSheet({ data, values, onChange, printMode = false, inspectionId }: Props) {
  const extras = data.extraPhotos ?? [];
  const extrasRef = useRef(extras);
  extrasRef.current = extras;
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const printedPhotos = [
    data.photoUrl ? { url: data.photoUrl, include: true } : null,
    ...extras,
  ].filter(isPrintedSheetPhoto);

  function setExtras(next: SheetPhoto[]) {
    extrasRef.current = next;
    onChange({ extraPhotos: next });
  }

  function addTile() {
    setExtras([...extrasRef.current, { url: "", include: true }]);
  }

  function updateExtra(index: number, patch: Partial<SheetPhoto>) {
    setExtras(extrasRef.current.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removeExtra(index: number) {
    setExtras(extrasRef.current.filter((_, i) => i !== index));
  }

  async function attachExtra(index: number, file: File) {
    if (!inspectionId) {
      toast.error("Photo could not be attached — this report is not linked to an inspection.");
      return;
    }
    setUploadingIndex(index);
    try {
      const result = await attachComparablePhoto({
        inspectionId,
        photoId: `${data.kind}-${data.id}-extra-${crypto.randomUUID()}`,
        file,
      });
      const current = extrasRef.current[index];
      updateExtra(index, { url: result.photoUrl, include: current?.include !== false });
      toast[result.synced ? "success" : "message"](
        result.synced ? "Photo attached and synced" : "Photo saved on this device only",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read photo");
    } finally {
      setUploadingIndex(null);
    }
  }

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
        {data.kind === "lease" ? (
          <>
            <div><span className="font-medium">Address:</span> {data.address || "—"}</div>
            <div><span className="font-medium">Area:</span> {data.landArea || "—"} land{data.buildingArea ? ` and ${data.buildingArea} building` : ""}</div>
            <div><span className="font-medium">Lease amount:</span> {data.price || "—"}</div>
            <div><span className="font-medium">Distance from subject:</span> {data.proximity || "—"}</div>
            <div><span className="font-medium">Rent/m²:</span> {data.rentPerM2 || "—"}</div>
            <div><span className="font-medium">Date:</span> {data.date || "—"}</div>
          </>
        ) : (
          <>
            <div><span className="font-medium">Address:</span> {data.address || "—"}</div>
            <div><span className="font-medium">Distance from subject:</span> {data.proximity || "—"}</div>
            <div><span className="font-medium">Price:</span> {data.price || "—"}</div>
            <div><span className="font-medium">Date:</span> {data.date || "—"}</div>
            <div className="col-span-2"><span className="font-medium">Area:</span> {data.landArea || "—"} land{data.buildingArea ? ` and ${data.buildingArea} building` : ""}</div>
          </>
        )}
      </div>

      {printMode ? (
        printedPhotos.length > 0 ? (
          <div
            className={`mt-3 grid border border-slate-300 bg-white ${
              printedPhotos.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {printedPhotos.map((p, i) => (
              <div
                key={i}
                className={`flex items-center justify-center p-3 ${
                  printedPhotos.length > 1 && i % 2 === 0 ? "border-r border-slate-300" : ""
                } ${i >= 2 ? "border-t border-slate-300" : ""}`}
              >
                <img
                  src={p.url}
                  alt=""
                  className="max-h-56 w-full object-contain"
                />
              </div>
            ))}
          </div>
        ) : null
      ) : (
        <div className="mt-3 space-y-1">
          <div className="grid grid-cols-2 gap-2">
            {data.photoUrl?.trim() ? (
              <img
                src={data.photoUrl}
                alt=""
                className="max-h-40 w-full rounded border border-slate-200 object-contain bg-slate-50"
              />
            ) : null}
            {extras.map((p, i) => (
              <ExtraPhotoTile
                key={i}
                photo={p}
                uploading={uploadingIndex === i}
                onFile={(file) => void attachExtra(i, file)}
                onInclude={(include) => updateExtra(i, { include })}
                onRemove={() => removeExtra(i)}
              />
            ))}
            <button
              type="button"
              onClick={addTile}
              className="flex min-h-[8rem] max-h-40 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-slate-300 bg-white text-[0.65rem] font-medium text-slate-400 hover:bg-slate-50"
            >
              Add photo tile
            </button>
          </div>
          <div className="text-[0.65rem] text-slate-400">
            Additional photos: empty tiles are omitted from the printed report.
          </div>
        </div>
      )}

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
        </>
      )}
    </div>
  );
}
