import { BOILERPLATE } from "@/lib/report/boilerplate";
import { get, hasValue, joinValues, labelFor, pick } from "@/lib/report/schema";
import { MAP_SLOTS, PHOTO_SLOTS, type ReportDraft } from "@/lib/report/types";
import { getReportTypeConfig, isPhilReportType } from "@/lib/report/reportTypes";
import { cleanSaleProse } from "@/lib/report/salesRelativity";
import { overlaySectionNumber, parseOverlayList } from "@/lib/report/overlays";

/* ---------- primitives ---------- */

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="report-section mt-8 scroll-mt-24">
      <h2 className="report-h2 border-b border-[var(--rule)] pb-1 uppercase tracking-wide">
        <span className="mr-3 tabular-nums">{number}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Template-aligned TOC entries. `fields` / narrative / sales drive visibility. */
type TocEntry = {
  id: string;
  number: string;
  title: string;
  /** Always shown (boilerplate-only sections). */
  always?: boolean;
  fields?: string[];
  /** Require non-empty narrative key. */
  narrativeKey?: keyof import("@/lib/report/types").ReportNarrative;
  /** Require at least one comparable sale. */
  requireSales?: boolean;
};

const TOC_ENTRIES: TocEntry[] = [
  {
    id: "sec-instructions",
    number: "1.",
    title: "Instructions and Purpose",
    fields: ["prop_assignment", "prop_rights", "insp_date"],
  },
  {
    id: "sec-property",
    number: "2.",
    title: "Property Details",
    fields: [
      "prop_address",
      "prop_suburb",
      "prop_state",
      "prop_postcode",
      "prop_lotplan",
      "prop_legal",
      "prop_title",
      "prop_parish",
      "prop_lga",
      "prop_owner",
      "prop_occupant",
    ],
  },
  {
    id: "sec-statutory",
    number: "3.",
    title: "Statutory Information",
    fields: [
      "prop_lga",
      "prop_offered",
      "prop_offer_details",
      "prop_contract_price",
      "prop_contract_date",
      "prop_seller_owner",
      "prop_assistance",
      "prop_assistance_details",
    ],
  },
  {
    id: "sec-planning",
    number: "4.",
    title: "Town Planning",
    fields: ["prop_zoning", "prop_zoning_desc", "prop_zoning_comp", "prop_hbu"],
  },
  {
    id: "sec-location",
    number: "5.",
    title: "Location",
    fields: [
      "nbhd_description",
      "nbhd_market_conditions",
      "nbhd_location",
      "nbhd_builtup",
      "nbhd_growth",
      "nbhd_values",
      "nbhd_demand",
      "nbhd_marketing",
      "nbhd_price_range",
      "nbhd_age",
      "offsite_road_type",
      "offsite_road_surface",
      "offsite_carriageway",
      "offsite_kerb",
      "offsite_footpaths",
    ],
  },
  {
    id: "sec-site",
    number: "6.",
    title: "Site Details",
    fields: [
      "prop_sitearea",
      "prop_areaunit",
      "prop_dimensions",
      "prop_shape",
      "topo",
      "land",
      "va",
      "fence",
      "exc",
      "prop_view",
      "svc_water_type",
      "svc_sewer_type",
      "svc_elec_type",
      "svc_storm_type",
      "svc_tel_type",
      "prop_flood",
    ],
  },
  {
    id: "sec-improvements",
    number: "7.",
    title: "Improvements",
    fields: [
      "imp_design",
      "imp_lowset",
      "imp_storeys",
      "imp_yearbuilt",
      "imp_effage",
      "imp_quality",
      "imp_gla",
      "ext",
      "rc",
      "rd",
      "foundations",
      "floor_structure",
      "flr",
      "overall_cond",
    ],
    narrativeKey: "improvements",
  },
  {
    id: "sec-accommodation",
    number: "8.",
    title: "Accommodation – Fixtures and Fittings",
    fields: ["imp_rooms", "imp_beds", "imp_baths", "accom", "park", "anc"],
    narrativeKey: "accommodation",
  },
  {
    id: "sec-other",
    number: "9.",
    title: "Improvements – Other Valuation Issues",
    fields: ["other_notes", "defects_notes", "overall_site_cond"],
  },
  {
    id: "sec-environmental",
    number: "10.",
    title: "Environmental Matters",
    fields: ["prop_flood", "prop_flood_map", "prop_adverse_site"],
  },
  { id: "sec-basis", number: "11.", title: "Basis of Valuation", always: true },
  { id: "sec-sales", number: "12.", title: "Sales Evidence", requireSales: true },
  {
    id: "sec-remarks",
    number: "13.",
    title: "Remarks",
    narrativeKey: "remarks",
    fields: ["other_notes", "defects_notes"],
  },
  { id: "sec-limitations", number: "14.", title: "Limitations", always: true },
  { id: "sec-assumptions", number: "15.", title: "Critical Assumptions", always: true },
  { id: "sec-valuation", number: "16.", title: "Valuation Statement", always: true },
];

