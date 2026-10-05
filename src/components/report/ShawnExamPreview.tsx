import { Children, isValidElement, useEffect, type ReactElement, type ReactNode } from "react";
import { australianiseSpelling } from "@/lib/report/australianEnglish";
import { formatNarrativeDate, formatNarrativeDateOr } from "@/lib/report/dates";
import { stripLeadingHeading } from "@/lib/report/printText";
import {
  buildClientInstructions,
  buildLegalAccess,
  buildPhysicalAccess,
  buildSiteIdentification,
} from "@/lib/report/narrative";
import {
  coverLotPlan,
  formatHbuVacant,
  formatPropertyType,
  formatSiteDimensions,
  formatUsableSiteAreaIfDifferent,
  get,
  joinValues,
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
  annexPageLabel,
  type ReportDraft,
} from "@/lib/report/types";
import { A4DocumentAnnex } from "@/components/report/A4DocumentAnnex";
import { AdjustmentGridPrint } from "@/components/report/AdjustmentGridPrint";
import { SalesEvidenceSchedule } from "@/components/report/SalesEvidenceSchedule";
import {
  printAdjustmentGridEnabled,
  printSalesEvidenceEnabled,
} from "@/lib/report/adjustmentGrid";
import {
  apaRetrieved,
  referencesForPrint,
  referenceStyleOf,
} from "@/lib/report/references";
import { purposeOfValuation } from "@/lib/report/reportTypes";
import { buildExecutiveSummaryLead } from "@/lib/report/narrative";
import { buildEncumbrancesSummary, titleCreatedDisplay, titleSearchNarrativeWithoutGridFacts, unregisteredDealingsDisplay } from "@/lib/report/titleAdvices";
import { planningSchemeInForce, zoningPurposeSentence } from "@/lib/report/parsePlanningExtract";
import { fillExamTocPages } from "@/lib/report/tocPages";
import { includedNumbers, majorTitle, subTitle } from "@/lib/report/sectionNumbers";
import { cleanSaleProse, formatCurrencyDisplay } from "@/lib/report/salesRelativity";
import { withoutSourceNotes } from "@/lib/report/sourceNotes";
import { riskCommentsForPrint } from "@/lib/report/propertyRiskRatings";
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

