/** Extract fields from a Titles Queensland Current Title Search. */

export type TitleSearchExtract = {
  prop_title?: string;
  prop_lotplan?: string;
  prop_legal?: string;
  prop_lga?: string;
  prop_owner?: string;
  prop_rights?: string;
  prop_title_search_date?: string;
  exam_title_search_date?: string;
  title_created?: string;
  enc_notes?: string;
  enc?: string;
  title_search_text?: string;
  title_admin_advices?: string;
  title_unregistered?: string;
};

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function auDate(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!m) return s.slice(0, 10);
  const d = m[1]!.padStart(2, "0");
  const mo = m[2]!.padStart(2, "0");
  let y = m[3]!;
  if (y.length === 2) y = `20${y}`;
  return `${d}/${mo}/${y}`;
}

function planCode(planType: string, planNo: string): string {
  const n = planNo.replace(/\s+/g, "");
  if (/survey\s*plan/i.test(planType) || /^sp$/i.test(planType)) return `SP${n}`;
  if (/registered\s*plan/i.test(planType) || /^rp$/i.test(planType)) return `RP${n}`;
  if (/building\s*format/i.test(planType) || /bup/i.test(planType)) return `BUP${n}`;
  if (/group\s*title/i.test(planType) || /gtp/i.test(planType)) return `GTP${n}`;
  if (/crown\s*plan/i.test(planType) || /^cp$/i.test(planType)) return `CP${n}`;
  return `${clean(planType)} ${n}`.trim();
}

function section(text: string, start: RegExp, end: RegExp): string {
  const from = text.search(start);
  if (from < 0) return "";
  const rest = text.slice(from).replace(start, "");
  const stop = rest.search(end);
  return cleanLines(stop < 0 ? rest : rest.slice(0, stop));
}

function cleanLines(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^Caution/i.test(l))
    .join("\n")
    .trim();
}

export function parseTitleSearchText(raw: string): TitleSearchExtract {
  const text = String(raw ?? "").replace(/\r/g, "\n");
  if (text.trim().length < 20) return {};
  const out: TitleSearchExtract = { title_search_text: text.trim().slice(0, 20000) };

  const titleRef =
    text.match(/Title\s*Reference\s*[:\s]*([0-9]{5,12})/i)?.[1] ||
    text.match(/\bTitle Reference:\s*\n?\s*([0-9]{5,12})/i)?.[1];
  if (titleRef) out.prop_title = titleRef;

  const searchDate =
    text.match(/Search\s*Date\s*[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i)?.[1];
  if (searchDate) {
    const formatted = auDate(searchDate);
    out.prop_title_search_date = formatted;
    out.exam_title_search_date = formatted;
  }

  const created = text.match(
    /(?:Title\s+Created|Date\s+Created)\s*[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i,
  )?.[1];
  if (created) out.title_created = auDate(created);

  const lotPlan =
    text.match(
      /LOT\s+(\d+[A-Z]?)\s+(SURVEY PLAN|REGISTERED PLAN|BUILDING FORMAT PLAN|GROUP TITLE PLAN|CROWN PLAN|SP|RP|BUP|GTP|CP)\s+(\d+)/i,
    ) ||
    text.match(/\bLot\s+(\d+[A-Z]?)\s+on\s+(SP|RP|BUP|GTP|CP)\s*(\d+)/i);
  if (lotPlan) {
    const lot = lotPlan[1]!;
    const code = planCode(lotPlan[2]!, lotPlan[3]!);
    out.prop_lotplan = `Lot ${lot} ${code}`;
    out.prop_legal = `Lot ${lot} on ${code}`;
  }

  const lga = text.match(/Local\s*Government\s*[:\s]*([A-Z][A-Z \-']{2,60})/i)?.[1];
  if (lga) out.prop_lga = clean(lga.replace(/\s+CITY$/i, " CITY"));

  if (/Estate in Fee Simple/i.test(text) || /Fee Simple/i.test(text)) {
    out.prop_rights = "Fee Simple";
  } else if (/Leasehold/i.test(text)) {
    out.prop_rights = "Leasehold";
  }

  const ownerBlock = text.match(
    /REGISTERED OWNER\s*\n([\s\S]{10,800}?)(?=\n\s*(?:EASEMENTS|ADMINISTRATIVE ADVICES|UNREGISTERED DEALINGS|ESTATE AND LAND)\b|$)/i,
  );
  if (ownerBlock?.[1]) {
    const lines = ownerBlock[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^Dealing No/i.test(l) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(l));
    const name = lines.find((l) => /pty|ltd|trustee|and\b|[A-Z]{2,}/i.test(l) && l.length > 3);
    if (name) out.prop_owner = clean(name.replace(/\s+TRUSTEE$/i, " as trustee"));
  }

  const encBlock = text.match(
    /EASEMENTS, ENCUMBRANCES AND INTERESTS\s*\n([\s\S]{10,8000}?)(?=\n\s*(?:ADMINISTRATIVE ADVICES|UNREGISTERED DEALINGS)\b|$)/i,
  );
  if (encBlock?.[1]) {
    const body = encBlock[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^Caution/i.test(l))
      .join("\n")
      .trim();
    if (body && !/^NIL$/i.test(body)) {
      out.enc_notes = body.slice(0, 8000);
      if (/easement/i.test(body)) out.enc = "Easement";
    }
  }

  const advices = section(
    text,
    /ADMINISTRATIVE ADVICES\s*\n/i,
    /\n\s*(?:UNREGISTERED DEALINGS|EASEMENTS, ENCUMBRANCES)\b/i,
  );
  if (advices && !/^NIL$/i.test(advices)) out.title_admin_advices = advices.slice(0, 8000);

  const unregistered = section(
    text,
    /UNREGISTERED DEALINGS\s*\n/i,
    /\n\s*(?:ADMINISTRATIVE ADVICES|EASEMENTS, ENCUMBRANCES|END OF (?:CURRENT )?TITLE SEARCH|END OF SEARCH|COPYRIGHT)\b/i,
  );
  const cleanedUnregistered = unregistered
    .replace(/End of Current Title Search[\s\S]*$/i, "")
    .replace(/copyright[\s\S]*$/i, "")
    .replace(/\bNIL\b/gi, "")
    .replace(/\*+/g, "")
    .trim();
  out.title_unregistered = cleanedUnregistered
    ? cleanedUnregistered.slice(0, 4000)
    : "None recorded";
  if (text.trim()) out.title_search_text = text.trim().slice(0, 20000);

  return out;
}

export function mergeTitleSearchExtract(
  existing: Record<string, unknown>,
  incoming: TitleSearchExtract,
): Record<string, string> {
  const patch: Record<string, string> = {};
  const authoritative: Array<keyof TitleSearchExtract> = [
    "prop_title",
    "prop_lotplan",
    "prop_legal",
    "prop_rights",
    "prop_title_search_date",
    "exam_title_search_date",
    "title_created",
    "enc_notes",
    "enc",
    "title_search_text",
    "title_admin_advices",
    "title_unregistered",
  ];
  for (const key of authoritative) {
    const value = incoming[key]?.trim();
    if (value) patch[key] = value;
  }
  if (incoming.prop_owner?.trim() && !String(existing.prop_owner ?? "").trim()) {
    patch.prop_owner = incoming.prop_owner.trim();
  }
  if (incoming.prop_lga?.trim() && !String(existing.prop_lga ?? "").trim()) {
    patch.prop_lga = incoming.prop_lga.trim();
  }
  return patch;
}