function sectionHasContent(
  entry: TocEntry,
  draft: ReportDraft,
): boolean {
  if (entry.always) return true;
  if (entry.requireSales) {
    return draft.sales.some(
      (s) =>
        s.address.trim() ||
        s.saleDate.trim() ||
        s.salePrice.trim() ||
        s.landArea.trim() ||
        s.comments.trim() ||
        Boolean(s.narrative?.trim()),
    );
  }
  if (entry.narrativeKey) {
    const text = draft.narrative[entry.narrativeKey];
    if (typeof text === "string" && text.trim()) return true;
  }
  if (entry.fields?.length) {
    if (entry.fields.some((name) => hasValue(draft.values[name]))) return true;
  }
  // Meta dates count for instructions when values are sparse
  if (entry.id === "sec-instructions") {
    if (draft.reportMeta.inspectionDate.trim() || draft.reportMeta.valueDate.trim()) {
      return true;
    }
  }
  return false;
}

function TableOfContents({ draft }: { draft: ReportDraft }) {
  const entries = TOC_ENTRIES.filter((e) => sectionHasContent(e, draft));
  if (entries.length === 0) return null;

  return (
    <nav id="table-of-contents" className="report-toc mt-10" aria-label="Table of contents">
      <h2 className="report-h2 border-b border-[var(--rule)] pb-1 uppercase tracking-wide">
        Table of Contents
      </h2>
      <ol className="mt-4 space-y-1.5 text-[0.9375rem]">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-2">
            <span className="w-8 shrink-0 tabular-nums text-[var(--page-foreground)]/70">
              {entry.number}
            </span>
            <a
              href={`#${entry.id}`}
              className="flex-1 border-b border-dotted border-[var(--rule)] pb-0.5 text-[var(--page-foreground)] no-underline transition-colors hover:text-primary hover:border-primary"
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <h3 className="report-h2 text-[0.9375rem] font-semibold">{title}</h3>
      <div className="mt-1 space-y-2">{children}</div>
    </div>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-justify">{children}</p>;
}

function Prose({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      {text
        .split(/\n{1,}/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, i) => (
          <p key={i} className="text-justify">
            {line}
          </p>
        ))}
    </>
  );
}

