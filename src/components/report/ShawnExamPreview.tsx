import { useEffect, type ReactElement, type ReactNode } from "react";
import { australianiseSpelling } from "@/lib/report/australianEnglish";
import { stripLeadingHeading } from "@/lib/report/printText";
import {
  buildClientInstructions,
  buildSiteIdentification,
  executiveSummaryBriefText,
  section61PhysicalText,
} from "@/lib/report/narrative";
import {
  coverLotPlan,
  formatHbuVacant,
  formatPropertyType,
  formatSiteDimensions,
  formatUsableSiteAreaIfDifferent,
  get,
  joinValues,
  valuedInterestPhrase,
} from "@/lib/report/schema";
import { surveyPlanAnnexureLabel } from "@/lib/report/annexures";
import { narrativePrints } from "@/lib/narrative/neighbourhoodAssist";
import {
  MAP_SLOTS,
  PHOTO_SLOTS,
  cadastralPhotosOnReport,
  extraAnnexGroupsOnReport,
  isCadastralAnnexPhoto,
  isExtraAnnexPhoto,
  isMapAnnexPhoto,
  isSurveyAnnexPhoto,
  isTitleAnnexPhoto,
  photoIsOnReport,
  salesOnReport,
  surveyPhotosOnReport,
  titlePhotosOnReport,
  type ReportDraft,
} from "@/lib/report/types";
import { A4DocumentAnnex } from "@/components/report/A4DocumentAnnex";
import { AdjustmentGridPrint } from "@/components/report/AdjustmentGridPrint";
import { SalesEvidenceSchedule } from "@/components/report/SalesEvidenceSchedule";
import {
  printAdjustmentGridEnabled,
  printSalesEvidenceEnabled,
} from "@/lib/report/adjustmentGrid";
import { purposeOfValuation } from "@/lib/report/reportTypes";
import { fillExamTocPages } from "@/lib/report/tocPages";
import { cleanSaleProse, formatCurrencyDisplay } from "@/lib/report/salesRelativity";
import { buildRiskAnalysis } from "@/lib/report/propertyRiskRatings";
import { RiskRatingsPrintTable } from "@/components/report/RiskRatingsPrintTable";
import { SHAWN_EXAM_STYLE as EXAM } from "@/lib/report/shawnExamStyle";



const TEAL = EXAM.navy;
const STRIPE = EXAM.stripe;
const RULE = EXAM.rule;

const IVSC_MARKET_VALUE =
  "Market Value is the estimated amount for which an asset or liability should exchange on the date of valuation between a willing buyer and a willing seller in an arm’s-length transaction after proper marketing where the parties had each acted knowledgeably, prudently and without compulsion. (IVS 2025)";

function amountInWords(raw: string): string {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return "";
  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const chunk = (num: number): string => {
    if (num === 0) return "";
    if (num < 20) return ones[num] ?? "";
    if (num < 100) {
      const unit = num % 10;
      return `${tens[Math.floor(num / 10)]}${unit ? `-${ones[unit]}` : ""}`;
    }
    const rest = num % 100;
    return `${ones[Math.floor(num / 100)]} hundred${rest ? ` and ${chunk(rest)}` : ""}`;
  };
  const dollars = Math.floor(n);
  if (dollars === 0) return "zero dollars";
  const millions = Math.floor(dollars / 1_000_000);
  const thousands = Math.floor((dollars % 1_000_000) / 1000);
  const rest = dollars % 1000;
  const parts: string[] = [];
  if (millions) parts.push(`${chunk(millions)} million`);
  if (thousands) parts.push(`${chunk(thousands)} thousand`);
  if (rest) parts.push(chunk(rest));
  const body = parts.join(" ");
  return body ? body.charAt(0).toUpperCase() + body.slice(1) + " dollars" : "";
}

function Para({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-left leading-relaxed">{children}</p>;
}

function Prose({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      {australianiseSpelling(text)
        .split(/\n{1,}/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, i) => (
          <p key={i} className="text-left leading-relaxed">
            {line}
          </p>
        ))}
    </>
  );
}

function RiskAnalysisProse({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      {australianiseSpelling(text)
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, i) => {
          const match = block.match(/^(.+?\.)\s*([\s\S]*)$/);
          const lead = match?.[1] ?? block;
          const rest = match?.[2]?.trim() ?? "";
          return (
            <p key={i} className="text-left leading-relaxed">
              <strong className="font-bold">{lead}</strong>
              {rest ? ` ${rest}` : ""}
            </p>
          );
        })}
    </>
  );
}

