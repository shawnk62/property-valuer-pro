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
  "cotality.com": "Cotality",
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
  "yourinvestmentpropertymag.com.au": "Your Investment Property",
  "jacksonclarkerealestate.com.au": "Jackson Clark Real Estate",
  "plantationhomes.com.au": "Plantation Homes",
  "frasersproperty.com.au": "Frasers Property",
  "heatmaps.com.au": "Heatmaps",
  "view.com.au": "View",
  "aussie.com.au": "Aussie",
  "property.com.au": "realestate.com.au",
  "andreamonti.com.au": "Andrea Monti",
  "landchecker.com.au": "Landchecker",
  "homely.com.au": "Homely",
  "inthesuburbs.com.au": "In the Suburbs",
  "goldcoastinfo.net": "Gold Coast Info",
  "wikipedia.org": "Wikipedia",
  "en.wikipedia.org": "Wikipedia",
  "westpac.com.au": "Westpac",
  "commbank.com.au": "Commonwealth Bank of Australia",
  "nab.com.au": "National Australia Bank",
  "kpmg.com": "KPMG",
  "htw.com.au": "Herron Todd White",
  "airdna.co": "AirDNA",
  "macrobusiness.com.au": "MacroBusiness",
  "propertycouncil.com.au": "Property Council of Australia",
  "prd.com.au": "PRD",
  "eliteagent.com": "Elite Agent",
  "theguardian.com": "The Guardian",
  "reuters.com": "Reuters",
  "areasearch.com.au": "AreaSearch",
  "gchaveyoursay.com.au": "City of Gold Coast",
};

const AUTHOR_ALIASES: Record<string, string> = {
  abs: "Australian Bureau of Statistics",
  rba: "Reserve Bank of Australia",
  qgso: "Queensland Government Statistician's Office",
  "rea group": "REA Group",
  "realestate.com.au": "REA Group",
  commbank: "Commonwealth Bank of Australia",
  "commonwealth bank": "Commonwealth Bank of Australia",
  nab: "National Australia Bank",
  htw: "Herron Todd White",
  "herron todd white": "Herron Todd White",
  cotality: "Cotality",
  corelogic: "CoreLogic",
  proptrack: "PropTrack",
  wikipedia: "Wikipedia",
};

const COMPOUND_SUFFIXES = new Set(["au", "uk", "nz", "za"]);
const SECOND_LEVEL = new Set(["com", "gov", "org", "edu", "net", "asn", "id", "co"]);

