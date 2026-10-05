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

const ADVICE_MEANING: Array<{
  test: RegExp;
  act: string;
  meaning: string;
}> = [
  {
    test: /heritage/i,
    act: "the Queensland Heritage Act 1992",
    meaning:
      "A heritage administrative advice records that the land is affected by a state or local heritage listing or a heritage agreement. Works may need approval beyond the planning scheme.",
  },
  {
    test: /contaminat|clr\b|notifiable activity/i,
    act: "the Environmental Protection Act 1994",
    meaning:
      "A contaminated-land advice records that the land is on the environmental management or contaminated-land register, or that a notifiable activity has been recorded. Use may be restricted until the site is investigated or removed from the register.",
  },
  {
    test: /coastal|erosion prone/i,
    act: "the Coastal Protection and Management Act 1995",
    meaning:
      "A coastal advice records that the land is in a coastal management district or an erosion-prone area. Building and clearing can be limited inside that area.",
  },
  {
    test: /nature conservation|koala|protected area/i,
    act: "the Nature Conservation Act 1992",
    meaning:
      "A nature-conservation advice records a protected-area, koala-habitat or conservation obligation that can restrict clearing and use.",
  },
  {
    test: /resumption|intention to resume|acquisition of land/i,
    act: "the Acquisition of Land Act 1967",
    meaning:
      "A resumption advice records a notice of intention to resume or a related acquisition step. It can remove or reduce the land available to the owner.",
  },
  {
    test: /water (licence|license|notice)|water act/i,
    act: "the Water Act 2000",
    meaning:
      "A water advice records a water licence, allocation or notice that may not run with the land in the same way as the title.",
  },
  {
    test: /strategic cropping|priority agricultural|regional interest/i,
    act: "the Regional Planning Interests Act 2014",
    meaning:
      "This advice records a regional interest, such as strategic cropping land or a priority agricultural area, which can constrain a non-agricultural use.",
  },
  {
    test: /carbon|offset/i,
    act: "the relevant carbon or offset legislation",
    meaning:
      "This advice records a carbon-farming, offset or similar interest that can restrict clearing and future use for the term of the project.",
  },
  {
    test: /mining|petroleum|resource authority|geothermal/i,
    act: "the Mineral and Energy Resources (Common Provisions) Act 2014",
    meaning:
      "This advice records a resource authority or related notice. It can allow access or restrict surface use even though it is not an estate in the land.",
  },
  {
    test: /cultural heritage|aboriginal/i,
    act: "the Aboriginal Cultural Heritage Act 2003",
    meaning:
      "This advice records a cultural-heritage obligation or agreement. Ground disturbance may need a heritage assessment.",
  },
];

function adviceLine(item: TitleAdvice): string {
  const lodged = item.lodged ? `, lodged ${item.lodged}` : "";
  const status = item.status ? `, ${item.status.toLowerCase()}` : "";
  const dealing = item.dealing ? `dealing ${item.dealing}` : "an administrative advice";
  return `${dealing}${lodged}${status}`;
}

function meaningFor(item: TitleAdvice): { act: string; meaning: string } {
  const blob = `${item.label} ${item.detail}`;
  const found = ADVICE_MEANING.find((row) => row.test.test(blob));
  if (found) return found;
  return {
    act: "the Act named on the dealing",
    meaning:
      "The search records the advice type and dealing number only. The dealing image was not obtained, so the precise restriction is not confirmed from the search alone.",
  };
}

function usableAssumption(values: InspectionValues): string {
  const usable = String(values["prop_usable_sitearea"] ?? "").trim();
  return usable
    ? `This valuation assumes the advice is confined to land already excluded from the estimated usable area of ${usable} square metres.`
    : "This valuation assumes the advice does not reduce the recorded usable area.";
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
        `The current title search records an administrative advice, ${adviceLine(item)}, under ${meaningFor(item).act}.`,
        meaningFor(item).meaning,
        item.detail ? `The search notes: ${item.detail}.` : "The dealing image was not obtained.",
        usableAssumption(values),
        "If the dealing shows that it affects land treated as usable, the value should be referred back.",
        "No separate dollar adjustment is made unless a comparable is shown not to carry the same advice.",
      ].join(" "),
    );
  }
  return paragraphs.join("\n\n");
}

export function buildEncumbrancesSummary(values: InspectionValues): string {
  const text = String(values["title_search_text"] ?? values["enc_notes"] ?? "");
  const interestBlock =
    text.match(
      /EASEMENTS, ENCUMBRANCES AND INTERESTS\s*\n([\s\S]{0,4000}?)(?=\n\s*ADMINISTRATIVE ADVICES\b|$)/i,
    )?.[1] ?? "";
  const interests = interestBlock
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(
      (line) =>
        line &&
        !/^Dealing\s+Type/i.test(line) &&
        !/^NIL$/i.test(line) &&
        !/End of Current Title Search/i.test(line) &&
        !/copyright|Titles Queensland/i.test(line) &&
        !/^Caution/i.test(line),
    )
    .slice(0, 4);
  const notices = buildTitleNoticesNarrative(values);
  const veg = notices
    .split(/\n\n/)
    .find((part) => /VEG NOTICE/i.test(part));
  const parts = [
    interests.length
      ? `The title records ${interests.join("; ")}.`
      : "",
    veg ?? "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function titleAdviceFacts(values: InspectionValues): string {
  const narrative = buildTitleNoticesNarrative(values);
  if (!narrative) return "No administrative advice was read from the imported title search.";
  return narrative;
}
