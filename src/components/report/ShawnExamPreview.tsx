import { Children, isValidElement, useEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
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
import { ComparableSheet } from "@/components/report/ComparableSheet";
import { effectiveLandSheet, effectiveLeaseSheet, effectiveSaleSheet } from "@/components/report/comparableSheetHelpers";
import { surveyPlanAnnexureLabel } from "@/lib/report/annexures";
import { narrativePrints, type NbhdClaim } from "@/lib/narrative/neighbourhoodAssist";
import {
  MAP_SLOTS,
  PHOTO_SLOTS,
  photoSlotsForJob,
  cadastralPhotosOnReport,
  clientAnnexGroupsOnReport,
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
  type ReportPhoto,
  type ReportMeta,
  type InspectionValues,
} from "@/lib/report/types";
import { A4DocumentAnnex } from "@/components/report/A4DocumentAnnex";
import { isVacantLand, isCommercialType, isIndustrialType } from "@/lib/inspection/visibility";
import { hasWorkingFile, WorkingNotesAnnex } from "@/components/report/WorkingNotesAnnex";
import { AdjustmentGridPrint } from "@/components/report/AdjustmentGridPrint";
import { CommercialEvidenceSchedule } from "@/components/report/CommercialEvidenceSchedule";
import { costBoilerplate, finalBoilerplate, incomeBoilerplate, marketApproachCalc, marketCalculationSentence } from "@/lib/report/commercialCalculations";
import { LandEvidenceSchedule } from "@/components/report/LandEvidenceSchedule";
import { SalesEvidenceSchedule } from "@/components/report/SalesEvidenceSchedule";
import {
  printAdjustmentGridEnabled,
  printSalesEvidenceEnabled,
} from "@/lib/report/adjustmentGrid";
import {
  apaRetrieved,
  citeAcceptedNotes,
  citeLocalitySources,
  insertHarvardCitations,
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





function stripValuationDateCommentary(text: string): string {
  return text
    .split(/\n+/)
    .filter((para) => !/opinion of market value is current as at the date of valuation/i.test(para))
    .filter((para) => !/the opinion is as at\b/i.test(para))
    .join("\n\n")
    .trim();
}



function capNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function parseAuDate(raw: string | undefined): number {
  if (!raw) return NaN;
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    return new Date(year, month, day).getTime();
  }
  return Date.parse(s);
}
function capMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n)).toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
  return n < 0 ? `(${abs})` : abs;
}
function capPrintRows(meta: ReportMeta, values: InspectionValues): { label: string; value: string; strong?: boolean }[] {
  const area = capNum(meta.ciAreaOverride) ?? capNum(String(values["comm_nla"] ?? "")) ?? capNum(String(values["comm_gba"] ?? ""));
  const rate = capNum(meta.ciAdoptedRentPerM2) ?? capNum(meta.ciMarketRent);
  const basis = meta.ciRentBasis === "gross" ? "gross" : "net";
  const outgoingsRate = capNum(meta.ciRecoverableOutgoings);
  const vacancyPct = capNum(meta.ciVacancyAllowance);
  const capRate = capNum(meta.ciCapRate);
  const starting = capNum(meta.ciStartingRent);
  const increasePct = capNum(meta.ciIncreasePct);
  const increaseDollar = capNum(meta.ciIncreaseDollar);
  const increaseType = meta.ciIncreaseType ?? "none";
  const startDate = meta.ciLeaseStartDate;
  const endDate = meta.ciLeaseEndDate;
  const valDate = String(values["insp_date"] ?? "");
  const startMs = parseAuDate(startDate);
  const asAtMs = Number.isFinite(parseAuDate(valDate)) ? parseAuDate(valDate) : (meta.valueDate ? parseAuDate(meta.valueDate) : Date.now());
  const yearsElapsed = Number.isFinite(startMs) ? Math.max(0, (asAtMs - startMs) / (365.25 * 86400000)) : 0;
  const anniversaries = Math.floor(yearsElapsed);
  let calculated = starting;
  if (calculated != null && anniversaries > 0) {
    for (let y = 1; y <= anniversaries; y++) {
      if ((increaseType === "fixed-pct" || increaseType === "cpi") && increasePct != null) calculated *= 1 + increasePct / 100;
      else if (increaseType === "fixed-dollar" && increaseDollar != null) calculated += increaseDollar;
    }
  }
  const passing = capNum(meta.ciPassingRentOverride) ?? calculated ?? capNum(String(values["comm_passing_rent"] ?? ""));
  const outgoings = outgoingsRate != null && area != null ? outgoingsRate * area : 0;
  const rateTimesArea = rate != null && area != null ? rate * area : null;
  const gross = rateTimesArea != null ? (basis === "gross" ? rateTimesArea : rateTimesArea + outgoings) : passing;
  const net = rateTimesArea != null ? (basis === "net" ? rateTimesArea : Math.max(0, rateTimesArea - outgoings)) : gross != null ? gross - outgoings : null;
  const vacancy = gross != null && vacancyPct != null ? gross * (vacancyPct / 100) : null;
  const adjusted = net != null && vacancy != null ? net - vacancy : net;
  const capitalised = adjusted != null && capRate != null && capRate > 0 ? adjusted / (capRate / 100) : null;
  const endMs = parseAuDate(endDate);
  const remaining = Number.isFinite(endMs) && Number.isFinite(asAtMs) ? Math.max(0, (endMs - asAtMs) / (365.25 * 86400000)) : capNum(meta.ciRemainingYears);
  const annualDiff = net != null && passing != null ? net - passing : null;
  const discount = capRate;
  let rentPv: number | null = null;
  if (annualDiff != null && remaining != null && remaining > 0 && discount != null && discount > 0) {
    const r = discount / 100;
    const n = Math.ceil(remaining);
    rentPv = annualDiff * (1 - Math.pow(1 + r, -n)) / r;
  }
  const afterAdjustment = capitalised != null ? capitalised + (rentPv != null ? -rentPv : 0) : null;
  const roundTo = capNum(meta.ciAdoptRoundTo);
  const rounded = afterAdjustment != null && roundTo != null && roundTo > 0 ? Math.round(afterAdjustment / roundTo) * roundTo : afterAdjustment != null ? Math.round(afterAdjustment / 1000) * 1000 : null;
  const adopted = capNum(meta.ciAdoptedValueOverride) ?? rounded;
  const rows: { label: string; value: string; strong?: boolean }[] = [];

  if (startDate || endDate || starting != null) {
    rows.push({ label: "Existing lease", value: "", strong: true });
    if (startDate) rows.push({ label: "Lease start", value: startDate });
    if (endDate) rows.push({ label: "Lease end", value: endDate });
    if (starting != null) rows.push({ label: "Starting rent", value: capMoney(starting) });
    if (increaseType !== "none") {
      const how = increaseType === "fixed-pct" ? `${increasePct ?? "—"}% per year` : increaseType === "fixed-dollar" ? `${capMoney(increaseDollar)} per year` : increaseType;
      rows.push({ label: "Contractual increases", value: how });
    }
    if (anniversaries > 0 && starting != null) rows.push({ label: `Increases elapsed to valuation date`, value: `${anniversaries} anniversary increase${anniversaries === 1 ? "" : "s"}` });
    if (calculated != null && starting != null && calculated !== starting) rows.push({ label: "Current rent calculated from starting rent and increases", value: capMoney(calculated) });
    if (passing != null) rows.push({ label: "Current / passing rent", value: capMoney(passing), strong: true });
    if (remaining != null) rows.push({ label: "Remaining term", value: `${remaining.toFixed(2)} years` });
  }

  if (rate != null && area != null) rows.push({ label: `Market rent (${capMoney(rate)}/m² × ${area.toLocaleString("en-AU")} m², ${basis})`, value: capMoney(rateTimesArea) });
  if (gross != null) rows.push({ label: basis === "net" ? "Nett annual income" : "Gross annual income", value: capMoney(gross) });
  if (outgoings) rows.push({ label: "Less outgoings", value: capMoney(outgoings) });
  if (net != null) rows.push({ label: "Net annual market rent", value: capMoney(net), strong: true });
  if (vacancy != null) rows.push({ label: `Less vacancy allowance (${vacancyPct}%)`, value: capMoney(vacancy) });
  if (adjusted != null) rows.push({ label: "Adjusted net income", value: capMoney(adjusted), strong: true });
  if (capitalised != null) rows.push({ label: `Capitalised at ${capRate}%`, value: capMoney(capitalised), strong: true });

  if (annualDiff != null) {
    const kind = annualDiff > 0 ? "below market — discount" : annualDiff < 0 ? "above market — premium" : "at market";
    rows.push({ label: `Annual rent difference (market net − passing) — ${kind}`, value: capMoney(annualDiff) });
    if (rentPv != null && remaining != null && discount != null) {
      rows.push({ label: `Present value of rent difference over ${remaining.toFixed(2)} years at ${discount}%`, value: capMoney(rentPv) });
      rows.push({ label: "Adjustment to value for above/below market lease", value: capMoney(-rentPv), strong: true });
    }
  }

  const monthsLoss = capNum(meta.ciLettingUpMonths);
  const monthsIncentive = capNum(meta.ciIncentiveMonths);
  const commissionPct = capNum(meta.ciAgentCommissionPct);
  if (gross != null && monthsLoss != null) rows.push({ label: `Less letting-up — rent loss (${monthsLoss} months)`, value: capMoney((gross / 12) * monthsLoss) });
  if (net != null && monthsIncentive != null) rows.push({ label: `Less letting-up — incentives (${monthsIncentive} months)`, value: capMoney((net / 12) * monthsIncentive) });
  if (net != null && commissionPct != null) rows.push({ label: `Less letting-up — commission (${commissionPct}%)`, value: capMoney(net * (commissionPct / 100)) });
  const capex = capNum(meta.ciCapex);
  if (capex != null) rows.push({ label: "Less capex", value: capMoney(-Math.abs(capex)) });
  if (afterAdjustment != null) rows.push({ label: "Value after rent adjustment", value: capMoney(afterAdjustment) });
  if (adopted != null) rows.push({ label: "Adopt for practical purposes (rounded)", value: capMoney(adopted), strong: true });
  return rows;
}

function costLineNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Depreciated line value — same rule as the working cost table. */
function costLineNew(line: { area?: string; rate?: string; nominal?: string }): number | null {
  const nominal = costLineNum(line.nominal);
  if (nominal != null) return nominal;
  const area = costLineNum(line.area);
  const rate = costLineNum(line.rate);
  if (area == null || rate == null) return null;
  return area * rate;
}

function costLineDepreciation(line: { area?: string; rate?: string; depreciation?: string; nominal?: string }): number | null {
  const gross = costLineNew(line);
  const dep = costLineNum(line.depreciation);
  if (gross == null || dep == null) return null;
  return gross * (dep / 100);
}

function costLineValue(line: { area?: string; rate?: string; depreciation?: string; nominal?: string }): number | null {
  const gross = costLineNew(line);
  if (gross == null) return null;
  const dep = costLineDepreciation(line);
  return dep != null ? gross - dep : gross;
}

function costLineEntered(line: { area?: string; rate?: string; nominal?: string }): boolean {
  return Boolean(String(line.area ?? "").trim() || String(line.rate ?? "").trim() || String(line.nominal ?? "").trim());
}

function formatCostMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

const TEAL = EXAM.navy;
const STRIPE = EXAM.stripe;
const RULE = EXAM.rule;

const IVSC_MARKET_VALUE =
  "Market Value is the estimated amount for which an asset or liability should exchange on the date of valuation between a willing buyer and a willing seller in an arm’s-length transaction after proper marketing where the parties had each acted knowledgeably, prudently and without compulsion (International Valuation Standards Council 2025).";

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

function renderWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (m) {
      return (
        <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
          {m[1]}
        </a>
      );
    }
    return part;
  });
}

function Prose({ text }: { text: string }) {
  const blocks = proseParagraphs(insertHarvardCitations(text));
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <p key={i} className="report-prose-para text-left leading-relaxed whitespace-pre-line">
          {renderWithLinks(block)}
        </p>
      ))}
    </>
  );
}

