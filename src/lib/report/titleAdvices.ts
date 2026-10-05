/**
 * Administrative advices on a Titles Queensland current title search.
 * A VEG NOTICE is not a restoration notice. Restoration notices are entered
 * as RESTORATION. A VEG NOTICE is a property map of assessable vegetation
 * that contains a Category A area, or a declared area and management plan.
 */
import type { InspectionValues } from "@/lib/report/types";

export interface TitleAdvice {
  dealing: string;
  kind: "vegetation-notice" | "restoration" | "other";
  label: string;
  lodged: string;
  status: string;
  detail: string;
  raw: string;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function kindOf(label: string, detail: string): TitleAdvice["kind"] {
  const blob = `${label} ${detail}`;
  if (/veg(?:etation)?\s*notice/i.test(blob)) return "vegetation-notice";
  if (/restoration/i.test(blob)) return "restoration";
  return "other";
}

export function parseAdministrativeAdvices(raw: string): TitleAdvice[] {
  const text = raw.replace(/\r/g, "");
  const block = text.match(
    /ADMINISTRATIVE ADVICES\s*\n([\s\S]{0,8000}?)(?=\n\s*UNREGISTERED DEALINGS\b|$)/i,
  );
  const body = clean(block?.[1] ?? "");
  if (!body || /^NIL$/i.test(body)) return [];
  const withoutHeader = body
    .replace(/^Dealing\s+Type\s+Lodgement\s+Date\s+Status\s*/i, "")
    .trim();
  if (!withoutHeader || /^NIL$/i.test(withoutHeader)) return [];

  const chunks = withoutHeader.split(/(?=\b\d{6,12}\b)/).map(clean).filter(Boolean);
  const out: TitleAdvice[] = [];
  for (const chunk of chunks) {
    const match = chunk.match(
      /^(\d{6,12})\s+([A-Z][A-Z /-]{2,40}?)\s+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{2}:\d{2})?\s+(CURRENT|CANCELLED|EXPIRED|REMOVED)?\s*([\s\S]*)$/i,
    );
    if (!match) {
      if (chunk.length > 8) {
        out.push({
          dealing: "",
          kind: kindOf(chunk, chunk),
          label: chunk.slice(0, 80),
          lodged: "",
          status: "",
          detail: chunk,
          raw: chunk,
        });
      }
      continue;
    }
    const label = clean(match[2] ?? "");
    const detail = clean(match[5] ?? "");
    out.push({
      dealing: match[1] ?? "",
      kind: kindOf(label, detail),
      label,
      lodged: match[3] ?? "",
      status: clean(match[4] ?? ""),
      detail,
      raw: chunk,
    });
  }
  return out;
}

export function administrativeAdviceText(raw: string): string {
  return parseAdministrativeAdvices(raw)
    .map((item) => item.raw)
    .join("\n");
}

function adviceLine(item: TitleAdvice): string {
  const lodged = item.lodged ? `, lodged ${item.lodged}` : "";
  const status = item.status ? `, ${item.status.toLowerCase()}` : "";
  const dealing = item.dealing ? `dealing ${item.dealing}` : "an administrative advice";
  return `${dealing}${lodged}${status}`;
}

export function buildTitleNoticesNarrative(values: InspectionValues): string {
  const raw = String(values["title_admin_advices"] ?? values["title_search_text"] ?? "");
  const items = parseAdministrativeAdvices(raw.includes("ADMINISTRATIVE ADVICES") ? raw : `ADMINISTRATIVE ADVICES\n${raw}`);
  if (!items.length) return "";
  const usable = String(values["prop_usable_sitearea"] ?? "").trim();
  const paragraphs: string[] = [];
  for (const item of items) {
    if (item.kind === "vegetation-notice") {
      paragraphs.push(
        [
          `The current title search records a VEG NOTICE, ${adviceLine(item)}, under the Vegetation Management Act 1999.`,
          "A VEG NOTICE is not a restoration notice. Those are entered on title as RESTORATION.",
          "A VEG NOTICE is either a property map of assessable vegetation that contains a Category A area, or a declared area and its management plan.",
          "The dealing image was not obtained, so the type cannot be settled from the title search alone.",
          usable
            ? `This valuation assumes the notice is confined to land already excluded from the estimated usable area of ${usable} square metres.`
            : "This valuation assumes the notice is confined to land already treated as unusable.",
          "If the dealing shows that it affects the building pad or other land treated as usable, the value should be referred back.",
          "No separate dollar adjustment is made unless a comparable is shown not to carry the same notice.",
        ].join(" "),
      );
      continue;
    }
    if (item.kind === "restoration") {
      paragraphs.push(
        [
          `The current title search records a restoration notice, ${adviceLine(item)}, under the Vegetation Management Act 1999.`,
          "A restoration notice is issued where an authorised officer believes a vegetation clearing offence has occurred and the matter can be rectified.",
          "It can run with the land. The notice itself was not obtained.",
          "This valuation assumes the required work does not reduce the recorded usable area. If it does, the value should be referred back.",
        ].join(" "),
      );
      continue;
    }
    paragraphs.push(
      [
        `The current title search records an administrative advice, ${adviceLine(item)}${item.detail ? `: ${item.detail}` : ""}.`,
        "The instrument was not obtained, so its effect on use and value is not confirmed from the search alone.",
        "This valuation assumes it does not reduce the recorded usable area. If the instrument shows that it does, the value should be referred back.",
      ].join(" "),
    );
  }
  return paragraphs.join("\n\n");
}

export function titleAdviceFacts(values: InspectionValues): string {
  const narrative = buildTitleNoticesNarrative(values);
  if (!narrative) return "No administrative advice was read from the imported title search.";
  return narrative;
}
