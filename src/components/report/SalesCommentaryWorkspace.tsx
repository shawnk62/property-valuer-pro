import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import {
  adjustmentFeaturesForProperty,
  computeSaleAdjustmentTotals,
  formatAdjustmentMoney,
  formatAreaWithSqm,
  formatMoney,
  formatPct,
  subjectSiteSizeDisplay,
} from "@/lib/report/adjustmentGrid";
import type { ComparableSale } from "@/lib/report/types";
import { salesOnReport } from "@/lib/report/types";

function money(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  return formatAdjustmentMoney(n);
}

/**
 * Desktop and iPad writing workspace. The sales strip stays visible while the
 * valuer writes the two sales narratives. Not required on a phone.
 */
export function SalesCommentaryWorkspace({
  controller,
}: {
  controller: ReportDraftController;
}) {
  const { draft, setNarrative, setMeta } = controller;
  const sales = salesOnReport(draft.sales);
  const features = adjustmentFeaturesForProperty(draft.values);
  const [salesWidth, setSalesWidth] = useState(38);
  const [openId, setOpenId] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const subjectPhoto = draft.photos.find((p) => p.slot === "front")?.url;
  const subjectAddress =
    [draft.values["prop_address"], draft.values["prop_suburb"]].filter(Boolean).join(", ") ||
    "Subject";

  function write(key: "salesComments" | "valueReconciliation", value: string) {
    setNarrative({ [key]: value });
    setMeta({
      manualNarrative: {
        ...(draft.reportMeta.manualNarrative ?? {}),
        [key]: true,
      },
    });
  }

  function onDividerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return;
    event.preventDefault();
    const startX = event.clientX;
    const start = salesWidth;
    const width = frame.getBoundingClientRect().width || 1;
    const move = (ev: PointerEvent) => {
      const next = start + ((ev.clientX - startX) / width) * 100;
      setSalesWidth(Math.min(62, Math.max(26, next)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">Sales commentary</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The sales stay on the left while you write. Drag the divider to give either side more
          room. The same text is in the narrative section and prints under the sales grids.
        </p>
      </div>
      <div
        ref={frameRef}
        className="flex flex-col md:h-[78vh] md:min-h-[36rem] md:flex-row"
        style={{ ["--sales-pane" as string]: `${salesWidth}%` }}
      >
        <div className="max-h-[24rem] w-full overflow-y-auto border-b border-border p-2 md:max-h-none md:w-[var(--sales-pane)] md:shrink-0 md:border-b-0 md:border-r">
          <SaleCard
            title="Subject"
            address={subjectAddress}
            photoUrl={subjectPhoto}
            site={subjectSiteSizeDisplay(draft.values)}
            open={openId === "subject"}
            onToggle={() => setOpenId((id) => (id === "subject" ? null : "subject"))}
          />
          {sales.map((sale, index) => (
            <SaleCard
              key={sale.id}
              title={`Sale ${index + 1}`}
              address={sale.address || "—"}
              photoUrl={sale.photoUrl}
              price={sale.salePrice || "—"}
              date={sale.saleDate || "—"}
              site={formatAreaWithSqm(sale.landArea)}
              net={money(computeSaleAdjustmentTotals(sale).netAdjustment)}
              netPct={formatPct(computeSaleAdjustmentTotals(sale).netPct)}
              open={openId === sale.id}
              onToggle={() => setOpenId((id) => (id === sale.id ? null : sale.id))}
              detail={<SaleDetail sale={sale} features={features} />}
            />
          ))}
          {sales.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No comparables on the report.</p>
          ) : null}
        </div>
        <div
          className="hidden w-3 shrink-0 cursor-col-resize touch-none bg-muted md:block"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sales and commentary"
          onPointerDown={onDividerDown}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <Editor
            label="Comments on comparable sales"
            value={draft.narrative.salesComments ?? ""}
            onChange={(value) => write("salesComments", value)}
          />
          <Editor
            label="Final reconciliation of value"
            value={draft.narrative.valueReconciliation ?? ""}
            onChange={(value) => write("valueReconciliation", value)}
          />
        </div>
      </div>
    </section>
  );
}

function Editor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-[16rem] flex-1 flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[16rem] w-full flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

function SaleCard({
  title,
  address,
  photoUrl,
  price,
  date,
  site,
  net,
  netPct,
  open,
  onToggle,
  detail,
}: {
  title: string;
  address: string;
  photoUrl?: string;
  price?: string;
  date?: string;
  site: string;
  net?: string;
  netPct?: string;
  open: boolean;
  onToggle: () => void;
  detail?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 w-full rounded-md border border-border bg-background p-2 text-left"
    >
      <div className="flex gap-2">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-16 w-20 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
            No photo
          </div>
        )}
        <div className="min-w-0 text-xs">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="truncate text-foreground">{address}</p>
          {price ? <p>Price {price}</p> : null}
          {date ? <p>Date {date}</p> : null}
          <p>Site {site}</p>
          {net ? (
            <p>
              Net adjustment {net}
              {netPct && netPct !== "—" ? ` (${netPct})` : ""}
            </p>
          ) : null}
        </div>
      </div>
      {open && detail ? <div className="mt-2 border-t border-border pt-2">{detail}</div> : null}
    </button>
  );
}

function SaleDetail({
  sale,
  features,
}: {
  sale: ComparableSale;
  features: { id: string; label: string }[];
}) {
  const totals = computeSaleAdjustmentTotals(sale);
  return (
    <div className="space-y-1 text-[11px] text-foreground">
      {features.map((feature) => {
        const adj = sale.adjustments?.[feature.id];
        const detail = adj?.detail?.trim();
        const amount = adj?.amount ?? 0;
        if (!detail && !amount) return null;
        return (
          <p key={feature.id}>
            <span className="font-medium">{feature.label}:</span> {detail || "—"}
            {amount ? ` · ${formatAdjustmentMoney(amount)}` : ""}
          </p>
        );
      })}
      <p className="font-medium">
        Adjusted price {formatMoney(totals.adjustedSalePrice)} · net {money(totals.netAdjustment)}
      </p>
    </div>
  );
}
