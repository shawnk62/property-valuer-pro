import type { InspectionValues, ReportMeta } from "@/lib/report/types";
import type { NbhdClaim } from "@/lib/narrative/neighbourhoodAssist";

export interface ReportReference {
  id: string;
  text: string;
  sourceRaw?: string;
  accepted: boolean;
}

const HOST_AUTHOR: Record<string, string> = {
  "abs.gov.au": "Australian Bureau of Statistics",
  "rba.gov.au": "Reserve Bank of Australia",
  "treasury.gov.au": "The Treasury",
  "qgso.qld.gov.au": "Queensland Government Statistician's Office",
  "qld.gov.au": "Queensland Government",
  "goldcoast.qld.gov.au": "City of Gold Coast",
  "brisbane.qld.gov.au": "Brisbane City Council",
  "corelogic.com.au": "CoreLogic",
  "corelogic.com": "CoreLogic",
  "proptrack.com.au": "PropTrack",
  "domain.com.au": "Domain",
  "realestate.com.au": "REA Group",
  "google.com": "Google",
  "maps.google.com": "Google",
  "maps.googleapis.com": "Google",
  "api.org.au": "Australian Property Institute",
  "rics.org": "Royal Institution of Chartered Surveyors",
  "ivsc.org": "International Valuation Standards Council",
  "apra.gov.au": "Australian Prudential Regulation Authority",
  "housing.gov.au": "Australian Government Department of Housing",
};

function newId(): string {
  return `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function hostAuthor(host: string): string {
  const h = host.replace(/^www\./i, "").toLowerCase();
  if (HOST_AUTHOR[h]) return HOST_AUTHOR[h];
  const parts = h.split(".").filter(Boolean);
  const core = parts.length >= 2 ? parts[parts.length - 2]! : h;
  return core
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const cleaned = decodeURIComponent(last)
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (cleaned.length >= 4 && !/^(index|home|default)$/i.test(cleaned)) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "Web page";
  }
}

/** APA 7th webpage: Author. (n.d.). Title. Site (if different). URL */
export function formatApaReference(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
  if (!s) return "";
  if (/\(\s*(n\.d\.|\d{4})\s*[,)]/.test(s) && /\.\s+\S+/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) {
    let host = "";
    try {
      host = new URL(s).hostname.replace(/^www\./i, "");
    } catch {
      host = "";
    }
    const author = host ? hostAuthor(host) : "Web source";
    const title = titleFromUrl(s);
    const site = host ? hostAuthor(host) : "";
    const siteBit = site && site.toLowerCase() !== author.toLowerCase() ? `${site}. ` : "";
    return `${author}. (n.d.). ${title}. ${siteBit}${s}`;
  }
  if (/https?:\/\//i.test(s)) {
    const url = s.match(/https?:\/\/\S+/i)?.[0] ?? "";
    const label = s.replace(url, "").trim().replace(/[.,;]+$/, "");
    if (url && label) {
      if (/\(\s*(n\.d\.|\d{4})/.test(label)) return `${label} ${url}`.trim();
      return `${label}. (n.d.). ${url}`;
    }
    if (url) return formatApaReference(url);
  }
  return `${s.replace(/\.$/, "")}. (n.d.).`;
}

function claimLists(meta: ReportMeta | undefined): NbhdClaim[] {
  if (!meta) return [];
  return [
    ...((meta.nbhdClaims as NbhdClaim[] | undefined) ?? []),
    ...((meta.marketClaimsAustralia as NbhdClaim[] | undefined) ?? []),
    ...((meta.marketClaimsState as NbhdClaim[] | undefined) ?? []),
    ...((meta.marketClaimsRegion as NbhdClaim[] | undefined) ?? []),
    ...((meta.marketClaimsLocality as NbhdClaim[] | undefined) ?? []),
  ];
}

function sourceKey(raw: string): string {
  return raw.toLowerCase().replace(/\/+$/, "").replace(/^www\./, "").trim();
}

export function collectReportReferences(
  meta: ReportMeta | undefined,
  values: InspectionValues,
  existing: ReportReference[] | undefined,
): ReportReference[] {
  const raws: string[] = [];
  for (const claim of claimLists(meta)) {
    const src = String(claim.source ?? "").trim();
    if (src) raws.push(src);
  }
  const exam = String(values["exam_references"] ?? "").trim();
  if (exam) {
    for (const line of exam.split(/\n+/)) {
      const t = line.replace(/^[\s*-]+/, "").trim();
      if (t.length > 4) raws.push(t);
    }
  }
  const seen = new Set<string>();
  const incoming: ReportReference[] = [];
  for (const raw of raws) {
    const key = sourceKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    incoming.push({
      id: newId(),
      text: formatApaReference(raw),
      sourceRaw: raw,
      accepted: true,
    });
  }
  const prior = existing ?? [];
  const byKey = new Map(
    prior.map((r) => [sourceKey(r.sourceRaw || r.text), r] as const),
  );
  const out: ReportReference[] = [];
  for (const next of incoming) {
    const prev = byKey.get(sourceKey(next.sourceRaw || next.text));
    if (prev) {
      out.push({
        ...prev,
        text: prev.text.trim() || next.text,
        sourceRaw: prev.sourceRaw || next.sourceRaw,
      });
    } else {
      out.push(next);
    }
  }
  for (const prev of prior) {
    const key = sourceKey(prev.sourceRaw || prev.text);
    if (!seen.has(key) && prev.text.trim()) {
      out.push(prev);
      seen.add(key);
    }
  }
  out.sort((a, b) => a.text.localeCompare(b.text, "en"));
  return out;
}

export function referencesProse(items: ReportReference[] | undefined): string {
  return (items ?? [])
    .filter((r) => r.accepted && r.text.trim())
    .map((r) => r.text.trim())
    .join("\n\n");
}
