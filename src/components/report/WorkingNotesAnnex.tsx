import { A4DocumentAnnex } from "@/components/report/A4DocumentAnnex";
import { AdjustmentGridPrint } from "@/components/report/AdjustmentGridPrint";
import { formatNarrativeDate } from "@/lib/report/dates";
import { formatSalePrice } from "@/lib/report/salesRelativity";
import {
  calculationWorkingRows,
  inspectionWorkingSections,
  researchWorkingGroups,
  saleWorkingRating,
  workingFileCoverLine,
  workingLotPlan,
} from "@/lib/report/workingFile";
import {
  annexPageLabel,
  salesOnReport,
  workingAnnexGroupsOnReport,
  type ReportDraft,
} from "@/lib/report/types";

const RULE = "var(--rule, #d6d3d1)";

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th
              className="w-[34%] px-2 py-1 text-left align-top font-medium"
              style={{ border: `1px solid ${RULE}` }}
            >
              {row.label}
            </th>
            <td className="px-2 py-1 align-top" style={{ border: `1px solid ${RULE}` }}>
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

export function hasWorkingFile(draft: ReportDraft): boolean {
  return (
    inspectionWorkingSections(draft.values).length > 0 ||
    salesOnReport(draft.sales).length > 0 ||
    calculationWorkingRows(draft).length > 0 ||
    researchWorkingGroups(draft.reportMeta).length > 0 ||
    workingAnnexGroupsOnReport(draft.photos).length > 0
  );
}

/** Stored working file. No generated prose. */
export function WorkingNotesAnnex({ draft }: { draft: ReportDraft }) {
  if (!hasWorkingFile(draft)) return null;
  const values = draft.values;
  const meta = draft.reportMeta;
  const address = ["prop_address", "prop_suburb", "prop_state", "prop_postcode"]
    .map((key) => values[key])
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  const sales = salesOnReport(draft.sales);
  const sections = inspectionWorkingSections(values);
  const calculations = calculationWorkingRows(draft);
  const research = researchWorkingGroups(meta);
  const documents = workingAnnexGroupsOnReport(draft.photos);
  const gridMeta = { ...meta, omitAdjustmentPrintRows: [] };

  return (
    <section id="exam-annex-working" className="report-annexure mt-12">
      <h2 className="text-base font-semibold">Annexure — Field and working notes</h2>
      <p className="mt-2 text-sm">{workingFileCoverLine()}</p>
      <Rows
        rows={[
          { label: "Property", value: address },
          { label: "Real property description", value: workingLotPlan(values) },
          { label: "Date of inspection", value: formatNarrativeDate(meta.inspectionDate) },
          { label: "Date of valuation", value: formatNarrativeDate(meta.valueDate) },
        ].filter((row) => row.value)}
      />

      {sections.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Inspection form</h3>
          {sections.map((section) => (
            <div key={section.id} className="mt-3">
              <p className="text-sm font-medium">{section.title}</p>
              <Rows rows={section.rows} />
            </div>
          ))}
        </div>
      ) : null}

      {sales.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Sales working papers</h3>
          {sales.map((sale, index) => (
            <div key={sale.id} className="mt-3">
              <p className="text-sm font-medium">Comparable {index + 1}</p>
              <Rows
                rows={[
                  { label: "Address", value: sale.address },
                  { label: "Date", value: sale.saleDate },
                  { label: "Price", value: formatSalePrice(sale.salePrice) },
                  { label: "Land area", value: sale.landArea },
                  { label: "Data source", value: sale.dataSource ?? "" },
                  { label: "Verification", value: sale.verificationSource ?? "" },
                  { label: "Rating", value: saleWorkingRating(sale) },
                ].filter((row) => row.value)}
              />
              <Note label="Source note" text={sale.comments ?? ""} />
              <Note label="Working note" text={sale.workingNotes ?? ""} />
            </div>
          ))}
          <div className="mt-4">
            <p className="text-sm font-medium">Adjustment grid</p>
            <AdjustmentGridPrint
              sales={sales}
              values={values}
              meta={gridMeta}
              subjectAddress={address}
            />
          </div>
        </div>
      ) : null}

      {calculations.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Calculation</h3>
          <Rows rows={calculations} />
        </div>
      ) : null}

      {research.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Research</h3>
          {research.map((group) => (
            <div key={group.title} className="mt-3">
              <p className="text-sm font-medium">{group.title}</p>
              {group.claims.map((claim) => (
                <p key={claim.id} className="mt-1 whitespace-pre-wrap text-sm">
                  {claim.accepted ? "Accepted" : "Not accepted"}
                  {claim.source ? ` — ${claim.source}` : ""}
                  {". "}
                  {claim.text}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {documents.map((group) => (
        <A4DocumentAnnex
          key={group.id}
          id={`exam-annex-working-${group.id}`}
          heading={group.title}
          pages={group.pages}
          pageHeading={(_page, index) => annexPageLabel(group.title, index)}
        />
      ))}
    </section>
  );
}
