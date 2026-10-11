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
  const title = sameName(parts.title, parts.author) ? parts.author : parts.title;
  const site = parts.site || parts.author;
  const viewed = australianViewed(parts.accessed);
  if (parts.url) {
    return `${parts.author} (${parts.year}) ${title}, ${site}, viewed ${viewed}, ${parts.url}.`;
  }
  return `${parts.author} (${parts.year}) ${title}, ${site}, viewed ${viewed}.`;
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
  marketText = "",
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
    const blob = `${item.author} ${item.title} ${item.site} ${item.url}`.toLowerCase();
    if (/\bvia\b/.test(blob)) return false;
    if (item.year === "n.d." || !item.year) return false;
    if (!item.title) return false;
    return true;
  });
  cleaned.sort((a, b) => a.author.localeCompare(b.author, "en") || a.title.localeCompare(b.title, "en"));
  const primary = [...primaryReportSources(values), ...standingShawnSources(), ...marketSourcesNamedIn(values, marketText), ...localitySources(meta, values), ...sectionFallbackSources("location", values), ...sectionFallbackSources("state", values), ...sectionFallbackSources("region", values), ...sectionFallbackSources("locality", values)];
  for (const item of primary) {
    const key = referenceKey(item);
    const sameAuthor = cleaned.findIndex((row) => row.author.toLowerCase() === item.author.toLowerCase());
    if (sameAuthor >= 0 && item.url && !cleaned[sameAuthor].url) cleaned.splice(sameAuthor, 1);
    else if (sameAuthor >= 0) continue;
    seen.add(key);
    cleaned.push(item);
  }
  if (/realestate\.com|rea group/i.test(marketText) && !cleaned.some((row) => row.author === "REA Group" && row.url)) {
    const viewed = apaRetrieved();
    cleaned.push({
      author: "REA Group",
      year: "2026",
      title: `${String(values["prop_suburb"] ?? "Worongary").trim() || "Worongary"} suburb profile`,
      site: "realestate.com.au",
      url: reaProfileUrl(values),
      accessed: viewed,
    });
  }
  cleaned.sort((a, b) => a.author.localeCompare(b.author, "en") || a.title.localeCompare(b.title, "en"));
  return cleaned.filter((row) => row.title && row.author !== row.url);
}

function australianViewed(raw = accessedLabel()): string {
  const text = String(raw || "").trim();
  if (/^\d{1,2} [A-Z][a-z]+ \d{4}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return accessedLabel(parsed);
  return accessedLabel();
}

function claimToReference(claim: NbhdClaim, values: InspectionValues, title: string): ReferenceParts | null {
  const raw = String(claim.source ?? "").trim();
  if (!raw) return null;
  const viewed = accessedLabel();
  const url = raw.match(/https?:\/\/\S+/i)?.[0]?.replace(/[.,;>)]+$/, "") ?? "";
  let author = "";
  if (url) {
    try {
      author = hostAuthor(new URL(url).hostname);
    } catch {
      author = "";
    }
  }
  if (!author) author = expandAuthor(raw.replace(/https?:\/\/\S+/gi, "").trim());
  if (!author || author === "Source" || /^com\.?$/i.test(author)) return null;
  return {
    author,
    year: raw.match(/\b(20\d{2})\b/)?.[1] ?? viewed.split(" ").pop() ?? "2026",
    title,
    site: author,
    url,
    accessed: viewed,
  };
}

function localitySources(meta: ReportMeta | undefined, values: InspectionValues): ReferenceParts[] {
  const suburb = String(values["prop_suburb"] ?? "the subject suburb").trim() || "the subject suburb";
  const seen = new Set<string>();
  const out: ReferenceParts[] = [];
  for (const claim of claimLists(meta).filter((item) => item.accepted)) {
    const title = /market|price|index|rate/i.test(claim.text)
      ? "Market commentary"
      : `${suburb} locality profile`;
    const source = claimToReference(claim, values, title);
    if (!source) continue;
    const key = `${source.author}|${source.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/** Print-time only. Cites the accepted notes that were used to write this block. */
export function citeAcceptedNotes(
  text: string,
  claims: NbhdClaim[] | undefined,
  values: InspectionValues,
  label: string,
  fallback: ReferenceParts[] = [],
): string {
  if (!text.trim()) return text;
  const fromClaims = (claims ?? [])
    .filter((claim) => claim.accepted)
    .map((claim) => claimToReference(claim, values, label))
    .filter((item): item is ReferenceParts => Boolean(item));
  const sources = [...fromClaims, ...fallback];
  const seen = new Set<string>();
  const unique = sources.filter((source) => {
    const key = source.author.toLowerCase();
    if (!source.author || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length === 0) return text;
  let out = text;
  for (const source of unique) {
    const author = source.author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${author}\\s*\\(${source.year}\\)`, "i").test(out)) continue;
    if (new RegExp(`\\(${author}\\s+${source.year}\\)`, "i").test(out)) continue;
    const named = out.search(new RegExp(author, "i"));
    if (named >= 0) {
      const end = named + source.author.length;
      out = `${out.slice(0, end)} (${source.year})${out.slice(end)}`;
    }
  }
  const missing = unique.filter((source) => {
    const author = source.author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`${author}\\s*\\(${source.year}\\)|\\(${author}\\s+${source.year}\\)`, "i").test(out);
  });
  if (missing.length) {
    const cites = missing.map((source) => `${source.author} (${source.year})`).join("; ");
    out = `${out.trim()} (${cites}).`;
  }
  return out;
}

