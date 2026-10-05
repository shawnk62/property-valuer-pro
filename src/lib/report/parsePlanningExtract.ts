/**
 * Pull planning-scheme identity and zone purpose from Landchecker or
 * Cotality / RP Data text when those labels are present.
 */
export type PlanningExtract = {
  prop_planning_scheme?: string;
  exam_planning_scheme?: string;
  prop_zoning?: string;
  prop_zoning_desc?: string;
};

function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function afterLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s*[:\\-]?\\s*([^\\n]{4,220})",
      "i",
    );
    const m = text.match(re);
    if (m?.[1]) {
      const v = cleanLine(m[1]);
      if (v && !/^unavailable$/i.test(v)) return v;
    }
  }
  return null;
}

function looksLikeSchemeName(s: string): boolean {
  if (s.length < 10) return false;
  if (/superseded|of non-?\s*$|;\s*-/i.test(s)) return false;
  return /(city plan|planning scheme|noosa plan|cairnsplan|\bversion\b|\bv\d+\b)/i.test(
    s,
  );
}

function composeSchemeName(text: string): string | undefined {
  const named =
    afterLabel(text, [
      "PLANNING SCHEME",
      "Planning scheme",
      "CITY PLAN",
      "City Plan",
      "PLANNING INSTRUMENT",
    ]) ||
    text.match(
      /((?:Gold Coast City Plan|City of Gold Coast|Sunshine Coast Planning Scheme|Brisbane City Plan|Moreton Bay Planning Scheme|Logan Planning Scheme|Ipswich Planning Scheme|Redland City Plan|Toowoomba Regional Planning Scheme|Scenic Rim Planning Scheme|Noosa Plan|CairnsPlan|Townsville City Plan|Mackay Region Planning Scheme)[^\n]{0,80})/i,
    )?.[1];
  if (!named) return undefined;
  let scheme = cleanLine(named.replace(/\s*[:]\s*$/, ""));
  if (!looksLikeSchemeName(scheme)) return undefined;
  const version =
    afterLabel(text, ["VERSION", "Version"]) ||
    text.match(/\bVersion\s+([0-9]+(?:\.[0-9]+)*)\b/i)?.[0];
  const amended =
    afterLabel(text, ["AMENDED", "Amended", "COMMENCED", "Commenced"]) ||
    text.match(
      /\b(?:amended|commenced|effective)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i,
    )?.[0];
  if (version && !new RegExp(version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(scheme)) {
    scheme = `${scheme} ${cleanLine(version)}`;
  }
  if (amended && !/amended|commenced|effective/i.test(scheme)) {
    scheme = `${scheme}, ${cleanLine(amended)}`;
  }
  return scheme;
}

function zonePurpose(text: string): string | undefined {
  const m = text.match(
    /The purpose of the [^\n.]{8,120} zone[^\n]*[. ]([\s\S]{40,3500}?)(?=\n\s*(?:OVERLAYS?|Place-based|FLOOD|Parcel Identifiers|Nearby Planning|Terms and Conditions|Disclaimer)\b|$)/i,
  );
  if (m?.[0]) return cleanLine(m[0]).slice(0, 4000);
  const alt = afterLabel(text, ["ZONE PURPOSE", "Zone purpose", "PURPOSE OF THE ZONE"]);
  return alt || undefined;
}

export function parsePlanningFromReportText(raw: string): PlanningExtract {
  const text = String(raw ?? "").replace(/\r/g, "\n");
  if (text.trim().length < 40) return {};
  const out: PlanningExtract = {};
  const scheme = composeSchemeName(text);
  if (scheme) {
    out.prop_planning_scheme = scheme;
    out.exam_planning_scheme = scheme;
  }
  const zone = afterLabel(text, [
    "ZONES",
    "ZONE",
    "ZONING",
    "ZONING PRECINCT",
    "Zone precinct",
  ]);
  if (zone && !/purpose of the/i.test(zone)) out.prop_zoning = zone;
  const purpose = zonePurpose(text);
  if (purpose) out.prop_zoning_desc = purpose;
  return out;
}

/** Inspection-form field wins. Ignore leftover extract fragments. */
export function planningSchemeDisplay(values: Record<string, unknown>): string {
  const form = String(values.prop_planning_scheme ?? "").trim();
  const exam = String(values.exam_planning_scheme ?? "").trim();
  const junk = (s: string) =>
    s.length < 10 || /superseded|of non-?\s*$|;\s*-/i.test(s);
  if (form && !junk(form)) return form;
  if (exam && !junk(exam)) return exam;
  return form || "";
}

/** Scheme wording pasted as "to:(1)identify" is rewritten as a sentence. */
export function zoningPurposeSentence(raw: string | null | undefined): string {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text
    .replace(/\bto:\s*(?:\(\d+\)\s*)?/gi, "to ")
    .replace(/\(\d+\)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[.!?]$/.test(text)) text += ".";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function schemeDate(raw: string): Date | null {
  const named = raw.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (named) {
    const months = "january,february,march,april,may,june,july,august,september,october,november,december".split(",");
    const month = months.indexOf(named[2]!.toLowerCase());
    if (month >= 0) return new Date(Number(named[3]), month, Number(named[1]));
  }
  const numeric = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!numeric) return null;
  const year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
  return new Date(year, Number(numeric[2]) - 1, Number(numeric[1]));
}

/** Drop a scheme version that commenced after the valuation date. */
export function planningSchemeInForce(
  values: Record<string, unknown>,
  valueDate: string | null | undefined,
): string {
  const display = planningSchemeDisplay(values);
  if (!display) return "";
  const valuation = schemeDate(String(valueDate ?? values["exam_value_date"] ?? ""));
  const effective = schemeDate(display);
  const future = Boolean(valuation && effective && effective.getTime() > valuation.getTime());
  if (!future) return display;
  return display
    .replace(/,?\s*version\s+\d+\b/i, "")
    .replace(/,?\s*(?:amended|commenced|effective)\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function mergePlanningExtract(
  existing: Record<string, unknown>,
  incoming: PlanningExtract,
): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (!value?.trim()) continue;
    const cur = String(existing[key] ?? "").trim();
    if (!cur) patch[key] = value.trim();
  }
  return patch;
}