function proseParagraphs(text: string): string[] {
  return australianiseSpelling(text)
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function Para({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-left leading-relaxed">{children}</p>;
}

function Prose({ text }: { text: string }) {
  const blocks = proseParagraphs(text);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <p key={i} className="report-prose-para text-left leading-relaxed whitespace-pre-line">
          {block}
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
            <p key={i} className="report-prose-para text-left leading-relaxed">
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

function subsectionTitle(node: ReactNode): ReactNode {
  if (!isValidElement(node) || node.type !== H2) return null;
  return (node.props as { children?: ReactNode }).children ?? null;
}

function flattenNodes(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).filter((child) => child != null && child !== false);
}

function openWithFirstSubsection(node: ReactNode): {
  title: ReactNode;
  lead: ReactNode;
  tail: ReactNode;
} {
  const flat = flattenNodes(node);
  const target = flat.length === 1 ? flat[0] : flat;
  const inner = Array.isArray(target) ? target : flattenNodes(
    isValidElement(target) ? (target.props as { children?: ReactNode }).children : target,
  );
  const heading = inner.find((child) => subsectionTitle(child) != null);
  const rest = inner.filter((child) => child !== heading);
  const prose = rest.find(
    (child) => isValidElement(child) && child.type === Prose,
  ) as ReactElement<{ text?: string }> | undefined;
  if (!prose) {
    return { title: subsectionTitle(heading), lead: rest, tail: null };
  }
  const paras = proseParagraphs(prose.props.text || "");
  const other = rest.filter((child) => child !== prose);
  return {
    title: subsectionTitle(heading),
    lead: (
      <>
        {paras[0] ? (
          <p className="report-prose-para text-left leading-relaxed whitespace-pre-line">{paras[0]}</p>
        ) : null}
        {other}
      </>
    ),
    tail: paras.length > 1 ? <Prose text={paras.slice(1).join("\n\n")} /> : null,
  };
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
  const items = Children.toArray(children).filter((child) => child != null && child !== false);
  const [first, ...rest] = items;
  const opened = openWithFirstSubsection(first);
  return (
    <>
      <div className="report-section-open">
        <h2
          id={id}
          className="report-h2 report-heading-lead mt-8 border-b pb-1 text-[1.05rem] font-semibold"
          style={{ color: TEAL, borderColor: RULE }}
        >
          {title}
        </h2>
        {opened.title ? (
          <h3 className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
            {opened.title}
          </h3>
        ) : null}
        {opened.lead}
      </div>
      {opened.tail}
      {rest}
    </>
  );
}

function SectionOpen({
  id,
  title,
  sub,
  text,
}: {
  id?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  text?: string;
}) {
  const paras = proseParagraphs(text || "");
  return (
    <>
      <div className="report-section-open">
        <h2
          id={id}
          className="report-h2 report-heading-lead mt-8 border-b pb-1 text-[1.05rem] font-semibold"
          style={{ color: TEAL, borderColor: RULE }}
        >
          {title}
        </h2>
        {sub ? (
          <h3 className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
            {sub}
          </h3>
        ) : null}
        {paras[0] ? (
          <p className="report-prose-para text-left leading-relaxed whitespace-pre-line">{paras[0]}</p>
        ) : null}
      </div>
      {paras.length > 1 ? <Prose text={paras.slice(1).join("\n\n")} /> : null}
    </>
  );
}

function Keep({ children }: { children: React.ReactNode }) {
  const inner = flattenNodes(children);
  const heading = inner.find((child) => subsectionTitle(child) != null);
  const prose = inner.find(
    (child) => isValidElement(child) && child.type === Prose,
  ) as ReactElement<{ text?: string }> | undefined;
  if (!heading || !prose) return <div className="report-keep-block">{children}</div>;
  const paras = proseParagraphs(prose.props.text || "");
  const other = inner.filter((child) => child !== heading && child !== prose);
  return (
    <>
      <div className="report-keep-block">
        {heading}
        {paras[0] ? (
          <p className="report-prose-para text-left leading-relaxed whitespace-pre-line">{paras[0]}</p>
        ) : null}
        {other}
      </div>
      {paras.length > 1 ? <Prose text={paras.slice(1).join("\n\n")} /> : null}
    </>
  );
}

function TocRows({ entries }: { entries: { id: string; label: string }[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="exam-toc mt-3 list-none space-y-1 text-sm" style={{ color: TEAL }}>
      {entries.map((item) => (
        <li key={item.id} className="exam-toc-row">
          <a href={`#${item.id}`}>{item.label}</a>
          <span className="exam-toc-leader" aria-hidden />
          <a href={`#${item.id}`} className="exam-toc-page" data-toc-id={item.id}>
            <span className="toc-fallback" />
          </a>
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
  const titleAnnexLabel = titlePages.some((p) => /title search/i.test(p.caption || ""))
    ? "Current Title Search"
    : "Certificate of Title";
  const surveyPages = surveyPhotosOnReport(draft.photos);
  const cadastralPages = cadastralPhotosOnReport(draft.photos);
  const extraAnnexGroups = extraAnnexGroupsOnReport(draft.photos);
  const valueWords = m.valueAmount ? amountInWords(m.valueAmount) : "";
  const siteArea = joinValues(v, ["prop_sitearea", "prop_areaunit"], " ");
  const usableSiteArea = formatUsableSiteAreaIfDifferent(v);
  const servicesText = narrativePrints(m, "servicesAmenities")
    ? (draft.narrative.servicesAmenities || "")
        .replace(/^\s*\d+(?:\.\d+)*\s*services?\s*\/\s*amenities\s*/i, "")
        .trim()
    : "";
  const prints = (key: keyof typeof draft.narrative) => narrativePrints(m, key, v);
  const show11 = prints("instructions");
  const show21 = prints("sitePhysical");
  const show32 = prints("highestBestUse");
  const show40 = prints("envIntro");
  const show41 = prints("acidSulphate");
  const show42 = prints("floodAssessment");
  const show43 = prints("noiseNuisances");
  const show44 = prints("titleNotices") && Boolean(draft.narrative.titleNotices?.trim());
  const show51 = prints("location");
  const show52 = prints("neighbourhood");
  const show53 = prints("amenities") && Boolean(draft.narrative.amenities?.trim() || get(v, "exam_amenities"));
  const show54 = prints("popularDestinations") && Boolean(draft.narrative.popularDestinations?.trim() || get(v, "exam_destinations"));
  const show61 = prints("marketAustralia") && Boolean(draft.narrative.marketAustralia?.trim() || get(v, "exam_market_australia"));
  const show62 = prints("marketState") && Boolean(draft.narrative.marketState?.trim() || get(v, "exam_market_state"));
  const show63 = prints("marketRegion") && Boolean(draft.narrative.marketRegion?.trim() || get(v, "exam_market_region"));
  const show64 = prints("marketLocality") && Boolean(draft.narrative.marketLocality?.trim() || get(v, "exam_market_local"));
  const show82 = prints("salesComments");
  const show83 = prints("valueReconciliation");
  const show84 = Boolean(get(v, "exam_on_market"));
  const show85 = prints("salesAnalysis") && Boolean(draft.narrative.salesAnalysis?.trim() || get(v, "exam_sales_analysis"));
  const show9 = prints("references");
  const hasAnnexures = Boolean(
    annexurePhotos.length ||
      printedSales.some((s) => s.photoUrl) ||
      mapPhotos.length ||
      cadastralPages.length ||
      titlePages.length ||
      surveyPages.length ||
      extraAnnexGroups.length,
  );
  const show4 = show40 || show41 || show42 || show43 || show44;
  const show5 = show51 || show52 || show53 || show54;
  const show6 = show61 || show62 || show63 || show64 || Boolean(get(v, "exam_market_commentary"));
  const major = includedNumbers([true, true, true, show4, show5, show6, true, true, show9, hasAnnexures]);
  const n1 = includedNumbers([show11, true, true, true]);
  const n2 = includedNumbers([show21, true, true]);
  const n3 = includedNumbers([true, show32]);
  const n4 = includedNumbers([show41, show42, show43, show44]);
  const n5 = includedNumbers([show51, show52, show53, show54]);
  const n6 = includedNumbers([show61, show62, show63, show64]);
  const n8 = includedNumbers([true, show82, show83, show84, show85, true]);
  const t = (n: number, title: string) => majorTitle(n, title);
  const toc = [
    { id: "exam-summary", label: "Executive Summary" },
    { id: "exam-1", label: t(major[0], "Basis of Value") },
    { id: "exam-2", label: t(major[1], "Title and Property Details") },
    { id: "exam-3", label: t(major[2], "Planning Controls") },
    ...(show4 ? [{ id: "exam-4", label: t(major[3], "Environmental Issues") }] : []),
    ...(show5 ? [{ id: "exam-5", label: t(major[4], "Locality and Location") }] : []),
    ...(show6 ? [{ id: "exam-6", label: t(major[5], "Market Commentary") }] : []),
    { id: "exam-7", label: t(major[6], "Risk Assessment") },
    { id: "exam-8", label: t(major[7], "Valuation Approach") },
    ...(show82 ? [{ id: "exam-8-2", label: `${major[7]}.${n8[1]} Comments on comparable sales` }] : []),
    ...(show83 ? [{ id: "exam-8-3", label: `${major[7]}.${n8[2]} Final reconciliation of value` }] : []),
    ...(prints("disclaimer") ? [{ id: "exam-reliance", label: "Reliance and terms of use" }] : []),
    ...(show9 ? [{ id: "exam-9", label: t(major[8], "List of References") }] : []),
    ...(hasAnnexures ? [{ id: "exam-10", label: t(major[9], "Annexures") }] : []),
  ];

  const hasMarketParts = Boolean(
    draft.narrative.marketAustralia?.trim() ||
      draft.narrative.marketState?.trim() ||
      draft.narrative.marketRegion?.trim() ||
      draft.narrative.marketLocality?.trim() ||
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
        <div className="exam-wordmark">
          <img
            src={EXAM.logoSrc}
            alt={`${EXAM.firmName} ${EXAM.firmTrade}`}
            className="exam-wordmark-logo"
          />
        </div>
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

      <section className="report-toc">
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
            ? [{ id: "exam-annex-title", label: titleAnnexLabel }]
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
      </section>

      <div id="exam-summary" className="report-exam-summary-sheet report-keep-block">
      <H1>Executive Summary</H1>
      <Para>
        {draft.narrative.executiveSummary?.trim() || buildExecutiveSummaryLead(v)}
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
            label: "Brief description of the subject property",
            value: String(draft.narrative.brief ?? "").trim(),
          },
          { label: "Zoning", value: get(v, "prop_zoning") },
          { label: "Date of Inspection", value: formatNarrativeDate(m.inspectionDate) },
          { label: "Date of Valuation", value: formatNarrativeDate(m.valueDate) },
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
        <ExamSignature draft={draft} />
      </div>
      </div>

      <Lead id="exam-1" title={t(major[0], "Basis of Value")}>
      <Keep>
      {show11 ? <H2>{subTitle(major[0], n1[0], "Instructions")}</H2> : null}
      <Prose
        text={
          draft.narrative.instructions?.trim() ||
          buildClientInstructions(v)
        }
      />
      </Keep>
      </Lead>

      <Keep>
      <H2>{subTitle(major[0], n1[1], "Valuation Standards")}</H2>
      <Para>
        The methodological framework for this valuation is grounded in the standards established by
        the International Valuation Standards Council (IVSC), the Australian Property Institute (API),
        and the Royal Institution of Chartered Surveyors (RICS). The basis of valuation is Market
        Value, defined as follows:
      </Para>
      <p className="mt-2 italic">{IVSC_MARKET_VALUE}</p>
      </Keep>

      <Keep>
      <H2>{subTitle(major[0], n1[2], "Valuer’s Interest")}</H2>
      <Para>
        The valuer declares that there is no pecuniary, professional or other interest that would
        constitute a conflict of interest or otherwise compromise the ability to provide an
        independent and unbiased valuation. Directives for this assignment have been received from
        the instructing party.
      </Para>
      </Keep>

      <Keep>
      <H2>{subTitle(major[0], n1[3], "Date of Valuation / Liability")}</H2>
      <Para>
        The subject property was inspected on {formatNarrativeDateOr(m.inspectionDate, "the date recorded in this report")}.
        The valuation is effective as at {formatNarrativeDateOr(m.valueDate, "the date of valuation")} only. The concluded
        value reflects market conditions at that date and may be affected by subsequent events,
        including market fluctuations, interest-rate movements and changes in broader economic
        conditions.
      </Para>
      </Keep>

      <Lead id="exam-2" title={t(major[1], "Title and Property Details")}>
      <Keep>
      {show21 ? (
      <>
      <H2>{subTitle(major[1], n2[0], "Property Description")}</H2>
      <Prose
        text={String(draft.narrative.sitePhysical ?? "").trim()}
      />
      {!String(draft.narrative.sitePhysical ?? "").trim() ? (
        <Para>
          {siteArea ? `The subject allotment has an area of ${siteArea}. ` : ""}
          {usableSiteArea
            ? `Estimated usable site area is ${usableSiteArea}. `
            : ""}
          {get(v, "prop_shape") ? `Allotment shape is recorded as ${get(v, "prop_shape")}. ` : ""}
          {get(v, "prop_lot_position") ? `Lot position is ${get(v, "prop_lot_position")}.` : ""}
        </Para>
      ) : null}
      </>
      ) : null}
      </Keep>
      </Lead>

      <Keep>
      <H2>{subTitle(major[1], n2[1], "Title Particulars")}</H2>
      <StripeTable
        rows={[
          { label: "Street address", value: addressLine },
          { label: "Real property description", value: lotPlan },
          { label: "Title reference", value: get(v, "prop_title") },
          { label: "Date title created", value: titleCreatedDisplay(v) },
          { label: "Local government", value: get(v, "prop_lga") },
          { label: "Registered owner", value: get(v, "prop_owner") },
          { label: "Nature of interest", value: get(v, "prop_rights") },
          {
            label: "How the site was identified",
            value:
              draft.narrative.siteIdentification?.trim() ||
              buildSiteIdentification(v),
          },
          {
            label: "Date of title search",
            value: get(v, "exam_title_search_date") || get(v, "prop_title_search_date"),
          },
          { label: "Unregistered dealings", value: unregisteredDealingsDisplay(v) },
          {
            label: "Legal access",
            value: narrativePrints(m, "legalAccess")
              ? draft.narrative.legalAccess?.trim() || buildLegalAccess(v)
              : "",
          },
        ]}
      />
      <Para>Title particulars are taken from the current title search annexed to this report.</Para>
      </Keep>
      {narrativePrints(m, "titleSearchNarrative") &&
      titleSearchNarrativeWithoutGridFacts(draft.narrative.titleSearchNarrative ?? "").trim() ? (
        <Prose text={titleSearchNarrativeWithoutGridFacts(draft.narrative.titleSearchNarrative ?? "")} />
      ) : null}

      <Keep>
      <H2>{subTitle(major[1], n2[2], "Particulars of Land")}</H2>
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
          {
            label: "Physical ingress / egress",
            value: narrativePrints(m, "physicalAccess", v)
              ? draft.narrative.physicalAccess?.trim() || buildPhysicalAccess(v)
              : "",
          },
          { label: "Utilities", value: servicesText },
          {
            label: "Easements, encumbrances and restrictions",
            value: australianiseSpelling(
              (narrativePrints(m, "encumbrancesSummary")
                ? draft.narrative.encumbrancesSummary?.trim()
                : "") || buildEncumbrancesSummary(v),
            ),
          },
        ]}
      />
      </Keep>

      <Lead id="exam-3" title={t(major[2], "Planning Controls")}>
      <Keep>
      <H2>{subTitle(major[2], n3[0], "Planning Scheme and Zoning")}</H2>
      <StripeTable
        rows={[
          {
            label: "Planning scheme",
            value: planningSchemeInForce(v, m.valueDate),
          },
          { label: "Zoning", value: get(v, "prop_zoning") },
          { label: "Zoning purpose / description", value: draft.narrative.zoningPurpose?.trim() || zoningPurposeSentence(get(v, "prop_zoning_desc")) },
          { label: "Zoning compliance", value: get(v, "prop_zoning_comp") },
        ]}
      />
      <Para>
        The planning scheme cited above is the scheme in force at the date of valuation.
      </Para>
      </Keep>
      </Lead>
      {show32 ? (
      <div className="report-keep-block">
        <H2>{subTitle(major[2], n3[1], "Highest and Best Use")}</H2>
        {draft.narrative.highestBestUse?.trim() ? (
          <Prose text={draft.narrative.highestBestUse} />
        ) : (
          <Para>{formatHbuVacant(v) || "Record the highest and best use of the subject property."}</Para>
        )}
      </div>
      ) : null}

      {show4 ? <Lead id="exam-4" title={t(major[3], "Environmental Issues")}>
      <Keep>
      {show40 ? <Prose
        text={
          draft.narrative.envIntro?.trim() ||
          "No separate contaminated-land search is assumed beyond the inspection record and any planning overlays noted. The valuation assumes there are no environmental issues other than those set out below."
        }
      /> : null}
      </Keep>
      </Lead> : null}
      {show41 ? <Keep>
      <H2>{subTitle(major[3], n4[0], "Acid sulphate soils")}</H2>
      <Prose text={draft.narrative.acidSulphate?.trim() || ""} />
      {!draft.narrative.acidSulphate?.trim() ? (
        <Para>No acid sulphate soils overlay is recorded against the subject.</Para>
      ) : null}
      </Keep> : null}
      {show42 ? <Keep>
      <H2>{subTitle(major[3], n4[1], "Flood assessment")}</H2>
      <Para>
        {/^no\.?\s/i.test(draft.narrative.floodAssessment || "")
          ? `No flood affectation is recorded for the subject on the flood layer checked (${draft.narrative.floodAssessment?.replace(/^no\.?\s*/i, "").replace(/\.$/, "") || "the planning flood layer"}).`
          : draft.narrative.floodAssessment?.trim() ||
            "No flood notation is recorded on the inspection."}
      </Para>
      </Keep> : null}
      {show43 ? <Keep>
      <H2>{subTitle(major[3], n4[2], "Noise and other nuisances")}</H2>
      <Para>
        {draft.narrative.noiseNuisances?.trim() ||
          "No formal acoustic report has been obtained. Comment is limited to features recorded on the inspection."}
      </Para>
      </Keep> : null}
      {show44 ? <Keep>
      <H2>{subTitle(major[3], n4[3], "Title notices")}</H2>
      <Prose text={draft.narrative.titleNotices} />
      </Keep> : null}

      {show5 ? <Lead id="exam-5" title={t(major[4], "Locality and Location")}>
      <Keep>
      {show51 ? <H2>{subTitle(major[4], n5[0], "Location")}</H2> : null}
      {narrativePrints(m, "location") ? (
        <>
      <Prose text={stripLeadingHeading(draft.narrative.location?.trim() || "", "Location")} />
      {!draft.narrative.location?.trim() && addressLine ? (
        <Para>The property is located at {addressLine}.</Para>
      ) : null}
        </>
      ) : null}
      </Keep>
      </Lead> : null}
      {show52 ? <Keep>
      <H2>{subTitle(major[4], n5[1], "Locality")}</H2>
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
      </Keep> : null}
      {show53 ? (
        <Keep>
          {show53 ? <H2>{subTitle(major[4], n5[2], "Amenities")}</H2> : null}
          <Prose text={draft.narrative.amenities?.trim() || get(v, "exam_amenities")} />
        </Keep>
      ) : null}
      {show54 ? (
        <Keep>
          {show54 ? <H2>{subTitle(major[4], n5[3], "Popular destinations")}</H2> : null}
          <Prose
            text={
              draft.narrative.popularDestinations?.trim() || get(v, "exam_destinations")
            }
          />
        </Keep>
      ) : null}

      {show6 && hasMarketParts ? (
        <SectionOpen
          id="exam-6"
          title={t(major[5], "Market Commentary")}
          sub={show61 ? subTitle(major[5], n6[0], "Australia") : undefined}
          text={
            show61
              ? withoutSourceNotes(
                  draft.narrative.marketAustralia?.trim() || get(v, "exam_market_australia"),
                  printedSales,
                )
              : ""
          }
        />
      ) : null}
      {show6 && show62 ? (
        <Keep>
          <H2>{subTitle(major[5], n6[1], "State")}</H2>
          <Prose text={withoutSourceNotes(draft.narrative.marketState?.trim() || get(v, "exam_market_state"), printedSales)} />
        </Keep>
      ) : null}
      {show6 && show63 ? (
        <Keep>
          <H2>{subTitle(major[5], n6[2], "Region")}</H2>
          <Prose text={withoutSourceNotes(draft.narrative.marketRegion?.trim() || get(v, "exam_market_region"), printedSales)} />
        </Keep>
      ) : null}
      {show6 && show64 ? (
        <Keep>
          <H2>{subTitle(major[5], n6[3], "Locality")}</H2>
          <Prose text={withoutSourceNotes(draft.narrative.marketLocality?.trim() || get(v, "exam_market_local"), printedSales)} />
        </Keep>
      ) : null}
      {show6 && !hasMarketParts ? (
        <SectionOpen
          id="exam-6"
          title={t(major[5], "Market Commentary")}
          text={get(v, "exam_market_commentary")}
        />
      ) : null}
      <Lead id="exam-7" title={t(major[6], "Risk Assessment")}>
      <div>
      <H2>{subTitle(major[6], 1, "Property risk assessment")}</H2>
      <Para>
        Each category has been considered against the criteria in the PropertyPRO Supporting
        Memorandum (API).
      </Para>
      <RiskRatingsPrintTable values={v} />
      </div>
      </Lead>
      <div className="mt-4">
        <RiskAnalysisProse
          text={
            [
              riskCommentsForPrint(
                v,
                draft.narrative.riskAnalysis,
                draft.reportMeta.manualNarrative?.riskAnalysis === true,
              ) || get(v, "exam_risk_commentary"),
              /overlay/i.test(String(v["prop_adverse_site"] ?? ""))
                ? "A mortgagee should require the overlay to be confirmed against the planning scheme before relying on the security, and should treat any land excluded by the overlay as not fully available."
                : "",
            ]
              .filter(Boolean)
              .join("\n\n")
          }
        />
      </div>

      <section id="sec-sales" className="report-section report-section-sales">
        <Lead id="exam-8" title={t(major[7], "Valuation Approach")}>
        <Keep>
        {narrativePrints(m, "valuationApproach") && draft.narrative.valuationApproach?.trim() ? (
          <Prose
            text={`${draft.narrative.valuationApproach.trim()}\n\nThe opinion is as at ${formatNarrativeDateOr(m.valueDate, "the date of valuation")} and is not to be read after the reliance period without a review.`}
          />
        ) : narrativePrints(m, "valuationApproach") ? (
        <Para>
          The market value of the subject property has been determined using the Direct Comparison
          Approach. Recent sales of similar properties are analysed and adjusted for points of
          difference. For vacant residential land those factors typically include date of sale, land
          area and shape, topography and zoning, location and proximity to amenities, aspect and
          views, and surrounding development. The opinion is as at{" "}
          {formatNarrativeDateOr(m.valueDate, "the date of valuation")} and is not to be read after
          the reliance period without a review.
        </Para>
        ) : null}
        </Keep>
        </Lead>
        <Keep>
        <H2>{subTitle(major[7], n8[0], "Comparable sales evidence (sales schedule)")}</H2>
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
              omitSourceNotes
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
        {narrativePrints(m, "salesComments") ? (
          <Keep>
            <h3 id="exam-8-2" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              {`${major[7]}.${n8[1]} Comments on comparable sales`}
            </h3>
            <Prose text={withoutSourceNotes(draft.narrative.salesComments || "", printedSales)} />
          </Keep>
        ) : null}
        {narrativePrints(m, "valueReconciliation") ? (
          <Keep>
            <h3 id="exam-8-3" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              {`${major[7]}.${n8[2]} Final reconciliation of value`}
            </h3>
            <Prose text={withoutSourceNotes(draft.narrative.valueReconciliation?.trim() || "", printedSales)} />
          </Keep>
        ) : null}
        {get(v, "exam_on_market") ? (
          <>
            {show84 ? <H2>{subTitle(major[7], n8[3], "On-the-market listings")}</H2> : null}
            <Para>
              The following listings were considered. They are not settled sales and are not used as
              primary evidence.
            </Para>
            <Prose text={get(v, "exam_on_market")} />
          </>
        ) : null}
        {draft.narrative.salesAnalysis?.trim() || get(v, "exam_sales_analysis") ? (
          <>
            {show85 ? <H2>{subTitle(major[7], n8[4], "Analysis")}</H2> : null}
            <Prose
              text={withoutSourceNotes(
                (draft.narrative.salesAnalysis?.trim() || get(v, "exam_sales_analysis")).replace(
                  /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g,
                  (_m, d, mo, y) => formatNarrativeDateOr(`${d}/${mo}/${y}`, `${d}/${mo}/${y}`),
                ),
                printedSales,
              )}
            />
          </>
        ) : null}
        <div className="report-result-sign">
        <H2>{subTitle(major[7], n8[5], "Valuation result")}</H2>
        <Para>
          Having regard to the sales evidence and market conditions at the date of valuation, it is
          my opinion that the market value of the unencumbered fee simple interest in the subject
          property located at {addressLine || "[property address]"} as at{" "}
          {formatNarrativeDateOr(m.valueDate, "[date of valuation]")} is
          {m.valueAmount
            ? ` $${formatCurrencyDisplay(m.valueAmount)}${valueWords ? ` (${valueWords})` : ""}.`
            : " [value in numbers and words]."}
        </Para>
        <div className="mt-4">
          <ExamSignature draft={draft} />
        </div>
        </div>
      </section>

      {prints("disclaimer") ? (
        <SectionOpen
          id="exam-reliance"
          title="Reliance and terms of use"
          text={
            draft.narrative.disclaimer?.trim() ||
            get(v, "exam_limitations") ||
            "This report was prepared for the instructing party for the stated purpose only. No other party may rely on it without written authorisation. It should not be relied upon more than 30 days after the date of valuation."
          }
        />
      ) : null}
      {draft.narrative.assumptions?.trim() || get(v, "exam_assumptions") ? (
        <div className="mt-4">
          <H2>Assumptions</H2>
          <Prose
            text={draft.narrative.assumptions?.trim() || get(v, "exam_assumptions")}
          />
        </div>
      ) : null}

      <section className="report-section report-section-references">
      {show9 ? <Lead id="exam-9" title={t(major[8], "References")}>
      <Keep>
      {narrativePrints(m, "references") ? (
        referencesForPrint(
          m,
          draft.narrative.references,
          v,
          [
            draft.narrative.marketAustralia,
            draft.narrative.marketState,
            draft.narrative.marketRegion,
            draft.narrative.marketLocality,
            draft.narrative.salesComments,
            "The methodological framework cites the International Valuation Standards Council.",
            "Section 6 names the Australian Bureau of Statistics.",
          ].join("\n"),
        ).length ? (
          <div className="report-reference-list">
            {referencesForPrint(
              m,
              draft.narrative.references,
              v,
              [
                draft.narrative.marketAustralia,
                draft.narrative.marketState,
                draft.narrative.marketRegion,
                draft.narrative.marketLocality,
            draft.narrative.salesComments,
            "The methodological framework cites the International Valuation Standards Council.",
            "Section 6 names the Australian Bureau of Statistics.",
              ].join("\n"),
            ).map((ref, i) => {
              const style = "harvard";
              const titled = ref.title && ref.title.toLowerCase() !== ref.author.toLowerCase();
              const site = ref.site && ref.site.toLowerCase() !== ref.author.toLowerCase();
              return (
                <p key={`ref-${ref.url || ref.author}-${i}`}>
                  {style === "apa" ? (
                    <>
                      {ref.author}. ({ref.year}).{" "}
                      {titled ? <><em>{ref.title}</em>. </> : null}
                      {site ? <>{ref.site}. </> : null}
                      {ref.url ? <>{ref.year === "n.d." ? `Retrieved ${apaRetrieved()}, from ` : ""}{ref.url}</> : null}
                    </>
                  ) : (
                    <>
                      {ref.author} ({ref.year}) <em>{ref.title}</em>, {ref.site || ref.author}, viewed {ref.accessed}.
                    </>
                  )}
                </p>
              );
            })}
          </div>
        ) : get(v, "exam_references") ? (
          <Prose text={get(v, "exam_references")} />
        ) : null
      ) : null}
      {narrativePrints(m, "references") &&
      !referencesForPrint(
        m,
        draft.narrative.references,
        v,
        [
          draft.narrative.marketAustralia,
          draft.narrative.marketState,
          draft.narrative.marketRegion,
          draft.narrative.marketLocality,
        ].join("\n"),
      ).length &&
      !get(v, "exam_references") ? (
        <Para>List sources used for the market commentary, planning searches and sales evidence.</Para>
      ) : null}
      </Keep>
      </Lead> : null}
      </section>

      {hasAnnexures ? <Lead id="exam-10" title={t(major[9], "Annexures")}>
      <ol className="ml-5 list-decimal space-y-0.5 text-sm">
        {annexurePhotos.length > 0 ? <li>Subject photographs</li> : null}
        {printedSales.some((s) => s.photoUrl) ? <li>Comparable sale photographs</li> : null}
        {mapPhotos.length > 0 ? <li>Maps</li> : null}
        {cadastralPages.length > 0 ? <li>Cadastral plan</li> : null}
        {titlePages.length > 0 ? <li>{titleAnnexLabel}</li> : null}
        {surveyPages.length > 0 ? <li>Survey Plan</li> : null}
        {extraAnnexGroups.map((g) => (
          <li key={g.id}>{g.title}</li>
        ))}
      </ol>
      </Lead> : null}

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
        heading={`Annexure — ${titleAnnexLabel}`}
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
          heading={g.title}
          pages={g.pages}
          pageHeading={(_page, index) => annexPageLabel(g.title, index)}
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
      {m.valueDate ? (
        <p className="mt-1 text-sm">{formatNarrativeDate(m.valueDate)}</p>
      ) : null}
    </div>
  );
}