export function citeLocalitySources(
  text: string,
  meta: ReportMeta | undefined,
  values: InspectionValues,
): string {
  return citeAcceptedNotes(text, meta?.nbhdClaims as NbhdClaim[] | undefined, values, "Locality profile");
}

export function sectionFallbackSources(
  section: "location" | "state" | "region" | "locality",
  values: InspectionValues,
): ReferenceParts[] {
  const viewed = accessedLabel();
  const year = viewed.split(" ").pop() ?? "2026";
  const council = String(values["prop_lga"] ?? "Local government").trim() || "Local government";
  if (section === "location") {
    return [{
      author: "Google",
      year,
      title: "Maps distance measurement",
      site: "Google Maps",
      url: "https://maps.google.com/",
      accessed: viewed,
    }];
  }
  if (section === "state") {
    return [{
      author: "Queensland Government Statistician's Office",
      year,
      title: "Queensland regional profiles",
      site: "Queensland Government",
      url: "https://www.qgso.qld.gov.au/",
      accessed: viewed,
    }];
  }
  if (section === "region") {
    return [{
      author: council,
      year,
      title: "Regional market profile",
      site: council,
      url: "",
      accessed: viewed,
    }];
  }
  return [{
    author: "PropTrack",
    year: "2026",
    title: "Home Price Index",
    site: "PropTrack",
    url: "https://www.proptrack.com.au/home-price-index/",
    accessed: viewed,
  }];
}
  text: string,
  meta: ReportMeta | undefined,
  values: InspectionValues,
): string {
  return citeAcceptedNotes(text, meta?.nbhdClaims as NbhdClaim[] | undefined, values, "Locality profile");
}

