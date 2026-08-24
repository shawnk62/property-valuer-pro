import { useEffect, useRef, useState } from "react";

type Props = {
  value?: string;
  disabled?: boolean;
  onChange: (dataUrl: string) => void;
  /** Compact height for form embedding */
  height?: number;
};

/**
 * Touch-friendly signature capture. value is a data:image/png URL when signed,
 * or empty when cleared. Drawing is disabled when disabled=true except Clear
 * is still offered via parent when unlocking.
 */
export function SignaturePad({ value, disabled, onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Paint existing signature
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
        ctx.drawImage(img, 0, 0, rect.width, height);
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
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function start(e: React.TouchEvent | React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
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
    if (!drawing.current) return;
    drawing.current = false;
  }

  function apply() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    onChange("");
    setHasInk(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
  }

  const signed = Boolean(value && value.startsWith("data:image"));

  return (
    <div className="space-y-2">
      {signed && disabled ? (
        <div className="rounded-md border border-border bg-card p-2">
          <img src={value} alt="Signature" className="max-h-28 w-auto bg-white" />
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
        {!disabled ? (
          <>
            <button
              type="button"
              onClick={apply}
              disabled={!hasInk && !signed}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Apply signature
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground"
            >
              Clear
            </button>
          </>
        ) : signed ? (
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground"
          >
            Remove signature (unlock report)
          </button>
        ) : null}
      </div>
      {signed ? (
        <p className="text-xs text-muted-foreground">
          Signature applied — report is locked for editing until the signature is removed.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Draw your signature, then tap Apply. Applying locks the valuation report until cleared.
        </p>
      )}
    </div>
  );
}

export function isAppliedSignature(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("data:image");
}