function H1({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="report-h2 report-heading-lead mt-8 border-b pb-1 text-[1.05rem] font-semibold"
      style={{ color: TEAL, borderColor: RULE }}
    >
      {children}
    </h2>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
      {children}
    </h3>
  );
}

function Lead({
  id,
  title,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="report-h-block">
      <H1 id={id}>{title}</H1>
      {children}
    </div>
  );
}

function Keep({ children }: { children: React.ReactNode }) {
  return <div className="report-keep-block">{children}</div>;
}

function TocRows({ entries }: { entries: { id: string; label: string }[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="exam-toc mt-3 list-none space-y-1 text-sm" style={{ color: TEAL }}>
      {entries.map((item) => (
        <li key={item.id} className="exam-toc-row">
          <a href={`#${item.id}`}>{item.label}</a>
          <span className="exam-toc-leader" aria-hidden />
          <span className="exam-toc-page" data-toc-id={item.id} />
        </li>
      ))}
    </ol>
  );
}

function ExamToc({
  entries,
  annexures,
}: {
  entries: { id: string; label: string }[];
  annexures: { id: string; label: string }[];
}) {
  useEffect(() => {
    const run = () => fillExamTocPages();
    run();
    const t = window.setTimeout(run, 400);
    window.addEventListener("beforeprint", run);
    window.addEventListener("load", run);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeprint", run);
      window.removeEventListener("load", run);
    };
  }, [entries, annexures]);
  return (
    <>
      <TocRows entries={entries} />
      <p className="exam-toc-subhead">List of Annexures</p>
      {annexures.length > 0 ? (
        <TocRows entries={annexures} />
      ) : (
        <p className="mt-2 text-sm" style={{ color: TEAL }}>
          No annexures attached.
        </p>
      )}
    </>
  );
}