const SOURCE_CATALOGUE: Array<{
  test: RegExp;
  author: string;
  year: string;
  title: string;
  site: string;
  url: string;
}> = [
  { test: /cotality|corelogic/i, author: "Cotality", year: "2026", title: "Home Value Index", site: "Cotality", url: "https://www.cotality.com/au" },
  { test: /proptrack/i, author: "PropTrack", year: "2026", title: "Home Price Index", site: "PropTrack", url: "https://www.proptrack.com.au/home-price-index/" },
  { test: /australian bureau of statistics|\bABS\b|bureau of statistics/i, author: "Australian Bureau of Statistics", year: "2026", title: "Total Value of Dwellings", site: "Australian Bureau of Statistics", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings" },
  { test: /reserve bank|\bRBA\b/i, author: "Reserve Bank of Australia", year: "2026", title: "Statement on Monetary Policy", site: "Reserve Bank of Australia", url: "https://www.rba.gov.au/publications/smp/" },
  { test: /westpac/i, author: "Westpac", year: "2026", title: "Housing Pulse", site: "Westpac", url: "https://www.westpac.com.au/news/" },
  { test: /commbank|commonwealth bank/i, author: "Commonwealth Bank of Australia", year: "2026", title: "Housing market update", site: "Commonwealth Bank of Australia", url: "https://www.commbank.com.au/" },
  { test: /\bNAB\b|national australia bank/i, author: "National Australia Bank", year: "2026", title: "NAB Residential Property Survey", site: "National Australia Bank", url: "https://www.nab.com.au/" },
  { test: /realestate\.com|rea group/i, author: "REA Group", year: "2026", title: "Suburb profile", site: "realestate.com.au", url: "https://www.realestate.com.au/" },
  { test: /international valuation standards council|\bIVSC\b|international valuation standards/i, author: "International Valuation Standards Council", year: "2025", title: "International Valuation Standards", site: "International Valuation Standards Council", url: "https://www.ivsc.org/" },
  { test: /\bKPMG\b/i, author: "KPMG", year: "2026", title: "Residential Property Market Outlook", site: "KPMG", url: "https://kpmg.com/au/en/home.html" },
];

/** Print-time only. Adds a Harvard author-date citation after the first naming of a known source. */
export function insertHarvardCitations(text: string): string {
  if (!text.trim()) return text;
  let out = text;
  for (const source of SOURCE_CATALOGUE) {
    const author = source.author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${author}\\s*\\(${source.year}\\)`, "i").test(out)) continue;
    if (new RegExp(`\\(${author}\\s+${source.year}\\)`, "i").test(out)) continue;
    const match = out.match(source.test);
    if (!match || match.index == null) continue;
    const end = match.index + match[0].length;
    if (/^\s*\((?:19|20)\d{2}\)/.test(out.slice(end, end + 10))) continue;
    const alias = /^(ABS|RBA|IVSC|NAB)$/i.test(match[0]);
    const replacement = alias
      ? `${source.author} (${source.year})`
      : `${match[0]} (${source.year})`;
    out = `${out.slice(0, match.index)}${replacement}${out.slice(end)}`;
  }
  return out;
}

function reaProfileUrl(values: InspectionValues): string {
  const suburb = String(values["prop_suburb"] ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const postcode = String(values["prop_postcode"] ?? "").trim();
  if (suburb === "worongary") return "https://www.realestate.com.au/qld/worongary-4213/";
  if (!suburb) return "https://www.realestate.com.au/";
  return `https://www.realestate.com.au/qld/${suburb}${postcode ? `-${postcode}` : ""}/`;
}

function marketSourcesNamedIn(values: InspectionValues, extra = ""): ReferenceParts[] {
  const text = [
    extra,
    values["exam_market_australia"],
    values["exam_market_state"],
    values["exam_market_region"],
    values["exam_market_local"],
    values["exam_market_commentary"],
  ]
    .map((part) => String(part ?? ""))
    .join("\n");
  if (!text.trim()) return [];
  const viewed = accessedLabel();
  const year = "2026";
  return SOURCE_CATALOGUE.filter((source) => source.test.test(text)).map((source) => ({
    author: source.author,
    year: source.year || year,
    title: source.author === "REA Group"
      ? `${String(values["prop_suburb"] ?? "Suburb").trim() || "Suburb"} suburb profile`
      : source.title,
    site: source.site,
    url: source.author === "REA Group" ? reaProfileUrl(values) : source.url,
    accessed: viewed,
  }));
}

function standingShawnSources(): ReferenceParts[] {
  const viewed = accessedLabel();
  return [
    {
      author: "International Valuation Standards Council",
      year: "2025",
      title: "International Valuation Standards",
      site: "International Valuation Standards Council",
      url: "https://www.ivsc.org/",
      accessed: viewed,
    },
  ];
}
function primaryReportSources(values: InspectionValues): ReferenceParts[] {
  const viewed = accessedLabel();
  const out: ReferenceParts[] = [];
  const scheme = String(values["prop_planning_scheme"] ?? values["exam_planning_scheme"] ?? "").trim();
  if (scheme) {
    out.push({
      author: String(values["prop_lga"] ?? "Planning authority").trim() || "Planning authority",
      year: scheme.match(/\b(20\d{2})\b/)?.[1] ?? viewed.split(" ").pop() ?? "",
      title: scheme,
      site: String(values["prop_lga"] ?? "Planning authority").trim() || "Planning authority",
      url: "",
      accessed: viewed,
    });
  }
  if (String(values["title_search_text"] ?? values["prop_title"] ?? "").trim()) {
    out.push({
      author: "Titles Queensland",
      year: String(values["prop_title_search_date"] ?? values["exam_title_search_date"] ?? "").match(/\b(20\d{2})\b/)?.[1] ?? viewed.split(" ").pop() ?? "",
      title: "Current title search",
      site: "Titles Queensland",
      url: "https://www.titlesqld.com.au/",
      accessed: viewed,
    });
  }
  if (String(values["prop_lotplan"] ?? values["prop_plan"] ?? "").trim()) {
    out.push({
      author: "Queensland Government",
      year: viewed.split(" ").pop() ?? "",
      title: "Survey plan",
      site: "Queensland Government",
      url: "https://www.qld.gov.au/",
      accessed: viewed,
    });
  }
  return out.filter((item) => item.title && item.year && item.year !== "n.d.");
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
