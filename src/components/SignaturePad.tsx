import { useEffect, useRef, useState } from "react";
import {
  deleteSavedSignature,
  listSavedSignatures,
  saveSignature,
  type SavedSignature,
} from "@/lib/signatures/savedSignatures";

type Props = {
  value?: string;
  disabled?: boolean;
  onChange: (dataUrl: string) => void;
  /** Compact height for form embedding */
  height?: number;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

function isImageFile(f: File | null | undefined): f is File {
  if (!f || f.size <= 0) return false;
  if (f.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(f.name);
}

/**
 * Signature capture: draw, upload PNG/JPEG, paste, or select a saved signature.
 * value is a data:image URL when signed, or empty when cleared.
 */
export function SignaturePad({ value, disabled, onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [saveLabel, setSaveLabel] = useState("My signature");

  async function refreshSaved() {
    try {
      const list = await listSavedSignatures();
      setSaved(list);
    } catch {
      setSaved([]);
    }
  }

  useEffect(() => {
    void refreshSaved();
  }, []);

  // Paint existing signature onto canvas for redraw path
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (value && value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(rect.width / img.width, height / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (rect.width - w) / 2;
        const y = (height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        setHasInk(true);
      };
      img.src = value;
    } else {
      setHasInk(false);
    }
  }, [value, height]);

  function pos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0]!;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    const m = e as React.MouseEvent;
    return { x: m.clientX - rect.left, y: m.clientY - rect.top };
  }

  function start(e: React.TouchEvent | React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.TouchEvent | React.MouseEvent) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  function applyDrawn() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onChange(canvas.toDataURL("image/png"));
    setError(null);
  }

  async function applyFile(file: File | null) {
    if (!file || !isImageFile(file)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl.startsWith("data:image")) {
        setError("Could not read that image.");
        return;
      }
      onChange(dataUrl);
      setError(null);
    } catch {
      setError("Could not read that image.");
    }
  }

  function clear() {
    onChange("");
    setHasInk(false);
    setError(null);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
  }

  function onPaste(e: React.ClipboardEvent) {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) {
          e.preventDefault();
          void applyFile(f);
          return;
        }
      }
    }
  }

  function applySaved(sig: SavedSignature) {
    onChange(sig.dataUrl);
    setPickerOpen(false);
    setError(null);
  }

  async function handleSaveCurrent() {
    const dataUrl =
      value && value.startsWith("data:image")
        ? value
        : canvasRef.current && hasInk
          ? canvasRef.current.toDataURL("image/png")
          : "";
    if (!dataUrl.startsWith("data:image")) {
      setError("Draw or upload a signature first, then save it.");
      return;
    }
    setBusySave(true);
    setError(null);
    try {
      await saveSignature(dataUrl, saveLabel);
      if (!value?.startsWith("data:image")) {
        onChange(dataUrl);
      }
      await refreshSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save signature");
    } finally {
      setBusySave(false);
    }
  }

  async function handleDeleteSaved(id: string) {
    await deleteSavedSignature(id);
    await refreshSaved();
  }

  const signed = Boolean(value && value.startsWith("data:image"));

  return (
    <div className="space-y-2" onPaste={onPaste}>
      {signed ? (
        <div className="rounded-md border border-border bg-white p-2">
          <img
            src={value}
            alt="Signature"
            className="max-h-28 w-auto max-w-full object-contain"
          />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full touch-none rounded-md border border-input bg-white"
          style={{ height }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {!signed ? (
          <>
            <button
              type="button"
              onClick={applyDrawn}
              disabled={!hasInk || disabled}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Apply drawn signature
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              Upload PNG / JPEG
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPickerOpen((o) => !o);
                void refreshSaved();
              }}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              Select saved signature
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void applyFile(f);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          {signed ? "Remove signature (unlock report)" : "Clear"}
        </button>
      </div>

      {/* Save current ink / applied signature for reuse */}
      {!disabled ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-2">
          <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
            Save for reuse
            <input
              type="text"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              placeholder="Label (e.g. Phil — usual)"
              className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            disabled={busySave || (!signed && !hasInk)}
            onClick={() => void handleSaveCurrent()}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            {busySave ? "Saving…" : "Save signature to app"}
          </button>
        </div>
      ) : null}

      {pickerOpen && !signed ? (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Saved signatures</p>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setPickerOpen(false)}
            >
              Close
            </button>
          </div>
          {saved.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None saved yet. Draw or upload a signature, then use “Save signature to app”.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {saved.map((sig) => (
                <li
                  key={sig.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white p-2"
                >
                  <img
                    src={sig.dataUrl}
                    alt={sig.label}
                    className="h-10 w-auto max-w-[8rem] object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {sig.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => applySaved(sig)}
                    className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSaved(sig.id)}
                    className="rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-foreground"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {signed ? (
        <p className="text-xs text-muted-foreground">
          Signature applied — report is locked for editing until the signature is removed.
          It appears on the valuation summary and closing signature blocks in the report.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Draw and apply, upload a PNG/JPEG, paste an image, or select a saved signature.
          Applying locks the valuation report until cleared.
        </p>
      )}
    </div>
  );
}

export function isAppliedSignature(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("data:image");
}