function StripeTable({ rows }: { rows: { label: string; value: string }[] }) {
  const shown = rows.filter((r) => r.value.trim());
  if (shown.length === 0) return null;
  return (
    <div className="report-table-keep">
    <table className="report-fact-table mt-3 w-full border-collapse text-sm">
      <tbody>
        {shown.map((row, i) => (
          <tr key={`${row.label}-${i}`} style={{ background: i % 2 === 0 ? STRIPE : "#fff" }}>
            <th className="w-[34%] border px-2 py-1.5 text-left font-semibold" style={{ borderColor: RULE }}>
              {row.label}
            </th>
            <td className="border px-2 py-1.5 whitespace-pre-line" style={{ borderColor: RULE }}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

const PHOTO_ANNEX_PER_PAGE = 4;

function PhotoAnnexPages({ heading, children }: { heading: string; children: ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean) as ReactElement[];
  const pages: ReactElement[][] = [];
  for (let i = 0; i < items.length; i += PHOTO_ANNEX_PER_PAGE) {
    pages.push(items.slice(i, i + PHOTO_ANNEX_PER_PAGE));
  }
  return (
    <>
      {pages.map((pageItems, pi) => (
        <div key={`annex-page-${pi}`} className="photo-annex-page">
          <h2 className="photo-annex-heading">{heading}</h2>
          <div className="photo-annex-grid">
            {pageItems.map((cell, ci) => (
              <div key={cell.key ?? `annex-cell-${pi}-${ci}`} className="photo-annex-cell">
                {cell}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function ShawnExamPreview({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;
  const printedSales = salesOnReport(draft.sales);
  const addressLine = [
    get(v, "prop_address"),
    [get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const lotPlan = get(v, "prop_lotplan") || get(v, "prop_legal");
  const frontPhoto = draft.photos.find((p) => p.slot === "front" && photoIsOnReport(p));
  const student = get(v, "exam_student_name") || get(v, "insp_valuer") || m.valuerName;
  const studentNo = get(v, "exam_student_number");
  const instructing = get(v, "instr_from_name") || get(v, "prop_owner") || "the instructing party";
  const purpose =
    purposeOfValuation(get(v, "prop_assignment"), v);
  const propertyType = formatPropertyType(v) || "Vacant residential land";
  const annexurePhotos = [
    ...PHOTO_SLOTS.map(({ slot, label }) => {
      const found = draft.photos.find((p) => p.slot === slot && photoIsOnReport(p));
      return found ? { ...found, caption: found.caption || label } : null;
    }).filter(Boolean),
    ...draft.photos.filter(
      (p) =>
        p.slot === null &&
        !isMapAnnexPhoto(p) &&
        !isTitleAnnexPhoto(p) &&
        !isSurveyAnnexPhoto(p) &&
        !isCadastralAnnexPhoto(p) &&
        !isExtraAnnexPhoto(p) &&
        photoIsOnReport(p),
    ),
  ] as typeof draft.photos;
  const mapPhotos = [
    ...MAP_SLOTS.map(({ slot, label }) => {
      const found = draft.photos.find((p) => p.slot === slot && photoIsOnReport(p));
      return found ? { ...found, caption: found.caption || label } : null;
    }).filter(Boolean),
    ...draft.photos.filter(
      (p) => p.slot === null && isMapAnnexPhoto(p) && photoIsOnReport(p),
    ),
  ] as typeof draft.photos;
  const titlePages = titlePhotosOnReport(draft.photos);
  const surveyPages = surveyPhotosOnReport(draft.photos);
  const cadastralPages = cadastralPhotosOnReport(draft.photos);
  const extraAnnexGroups = extraAnnexGroupsOnReport(draft.photos);
  const valueWords = m.valueAmount ? amountInWords(m.valueAmount) : "";
  const siteArea = joinValues(v, ["prop_sitearea", "prop_areaunit"], " ");
  const usableSiteArea = formatUsableSiteAreaIfDifferent(v);
  const servicesText = narrativePrints(m, "servicesAmenities")
    ? draft.narrative.servicesAmenities?.trim() || ""
    : "";
 

  const toc = [
    { id: "exam-summary", label: "Executive Summary" },
    { id: "exam-1", label: "1.0 Basis of Value" },
    { id: "exam-2", label: "2.0 Title and Property Details" },
    { id: "exam-3", label: "3.0 Planning Controls" },
    { id: "exam-4", label: "4.0 Environmental Issues" },
    { id: "exam-5", label: "5.0 Locality and Location" },
    { id: "exam-6", label: "6.0 Market Commentary" },
    { id: "exam-7", label: "7.0 Risk Assessment" },
    { id: "exam-8", label: "8.0 Valuation Approach" },
    { id: "exam-9", label: "9.0 List of References" },
    { id: "exam-10", label: "10.0 Annexures" },
  ];
  const hasMarketParts = Boolean(
    get(v, "exam_market_australia") ||
      get(v, "exam_market_state") ||
      get(v, "exam_market_region") ||
      get(v, "exam_market_local"),
  );

  return (
    <article
      id="report-preview-sheet"
      className="report-sheet report-type-exam mx-auto max-w-[52rem] px-8 py-10 shadow-sm sm:px-12 sm:py-14"
    >
      <section className="exam-cover break-after-page text-left">
        <header className="exam-wordmark">
          <img
            src={EXAM.logoSrc}
            alt={`${EXAM.firmName} ${EXAM.firmTrade}`}
            className="exam-wordmark-logo"
          />
        </header>
        {frontPhoto?.url ? (
          <figure className="exam-cover-photo mx-auto">
            <img
              src={frontPhoto.url}
              alt={addressLine || "Subject property"}
              className="w-full object-contain"
            />
          </figure>
        ) : null}
        <h1 className="exam-cover-kicker">Valuation Report</h1>
        <p className="exam-cover-address">{addressLine || "—"}</p>
        {coverLotPlan(v) ? (
          <p className="exam-cover-meta">{coverLotPlan(v)}</p>
        ) : null}
        <p className="exam-cover-meta">Prepared for {instructing}</p>
        <p className="exam-cover-meta">{propertyType}</p>
        <p className="exam-cover-meta">
          Basis of the valuation — {get(v, "insp_basis") || "Market value"}
        </p>
        <p className="exam-cover-meta">
          Purpose of the report: {purpose || "—"}
        </p>
        {student ? <p className="exam-cover-meta">Prepared by {student}</p> : null}
        {studentNo ? <p className="exam-cover-meta">Student number {studentNo}</p> : null}
        {get(v, "instr_from_email") ? (
          <p className="exam-cover-meta">Email: {get(v, "instr_from_email")}</p>
        ) : null}
      </section>

      <H1>Table of Contents</H1>
      <ExamToc
        entries={toc}
        annexures={[
          ...(annexurePhotos.length > 0
            ? [{ id: "exam-annex-subject", label: "Subject photographs" }]
            : []),
          ...(printedSales.some((s) => s.photoUrl)
            ? [{ id: "exam-annex-comps", label: "Comparable sale photographs" }]
            : []),
          ...(mapPhotos.length > 0 ? [{ id: "exam-annex-maps", label: "Maps" }] : []),
          ...(cadastralPages.length > 0
            ? [{ id: "exam-annex-cadastral", label: "Cadastral plan" }]
            : []),
          ...(titlePages.length > 0
            ? [{ id: "exam-annex-title", label: "Certificate of Title" }]
            : []),
          ...(surveyPages.length > 0
            ? [{ id: "exam-annex-survey", label: "Survey Plan" }]
            : []),
          ...extraAnnexGroups.map((g) => ({
            id: `exam-annex-extra-${g.id}`,
            label: g.title,
          })),
        ]}
      />

      <div id="exam-summary" className="report-exam-summary-sheet report-keep-block">
      <H1>Executive Summary</H1>
      <Para>
        Instructions were received from {instructing} to prepare a valuation of
        {addressLine ? ` ${addressLine}` : " the subject property"}
        {purpose ? ` for the purpose of ${purpose}` : ""}.
      </Para>
      <StripeTable
        rows={[
          { label: "Property Address", value: addressLine },
          { label: "Real Property Description", value: lotPlan },
          { label: "Property Type", value: propertyType },
          { label: "Property rights", value: get(v, "prop_rights") },
          { label: "Instructing Party", value: instructing },
          { label: "Valuation Purpose", value: purpose },
          {
            label: "Brief Description of the Property",
            value: executiveSummaryBriefText({
              brief: draft.narrative.brief,
            }),
          },
          { label: "Zoning", value: get(v, "prop_zoning") },
          { label: "Date of Inspection", value: m.inspectionDate },
          { label: "Date of Valuation", value: m.valueDate },
        ]}
      />
      {m.valueAmount ? (
        <div className="mt-4 text-left">
          <p>The Market Valuation of {addressLine || "the subject property"} is:</p>
          <p className="mt-2 text-xl font-semibold">${formatCurrencyDisplay(m.valueAmount)}</p>
          {valueWords ? <p className="mt-1">({valueWords})</p> : null}
        </div>
      ) : null}
      <div className="mt-4">
        <p className="text-sm">Signature of Student Valuer</p>
        <ExamSignature draft={draft} />
      </div>
      </div>

      <Lead id="exam-1" title="1.0 Basis of Value">
      <Keep>
      <H2>1.1 Instructions</H2>
      <Prose
        text={
          draft.narrative.instructions?.trim() ||
          buildClientInstructions(v)
        }
      />
      </Keep>
      </Lead>

      <Keep>
      <H2>1.2 Valuation Standards</H2>
      <Para>
        The methodological framework for this valuation is grounded in the standards established by
        the International Valuation Standards Council (IVSC), the Australian Property Institute (API),
        and the Royal Institution of Chartered Surveyors (RICS). The basis of valuation is Market
        Value, defined as follows:
      </Para>
      <p className="mt-2 italic">{IVSC_MARKET_VALUE}</p>
      </Keep>

      <Keep>
      <H2>1.3 Valuer’s Interest</H2>
      <Para>
        The valuer declares that there is no pecuniary, professional or other interest that would
        constitute a conflict of interest or otherwise compromise the ability to provide an
        independent and unbiased valuation. Directives for this assignment have been received from
        the instructing party.
      </Para>
      </Keep>

      <Keep>
      <H2>1.4 Date of Valuation / Liability</H2>
      <Para>
        The subject property was inspected on {m.inspectionDate || "the date recorded in this report"}.
        The valuation is effective as at {m.valueDate || "the date of valuation"} only. The concluded
        value reflects market conditions at that date and may be affected by subsequent events,
        including market fluctuations, interest-rate movements and changes in broader economic
        conditions.
      </Para>
      </Keep>

      <Lead id="exam-2" title="2.0 Title and Property Details">
      <Keep>
      <H2>2.1 Property Description</H2>
      <Prose
        text={section61PhysicalText({
          sitePhysical: draft.narrative.sitePhysical,
          values: v,
        })}
      />
      {!section61PhysicalText({
        sitePhysical: draft.narrative.sitePhysical,
        values: v,
      }) ? (
        <Para>
          {siteArea ? `The subject allotment has an area of ${siteArea}. ` : ""}
          {usableSiteArea
            ? `Estimated usable site area is ${usableSiteArea}. `
            : ""}
          {get(v, "prop_shape") ? `Allotment shape is recorded as ${get(v, "prop_shape")}. ` : ""}
          {get(v, "prop_lot_position") ? `Lot position is ${get(v, "prop_lot_position")}.` : ""}
        </Para>
      ) : null}
      </Keep>
      </Lead>

      <Keep>
      <H2>2.2 Title Particulars</H2>
      <StripeTable
        rows={[
          { label: "Street address", value: addressLine },
          { label: "Real property description", value: lotPlan },
          { label: "Title reference", value: get(v, "prop_title") },
          { label: "Local government", value: get(v, "prop_lga") },
          { label: "Registered owner", value: get(v, "prop_owner") },
          { label: "Nature of interest", value: get(v, "prop_rights") },
          {
            label: "How the site was identified",
            value:
              draft.narrative.siteIdentification?.trim() ||
              buildSiteIdentification(v),
          },
          { label: "Date of title search", value: get(v, "exam_title_search_date") },
        ]}
      />
      </Keep>

      <Keep>
      <H2>2.3 Particulars of Land</H2>
      <StripeTable
        rows={[
          { label: "Area", value: siteArea },
          { label: "Estimated usable site area", value: usableSiteArea },
          { label: "Dimensions", value: formatSiteDimensions(v, surveyPlanAnnexureLabel(draft)) },
          { label: "Frontage", value: get(v, "prop_frontage") },
          { label: "Allotment shape", value: get(v, "prop_shape") },
          { label: "Lot position", value: get(v, "prop_lot_position") },
          { label: "Topography", value: get(v, "topo") },
          { label: "Adjoining properties", value: get(v, "adj_props") },
          { label: "Adjoining interface / impact", value: get(v, "adj_props_interface") },
          { label: "Adjoining notes", value: get(v, "adj_props_notes") },
          { label: "Access / street frontage", value: get(v, "prop_access") || get(v, "access") },
          { label: "Utilities", value: servicesText },
          { label: "Easements, encumbrances and restrictions", value: get(v, "prop_rights") },
        ]}
      />
      </Keep>

      <Lead id="exam-3" title="3.0 Planning Controls">
      <Keep>
      <H2>3.1 Planning Scheme and Zoning</H2>
      <StripeTable
        rows={[
          { label: "Planning scheme", value: get(v, "exam_planning_scheme") },
          { label: "Zoning", value: get(v, "prop_zoning") },
          { label: "Zoning purpose / description", value: get(v, "prop_zoning_desc") },
          { label: "Zoning compliance", value: get(v, "prop_zoning_comp") },
        ]}
      />
      </Keep>
      </Lead>
      <div className="report-keep-block">
        <H2>3.2 Highest and Best Use</H2>
        {draft.narrative.highestBestUse?.trim() ? (
          <Prose text={draft.narrative.highestBestUse} />
        ) : (
          <Para>{formatHbuVacant(v) || "Record the highest and best use of the subject property."}</Para>
        )}
      </div>

      <Lead id="exam-4" title="4.0 Environmental Issues">
      <Keep>
      <Para>
        No separate contaminated-land search is assumed beyond the inspection record and any planning
        overlays noted. The valuation assumes there are no environmental issues other than those set
        out below.
      </Para>
      </Keep>
      </Lead>
      <Keep>
      <H2>4.1 Acid sulphate soils</H2>
      <Prose
        text={
          get(v, "exam_acid_sulphate") ||
          get(v, "plan_overlay_notes") ||
          get(v, "prop_adverse_site") ||
          ""
        }
      />
      {!get(v, "exam_acid_sulphate") &&
      !get(v, "plan_overlay_notes") &&
      !get(v, "prop_adverse_site") ? (
        <Para>
          Comment is limited to planning overlays and matters recorded on inspection or title. If
          an acid sulphate soils overlay applies, record whether it affects development or value.
        </Para>
      ) : null}
      </Keep>
      <Keep>
      <H2>4.2 Flood assessment</H2>
      <Para>
        {[get(v, "prop_flood"), get(v, "prop_flood_map")].filter(Boolean).join(". ") ||
          "No flood notation is recorded on the inspection."}
      </Para>
      </Keep>
      <Keep>
      <H2>4.3 Noise and other nuisances</H2>
      <Para>
        {get(v, "nbhd_adverse") ||
          "No formal acoustic report has been obtained. Comment is limited to features recorded on the inspection."}
      </Para>
      </Keep>

      <Lead id="exam-5" title="5.0 Locality and Location">
      <Keep>
      <H2>5.1 Location</H2>
      {narrativePrints(m, "location") ? (
        <>
      <Prose text={stripLeadingHeading(draft.narrative.location?.trim() || "", "Location")} />
      {!draft.narrative.location?.trim() && addressLine ? (
        <Para>The property is located at {addressLine}.</Para>
      ) : null}
        </>
      ) : null}
      </Keep>
      </Lead>
      <Keep>
      <H2>5.2 Locality</H2>
      {narrativePrints(m, "neighbourhood") ? (
      <Prose
        text={stripLeadingHeading(
          stripLeadingHeading(
            draft.narrative.neighbourhood?.trim() || get(v, "nbhd_description") || "",
            "Neighbourhood",
          ),
          "Locality",
        )}
      />
      ) : null}
      </Keep>
      {get(v, "exam_amenities") ? (
        <Keep>
          <H2>5.3 Amenities</H2>
          <Prose text={get(v, "exam_amenities")} />
        </Keep>
      ) : null}
      {get(v, "exam_destinations") ? (
        <Keep>
          <H2>5.4 Popular destinations</H2>
          <Prose text={get(v, "exam_destinations")} />
        </Keep>
      ) : null}

      <Lead id="exam-6" title="6.0 Market Commentary">
      {hasMarketParts ? (
        <>
          {get(v, "exam_market_australia") ? (
            <Keep>
              <H2>6.1 Australia</H2>
              <Prose text={get(v, "exam_market_australia")} />
            </Keep>
          ) : null}
          {get(v, "exam_market_state") ? (
            <Keep>
              <H2>6.2 State</H2>
              <Prose text={get(v, "exam_market_state")} />
            </Keep>
          ) : null}
          {get(v, "exam_market_region") ? (
            <Keep>
              <H2>6.3 Region</H2>
              <Prose text={get(v, "exam_market_region")} />
            </Keep>
          ) : null}
          {get(v, "exam_market_local") ? (
            <Keep>
              <H2>6.4 Locality</H2>
              <Prose text={get(v, "exam_market_local")} />
            </Keep>
          ) : null}
        </>
      ) : (
        <Keep>
          <Prose text={get(v, "exam_market_commentary") || ""} />
          {!get(v, "exam_market_commentary") ? (
            <Para>
              Record national, state, regional and suburb conditions, supply and demand, and the
              price range of similar vacant lots. Use the four part-fields on the inspection form
              for the 6.1–6.4 structure used in the sample reports.
            </Para>
          ) : null}
        </Keep>
      )}
      </Lead>

      <Lead id="exam-7" title="7.0 Risk Assessment">
      <Keep>
      <Para>
        Each category has been considered against the criteria in the PropertyPRO Supporting
        Memorandum (API).
      </Para>
      </Keep>
      </Lead>
      <Keep>
      <H2>7.1 Property risk assessment</H2>
      <RiskRatingsPrintTable values={v} />
      </Keep>
      <div className="mt-4">
        <RiskAnalysisProse
          text={buildRiskAnalysis(v) || get(v, "exam_risk_commentary") || ""}
        />
      </div>

      <section id="sec-sales" className="report-section report-section-sales">
        <Lead id="exam-8" title="8.0 Valuation Approach">
        <Keep>
        {narrativePrints(m, "valuationApproach") && draft.narrative.valuationApproach?.trim() ? (
          <Prose text={draft.narrative.valuationApproach} />
        ) : narrativePrints(m, "valuationApproach") ? (
        <Para>
          The market value of the subject property has been determined using the Direct Comparison
          Approach. Recent sales of similar properties are analysed and adjusted for points of
          difference. For vacant residential land those factors typically include date of sale, land
          area and shape, topography and zoning, location and proximity to amenities, aspect and
          views, and surrounding development.
        </Para>
        ) : null}
        </Keep>
        </Lead>
        <Keep>
        <H2>8.1 Comparable sales evidence (sales schedule)</H2>
        {printedSales.length === 0 ? (
          <Para>No sales evidence has been recorded.</Para>
        ) : (
          <div className="space-y-6">
            {draft.reportMeta.salesMapUrl ? (
              <div className="sales-map">
                <p className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-wide">
                  Sales map
                </p>
                <img
                  src={draft.reportMeta.salesMapUrl}
                  alt="Comparable sales map"
                  className="mx-auto max-h-[28rem] w-auto max-w-full object-contain"
                  style={{ border: `1px solid ${RULE}` }}
                />
              </div>
            ) : null}
            {printSalesEvidenceEnabled(draft.reportMeta) ? (
            <SalesEvidenceSchedule
              sales={printedSales}
              headerStyle={{ background: TEAL, color: "#fff" }}
              cellBorderClassName="border"
              cellStyle={{ borderColor: RULE }}
            />
            ) : null}
            {printAdjustmentGridEnabled(draft.reportMeta) ? (
              <AdjustmentGridPrint
                sales={printedSales}
                values={v}
                meta={draft.reportMeta}
                subjectAddress={addressLine}
              />
            ) : null}
          </div>
        )}
        </Keep>
        {get(v, "exam_on_market") ? (
          <>
            <H2>8.2 On-the-market listings</H2>
            <Para>
              The following listings were considered. They are not settled sales and are not used as
              primary evidence.
            </Para>
            <Prose text={get(v, "exam_on_market")} />
          </>
        ) : null}
        {get(v, "exam_sales_analysis") ? (
          <>
            <H2>8.3 Analysis</H2>
            <Prose text={get(v, "exam_sales_analysis")} />
          </>
        ) : null}
        <H2>8.4 Valuation result</H2>
        <Para>
          Having regard to the sales evidence and market conditions at the date of valuation, the
          market value of the {valuedInterestPhrase(v)} in the subject property
          {addressLine ? `, ${addressLine},` : ""} as at {m.valueDate || "the date of valuation"} is:
        </Para>
        {m.valueAmount ? (
          <p className="py-3 text-left text-lg font-semibold">
            ${formatCurrencyDisplay(m.valueAmount)}
            {valueWords ? ` (${valueWords})` : ""}
          </p>
        ) : null}
      </section>

      {get(v, "exam_limitations") ? (
        <div className="mt-4">
          <H2>Disclaimer</H2>
          <Prose text={get(v, "exam_limitations")} />
        </div>
      ) : (
        <Para>
          This valuation has been prepared for the stated purpose and the instructing party only.
          It may not be used for any other purpose without written authorisation.
        </Para>
      )}
      {get(v, "exam_assumptions") ? (
        <div className="mt-4">
          <H2>Assumptions</H2>
          <Prose text={get(v, "exam_assumptions")} />
        </div>
      ) : null}

      <Lead id="exam-9" title="9.0 References">
      <Keep>
      <Prose text={get(v, "exam_references")} />
      {!get(v, "exam_references") ? (
        <Para>List sources used for the market commentary, planning searches and sales evidence.</Para>
      ) : null}
      </Keep>
      </Lead>

      <Lead id="exam-10" title="10.0 Annexures">
      <ol className="ml-5 list-decimal space-y-0.5 text-sm">
        {annexurePhotos.length > 0 ? <li>Subject photographs</li> : null}
        {printedSales.some((s) => s.photoUrl) ? <li>Comparable sale photographs</li> : null}
        {mapPhotos.length > 0 ? <li>Maps</li> : null}
        {cadastralPages.length > 0 ? <li>Cadastral plan</li> : null}
        {titlePages.length > 0 ? <li>Certificate of Title</li> : null}
        {surveyPages.length > 0 ? <li>Survey Plan</li> : null}
        {extraAnnexGroups.map((g) => (
          <li key={g.id}>{g.title}</li>
        ))}
      </ol>
      </Lead>

      {annexurePhotos.length > 0 ? (
        <section id="exam-annex-subject" className="report-annexure report-annexure-subject mt-12">
          <PhotoAnnexPages heading="Annexure — Subject photographs">
            {annexurePhotos.map((photo) => (
              <figure key={photo.id} className="report-photo-figure">
                <img
                  src={photo.url}
                  alt={photo.caption || "Photograph"}
                  className="aspect-4/3 w-full object-cover"
                  style={{ border: `1px solid ${RULE}` }}
                  loading="eager"
                  decoding="sync"
                />
                <figcaption className="mt-1.5 text-left text-sm">{photo.caption}</figcaption>
              </figure>
            ))}
          </PhotoAnnexPages>
        </section>
      ) : null}

      {printedSales.some((s) => s.photoUrl) ? (
        <section id="exam-annex-comps" className="report-annexure report-annexure-comps mt-12">
          <PhotoAnnexPages heading="Annexure — Comparable sale photographs">
            {printedSales.map((s, idx) =>
              s.photoUrl ? (
                <figure key={s.id} className="report-photo-figure">
                  <img
                    src={s.photoUrl}
                    alt={s.address || `Comparable ${idx + 1}`}
                    className="w-full object-contain"
                    style={{ border: `1px solid ${RULE}` }}
                    loading="eager"
                    decoding="sync"
                  />
                  <figcaption className="mt-1.5 text-left text-sm font-medium">
                    Comparable {idx + 1}
                    {s.address ? ` — ${s.address}` : ""}
                  </figcaption>
                </figure>
              ) : null,
            )}
          </PhotoAnnexPages>
        </section>
      ) : null}

      {mapPhotos.length > 0 ? (
        <section id="exam-annex-maps" className="report-annexure mt-12">
          <h2 className="text-left text-base font-semibold" style={{ color: TEAL }}>
            Annexure — Maps
          </h2>
          <div className="mt-6">
            {mapPhotos.map((photo) => (
              <div key={photo.id}>
                <figure className="report-map-figure">
                  <img src={photo.url} alt={photo.caption || "Map"} />
                  <figcaption className="mt-1.5 text-left text-sm">{photo.caption}</figcaption>
                </figure>
                {photo.slot === "map_aerial" ? (
                  <A4DocumentAnnex
                    id="exam-annex-cadastral"
                    heading="Cadastral plan"
                    pages={cadastralPages}
                  />
                ) : null}
              </div>
            ))}
            {!mapPhotos.some((p) => p.slot === "map_aerial") && cadastralPages.length > 0 ? (
              <A4DocumentAnnex
                id="exam-annex-cadastral"
                heading="Cadastral plan"
                pages={cadastralPages}
              />
            ) : null}
          </div>
        </section>
      ) : cadastralPages.length > 0 ? (
        <section id="exam-annex-maps" className="report-annexure mt-12">
          <A4DocumentAnnex
            id="exam-annex-cadastral"
            heading="Cadastral plan"
            pages={cadastralPages}
          />
        </section>
      ) : null}

      <A4DocumentAnnex
        id="exam-annex-title"
        heading="Annexure — Certificate of Title"
        pages={titlePages}
      />
      <A4DocumentAnnex
        id="exam-annex-survey"
        heading="Annexure — Survey Plan"
        pages={surveyPages}
      />
      {extraAnnexGroups.map((g) => (
        <A4DocumentAnnex
          key={g.id}
          id={`exam-annex-extra-${g.id}`}
          heading={`Annexure — ${g.title}`}
          pages={g.pages}
        />
      ))}
    </article>
  );
}

function ExamSignature({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;
  const sig =
    typeof v["sign_sig"] === "string" && v["sign_sig"].startsWith("data:image")
      ? v["sign_sig"]
      : "";
  const name = m.valuerName || get(v, "exam_student_name") || get(v, "insp_valuer");
  return (
    <div className="report-signature mt-4">
      {sig ? (
        <div className="report-sig-stage">
          <img src={sig} alt="Signature" className="report-sig-image" />
          <div className="report-sig-line" aria-hidden />
        </div>
      ) : (
        <div className="report-sig-stage report-sig-stage--empty">
          <div className="report-sig-line" aria-hidden />
        </div>
      )}
      <p className="report-sig-name font-semibold">{name}</p>
      <p className="text-sm">Student Valuer</p>
      {m.valueDate ? <p className="mt-1 text-sm">{m.valueDate}</p> : null}
    </div>
  );
}
