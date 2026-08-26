import type { ReportDraftController } from "@/hooks/useReportDraft";
import { formatCurrencyInput } from "@/lib/report/salesRelativity";
import { pick } from "@/lib/report/schema";
import { resolveValuerProfile } from "@/lib/report/valuerProfiles";

/** Options kept in sync with inspection-schema.json prop_assignment */
const REPORT_TYPE_OPTIONS = [
  "Purchase",
  "Refinance",
  "ATO / CGT",
  "Resumption",
  "Dispute",
  "Other",
  "Stamp Duty - Phil",
  "CGT - Phil",
  "CGT - Phil Retrospective",
  "CGT - Phil Apportionment",
  "Stamp Duty - Murray",
  "CGT - Murray",
  "CGT - Murray Retrospective",
  "CGT - Murray Apportionment",
] as const;

const IDENTITY_FIELDS = [
  // prop_assignment is rendered as an editable control above the fact tables
  "insp_purpose",
  "prop_address",
  "prop_suburb",
  "prop_state",
  "prop_postcode",
  "prop_lotplan",
  "prop_title",
  "prop_legal",
  "prop_lga",
  "prop_parish",
  "prop_owner",
  "prop_occupant",
  "prop_rights",
];

const SITE_FIELDS = [
  "prop_sitearea",
  "prop_areaunit",
  "prop_dimensions",
  "prop_shape",
  "prop_lot_position",
  "prop_zoning",
  "prop_zoning_desc",
  "prop_zoning_comp",
  "prop_hbu",
  "prop_flood",
  "prop_flood_map",
  "prop_adverse_site",
];

const TRANSACTION_FIELDS = [
  "prop_offered",
  "prop_offer_details",
  "prop_contract_price",
  "prop_contract_date",
  "prop_seller_owner",
  "prop_assistance",
  "prop_assistance_details",
];

function FactTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; label: string; value: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
        {title}
      </h3>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-4"
          >
            <dt className="text-sm text-muted-foreground">
              {row.label}
              <span className="ml-2 font-mono text-[11px] text-muted-foreground/70">
                {row.name}
              </span>
            </dt>
            <dd className="text-sm text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MetaInput({
  label,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
        {prefix ? (
          <span className="pl-3 text-sm text-muted-foreground">{prefix}</span>
        ) : null}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </label>
  );
}

export function SubjectSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setMeta, setValue } = controller;
  const { values, reportMeta } = draft;

  const currentReportType =
    typeof values.prop_assignment === "string" ? values.prop_assignment : "";

  return (
    <div className="space-y-6">
      {/* Report type — editable on the report draft so one inspection can produce multiple report products */}
      <section className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Report type for this report</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The original inspection answers stay frozen. Change the type here to generate a
          different report product (Purchase, Stamp Duty – Phil/Murray, ATO / CGT, etc.) from the
          same inspection.
        </p>
        <div className="mt-4 max-w-sm">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Report Type
            </span>
            <select
              value={currentReportType}
              onChange={(e) => {
                const nextType = e.target.value;
                setValue("prop_assignment", nextType);
                const profile = resolveValuerProfile(nextType);
                if (profile.id === "phil" || profile.id === "murray") {
                  setValue("insp_valuer", profile.displayName);
                  setValue("insp_firm", profile.firm);
                  setValue("sign_member", profile.membershipLine);
                  setMeta({
                    valuerName: profile.displayName,
                    firmName: profile.firm,
                  });
                }
              }}
              className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select…</option>
              {REPORT_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Valuation figures</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Entered here for the report; not part of the inspection record.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetaInput
            label="Assessed market value"
            prefix="$"
            value={formatCurrencyInput(reportMeta.valueAmount)}
            onChange={(v) => setMeta({ valueAmount: formatCurrencyInput(v) })}
            placeholder="895,000"
          />
          <MetaInput
            label="Date of valuation"
            value={reportMeta.valueDate}
            onChange={(v) => setMeta({ valueDate: v })}
            placeholder="dd/mm/yyyy"
          />
          <MetaInput
            label="Date of inspection"
            value={reportMeta.inspectionDate}
            onChange={(v) => setMeta({ inspectionDate: v })}
            placeholder="dd/mm/yyyy"
          />
          <MetaInput
            label="Valuer"
            value={reportMeta.valuerName}
            onChange={(v) => setMeta({ valuerName: v })}
          />
          <MetaInput
            label="Firm"
            value={reportMeta.firmName}
            onChange={(v) => setMeta({ firmName: v })}
          />
        </div>
      </section>

      <FactTable title="Property identification" rows={pick(values, IDENTITY_FIELDS)} />
      <FactTable title="Site and planning" rows={pick(values, SITE_FIELDS)} />
      <FactTable title="Transaction" rows={pick(values, TRANSACTION_FIELDS)} />
      <p className="text-sm text-muted-foreground">
        Subject facts (other than Report Type) are shown from the inspection record.
        To change them, open the inspection form (Edit inspection form on Review). Fields left
        unset in the inspection are omitted entirely, in the report as well as above.
      </p>
    </div>
  );
}