/** Two-column fact rows. Empty fields are dropped entirely. */
function Facts({
  values,
  fields,
  extra = [],
}: {
  values: ReportDraft["values"];
  fields: string[];
  extra?: { label: string; value: string }[];
}) {
  const rows = [
    ...pick(values, fields).map((r) => ({ label: r.label, value: r.value })),
    ...extra.filter((r) => r.value.trim()),
  ];
  if (rows.length === 0) return null;
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((row, i) => (
          <tr key={`${row.label}-${i}`} className="align-top">
            <th className="w-[38%] border-b border-[var(--rule)]/60 py-1.5 pr-4 text-left font-normal text-[var(--page-foreground)]/70">

              {row.label}
            </th>
            <td className="border-b border-[var(--rule)]/60 py-1.5 whitespace-pre-line">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- report ---------- */


/** Map/photo slot inline in body — renders nothing when empty. */
function InlineMap({
  photos,
  slot,
  caption,
}: {
  photos: ReportDraft["photos"];
  slot: string;
  caption?: string;
}) {
  const photo = photos.find((p) => p.slot === slot && p.url);
  if (!photo?.url) return null;
  return (
    <figure className="my-4 break-inside-avoid">
      <img
        src={photo.url}
        alt={caption || photo.caption || "Map"}
        className="mx-auto max-h-[22rem] w-auto max-w-full border border-[var(--rule)] object-contain"
        loading="eager"
        decoding="sync"
      />
      {(caption || photo.caption) ? (
        <figcaption className="mt-1.5 text-center text-xs text-[var(--page-foreground)]/80">
          {caption || photo.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ReportPreview({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;
  const reportType = getReportTypeConfig(get(v, "prop_assignment"));

  const addressLine = [
    get(v, "prop_address"),
    [get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const siteArea = joinValues(v, ["prop_sitearea", "prop_areaunit"], "");
  const annexurePhotos = [
    ...PHOTO_SLOTS.map(({ slot, label }) => {
      const found = draft.photos.find((p) => p.slot === slot && p.url);
      return found ? { ...found, caption: found.caption || label } : null;
    }).filter(Boolean),
    ...draft.photos.filter((p) => p.slot === null && p.url),
  ] as typeof draft.photos;

  const bodyMapSlotSet = new Set([
    "map_location",
    "map_aerial",
    "map_site_dimensions",
    "map_flood",
    "map_bushfire",
    "map_overlays",
    "map_landslide",
  ]);
  // Annexure only lists maps that are not already embedded in sections 5–6
  const mapPhotos = MAP_SLOTS.map(({ slot, label }) => {
    if (bodyMapSlotSet.has(slot)) return null;
    const found = draft.photos.find((p) => p.slot === slot && p.url);
    return found ? { ...found, caption: found.caption || label } : null;
  }).filter(Boolean) as typeof draft.photos;

  const frontPhoto = draft.photos.find((p) => p.slot === "front" && p.url);

  return (
    <article
      id="report-preview-sheet"
      className={
        "report-sheet mx-auto max-w-[52rem] px-8 py-10 shadow-sm sm:px-12 sm:py-14" +
        (isPhilReportType(reportType.id) ? " report-type-phil" : "")
      }
    >
      {/* ---- Cover ---- */}
      {isPhilReportType(reportType.id) ? (
        /* Sample: page 1 photo, page 2 summary — separate top-level blocks so print breaks work */
        <>
          <div id="report-cover" className="report-cover phil-photo-page">
            <header className="flex items-start justify-between gap-4 text-left">
              <img
                src="/ppv-logo.jpeg"
                alt="Peterson Property Valuations"
                className="h-20 w-auto object-contain"
              />
              <div className="text-right text-[10px] leading-snug text-[var(--phil-green)]">
                <p className="font-semibold">Real Estate Valuers</p>
                <p>Phillip R Peterson, AVI, Certified Practicing Valuer</p>
                <p>Registered Valuer No. 1083</p>
              </div>
            </header>

            {frontPhoto ? (
              <div className="phil-front-photo mt-3 flex justify-center">
                <img
                  src={frontPhoto.url}
                  alt="Subject property"
                  className="phil-front-photo-img w-full max-w-[24rem] object-contain"
                />
              </div>
            ) : (
              <div className="phil-front-photo mt-3 flex h-36 items-center justify-center border border-dashed border-[var(--rule)] text-sm text-[var(--page-foreground)]/50">
                Front photo not set
              </div>
            )}

            <div className="phil-cover-title mt-4 text-center">
              <p className="font-serif text-lg font-bold uppercase leading-snug tracking-wide">
                Report and Valuation
              </p>
              {m.valueDate ? (
                <p className="font-serif text-lg font-bold uppercase leading-snug">
                  Dated {m.valueDate}
                </p>
              ) : null}
              <p className="font-serif text-lg font-bold uppercase leading-snug">
                Residential Dwelling
              </p>
              <p className="font-serif text-lg font-bold uppercase leading-snug">
                Situated at
              </p>
              {addressLine ? (
                <p className="font-serif text-lg font-bold uppercase leading-snug">
                  {addressLine}
                </p>
              ) : null}
            </div>

            <div className="phil-gold-rule mt-4" />
          </div>

          <div className="phil-summary-page report-cover">
            <h1 className="report-h1 text-center text-xl text-[var(--phil-green)]">
              Valuation Summary
            </h1>

            <div className="mt-6">
              <Facts
                values={v}
                fields={[]}
                extra={[
                  { label: "PROPERTY ADDRESS", value: addressLine },
                  {
                    label: "BRIEF DESCRIPTION",
                    value: [
                      get(v, "imp_design") || "A residential dwelling",
                      siteArea ? `on a ${siteArea} lot.` : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  },
                  { label: "REGISTERED OWNER", value: get(v, "prop_owner") },
                  {
                    label: "REAL PROPERTY DESCRIPTION",
                    value: get(v, "prop_lotplan"),
                  },
                  { label: "LAND AREA", value: siteArea },
                  { label: "ZONING", value: get(v, "prop_zoning") },
                  { label: "INSTRUCTIONS", value: get(v, "prop_owner") },
                  {
                    label: "PURPOSE OF VALUATION",
                    value: reportType.defaultPurpose,
                  },
                ].filter((r) => r.value && String(r.value).trim())}
              />
            </div>

            <div className="mt-8 border-y-2 border-[var(--page-foreground)]/80 py-6 text-center">
              <p className="text-sm uppercase tracking-wide text-[var(--page-foreground)]/70">
                VALUATION STATEMENT
              </p>
              {reportType.valuationDisplay === "see-remarks" ? (
                <p className="mt-3 font-serif text-xl font-bold uppercase tracking-wide">
                  See remarks in this report
                </p>
              ) : (
                <p className="mt-3 font-serif text-2xl font-bold">
                  {m.valueAmount ? `$${m.valueAmount}` : "—"}
                </p>
              )}
              {m.valueDate ? (
                <p className="mt-1 text-sm">as at {m.valueDate}</p>
              ) : null}
            </div>

            <div className="mt-6 text-center">
              <p className="font-semibold text-[var(--phil-green)]">
                {m.firmName ||
                  get(v, "insp_firm") ||
                  "Peterson Property Valuations Pty Ltd"}
              </p>
              <p className="text-sm text-[var(--phil-green)]">Real Estate Valuers</p>
            </div>

            <div className="report-signature mt-8">
              <div className="h-14 w-56 border-b border-[var(--page-foreground)]/70" />
              <p className="mt-2 font-semibold">
                {m.valuerName || get(v, "insp_valuer")}
              </p>
              {get(v, "sign_member") ? (
                <p className="text-sm">{get(v, "sign_member")}</p>
              ) : null}
              {m.valueDate ? <p className="mt-1 text-sm">{m.valueDate}</p> : null}
            </div>

            <div className="mt-8 border-t border-[var(--rule)] pt-4">
              <p className="text-sm italic text-[var(--page-foreground)]/75">
                {BOILERPLATE.summaryDisclaimer}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div id="report-cover" className="report-cover">
          <header className="text-center">
            <img
              src="/ppv-logo.jpeg"
              alt="Peterson Property Valuations"
              className="mx-auto h-24 w-auto object-contain"
            />
            <h1 className="report-h1 mt-6 text-2xl">Valuation Summary</h1>
            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[var(--page-foreground)]/70">
              {reportType.coverSubtitle}
            </p>
          </header>

          <div className="mt-8 border-y-2 border-[var(--page-foreground)]/80 py-6 text-center">
            {addressLine ? (
              <p className="font-serif text-xl font-bold uppercase tracking-wide">
                {addressLine}
              </p>
            ) : null}
            {get(v, "prop_lotplan") ? (
              <p className="mt-1 text-sm">{get(v, "prop_lotplan")}</p>
            ) : null}
            <p className="mt-5 font-serif text-2xl font-bold">
              Market Value: {m.valueAmount ? `$${m.valueAmount}` : "—"}
            </p>
            {m.valueDate ? (
              <p className="mt-1 text-sm">As at {m.valueDate}</p>
            ) : null}
          </div>

          <div className="mt-6">
            <Facts
              values={v}
              fields={["prop_assignment", "prop_owner", "prop_rights"]}
              extra={[
                { label: "Date of inspection", value: m.inspectionDate },
                { label: "Date of valuation", value: m.valueDate },
                { label: "Valuer", value: m.valuerName },
                { label: "Prepared by", value: m.firmName },
              ]}
            />
          </div>

          <Prose text={draft.narrative.brief} />

          <div className="mt-8 border-t border-[var(--rule)] pt-6">
            <p className="text-sm italic text-[var(--page-foreground)]/75">
              {BOILERPLATE.summaryDisclaimer}
            </p>
          </div>

          <div className="report-signature mt-10">
            <div className="h-14 w-56 border-b border-[var(--page-foreground)]/70" />
            <p className="mt-2 font-semibold">
              {m.valuerName || get(v, "insp_valuer")}
            </p>
            {get(v, "sign_member") ? (
              <p className="text-sm">{get(v, "sign_member")}</p>
            ) : null}
            <p className="text-sm">{m.firmName || get(v, "insp_firm")}</p>
            {m.valueDate ? <p className="mt-1 text-sm">{m.valueDate}</p> : null}
          </div>
        </div>
      )}
      <TableOfContents draft={draft} />

      {/* ---- 1. Instructions & purpose ---- */}
      {isPhilReportType(reportType.id) ? (
        <Section id="sec-instructions" number="1." title="Instructions and Purpose">
          <Sub title="1.1  Instructions">
            <Para>{get(v, "prop_owner") || "As instructed."}</Para>
          </Sub>
          <Sub title="1.2  Purpose of Valuation">
            <Prose text={reportType.defaultPurpose} />
          </Sub>
          <Sub title="1.3  Nature of Interest to be Valued">
            <Para>{BOILERPLATE.natureOfInterest}</Para>
          </Sub>
          <Sub title="1.4  Date of Inspection">
            <Para>{m.inspectionDate || "—"}</Para>
          </Sub>
          <Sub title="1.5  Date of Valuation">
            <Para>{m.valueDate || "—"}</Para>
          </Sub>
          <Sub title="1.6  Basis of Valuation">
            <Para>{BOILERPLATE.basisOfValuation}</Para>
          </Sub>
          <Sub title="1.7  Market Value Definition">
            <Para>{BOILERPLATE.marketValueDefinition}</Para>
          </Sub>
          <Sub title="1.8  Highest and Best Use">
            <Para>{BOILERPLATE.highestAndBestUse}</Para>
          </Sub>
          <Sub title="1.9  Assumptions and Limitations">
            <Para>{BOILERPLATE.assumptionsAndLimitations}</Para>
          </Sub>
        </Section>
      ) : (
        <Section id="sec-instructions" number="1." title="Instructions and Purpose of Valuation">
          <Facts
            values={v}
            fields={["prop_assignment", "prop_rights"]}
            extra={[
              { label: "Date of inspection", value: m.inspectionDate },
              { label: "Date of valuation", value: m.valueDate },
            ]}
          />
          <Para>{BOILERPLATE.natureOfInterest}</Para>
        </Section>
      )}

      {/* ---- 2. Property details ---- */}
      <Section id="sec-property" number="2." title="Property Details">
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="2.1  Real Property Description">
              <Para>{[get(v, "prop_lotplan"), get(v, "prop_lga")].filter(Boolean).join("  ") || "—"}</Para>
            </Sub>
            <Sub title="2.2  Land Area">
              <Para>{siteArea || "—"}</Para>
            </Sub>
            <Sub title="2.3  Registered Owner">
              <Para>{get(v, "prop_owner") || "—"}</Para>
            </Sub>
          </>
        ) : (
          <Facts
            values={v}
            fields={[
              "prop_address",
              "prop_suburb",
              "prop_state",
              "prop_postcode",
              "prop_lotplan",
              "prop_legal",
              "prop_title",
              "prop_parish",
              "prop_lga",
              "prop_owner",
              "prop_occupant",
            ]}
          />
        )}
      </Section>

      {/* ---- 3. Statutory ---- */}
      <Section id="sec-statutory" number="3." title="Statutory Information">
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="3.1  Local Authority">
              <Para>{get(v, "prop_lga") || "Sunshine Coast Council"}</Para>
            </Sub>
            <Sub title="3.2  Statutory Valuation">
              <Para>
                {[get(v, "prop_site_value"), get(v, "prop_sv_date")]
                  .filter(Boolean)
                  .join(" — ") || "Site value as assessed by the local authority."}
              </Para>
            </Sub>
          </>
        ) : (
          <Facts
            values={v}
            fields={[
              "prop_lga",
              "prop_offered",
              "prop_offer_details",
              "prop_contract_price",
              "prop_contract_date",
              "prop_seller_owner",
              "prop_assistance",
              "prop_assistance_details",
            ]}
          />
        )}
      </Section>

      {/* ---- 4. Town planning ---- */}
      <Section id="sec-planning" number="4." title="Town Planning">
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="4.1  Current Zone">
              <Para>{get(v, "prop_zoning") || "—"}</Para>
            </Sub>
            <Sub title="4.2  Town Planning Consent">
              <Para>
                The current use of the property is an "As of Right" use under the applicable
                planning scheme.
              </Para>
            </Sub>
          </>
        ) : (
          <>
            <Facts
              values={v}
              fields={["prop_zoning", "prop_zoning_desc", "prop_zoning_comp", "prop_hbu"]}
            />
            <Para>{BOILERPLATE.townPlanningConsent}</Para>
            <Sub title="Development potential">
              <Para>{BOILERPLATE.developmentPotential}</Para>
            </Sub>
          </>
        )}
      </Section>

      {/* ---- 5. Location ---- */}
      <Section
        id="sec-location"
        number="5."
        title={isPhilReportType(reportType.id) ? "Location" : "Location and Neighbourhood"}
      >
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="5.1  Description of Neighbourhood">
              <Para>
                {draft.narrative.location?.trim() ||
                  get(v, "nbhd_description") ||
                  "—"}
              </Para>
            </Sub>
            <Sub title="5.2  Property Location">
              <Para>
                {addressLine
                  ? `The property is located at ${addressLine}.`
                  : "—"}
              </Para>
              <InlineMap photos={draft.photos} slot="map_location" caption="Property location" />
            </Sub>
            <Sub title="5.3  Transport Patterns">
              <Para>
                {[get(v, "offsite_road_type"), get(v, "offsite_road_surface")]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </Para>
            </Sub>
          </>
        ) : (
          <>
            <Prose
              text={
                draft.narrative.location?.trim() || get(v, "nbhd_description") || ""
              }
            />
            <Prose text={get(v, "nbhd_market_conditions")} />
            <Facts
              values={v}
              fields={[
                "nbhd_location",
                "nbhd_builtup",
                "nbhd_growth",
                "nbhd_values",
                "nbhd_demand",
                "nbhd_marketing",
                "nbhd_price_range",
                "nbhd_age",
              ]}
            />
            <Sub title="Property location map">
              <InlineMap photos={draft.photos} slot="map_location" caption="Property location" />
            </Sub>
            <Sub title="Off-site improvements">
              <Facts
                values={v}
                fields={[
                  "offsite_road_type",
                  "offsite_road_surface",
                  "offsite_carriageway",
                  "offsite_kerb",
                  "offsite_footpaths",
                  "offsite_verge",
                  "offsite_lighting",
                  "offsite_drainage",
                ]}
              />
            </Sub>
          </>
        )}
      </Section>

      {/* ---- 6. Site ---- */}
      <Section id="sec-site" number="6." title="Site Details">
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="6.1  Physical Description">
              <Para>
                {[
                  get(v, "prop_shape"),
                  get(v, "topo"),
                  get(v, "prop_dimensions"),
                  get(v, "prop_orientation") && `Orientation ${get(v, "prop_orientation")}`,
                ]
                  .filter(Boolean)
                  .join(". ") || "—"}
              </Para>
              <InlineMap
                photos={draft.photos}
                slot="map_aerial"
                caption="Aerial view of subject site"
              />
              <InlineMap
                photos={draft.photos}
                slot="map_site_dimensions"
                caption="Site dimensions"
              />
            </Sub>
            <Sub title="6.2  Services/Amenities">
              <Para>
                {[
                  get(v, "svc_water_type") && `Water: ${get(v, "svc_water_type")}`,
                  get(v, "svc_sewer_type") && `Sewerage: ${get(v, "svc_sewer_type")}`,
                  get(v, "svc_elec_type") && `Electricity: ${get(v, "svc_elec_type")}`,
                  get(v, "svc_tel_type") && `Telephone: ${get(v, "svc_tel_type")}`,
                ]
                  .filter(Boolean)
                  .join(". ") || "—"}
              </Para>
            </Sub>
            <Sub title="6.3  Flood Inquiry">
              <Para>
                {get(v, "prop_flood") === "Yes"
                  ? `The property is subject to flood hazard${get(v, "prop_flood_map") ? ` (${get(v, "prop_flood_map")})` : ""}.`
                  : get(v, "prop_flood") === "No"
                    ? "The property is not subject to flood."
                    : get(v, "prop_flood") || "—"}
              </Para>
              <InlineMap photos={draft.photos} slot="map_flood" caption="Flood hazard map" />
            </Sub>
            <Sub title="6.4  Bushfire Hazard">
              <Para>
                {draft.photos.some((p) => p.slot === "map_bushfire" && p.url)
                  ? "See bushfire hazard map below."
                  : get(v, "prop_adverse_site")?.toLowerCase().includes("bushfire")
                    ? get(v, "prop_adverse_site")
                    : "See attached bushfire mapping if applicable."}
              </Para>
              <InlineMap
                photos={draft.photos}
                slot="map_bushfire"
                caption="Bushfire hazard map"
              />
            </Sub>
            {(() => {
              const overlays = parseOverlayList(get(v, "prop_adverse_site"));
              if (overlays.length === 0) {
                return (
                  <Sub title="6.5  Overlays">
                    <Para>
                      {draft.photos.some((p) => p.slot === "map_overlays" && p.url)
                        ? "See overlay map below."
                        : "No planning overlays recorded for the subject."}
                    </Para>
                    <InlineMap
                      photos={draft.photos}
                      slot="map_overlays"
                      caption="Planning overlays"
                    />
                    <InlineMap
                      photos={draft.photos}
                      slot="map_landslide"
                      caption="Landslide hazard map"
                    />
                  </Sub>
                );
              }
              return (
                <>
                  {overlays.map((name, i) => (
                    <Sub key={name} title={`${overlaySectionNumber(i)}  ${name}`}>
                      <Para>
                        {`The property is subject to ${name}.`}
                      </Para>
                      {i === 0 ? (
                        <InlineMap
                          photos={draft.photos}
                          slot="map_overlays"
                          caption="Planning overlays"
                        />
                      ) : null}
                    </Sub>
                  ))}
                  {draft.photos.some((p) => p.slot === "map_landslide" && p.url) ? (
                    <Sub
                      title={`${overlaySectionNumber(overlays.length)}  Landslide Hazard`}
                    >
                      <Para>See landslide hazard map below.</Para>
                      <InlineMap
                        photos={draft.photos}
                        slot="map_landslide"
                        caption="Landslide hazard map"
                      />
                    </Sub>
                  ) : null}
                </>
              );
            })()}
          </>
        ) : (
          <>
            <Facts
              values={v}
              fields={["prop_dimensions", "prop_orientation", "prop_shape", "topo", "land", "va", "fence", "exc", "prop_view"]}
              extra={siteArea ? [{ label: labelFor("prop_sitearea"), value: siteArea }] : []}
            />
            <Sub title="Services">
              <Facts
                values={v}
                fields={[
                  "svc_water_type",
                  "svc_sewer_type",
                  "svc_elec_type",
                  "svc_storm_type",
                  "svc_tel_type",
                  "svc_internet_type",
                  "svc_gas_type",
                ]}
              />
            </Sub>
            <Sub title="Aerial / site plan">
              <InlineMap
                photos={draft.photos}
                slot="map_aerial"
                caption="Aerial view of subject site"
              />
              <InlineMap
                photos={draft.photos}
                slot="map_site_dimensions"
                caption="Site dimensions"
              />
            </Sub>
            <Sub title="Flood Inquiry">
              <Para>
                {get(v, "prop_flood") === "Yes"
                  ? `The property is subject to flood hazard${get(v, "prop_flood_map") ? ` (${get(v, "prop_flood_map")})` : ""}.`
                  : get(v, "prop_flood") === "No"
                    ? "The property is not subject to flood."
                    : get(v, "prop_flood") || "—"}
              </Para>
              <InlineMap photos={draft.photos} slot="map_flood" caption="Flood hazard map" />
            </Sub>
            <Sub title="Bushfire Hazard">
              <InlineMap
                photos={draft.photos}
                slot="map_bushfire"
                caption="Bushfire hazard map"
              />
            </Sub>
            {(() => {
              const overlays = parseOverlayList(get(v, "prop_adverse_site"));
              if (overlays.length === 0) {
                return (
                  <Sub title="Overlays / other hazards">
                    <Para>—</Para>
                    <InlineMap
                      photos={draft.photos}
                      slot="map_overlays"
                      caption="Planning overlays"
                    />
                    <InlineMap
                      photos={draft.photos}
                      slot="map_landslide"
                      caption="Landslide hazard map"
                    />
                  </Sub>
                );
              }
              return (
                <>
                  {overlays.map((name, i) => (
                    <Sub key={name} title={name}>
                      <Para>{`The property is subject to ${name}.`}</Para>
                      {i === 0 ? (
                        <InlineMap
                          photos={draft.photos}
                          slot="map_overlays"
                          caption="Planning overlays"
                        />
                      ) : null}
                    </Sub>
                  ))}
                  <InlineMap
                    photos={draft.photos}
                    slot="map_landslide"
                    caption="Landslide hazard map"
                  />
                </>
              );
            })()}
            <Sub title="Encroachments">
              <Para>{BOILERPLATE.encroachments}</Para>
            </Sub>
          </>
        )}
      </Section>

      {/* ---- 7. Improvements ---- */}
      <Section id="sec-improvements" number="7." title="Improvements">
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="7.1  General Description">
              <Para>
                {(draft.narrative.improvements || "").trim().split("\n")[0] ||
                  get(v, "imp_design") ||
                  "A residential dwelling."}
              </Para>
            </Sub>
            <Sub title="7.2  Floor Areas (approx)">
              <Facts values={v} fields={["imp_gla"]} />
            </Sub>
            <Sub title="7.3  General Construction">
              <Facts
                values={v}
                fields={["foundations", "floor_structure", "ext", "il", "ceil", "rc"]}
              />
            </Sub>
          </>
        ) : (
          <>

        <Sub title="7.1  General description">
          <Prose text={draft.narrative.improvements} />
        </Sub>
        <Facts
          values={v}
          fields={[
            "imp_design",
            "imp_storeys",
            "imp_yearbuilt",
            "imp_effage",
            "imp_quality",
            "ext",
            "rc",
            "rd",
            "foundations",
            "floor_structure",
            "flr",
            "il",
            "ceil",
            "vent",
            "imp_gla",
            "imp_add_features",
          ]}
        />
        <Sub title="7.2  Kitchen and bathrooms">
          <Prose text={get(v, "kit_overall_notes")} />
          <Prose text={get(v, "bath_overall_notes")} />
          <Facts
            values={v}
            fields={[
              "kit_bench_type",
              "kit_cab_type",
              "kit_splash_type",
              "bath_vanity_type",
              "bath_tiles_type",
              "bath_tapware_type",
            ]}
          />
        </Sub>
        <Sub title="7.3  Condition of improvements">
          <Facts values={v} fields={["overall_cond", "overall_site_cond"]} />
          <Para>{BOILERPLATE.conditionOfImprovements}</Para>
        </Sub>
          </>
        )}
      </Section>

      {/* ---- 8. Accommodation ---- */}
      <Section id="sec-accommodation" number="8." title="Accommodation – Fixtures and Fittings">
        {isPhilReportType(reportType.id) ? (
          /* Samples: short prose only — rooms/beds/baths as brief facts, no outdoor areas */
          <>
            <Prose text={draft.narrative.accommodation} />
            <Facts
              values={v}
              fields={["imp_beds", "imp_baths"]}
            />
          </>
        ) : (
          <>
            <Prose text={draft.narrative.accommodation} />
            <Facts
              values={v}
              fields={["imp_rooms", "imp_beds", "imp_baths", "accom", "park", "anc"]}
            />
          </>
        )}
      </Section>

      {/* ---- 9. Other issues ---- */}
      <Section id="sec-other" number="9." title="Improvements – Other Valuation Issues">
        {isPhilReportType(reportType.id) ? (
          <>
            <Sub title="9.1  Encroachments">
              <Para>{BOILERPLATE.encroachments}</Para>
            </Sub>
            <Sub title="9.2  Condition of Improvements">
              <Prose text={get(v, "defects_notes") || get(v, "other_notes") || ""} />
              <Para>
                Our assessment of the condition of the improvements was based on visual
                inspection. No liability is assumed for the soundness of the structure
                since no engineering tests were made. This report is a valuation report
                and not a structural survey.
              </Para>
            </Sub>
            <Sub title="9.3  Development Potential">
              <Para>{BOILERPLATE.developmentPotential}</Para>
            </Sub>
          </>
        ) : (
          <>
            <Prose text={get(v, "other_notes")} />
            <Prose text={get(v, "defects_notes")} />
            <Para>{BOILERPLATE.addedValue}</Para>
          </>
        )}
      </Section>

      {/* ---- 10. Environmental ---- */}
      <Section id="sec-environmental" number="10." title="Environmental Matters">
        <Facts values={v} fields={["prop_flood", "prop_flood_map", "prop_adverse_site"]} />
        <Para>{BOILERPLATE.contaminatedLand}</Para>
        <Para>{BOILERPLATE.heritageListing}</Para>
        <Para>{BOILERPLATE.vegetationProtection}</Para>
        <Para>{BOILERPLATE.asbestos}</Para>
      </Section>

      {/* ---- 11. Basis of valuation ---- */}
      <Section id="sec-basis" number="11." title="Basis of Valuation">
        <Para>{BOILERPLATE.basisOfValuation}</Para>
        <Sub title="Market value">
          <Para>{BOILERPLATE.marketValueDefinition}</Para>
        </Sub>
        <Sub title="Highest and best use">
          <Para>{BOILERPLATE.highestAndBestUse}</Para>
        </Sub>
        <Sub title="Method of valuation">
          <Para>{BOILERPLATE.directComparisonIntro}</Para>
          {BOILERPLATE.directComparisonBody.map((line) => (
            <Para key={line}>{line}</Para>
          ))}
          <ul className="ml-6 list-disc space-y-0.5">
            {BOILERPLATE.directComparisonFactors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Para>{BOILERPLATE.directComparisonClose}</Para>
        </Sub>
      </Section>

      {/* ---- 12. Sales evidence ---- */}
      <Section id="sec-sales" number="12." title="Sales Evidence">
        {draft.sales.length === 0 ? (
          <Para>No sales evidence has been recorded.</Para>
        ) : (
          <div className="space-y-6">
            {draft.reportMeta.salesMapUrl ? (
              <div className="sales-map">
                <p className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--page-foreground)]/70">
                  Sales map
                </p>
                <img
                  src={draft.reportMeta.salesMapUrl}
                  alt="Comparable sales map"
                  className="mx-auto max-h-[28rem] w-auto max-w-full border border-[var(--rule)] object-contain"
                />
              </div>
            ) : null}

            <table className="w-full border-collapse text-[0.8125rem]">
              <thead>
                <tr>
                  {["Address", "Sale date", "Sale price", "Land area", "Comments"].map(
                    (h) => (
                      <th
                        key={h}
                        className="border border-[var(--rule)] bg-[var(--page-foreground)]/5 px-2 py-1.5 text-left font-semibold"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {draft.sales.map((s, idx) => (
                  <tr key={s.id} className="align-top">
                    <td className="border border-[var(--rule)] px-2 py-1.5">
                      <div>{s.address}</div>
                      {s.photoUrl ? (
                        <img
                          src={s.photoUrl}
                          alt={`Comparable ${idx + 1}`}
                          className="mt-1.5 h-12 w-auto max-w-[5.5rem] border border-[var(--rule)] object-cover"
                        />
                      ) : null}
                    </td>
                    <td className="border border-[var(--rule)] px-2 py-1.5 whitespace-nowrap">
                      {s.saleDate}
                    </td>
                    <td className="border border-[var(--rule)] px-2 py-1.5 whitespace-nowrap">
                      {s.salePrice}
                    </td>
                    <td className="border border-[var(--rule)] px-2 py-1.5 whitespace-nowrap">
                      {s.landArea}
                    </td>
                    <td className="border border-[var(--rule)] px-2 py-1.5 text-left normal-case tracking-normal">
                      {cleanSaleProse(s.narrative?.trim() || s.comments || "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ---- 13. Remarks ---- */}
      <Section id="sec-remarks" number="13." title="Remarks">
        <Prose text={draft.narrative.remarks || BOILERPLATE.remarksDefault} />
      </Section>

      {/* ---- 14. Limitations ---- */}
      <Section id="sec-limitations" number="14." title="Limitations">
        <Para>{BOILERPLATE.assumptionsAndLimitations}</Para>
        {BOILERPLATE.limitations.map((l) => (
          <Para key={l}>{l}</Para>
        ))}
      </Section>

      {/* ---- 15. Critical assumptions ---- */}
      <Section id="sec-assumptions" number="15." title="Critical Assumptions">
        <Para>{BOILERPLATE.criticalAssumptionsIntro}</Para>
        <ol className="ml-6 list-decimal space-y-2">
          {BOILERPLATE.criticalAssumptions.map((a) => (
            <li key={a} className="text-justify">
              {a}
            </li>
          ))}
        </ol>
        <Para>{BOILERPLATE.criticalAssumptionsClose}</Para>
      </Section>

      {/* ---- 16. Valuation statement ---- */}
      <Section id="sec-valuation" number="16." title="Valuation Statement">
        {reportType.valuationDisplay === "see-remarks" ? (
          <>
            <Para>
              Having regard to the foregoing, the assessed values and apportionments for the
              subject property
              {addressLine ? `, ${addressLine},` : ""} as at{" "}
              {m.valueDate || "the date of valuation"} are set out in the Remarks section of
              this report.
            </Para>
            <p className="py-3 text-center font-serif text-lg font-bold uppercase tracking-wide">
              See remarks in this report
            </p>
          </>
        ) : (
          <>
            <Para>
              Having regard to the foregoing, I am of the opinion that the market value of the
              unencumbered fee simple interest in the subject property
              {addressLine ? `, ${addressLine},` : ""} as at{" "}
              {m.valueDate || "the date of valuation"} is:
            </Para>
            {m.valueAmount ? (
              <p className="py-3 text-center font-serif text-xl font-bold">
                ${m.valueAmount}
              </p>
            ) : null}
          </>
        )}
        <div className="mt-8">
          <div className="h-14 w-56 border-b border-[var(--page-foreground)]/70" />
          <p className="mt-2 font-semibold">{m.valuerName || get(v, "insp_valuer")}</p>
          {get(v, "sign_member") ? (
            <p className="text-sm">{get(v, "sign_member")}</p>
          ) : null}
          <p className="text-sm">{m.firmName || get(v, "insp_firm")}</p>
        </div>
        <div className="mt-6">
          {BOILERPLATE.annexures.map((a) => (
            <p key={a} className="text-sm">
              {a}
            </p>
          ))}
        </div>
      </Section>

      {/* ---- Photo annexure (only when images exist) ---- */}
      {annexurePhotos.length > 0 || draft.sales.some((s) => s.photoUrl) ? (
        <section id="report-annexure-photos" className="report-annexure mt-12">
          <h2 className="report-h1 text-center">Annexure 2 — Photographs</h2>
          <div className="mt-6 space-y-8">
            {annexurePhotos.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {annexurePhotos.map((photo) => (
                  <figure key={photo.id} className="report-photo-figure">
                    <img
                      src={photo.url}
                      alt={photo.caption || "Photograph"}
                      className="aspect-4/3 w-full border border-[var(--rule)] object-cover"
                      loading="eager"
                      decoding="sync"
                    />
                    <figcaption className="mt-1.5 text-center text-sm">
                      {photo.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}

            {draft.sales.some((s) => s.photoUrl) ? (
              <div className="space-y-6">
                <h3 className="text-center text-sm font-semibold uppercase tracking-wide">
                  Comparable sales — front elevations
                </h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {draft.sales.map((s, idx) =>
                    s.photoUrl ? (
                      <figure key={s.id} className="report-photo-figure break-inside-avoid">
                        <img
                          src={s.photoUrl}
                          alt={
                            s.address
                              ? `Comparable ${idx + 1} — ${s.address}`
                              : `Comparable ${idx + 1}`
                          }
                          className="w-full border border-[var(--rule)] object-contain"
                          loading="eager"
                          decoding="sync"
                        />
                        <figcaption className="mt-1.5 text-center text-sm font-medium">
                          Comparable {idx + 1}
                          {s.address ? ` — ${s.address}` : ""}
                        </figcaption>
                      </figure>
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ---- Maps annexure (only filled map slots) ---- */}
      {mapPhotos.length > 0 ? (
        <section id="report-annexure-maps" className="report-annexure mt-12">
          <h2 className="report-h1 text-center">Annexure 3 — Maps &amp; planning layers</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-1">
            {mapPhotos.map((photo) => (
              <figure key={photo.id} className="report-photo-figure break-inside-avoid">
                <img
                  src={photo.url}
                  alt={photo.caption || "Map"}
                  className="w-full border border-[var(--rule)] object-contain"
                  loading="eager"
                  decoding="sync"
                />
                <figcaption className="mt-1.5 text-center text-sm font-medium">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {get(v, "prop_place_based")?.trim() ? (
        <section id="report-annexure-place-based" className="report-annexure mt-12">
          <h2 className="report-h1 text-center">Annexure 4 — Place-based plans</h2>
          <div className="mt-6 space-y-3 text-sm leading-relaxed">
            {get(v, "prop_place_based")!
              .split(/\n+/)
              .map((para) => para.trim())
              .filter(Boolean)
              .map((para, i) => (
                <p key={i}>{para}</p>
              ))}
          </div>
          <InlineMap
            photos={draft.photos}
            slot="map_place_based"
            caption="Place-based plans map"
          />
        </section>
      ) : null}
    </article>
  );
}