function newId(): string {
  return `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cleanHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

function knownAuthorForHost(host: string): string {
  const h = cleanHost(host);
  if (HOST_AUTHOR[h]) return HOST_AUTHOR[h];
  const parts = h.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join(".");
    if (HOST_AUTHOR[suffix]) return HOST_AUTHOR[suffix];
  }
  return "";
}

function registrableLabel(host: string): string {
  const h = cleanHost(host);
  const known = knownAuthorForHost(h);
  if (known) return known;
  const parts = h.split(".").filter(Boolean);
  let core = parts[0] ?? h;
  if (parts.length >= 3 && COMPOUND_SUFFIXES.has(parts[parts.length - 1]!) && SECOND_LEVEL.has(parts[parts.length - 2]!)) {
    core = parts[parts.length - 3]!;
  } else if (parts.length >= 2) {
    core = parts[parts.length - 2]!;
  }
  return core
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hostAuthor(host: string): string {
  return registrableLabel(host);
}

function expandAuthor(raw: string): string {
  const cleaned = raw
    .replace(/\(\s*(n\.d\.|\d{4}(?:\s*[,–-]\s*\d{4})?)\s*\)/gi, "")
    .replace(/\.\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^(com|web source|source|n\.d)$/i.test(cleaned)) return "";
  const alias = AUTHOR_ALIASES[cleaned.toLowerCase()];
  if (alias) return alias;
  if (/^abs\b/i.test(cleaned) && cleaned.length < 12) return "Australian Bureau of Statistics";
  return cleaned;
}

function sentenceCase(raw: string): string {
  const proper = new Map<string, string>([
    ["gold coast", "Gold Coast"],
    ["gold coasts", "Gold Coast's"],
    ["queensland", "Queensland"],
    ["australia", "Australia"],
    ["worongary", "Worongary"],
    ["skyridge", "SkyRidge"],
    ["nerang", "Nerang"],
    ["mudgeeraba", "Mudgeeraba"],
    ["brisbane", "Brisbane"],
    ["robina", "Robina"],
    ["wikipedia", "Wikipedia"],
    ["rea group", "REA Group"],
  ]);
  const words = raw
    .replace(/[_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "";
  let text = words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()))
    .join(" ");
  for (const [key, value] of proper) {
    text = text.replace(new RegExp(`\\b${key}\\b`, "ig"), value);
  }
  const suburb = text.match(/^(\d{4})\s+([A-Za-z].+)$/);
  if (suburb) return `${suburb[2]} ${suburb[1]}`;
  return text;
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    const generic = /^(index|home|default|latest|latest-release|release|\d+)$/i;
    const chosen = [...segments].reverse().find((part) => {
      const bare = part.replace(/\.[a-z0-9]{2,4}$/i, "");
      return bare.length >= 4 && !generic.test(bare);
    }) ?? segments[segments.length - 1] ?? "";
    const cleaned = chosen.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[-_]+/g, " ").trim();
    if (cleaned.length >= 4) return sentenceCase(cleaned);
    return sentenceCase(registrableLabel(parsed.hostname));
  } catch {
    return "Web page";
  }
}

export type ReferenceStyle = "harvard" | "apa";

function accessedLabel(date = new Date()): string {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function apaRetrieved(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export interface ReferenceParts {
  author: string;
  year: string;
  title: string;
  site: string;
  url: string;
  accessed: string;
}

function referenceParts(raw: string, accessed = accessedLabel()): ReferenceParts {
  const s = raw.replace(/\s+/g, " ").trim();
  const url = s.match(/https?:\/\/\S+/i)?.[0]?.replace(/[.,;>)]+$/, "") ?? "";
  let author = "";
  let site = "";
  let title = "";
  let year = "n.d.";
  const yearMatch = s.match(/\((\d{4}|n\.d\.)\)/i);
  if (yearMatch?.[1] && yearMatch[1].toLowerCase() !== "n.d.") year = yearMatch[1];
  if (url) {
    try {
      const host = new URL(url).hostname;
      author = hostAuthor(host);
      site = author;
    } catch {
      author = "Web source";
      site = author;
    }
    title = titleFromUrl(url);
  }
  const label = s
    .replace(url, "")
    .replace(/\(\s*(n\.d\.|\d{4})\s*\)/gi, "")
    .replace(/\b(available at|retrieved|viewed|accessed)\b.*$/i, "")
    .replace(/[.,;:\s]+$/g, "")
    .trim();
  const expanded = expandAuthor(label.split(". ")[0] ?? label);
  if (!author && expanded) author = expanded;
  if (!url && label && !/^com\.?$/i.test(label)) {
    const candidate = sentenceCase(label.replace(/^[^.]+?\.\s+/, ""));
    const candidateAuthor = expandAuthor(candidate);
    if (
      candidate &&
      candidate.toLowerCase() !== author.toLowerCase() &&
      candidateAuthor.toLowerCase() !== author.toLowerCase()
    ) {
      title = candidate;
    }
  }
  if (!title) title = author || "Source";
  if (!author) author = "Source";
  if (!site) site = author;
  return { author, year, title, site, url, accessed };
}

function sameName(a: string, b: string): boolean {
  return a.replace(/\.$/, "").toLowerCase() === b.replace(/\.$/, "").toLowerCase();
}

/** APA 7th webpage. Title is italicised by the print renderer. */
export function formatApaReference(raw: string): string {
  const parts = referenceParts(raw);
  const title = sameName(parts.title, parts.author) ? "" : parts.title;
  const site = parts.site && !sameName(parts.site, parts.author) ? `${parts.site}. ` : "";
  const retrieved = parts.url && parts.year === "n.d." ? `Retrieved ${apaRetrieved()}, from ` : "";
  if (parts.url) {
    return `${parts.author}. (${parts.year}). ${title ? `${title}. ` : ""}${site}${retrieved}${parts.url}`;
  }
  return `${parts.author}. (${parts.year}).${title ? ` ${title}.` : ""}`;
}

/** Australian Harvard author-date webpage. Title is italicised by the print renderer. */
export function formatHarvardReference(raw: string, accessed = accessedLabel()): string {
  const parts = referenceParts(raw, accessed);
  const title = sameName(parts.title, parts.author) ? "" : parts.title;
  if (parts.url) {
    const site = parts.site || parts.author;
    return `${parts.author} (${parts.year}) ${title ? `${title}, ` : ""}${site}, viewed ${parts.accessed}, <${parts.url}>.`;
  }
  return `${parts.author} (${parts.year})${title ? ` ${title}.` : "."}`;
}

export function formatReference(raw: string, style: ReferenceStyle = "harvard"): string {
  return style === "apa" ? formatApaReference(raw) : formatHarvardReference(raw);
}

export function referenceKey(parts: ReferenceParts): string {
  if (parts.url) {
    try {
      const u = new URL(parts.url);
      return `${cleanHost(u.hostname)}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
    } catch {
      return parts.url.toLowerCase();
    }
  }
  return `${parts.author}|${parts.title}`.toLowerCase();
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

