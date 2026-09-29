import type { ReportMeta, ReportNarrative } from "@/lib/report/types";

/**
 * Trial switch. Set to false to restore the previous neighbourhood writer
 * with no web-search pass and no claim panel.
 */
export const NBHD_ASSIST_TRIAL = true;

export type NbhdClaimKind =
  | "city"
  | "amenities"
  | "transport"
  | "population"
  | "gentrification"
  | "estate"
  | "character"
  | "other";

export const NBHD_CLAIM_GROUPS: { kind: NbhdClaimKind; label: string }[] = [
  { kind: "city", label: "City / suburb" },
  { kind: "amenities", label: "Amenities" },
  { kind: "transport", label: "Access to transport" },
  { kind: "population", label: "Population" },
  { kind: "estate", label: "Estate / completion" },
  { kind: "gentrification", label: "Gentrification / change" },
  { kind: "character", label: "Character" },
  { kind: "other", label: "Other" },
];

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

function rowToClaim(row: unknown): NbhdClaim | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const t = String(r.text ?? "").trim();
  if (!t) return null;
  const kindRaw = String(r.kind ?? "other");
  const kind: NbhdClaimKind =
    kindRaw === "population" ||
    kindRaw === "gentrification" ||
    kindRaw === "estate" ||
    kindRaw === "character" ||
    kindRaw === "city" ||
    kindRaw === "amenities" ||
    kindRaw === "transport"
      ? kindRaw
      : "other";
  return {
    id: newClaimId(),
    kind,
    text: t,
    source: typeof r.source === "string" ? r.source : undefined,
    accepted: true,
  };
}

export function parseNbhdClaims(raw: string): NbhdClaim[] {
  const text = raw.trim();
  const out: NbhdClaim[] = [];
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf("[", from);
    if (start < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "[") depth += 1;
      if (text[i] === "]") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const claim = rowToClaim(row);
          if (claim) out.push(claim);
        }
      }
    } catch {
      /* next block */
    }
    from = end + 1;
  }
  if (out.length === 0) {
    const objectRe =
      /\{\s*"(?:kind|text|source)"[\s\S]*?"(?:kind|text|source)"[\s\S]*?\}/g;
    const matches = text.match(objectRe) ?? [];
    for (const chunk of matches) {
      try {
        const claim = rowToClaim(JSON.parse(chunk));
        if (claim) out.push(claim);
      } catch {
        /* skip */
      }
    }
  }
  if (out.length === 0) {
    for (const line of text.split(/\n+/)) {
      const t = line.replace(/^[\s*-]+/, "").trim();
      if (t.length < 40) continue;
      if (!/estate|master\s*plan|community|population|suburb|corridor/i.test(t)) continue;
      out.push({
        id: newClaimId(),
        kind: /estate|master\s*plan/i.test(t) ? "estate" : "other",
        text: t.replace(/^"+|"+$/g, ""),
        accepted: true,
      });
    }
  }
  return out;
}

const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
] as const;

export function claimDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): { km: number; dir: string; label: string } {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dir = COMPASS[Math.round(brng / 45) % 8]!;
  const label =
    km < 0.1 ? `${Math.round(km * 1000)} metres` : `${km < 1 ? km.toFixed(2) : km.toFixed(1)} kilometres`;
  return { km, dir, label };
}

export function measuredClaim(
  kind: NbhdClaimKind,
  text: string,
  source = "Google Maps",
): NbhdClaim {
  return { id: newClaimId(), kind, text, source, accepted: true };
}

function claimKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Keep earlier notes on a later search; copy the valuer's tick when the same line returns. */
export function mergeNbhdClaims(existing: NbhdClaim[], incoming: NbhdClaim[]): NbhdClaim[] {
  const out = [...existing];
  const byKey = new Map(out.map((c) => [claimKey(c.text), c]));
  for (const next of incoming) {
    const key = claimKey(next.text);
    const prev = byKey.get(key);
    if (prev) {
      if (next.source && !prev.source) prev.source = next.source;
      continue;
    }
    out.push(next);
    byKey.set(key, next);
  }
  return out;
}

const STOP = new Set([
  "about",
  "approximately",
  "property",
  "subject",
  "suburb",
  "locality",
  "estate",
  "within",
  "there",
  "their",
  "which",
  "where",
  "from",
  "with",
  "that",
  "this",
  "recorded",
  "nearest",
  "includes",
  "including",
]);

function claimTokens(text: string): string[] {
  const nums = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  return [...nums.map((n) => n.replace(/,/g, "")), ...words];
}

export function claimCoveredByProse(prose: string, claim: NbhdClaim): boolean {
  const hay = prose.toLowerCase().replace(/,/g, "");
  const tokens = claimTokens(claim.text);
  if (tokens.length === 0) return hay.includes(claim.text.toLowerCase().slice(0, 24));
  const hit = tokens.filter((t) => hay.includes(t.toLowerCase())).length;
  return hit >= Math.min(2, tokens.length);
}

/** Append any accepted fact the model left out. */
export function ensureAcceptedFactsInProse(prose: string, claims: NbhdClaim[]): string {
  const missing = claims.filter((c) => c.accepted && !claimCoveredByProse(prose, c));
  if (!missing.length) return prose.trim();
  const extra = missing.map((c) => c.text.replace(/\s+/g, " ").trim()).join(" ");
  return `${prose.trim()}\n\n${extra}`;
}