function RiskAnalysisProse({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      {australianiseSpelling(insertHarvardCitations(text))
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

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
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
  const paras = proseParagraphs(insertHarvardCitations(prose.props.text || ""));
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
  const paras = proseParagraphs(insertHarvardCitations(text || ""));
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
  const paras = proseParagraphs(insertHarvardCitations(prose.props.text || ""));
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


function SafePhotoFigure({
  src,
  alt,
  caption,
  figureClassName,
  imgClassName,
  imgStyle,
  captionClassName,
  eager,
}: {
  src: string;
  alt: string;
  caption?: string;
  figureClassName?: string;
  imgClassName: string;
  imgStyle?: CSSProperties;
  captionClassName: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed || !src.trim()) return null;
  return (
    <figure className={figureClassName}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        style={imgStyle}
        loading={eager ? "eager" : undefined}
        decoding={eager ? "sync" : undefined}
        onError={() => setFailed(true)}
      />
      {caption ? <figcaption className={captionClassName}>{caption}</figcaption> : null}
    </figure>
  );
}

export function ShawnExamPreview({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;
  const citeStyle = referenceStyleOf(m);
  const includeCitations = m.includeInTextCitations !== false;
  const cite = (text: string, claims: NbhdClaim[] | undefined, label: string) =>
    includeCitations ? citeAcceptedNotes(text, claims, v, label, citeStyle) : text;
  const citeLoc = (text: string) => (includeCitations ? citeLocalitySources(text, m, v, citeStyle) : text);
  const printedSales = salesOnReport(draft.sales);
  const sheetPools = {
    sales: draft.sales,
    leases: m.ciLeaseComps,
    landSales: m.ciLandSales,
  };
  const addressLine = [
    get(v, "prop_address"),
    [get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const lotPlan = get(v, "prop_lotplan") || get(v, "prop_legal");
  const overlayLabels: Record<string, string> = {
    overlay_bushfire: "Bushfire hazard",
    overlay_landslide: "Landslide",
    overlay_wetland: "Wetland / waterway",
    overlay_character: "Neighbourhood character / local plan",
    overlay_airport: "Airport / OLS",
    overlay_coastal: "Coastal",
    overlay_koala: "Koala habitat",
    overlay_infrastructure: "Infrastructure",
    overlay_acid_sulfate: "Acid sulfate soils",
  };
  const selectedOverlays = Object.entries(overlayLabels)
    .filter(([id]) => {
      const raw = v["plan_overlay"];
      if (Array.isArray(raw)) return raw.includes(id);
      if (raw && typeof raw === "object") return Boolean((raw as Record<string, unknown>)[id]);
      return false;
    })
    .map(([, label]) => label);
  const otherSelected = (() => {
    const raw = v["plan_overlay"];
    if (Array.isArray(raw)) return raw.includes("overlay_other");
    if (raw && typeof raw === "object") return Boolean((raw as Record<string, unknown>)["overlay_other"]);
    return false;
  })();
  if (otherSelected) {
    const notes = get(v, "plan_overlay_notes");
    const named = notes
      .split(/[;\n]+/)
      .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter((s) => s.length > 1);
    for (const name of named) {
      if (!selectedOverlays.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
        selectedOverlays.push(name);
      }
    }
  }
  const zoningMap = draft.photos.find((p) => p.slot === "map_zoning" && photoIsOnReport(p));
  const frontPhoto = draft.photos.find((p) => p.slot === "front" && photoIsOnReport(p));
  const fixedSlots = photoSlotsForJob(isVacantLand(v));
  const extraSubject = draft.photos.filter((p) => !p.slot && p.kind !== "map" && p.kind !== "title" && p.kind !== "survey" && p.kind !== "cadastral" && p.kind !== "annex" && photoIsOnReport(p));
  const subjectInlinePhotos: ReportPhoto[] = [];
  for (const slot of fixedSlots) {
    const fixed = draft.photos.find((p) => p.slot === slot.slot && photoIsOnReport(p));
    if (fixed) subjectInlinePhotos.push(fixed);
    subjectInlinePhotos.push(...extraSubject.filter((p) => p.insertAfter === slot.slot));
  }
  subjectInlinePhotos.push(...extraSubject.filter((p) => !p.insertAfter));
  const student = get(v, "exam_student_name") || get(v, "insp_valuer") || m.valuerName;
  const coValuers = (m.valuers ?? []).filter((row) => row.include !== false && row.name).map((row) => row.name);
  const preparedBy = [student, ...coValuers].filter(Boolean).join(" and ");
  const studentNo = get(v, "exam_student_number");
  const instructing = get(v, "instr_from_name") || get(v, "prop_owner") || "the instructing party";
  const purpose =
    purposeOfValuation(get(v, "prop_assignment"), v);
  const propertyType = formatPropertyType(v) || "Vacant residential land";
  const annexurePhotos = [
    ...PHOTO_SLOTS.flatMap(({ slot, label }) => {
      const found = draft.photos.find((p) => p.slot === slot && photoIsOnReport(p));
      const after = draft.photos.filter(
        (p) =>
          p.slot === null &&
          p.insertAfter === slot &&
          !isMapAnnexPhoto(p) &&
          !isTitleAnnexPhoto(p) &&
          !isSurveyAnnexPhoto(p) &&
          !isCadastralAnnexPhoto(p) &&
          !isExtraAnnexPhoto(p) &&
          photoIsOnReport(p),
      );
      return [
        found && photoIsOnReport(found) ? { ...found, caption: found.caption || label } : null,
        ...after.filter((p) => photoIsOnReport(p) && Boolean(String(p.url || "").trim())),
      ];
    }).filter((p): p is NonNullable<typeof p> => Boolean(p && photoIsOnReport(p) && String(p.url || "").trim())),
    ...draft.photos.filter(
      (p) =>
        p.slot === null &&
        !p.insertAfter &&
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
  const extraAnnexGroups = clientAnnexGroupsOnReport(draft.photos).filter(
    (group) => !/title search|certificate of title/i.test(group.title),
  );
  const showWorkingFile = hasWorkingFile(draft);
  const valueWords = m.valueAmount ? amountInWords(m.valueAmount) : "";
  const valuerCount = 1 + (m.valuers ?? []).filter((row) => row.include !== false && row.name).length;
  const opinionPronoun = valuerCount > 1 ? "our" : "my";
  const valueDateText = formatNarrativeDateOr(m.valueDate || get(v, "insp_date"), "[date of valuation]");
  const valueInFigures = m.valueAmount ? `$${formatCurrencyDisplay(m.valueAmount)}` : "";
  const valueStatement = m.valueAmount
    ? `It is ${opinionPronoun} opinion that the market value of the subject property as at ${valueDateText} is ${valueInFigures}${valueWords ? ` (${valueWords})` : ""}.`
    : "";
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
  const show51 = prints("location") && Boolean(draft.narrative.location?.trim() || addressLine);
  const show52 = prints("neighbourhood") && Boolean(draft.narrative.neighbourhood?.trim() || get(v, "nbhd_description"));
  const show53 = prints("amenities") && Boolean(draft.narrative.amenities?.trim() || get(v, "exam_amenities"));
  const show54 = prints("popularDestinations") && Boolean(draft.narrative.popularDestinations?.trim() || get(v, "exam_destinations"));
  const show61 = prints("marketAustralia") && Boolean(draft.narrative.marketAustralia?.trim() || get(v, "exam_market_australia"));
  const show62 = prints("marketState") && Boolean(draft.narrative.marketState?.trim() || get(v, "exam_market_state"));
  const show63 = prints("marketRegion") && Boolean(draft.narrative.marketRegion?.trim() || get(v, "exam_market_region"));
  const show64 = prints("marketLocality") && Boolean(draft.narrative.marketLocality?.trim() || get(v, "exam_market_local"));
  const salesCommentsText = withoutSourceNotes(draft.narrative.salesComments || "", printedSales)
    .replace(/real\s*estate\.com(?:\.au)?/gi, "REA Group (2026)")
    .trim();
  const reconciliationText = withoutSourceNotes(draft.narrative.valueReconciliation?.trim() || "", printedSales).trim();
  const show82 = prints("salesComments") && Boolean(salesCommentsText);
  const showLease = prints("leaseEvidence") && Boolean(
    draft.narrative.leaseEvidence?.trim()
    || (m.ciLeaseComps ?? []).some((c) => c.omitFromReport !== true && (c.address || c.leaseAmount || c.netRentPerM2 || c.nla)),
  );
  const showCap = prints("capitalisationApproach") && !isVacantLand(v) && (isCommercialType(v) || isIndustrialType(v)) && Boolean(draft.narrative.capitalisationApproach?.trim() || m.ciCapRate || m.ciAdoptedRentPerM2);
  const showDcf = prints("dcfApproach") && Boolean(draft.narrative.dcfApproach?.trim());
  const showCost = prints("costApproach") && !isVacantLand(v) && Boolean(draft.narrative.costApproach?.trim() || m.costApproach);
  const show83 = prints("valueReconciliation") && Boolean(reconciliationText);
  const show84 = Boolean(get(v, "exam_on_market"));
  const show85 = prints("salesAnalysis") && Boolean(draft.narrative.salesAnalysis?.trim() || get(v, "exam_sales_analysis"));
  const show9 = prints("references");
  const showReflection = narrativePrints(m, "assignmentReflection") && Boolean(draft.narrative.assignmentReflection?.trim());
  const hasAnnexures = Boolean(
    annexurePhotos.length ||
      printedSales.some((s) => s.photoUrl) ||
      mapPhotos.length ||
      cadastralPages.length ||
      titlePages.length ||
      surveyPages.length ||
      extraAnnexGroups.length ||
      showWorkingFile,
  );
  const show4 = show40 || show41 || show42 || show43 || show44;
  const show5 = show51 || show52 || show53 || show54;
  const show6 = show61 || show62 || show63 || show64 || Boolean(get(v, "exam_market_commentary"));
  const major = includedNumbers([true, true, true, show4, show32, show5, show6, true, true, show9, hasAnnexures]);
  const n1 = includedNumbers([show11, true, true, true]);
  const n2 = includedNumbers([show21, true, true]);
  const n3 = includedNumbers([true]);
  const n4 = includedNumbers([show41, show42, show43, show44]);
  const n5 = includedNumbers([show51, show52, show53, show54]);
  const n6 = includedNumbers([show61, show62, show63, show64]);
  const showMarket = true;
  const showIncome = showLease || showCap || showDcf;
  const showCostSection = showCost || (m.printLandEvidence !== false && (m.ciLandSales ?? []).some((l) => l.omitFromReport !== true && (l.address || l.price)));
  const showMarketRec = Boolean((draft.narrative.marketReconciliation || m.marketReconciliation)?.trim() || m.marketApproachValue);
  const showIncomeRec = showIncome && Boolean((draft.narrative.incomeReconciliation || m.incomeReconciliation)?.trim() || m.incomeApproachValue);
  const showCostRec = showCostSection && Boolean((draft.narrative.costReconciliation || m.costReconciliation)?.trim() || m.costApproachValue);
  const showFinalRec = show83 || Boolean(m.marketApproachValue || m.incomeApproachValue || m.costApproachValue);
  const n8 = includedNumbers([showMarket, showIncome, showCostSection, showFinalRec, show84, show85, true, prints("disclaimer")]);
  const t = (n: number, title: string) => majorTitle(n, title);
  const toc = [
    { id: "exam-summary", label: "Executive Summary" },
    { id: "exam-1", label: t(major[0], "Basis of Value") },
    { id: "exam-2", label: t(major[1], "Title and Property Details") },
    { id: "exam-3", label: t(major[2], "Planning Controls") },
    ...(show4 ? [{ id: "exam-4", label: t(major[3], "Environmental Issues") }] : []),
    ...(show32 ? [{ id: "exam-hbu", label: t(major[4], "Highest and Best Use") }] : []),
    ...(show5 ? [{ id: "exam-5", label: t(major[5], "Locality and Location") }] : []),
    ...(show6 ? [{ id: "exam-6", label: t(major[6], "Market Commentary") }] : []),
    { id: "exam-7", label: t(major[7], "Risk Assessment") },
    { id: "exam-8", label: t(major[8], "Valuation approaches and methods") },
    ...(showMarket ? [{ id: "exam-8-market", label: `${major[8]}.${n8[0]} Market approach` }] : []),
    ...(showIncome ? [{ id: "exam-8-income", label: `${major[8]}.${n8[1]} Income approach` }] : []),
    ...(showCostSection ? [{ id: "exam-8-cost", label: `${major[8]}.${n8[2]} Cost approach` }] : []),
    ...(showFinalRec ? [{ id: "exam-8-3", label: `${major[8]}.${n8[3]} Final reconciliation` }] : []),
    ...(prints("disclaimer")
      ? [{ id: "exam-reliance", label: subTitle(major[8], n8[7], "Reliance and terms of use") }]
      : []),
    ...(show9 ? [{ id: "exam-9", label: t(major[9], "List of References") }] : []),
    ...(showReflection
      ? [{ id: "exam-reflection", label: "Review of learning outcomes" }]
      : []),
    ...(hasAnnexures ? [{ id: "exam-10", label: t(major[10], "Annexures") }] : []),
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
      id="report-preview-source"
      className="report-sheet report-type-exam mx-auto max-w-[52rem] px-8 py-10 shadow-sm sm:px-12 sm:py-14"
    >
      {m.includeAcademicCover ? <AcademicCoverSheet draft={draft} /> : null}
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
        {preparedBy ? <p className="exam-cover-meta">Prepared by {preparedBy}</p> : null}
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
          ...(showWorkingFile
            ? [{ id: "exam-annex-working", label: "Field and working notes" }]
            : []),
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
          { label: "Overlays", value: selectedOverlays.length ? selectedOverlays.join("; ") : "None recorded" },
          { label: "Zoning", value: get(v, "prop_zoning") },
          { label: "Date of Inspection", value: formatNarrativeDate(m.inspectionDate) },
          { label: "Date of Valuation", value: formatNarrativeDate(m.valueDate) },
        ]}
      />
      {zoningMap?.url ? (
        <figure className="mt-3">
          <img src={zoningMap.url} alt="Zoning map" className="max-h-48 w-auto rounded border border-slate-200" />
          <figcaption className="mt-1 text-[0.7rem] text-slate-500">Zoning — {get(v, "prop_zoning") || "subject"}</figcaption>
        </figure>
      ) : null}
      {valueStatement ? (
        <p className="mt-4 text-left">{valueStatement}</p>
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
      {subjectInlinePhotos.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {subjectInlinePhotos.map((p) => (
            <SafePhotoFigure
              key={p.id ?? p.slot}
              src={p.url}
              alt={p.caption || p.label || p.slot || "Subject photo"}
              caption={p.caption || p.label || p.slot || undefined}
              imgClassName="max-h-40 w-full rounded border border-slate-200 object-contain bg-slate-50"
              captionClassName="mt-0.5 text-[0.65rem] text-slate-500"
            />
          ))}
        </div>
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
      {selectedOverlays.length > 0 ? (
        <Keep>
          <H2>Overlays</H2>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr style={{ background: TEAL, color: "#fff" }}>
                <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Overlay</th>
                <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Mapping</th>
                <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Criteria</th>
                <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Comment / Impact</th>
              </tr>
            </thead>
            <tbody>
              {selectedOverlays.map((label, i) => {
                const lower = label.toLowerCase();
                const dedicatedSlot = lower.includes("acid")
                  ? "map_acid_sulfate"
                  : lower.includes("bushfire")
                    ? "map_bushfire"
                    : lower.includes("flood")
                      ? "map_flood"
                      : lower.includes("landslide")
                        ? "map_landslide"
                        : lower.includes("heritage")
                          ? "map_heritage"
                          : null;
                const fixed = dedicatedSlot
                  ? draft.photos.find((p) => p.slot === dedicatedSlot && photoIsOnReport(p))
                  : undefined;
                const extra = draft.photos.find((p) => {
                  if (p.kind !== "map" || p.slot || !photoIsOnReport(p) || !p.url) return false;
                  const cap = (p.caption || "").toLowerCase().trim();
                  if (!cap) return false;
                  return cap.includes(lower) || lower.includes(cap);
                });
                const map = fixed?.url ? fixed : extra;
                const analysis = (m.overlayAnalyses ?? []).find((a) => a.name.toLowerCase() === label.toLowerCase());
                return (
                  <tr key={label} style={{ background: i % 2 === 0 ? STRIPE : "#fff" }}>
                    <td className="border px-2 py-1.5 font-medium" style={{ borderColor: RULE }}>{label}</td>
                    <td className="border px-2 py-1.5" style={{ borderColor: RULE }}>
                      {map?.url ? <img src={map.url} alt={label} className="h-16 w-auto rounded" /> : "—"}
                    </td>
                    <td className="border px-2 py-1.5" style={{ borderColor: RULE }}>{analysis?.criteria?.trim() || get(v, "prop_zoning") || "—"}</td>
                    <td className="border px-2 py-1.5" style={{ borderColor: RULE }}>{analysis?.impact?.trim() || "See planning scheme for criteria and impact."}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Keep>
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
        {draft.narrative.floodAssessment?.trim() ||
          "No flood affectation is recorded for the subject on the flood layer checked."}
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

      {show32 ? (
        <Lead id="exam-hbu" title={t(major[4], "Highest and Best Use")}>
          <Keep>
            {draft.narrative.highestBestUse?.trim() ? (
              <Prose text={draft.narrative.highestBestUse} />
            ) : (
              <Para>{formatHbuVacant(v) || "Record the highest and best use of the subject property."}</Para>
            )}
          </Keep>
        </Lead>
      ) : null}

      {show5 ? <Lead id="exam-5" title={t(major[5], "Locality and Location")}>
      <Keep>
      {show51 ? <H2>{subTitle(major[5], n5[0], "Location")}</H2> : null}
      {narrativePrints(m, "location") ? (
        <>
      <Prose text={cite(stripLeadingHeading(draft.narrative.location?.trim() || "", "Location"), m.nbhdClaims as NbhdClaim[] | undefined, "Location")} />
      {!draft.narrative.location?.trim() && addressLine ? (
        <Para>The property is located at {addressLine}.</Para>
      ) : null}
        </>
      ) : null}
      </Keep>
      </Lead> : null}
      {show52 ? <Keep>
      <H2>{subTitle(major[5], n5[1], "Locality")}</H2>
      {narrativePrints(m, "neighbourhood") ? (
      <Prose
        text={citeLoc(
          stripLeadingHeading(
            stripLeadingHeading(
              draft.narrative.neighbourhood?.trim() || get(v, "nbhd_description") || "",
              "Neighbourhood",
            ),
            "Locality",
          ),
        )}
      />
      ) : null}
      </Keep> : null}
      {show53 ? (
        <Keep>
          {show53 ? <H2>{subTitle(major[5], n5[2], "Amenities")}</H2> : null}
          <Prose text={citeLoc(draft.narrative.amenities?.trim() || get(v, "exam_amenities"))} />
        </Keep>
      ) : null}
      {show54 ? (
        <Keep>
          {show54 ? <H2>{subTitle(major[5], n5[3], "Popular destinations")}</H2> : null}
          <Prose
            text={citeLoc(
              draft.narrative.popularDestinations?.trim() || get(v, "exam_destinations"),
            )}
          />
        </Keep>
      ) : null}

      {show6 && hasMarketParts ? (
        <SectionOpen
          id="exam-6"
          title={t(major[6], "Market Commentary")}
          sub={show61 ? subTitle(major[6], n6[0], "Australia") : undefined}
          text={
            show61
              ? cite(
                  withoutSourceNotes(
                    draft.narrative.marketAustralia?.trim() || get(v, "exam_market_australia"),
                    printedSales,
                  ),
                  m.marketClaimsAustralia as NbhdClaim[] | undefined,
                  "Australian market commentary",
                )
              : ""
          }
        />
      ) : null}
      {show6 && show62 ? (
        <Keep>
          <H2>{subTitle(major[6], n6[1], "State")}</H2>
          <Prose text={cite(withoutSourceNotes(draft.narrative.marketState?.trim() || get(v, "exam_market_state"), printedSales), m.marketClaimsState as NbhdClaim[] | undefined, "State market commentary")} />
        </Keep>
      ) : null}
      {show6 && show63 ? (
        <Keep>
          <H2>{subTitle(major[6], n6[2], "Region")}</H2>
          <Prose text={cite(withoutSourceNotes(draft.narrative.marketRegion?.trim() || get(v, "exam_market_region"), printedSales), m.marketClaimsRegion as NbhdClaim[] | undefined, "Regional market commentary")} />
        </Keep>
      ) : null}
      {show6 && show64 ? (
        <Keep>
          <H2>{subTitle(major[6], n6[3], "Locality")}</H2>
          <Prose text={cite(withoutSourceNotes(draft.narrative.marketLocality?.trim() || get(v, "exam_market_local"), printedSales), m.marketClaimsLocality as NbhdClaim[] | undefined, "Locality market commentary")} />
        </Keep>
      ) : null}
      {show6 && !hasMarketParts ? (
        <SectionOpen
          id="exam-6"
          title={t(major[6], "Market Commentary")}
          text={get(v, "exam_market_commentary")}
        />
      ) : null}
      <Lead id="exam-7" title={t(major[7], "Risk Assessment")}>
      <div>
      <H2>{subTitle(major[7], 1, "Property risk assessment")}</H2>
      <Para>
        Each category has been considered against the property risk assessment criteria of the
        Australian Property Institute.
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
        <div className="report-keep-block">
          <h2 id="exam-8" className="report-h2 report-heading-lead mt-8 border-b pb-1 text-[1.05rem] font-semibold" style={{ color: TEAL, borderColor: RULE }}>
            {t(major[8], "Valuation approaches and methods")}
          </h2>
          {narrativePrints(m, "valuationApproach") && draft.narrative.valuationApproach?.trim() ? (
            <Prose text={stripValuationDateCommentary(draft.narrative.valuationApproach.trim())} />
          ) : null}
        </div>
        <Keep>
        <H2 id="exam-8-market">{`${major[8]}.${n8[0]} Market approach`}</H2>
        <h3 className="report-h2 report-heading-lead mt-3 text-[0.9rem] font-semibold" style={{ color: TEAL }}>Direct comparison method</h3>
        {printedSales.length === 0 ? (
          <Para>No sales evidence has been recorded.</Para>
        ) : (
          <div className="space-y-6">
            {isCommercialType(v) || isIndustrialType(v) ? (
            <CommercialEvidenceSchedule
              kind="sales"
              sales={printedSales}
              values={v}
              meta={m}
              pools={sheetPools}
              headerStyle={{ background: TEAL, color: "#fff" }}
              cellBorderClassName="border"
              cellStyle={{ borderColor: RULE }}
            />
            ) : printSalesEvidenceEnabled(draft.reportMeta) ? (
            <SalesEvidenceSchedule
              sales={printedSales}
              omitSourceNotes
              showCommercialMetrics={false}
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
        {m.printFullPageSheets !== false
          ? printedSales.filter((s) => s.includeSheet !== false).map((s, idx) => (
              <ComparableSheet
                key={`sale-${s.id}`}
                printMode
                data={effectiveSaleSheet(s, idx + 1, sheetPools)}
                values={v}
                onChange={() => {}}
              />
            ))
          : null}
        </Keep>
        {show82 ? (
          <Keep>
            <h3 id="exam-8-2" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              Comments on comparable sales
            </h3>
            <Prose text={salesCommentsText} />
          </Keep>
        ) : null}

        {draft.reportMeta.salesMapUrl && m.printSalesMap !== false ? (
          <div className="report-map-page break-before-page break-after-page flex min-h-[90vh] flex-col items-center justify-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide">Direct comparison — sales map</p>
            <img src={draft.reportMeta.salesMapUrl} alt="Sales map" className="max-h-[85vh] w-auto max-w-full object-contain" style={{ border: `1px solid ${RULE}` }} />
          </div>
        ) : null}
        {showMarketRec ? (
          <Keep>
            <h3 className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>Reconciliation of the market approach</h3>
            {(draft.narrative.marketReconciliation || m.marketReconciliation)?.trim() ? (
              <Prose text={(draft.narrative.marketReconciliation || m.marketReconciliation || "").replace(/\n*Therefore,?[\s\S]*$/i, "").trim()} />
            ) : null}
            {marketApproachCalc(m, v) ? <Para>{marketCalculationSentence(m, v)}</Para> : null}
          </Keep>
        ) : null}

        {showLease ? (
          <div className="report-keep-block break-before-page">
            {showIncome ? (
              <h2 id="exam-8-income" className="report-h2 report-heading-lead mt-8 border-b pb-1 text-[1.05rem] font-semibold" style={{ color: TEAL, borderColor: RULE }}>{`${major[8]}.${n8[1]} Income approach`}</h2>
            ) : null}
            <h3 id="exam-8-lease" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              Lease evidence
            </h3>
            <CommercialEvidenceSchedule
              kind="leases"
              leases={m.ciLeaseComps}
              values={v}
              meta={m}
              pools={sheetPools}
              headerStyle={{ background: TEAL, color: "#fff" }}
              cellBorderClassName="border"
              cellStyle={{ borderColor: RULE }}
            />
            {m.printFullPageSheets !== false && m.printLeaseSheets !== false
              ? (m.ciLeaseComps ?? []).filter((c) => c.omitFromReport !== true && c.includeSheet !== false && (c.address || c.leaseAmount || c.netRentPerM2 || c.nla)).map((c, idx) => (
                  <ComparableSheet
                    key={`lease-${c.id}`}
                    printMode
                    data={effectiveLeaseSheet(c, idx + 1, sheetPools)}
                    values={v}
                    onChange={() => {}}
                  />
                ))
              : null}
            <Prose text={withoutSourceNotes(draft.narrative.leaseEvidence || "", printedSales)} />
            {(draft.narrative.incomeReconciliation || m.incomeReconciliation)?.trim() ? (
              <Prose text={withoutSourceNotes(draft.narrative.incomeReconciliation || m.incomeReconciliation || "", printedSales)} />
            ) : null}

            {m.ciLeaseMapUrl ? (
              <div className="break-before-page flex min-h-[90vh] flex-col items-center justify-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide">Income approach — lease evidence map</p>
                <img src={m.ciLeaseMapUrl} alt="Lease evidence map" className="max-h-[85vh] w-auto max-w-full object-contain" style={{ border: `1px solid ${RULE}` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        {showIncome && !showLease ? (
          <div className="report-keep-block break-before-page">
            <h2 id="exam-8-income" className="report-h2 report-heading-lead mt-8 border-b pb-1 text-[1.05rem] font-semibold" style={{ color: TEAL, borderColor: RULE }}>{`${major[8]}.${n8[1]} Income approach`}</h2>
          </div>
        ) : null}
        {showDcf ? (
          <Keep>
            <h3 id="exam-8-dcf" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              Discounted cash flow method
            </h3>
            <Prose text={withoutSourceNotes(draft.narrative.dcfApproach || "", printedSales)} />
          </Keep>
        ) : null}
        {(m.ciCapRate || m.ciAdoptedRentPerM2 || m.ciAdoptedValueOverride || m.ciPassingRentOverride || m.ciStartingRent || m.ciLeaseStartDate) && m.printCapTable !== false ? (
          <div className="report-keep-block">
            <h3 id="exam-8-cap" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              Capitalisation method
            </h3>
            <table className="mt-2 w-full border-collapse text-xs">
              <tbody>
                {capPrintRows(m, v).map((row) => (
                  <tr key={row.label} className={row.strong ? "font-semibold" : undefined} style={{ background: row.strong ? STRIPE : undefined }}>
                    <td className="border px-2 py-1.5" style={{ borderColor: RULE }}>{row.label}</td>
                    <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {prints("capitalisationApproach") && draft.narrative.capitalisationApproach?.trim() ? (
              <Prose text={withoutSourceNotes(draft.narrative.capitalisationApproach, printedSales)} />
            ) : null}
          </div>
        ) : null}
        {showIncomeRec ? (
          <Keep>
            <h3 className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>Reconciliation of the income approach</h3>
            <Prose text={incomeBoilerplate(m)} />
            {m.incomeApproachValue || m.ciAdoptedValueOverride ? (
              <table className="mt-3 w-full border-collapse text-xs">
                <tbody>
                  <tr className="font-semibold"><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>Adopt for practical purposes</td><td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>${formatCurrencyDisplay(m.incomeApproachValue || m.ciAdoptedValueOverride || "")}</td></tr>
                </tbody>
              </table>
            ) : null}
          </Keep>
        ) : null}

        {showCost ? (
          <Keep>
            <h3 id="exam-8-cost" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              {`${major[8]}.${n8[2]} Cost approach`}
            </h3>
            <h3 className="mt-2 text-[0.9rem] font-semibold" style={{ color: TEAL }}>Land value</h3>
            {m.printLandEvidence !== false ? (
              <LandEvidenceSchedule
                sales={m.ciLandSales ?? []}
                headerStyle={{ background: TEAL, color: "#fff" }}
                cellStyle={{ borderColor: RULE }}
              />
            ) : null}
            {m.ciLandMapUrl && m.printLandMap !== false ? (
              <div className="break-before-page flex min-h-[90vh] flex-col items-center justify-center">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide">Cost approach — land sales map</p>
                <img src={m.ciLandMapUrl} alt="Land sales map" className="max-h-[85vh] w-auto max-w-full object-contain" style={{ border: `1px solid ${RULE}` }} />
              </div>
            ) : null}
            {m.printFullPageSheets !== false && m.printLandSheets !== false
              ? (m.ciLandSales ?? []).filter((l) => l.omitFromReport !== true && l.includeSheet !== false && (l.address || l.price)).map((l, idx) => (
                  <ComparableSheet
                    key={`land-${l.id}`}
                    printMode
                    data={effectiveLandSheet(l, idx + 1, sheetPools)}
                    values={v}
                    onChange={() => {}}
                  />
                ))
              : null}

            <h3 className="mt-4 text-[0.9rem] font-semibold" style={{ color: TEAL }}>Summation method</h3>
            {m.costApproach ? (
              <table className="mt-2 w-full border-collapse text-xs">
                <thead>
                  <tr style={{ background: TEAL, color: "#fff" }}>
                    <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Item</th>
                    <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Area / qty</th>
                    <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Rate</th>
                    <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Cost new</th>
                    <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Dep %</th>
                    <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Depreciation</th>
                    <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Depreciated $</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(m.costApproach.mainBuilding ?? []), ...(m.costApproach.ancillary ?? [])]
                    .filter(costLineEntered)
                    .map((line, i) => (
                    <tr key={`cost-${i}`} style={{ background: i % 2 === 0 ? STRIPE : "#fff" }}>
                      <td className="border px-2 py-1.5" style={{ borderColor: RULE }}>{line.name}</td>
                      <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{line.area || "—"}</td>
                      <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{line.rate || line.nominal || "—"}</td>
                      <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{formatCostMoney(costLineNew(line))}</td>
                      <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{line.depreciation || "—"}</td>
                      <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{formatCostMoney(costLineDepreciation(line))}</td>
                      <td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>{formatCostMoney(costLineValue(line))}</td>
                    </tr>
                  ))}
                  {m.costApproach.adoptedValue ? (
                    <tr style={{ background: STRIPE }}>
                      <td className="border px-2 py-1.5 font-semibold" style={{ borderColor: RULE }} colSpan={6}>Adopted value (rounded)</td>
                      <td className="border px-2 py-1.5 text-right font-semibold" style={{ borderColor: RULE }}>${formatCurrencyDisplay(m.costApproach.adoptedValue)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            ) : null}
          </Keep>
        ) : null}
        {showCostRec ? (
          <Keep>
            <h3 className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>Reconciliation of the cost approach</h3>
            <Prose text={costBoilerplate(m, draft.narrative.costReconciliation || m.costReconciliation)} />
          </Keep>
        ) : null}

        {showFinalRec ? (
          <Keep>
            <h3 id="exam-8-3" className="report-h2 report-heading-lead mt-4 text-[0.95rem] font-semibold" style={{ color: TEAL }}>
              {`${major[8]}.${n8[3]} Final reconciliation`}
            </h3>
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr style={{ background: TEAL, color: "#fff" }}>
                  <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Approach</th>
                  <th className="border px-2 py-1.5 text-left" style={{ borderColor: RULE }}>Method</th>
                  <th className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>Indicated value</th>
                </tr>
              </thead>
              <tbody>
                {marketApproachCalc(m, v) || m.marketApproachValue ? <tr><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>Market</td><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>Direct comparison</td><td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>${formatCurrencyDisplay(String(marketApproachCalc(m, v)?.adopted ?? m.marketApproachValue ?? ""))}</td></tr> : null}
                {m.incomeApproachValue || m.ciAdoptedValueOverride ? <tr><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>Income</td><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>{[showCap ? "Capitalisation" : "", showDcf ? "DCF" : ""].filter(Boolean).join(" / ") || "Income"}</td><td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>${formatCurrencyDisplay(m.incomeApproachValue || m.ciAdoptedValueOverride || "")}</td></tr> : null}
                {m.costApproachValue || m.costApproach?.adoptedValue ? <tr><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>Cost</td><td className="border px-2 py-1.5" style={{ borderColor: RULE }}>Summation</td><td className="border px-2 py-1.5 text-right" style={{ borderColor: RULE }}>${formatCurrencyDisplay(m.costApproachValue || m.costApproach?.adoptedValue || "")}</td></tr> : null}
              </tbody>
            </table>
            <Prose text={finalBoilerplate(m, v, draft.narrative.valueReconciliation)} />
          </Keep>
        ) : null}
        {get(v, "exam_on_market") ? (
          <>
            {show84 ? <H2>{subTitle(major[8], n8[4], "On-the-market listings")}</H2> : null}
            <Para>
              The following listings were considered. They are not settled sales and are not used as
              primary evidence.
            </Para>
            <Prose text={get(v, "exam_on_market")} />
          </>
        ) : null}
        {draft.narrative.salesAnalysis?.trim() || get(v, "exam_sales_analysis") ? (
          <>
            {show85 ? <H2>{subTitle(major[8], n8[5], "Analysis")}</H2> : null}
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
        <H2>{subTitle(major[8], n8[6], "Valuation result")}</H2>
        {prints("valuationResult") ? (
          <Para>
            {draft.narrative.valuationResult?.trim() ||
              `Having regard to the sales evidence and market conditions at the date of valuation, it is ${opinionPronoun} opinion that the market value of the subject property located at ${addressLine || "[property address]"} as at ${valueDateText} is ${m.valueAmount ? `${valueInFigures}${valueWords ? ` (${valueWords})` : ""}.` : "[value in numbers, then words]." }`}
          </Para>
        ) : null}
        {prints("valuationReliance") ? (
          <Para>
            {draft.narrative.valuationReliance?.trim() ||
              `The opinion of market value is current as at the date of valuation and is not to be read or relied upon after the expiration of the reliance period without further review by the valuer. The opinion is as at ${formatNarrativeDateOr(m.valueDate, "the date of valuation")} and is not to be read after the reliance period without a review.`}
          </Para>
        ) : null}
        <div className="mt-4">
          <ExamSignature draft={draft} />
        </div>
        </div>
      </section>

      {prints("disclaimer") ? (
        <SectionOpen
          id="exam-reliance"
          title={subTitle(major[8], n8[7], "Reliance and terms of use")}
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
      {show9 ? <Lead id="exam-9" title={t(major[9], "References")}>
      <Keep>
      {narrativePrints(m, "references") ? (
        referencesForPrint(
          m,
          draft.narrative.references,
          v,
          Object.values(draft.narrative).join("\n"),
        ).length ? (
          <div className="report-reference-list">
            <style>{`.report-reference-list i, .report-reference-list em, .report-ref-title { font-style: italic !important; font-synthesis: style !important; }`}</style>
            {referencesForPrint(
              m,
              draft.narrative.references,
              v,
              Object.values(draft.narrative).join("\n"),
            ).map((ref, i) => {
              const style = referenceStyleOf(m);
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
                      {ref.author} {ref.year}, <i className="report-ref-title" style={{ fontStyle: "italic" }}>{ref.title}</i>
                      {site ? <>, {ref.site}</> : null}, viewed {ref.accessed}
                      {ref.url ? <>, {"<"}{ref.url}{">"}</> : null}.
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
        Object.values(draft.narrative).join("\n"),
      ).length &&
      !get(v, "exam_references") ? (
        <Para>List sources used for the market commentary, planning searches and sales evidence.</Para>
      ) : null}
      </Keep>
      </Lead> : null}
      </section>
      {showReflection ? (
        <section id="exam-reflection" className="report-section mt-8">
          <H1>Review of learning outcomes</H1>
          <Prose text={draft.narrative.assignmentReflection || ""} />
        </section>
      ) : null}

      {hasAnnexures ? <Lead id="exam-10" title={t(major[10], "Annexures")}>
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
        {showWorkingFile ? <li>Field and working notes</li> : null}
      </ol>
      </Lead> : null}

      {annexurePhotos.length > 0 ? (
        <section id="exam-annex-subject" className="report-annexure report-annexure-subject mt-12">
          <PhotoAnnexPages heading="Annexure — Subject photographs">
            {annexurePhotos.map((photo) => (
              <SafePhotoFigure
                key={photo.id}
                src={photo.url}
                alt={photo.caption || "Photograph"}
                caption={photo.caption}
                figureClassName="report-photo-figure"
                imgClassName="aspect-4/3 w-full object-cover"
                imgStyle={{ border: `1px solid ${RULE}` }}
                captionClassName="mt-1.5 text-left text-sm"
                eager
              />
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
        <A4DocumentAnnex
          id="exam-annex-maps"
          heading="Annexure — Maps"
          pages={mapPhotos}
          pageHeading={(photo) => photo.caption || "Map"}
        />
      ) : null}
      {cadastralPages.length > 0 ? (
        <A4DocumentAnnex
          id="exam-annex-cadastral"
          heading="Cadastral plan"
          pages={cadastralPages}
        />
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
      {showWorkingFile ? <WorkingNotesAnnex draft={draft} /> : null}
    </article>
  );
}

function AcademicCoverSheet({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;
  const name = get(v, "exam_student_name") || m.valuerName || get(v, "insp_valuer") || "";
  const studentNo = get(v, "exam_student_number");
  const sig =
    typeof v["sign_sig"] === "string" && v["sign_sig"].startsWith("data:image") ? v["sign_sig"] : "";
  const address = [
    get(v, "prop_address"),
    [get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const date = formatNarrativeDateOr(m.valueDate, "");
  const body = (m.academicCoverText || defaultAcademicCoverText()).trim();
  return (
    <section className="exam-cover break-after-page text-left text-sm leading-relaxed">
      <p className="text-base font-semibold">Bond University</p>
      <h1 className="mt-2 text-lg font-semibold">Assessment Cover Sheet</h1>
      <p className="mt-4"><strong>Subject</strong> — Graduate Diploma of Valuation and Property Development</p>
      <p><strong>Assessment task title</strong> — Valuation report{address ? `: ${address}` : ""}</p>
      <p><strong>Type of assessment</strong> — Valuation report</p>
      <p><strong>Due date</strong> — {date || "—"}</p>
      <div className="mt-4 whitespace-pre-line">{body}</div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <p><strong>Name</strong> — {name || "—"}</p>
        <p><strong>Student ID</strong> — {studentNo || "—"}</p>
        <p>
          <strong>Signature</strong>
          {sig ? <img src={sig} alt="Signature" className="mt-1 h-12 w-auto" /> : " —"}
        </p>
        <p><strong>Date</strong> — {date || "—"}</p>
      </div>
      <p className="mt-3 text-xs">
        Both handwritten and typed signatures are considered legal signatures. You may use either form of signature on this document.
      </p>
    </section>
  );
}

export function defaultAcademicCoverText(): string {
  return [
    "Academic Integrity",
    "Academic Integrity at Bond means adhering, in words and actions and across all aspects of student life, to an academic moral code bound by the seven integrity principles of honesty, trust, fairness, respect, responsibility, courage, and professionalism. Breaches of academic integrity are known as academic misconduct or academic dishonesty.",
    "The University supports Academic Integrity by providing students with resources and support. Visit Academic Integrity at Bond or seek support from your educators, BondCare support services including the Academic Skills Centre, or Library services.",
    "Use of Generative AI in this Assessment",
    "The University acknowledges that Generative Artificial Intelligence (AI) tools are an important facet of contemporary life. Their use in assessment is considered in line with students’ development of the skills and knowledge which demonstrate the learning outcomes and underpin study and career success. This statement follows Bond University Artificial Intelligence Policy TL 3.5.4 and the Academic Integrity Policy TL 3.5.2. The assessment is treated as AI-Supported under the Bond AI Assessment Framework: AI is used as a directed drafting aid, and the submitted work is the student’s own after critical review.",
    "What the application does",
    "The report was prepared in Property Valuer-Pro, of which Shawn Kelly is the sole and exclusive author. A generative AI tool is available inside that application. It acts only when the student asks. It drafts narrative text for a block the student selects, using the inspection form and the notes the student has accepted. It drafts the comments shown in the comparable sales grid. Those grid comments are AI-drafted. The narrative comments in the sales comparison section are written by the student and are not generated by AI. It rewrites only the suburb and market notes the student has ticked. At print, it places an in-text citation beside a sentence that uses a figure from an accepted note, and it lists a source only when a ticked note or a named source in the text supports it. Existing text is not replaced unless the student confirms that it should be.",
    "What the application does not do",
    "It does not form the opinion of value. It does not select the comparable sales. It does not make the adjustments. It does not write the narrative comments in the sales comparison section. Those comments are the student’s own work. It does not sign the report. It does not invent a source, a figure, or a citation. It does not generate text unless the student asks. It does not overwrite a manual edit without a confirmation. The maps are from Google Maps. The photographs are the student’s. The assessed value, the adjustments, the reconciliation and the signature are the student’s own work.",
    "The student has reviewed every AI-assisted passage, corrected it where required, and takes responsibility for the content submitted. All additional sources used are listed in the references.",
    "Submission declaration",
    "I have read and understand the Student Code of Conduct and the Student Roles and Responsibilities outlined in the Academic Integrity Policy.",
    "I declare that this assessment is my original work, except where acknowledgement of sources is made.",
    "I declare that in completing this assessment task I have adhered to the instructions for use and acknowledgement of Generative AI outlined in this Assessment Cover Sheet.",
  ].join("\n\n");
}

function ExamSignature({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;
  const sig =
    typeof v["sign_sig"] === "string" && v["sign_sig"].startsWith("data:image")
      ? v["sign_sig"]
      : "";
  const name = m.valuerName || get(v, "exam_student_name") || get(v, "insp_valuer");
  const extras = (m.valuers ?? []).filter((row) => row.include !== false && (row.name || row.signature));
  const signatory = (label: string, who: string, role: string, signature?: string, registration?: string) => (
    <div className="min-w-[12rem] flex-1">
      {signature ? (
        <div className="report-sig-stage">
          <img src={signature} alt={`${who} signature`} className="report-sig-image" />
          <div className="report-sig-line" aria-hidden />
        </div>
      ) : (
        <div className="report-sig-stage report-sig-stage--empty">
          <div className="report-sig-line" aria-hidden />
        </div>
      )}
      <p className="report-sig-name font-semibold">{who}</p>
      {role ? <p className="text-sm">{role}</p> : null}
      {registration ? <p className="text-sm">{registration}</p> : null}
    </div>
  );
  return (
    <div className={`report-signature mt-4 ${extras.length === 1 ? "flex flex-wrap gap-8" : ""}`}>
      {signatory("primary", name, "Student Valuer", sig)}
      {extras.map((row) => (
        <div key={row.id} className={extras.length === 1 ? "" : "mt-4"}>
          {signatory(row.id, row.name, row.role || "Co-signatory", row.signature, row.registration)}
        </div>
      ))}
      {m.valueDate ? (
        <p className="mt-1 w-full text-sm">{formatNarrativeDate(m.valueDate)}</p>
      ) : null}
    </div>
  );
}


