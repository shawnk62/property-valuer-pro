import type { ReportMeta, ReportNarrative } from "@/lib/report/types";

/**
 * Trial switch. Set to false to restore the previous neighbourhood writer
 * with no web-search pass and no claim panel.
 */
export const NBHD_ASSIST_TRIAL = true;

export type NbhdClaimKind =
  | "population"
  | "gentrification"
  | "estate"
  | "character"
  | "other";

export interface NbhdClaim {
  id: string;
  kind: NbhdClaimKind;
  text: string;
  source?: string;
  accepted: boolean;
}

export function isShawnReportAssignment(assignment: string | null | undefined): boolean {
  return /shawn/i.test(String(assignment ?? ""));
}

export function neighbourhoodAssistEnabled(assignment: string | null | undefined): boolean {
  return NBHD_ASSIST_TRIAL && isShawnReportAssignment(assignment);
}

export function narrativePrints(
  meta: ReportMeta | null | undefined,
  key: keyof ReportNarrative,
): boolean {
  const map = meta?.printNarrative;
  if (!map || map[key] === undefined) return true;
  return map[key] !== false;
}

export function newClaimId(): string {
  return `nbhd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function parseNbhdClaims(raw: string): NbhdClaim[] {
  const text = raw.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        const t = String(r.text ?? "").trim();
        if (!t) return null;
        const kindRaw = String(r.kind ?? "other");
        const kind: NbhdClaimKind =
          kindRaw === "population" ||
          kindRaw === "gentrification" ||
          kindRaw === "estate" ||
          kindRaw === "character"
            ? kindRaw
            : "other";
        return {
          id: newClaimId(),
          kind,
          text: t,
          source: typeof r.source === "string" ? r.source : undefined,
          accepted: false,
        };
      })
      .filter((c): c is NbhdClaim => Boolean(c));
  } catch {
    return [];
  }
}