function sourcesFromClaim(claim: NbhdClaim): string[] {
  const out: string[] = [];
  const src = String(claim.source ?? "").trim();
  const text = String(claim.text ?? "");
  const urls = [
    ...(src.match(/https?:\/\/\S+/gi) ?? []),
    ...(text.match(/https?:\/\/[^\s)]+/gi) ?? []),
  ].map((url) => url.replace(/[.,;]+$/, ""));
  if (urls.length) {
    out.push(...urls);
    return out;
  }
  if (src) out.push(src);
  const trailing = text.match(/\(([^)]{3,80})\)\s*$/);
  if (trailing?.[1] && !/n\.d\./i.test(trailing[1])) out.push(trailing[1].trim());
  return out;
}

export function collectReportReferences(
  meta: ReportMeta | undefined,
  values: InspectionValues,
  existing: ReportReference[] | undefined,
  style: ReferenceStyle = meta?.referenceStyle === "apa" ? "apa" : "harvard",
): ReportReference[] {
  const raws: string[] = [];
  for (const claim of claimLists(meta)) {
    raws.push(...sourcesFromClaim(claim));
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
      text: formatReference(raw, style),
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

export function reformatReferences(
  items: ReportReference[] | undefined,
  style: ReferenceStyle,
): ReportReference[] {
  return (items ?? []).map((item) => ({
    ...item,
    text: formatReference(item.sourceRaw || item.text, style) || item.text,
  }));
}


export function referencesForPrint(
  meta: ReportMeta | undefined,
  narrative: string | undefined,
  values: InspectionValues,
): ReferenceParts[] {
  const style: ReferenceStyle = meta?.referenceStyle === "apa" ? "apa" : "harvard";
  const raws: string[] = [];
  for (const item of meta?.reportReferences ?? []) {
    const raw = String(item.sourceRaw || item.text || "").trim();
    if (item.accepted !== false && raw) raws.push(raw);
  }
  const prose = String(narrative ?? "").trim();
  if (prose) {
    for (const line of prose.split(/\n+/)) {
      const t = line.replace(/^[\s*\-]+/, "").trim();
      if (t.length > 4) raws.push(t);
    }
  }
  const exam = String(values["exam_references"] ?? "").trim();
  if (exam) {
    for (const line of exam.split(/\n+/)) {
      const t = line.replace(/^[\s*\-]+/, "").trim();
      if (t.length > 4) raws.push(t);
    }
  }
  const seen = new Set<string>();
  const out: ReferenceParts[] = [];
  for (const raw of raws) {
    const parts = referenceParts(raw);
    if (!parts.author || parts.author === "Source" && !parts.url) continue;
    const key = referenceKey(parts);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parts);
  }
  const authorsWithUrl = new Set(
    out.filter((item) => item.url).map((item) => item.author.toLowerCase()),
  );
  const cleaned = out.filter((item) => {
    if (/^com\.?$/i.test(item.author)) return false;
    if (!item.url && authorsWithUrl.has(item.author.toLowerCase())) return false;
    return true;
  });
  cleaned.sort((a, b) => a.author.localeCompare(b.author, "en") || a.title.localeCompare(b.title, "en"));
  return cleaned.map((parts) => ({ ...parts, year: parts.year || "n.d." }));
}

export function referenceStyleOf(meta: ReportMeta | undefined): ReferenceStyle {
  return meta?.referenceStyle === "apa" ? "apa" : "harvard";
}

export function referencesProse(items: ReportReference[] | undefined): string {
  return (items ?? [])
    .filter((r) => r.accepted && r.text.trim())
    .map((r) => r.text.trim())
    .join("\n\n");
}
