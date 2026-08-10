import { BOILERPLATE } from "@/lib/report/boilerplate";
import { get, joinValues, labelFor, pick } from "@/lib/report/schema";
import { PHOTO_SLOTS, type ReportDraft } from "@/lib/report/types";

/* ---------- primitives ---------- */

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="report-h2 border-b border-[var(--rule)] pb-1 uppercase tracking-wide">
        <span className="mr-3 tabular-nums">{number}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
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
            <td className="border-b border-[var(--rule)]/60 py-1.5">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- report ---------- */

export function ReportPreview({ draft }: { draft: ReportDraft }) {
  const v = draft.values;
  const m = draft.reportMeta;

  const addressLine = [
    get(v, "prop_address"),
    [get(v, "prop_suburb"), get(v, "prop_state"), get(v, "prop_postcode")]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const siteArea = joinValues(v, ["prop_sitearea", "prop_areaunit"], "");
  const slotPhotos = PHOTO_SLOTS.map(({ slot, label }) => {
    const found = draft.photos.find((p) => p.slot === slot);
    return found ?? { id: slot, slot, caption: label, url: "" };
  });
  const extraPhotos = draft.photos.filter((p) => p.slot === null);
  const annexurePhotos = [...slotPhotos, ...extraPhotos].filter((p) => p.url);

  return (
    <article className="report-sheet mx-auto max-w-[52rem] px-8 py-10 shadow-sm sm:px-12 sm:py-14">
      {/* ---- Cover / valuation summary ---- */}
      <header className="text-center">
        <img
          src="/ppv-logo.jpeg"
          alt="Peterson Property Valuations"
          className="mx-auto h-24 w-auto object-contain"
        />
        <h1 className="report-h1 mt-6 text-2xl">Valuation Summary</h1>

        <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[var(--page-foreground)]/70">
          Residential Valuation Report
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
        {m.valueAmount ? (
          <p className="mt-5 font-serif text-2xl font-bold">
            Market Value: ${m.valueAmount}
          </p>
        ) : null}
        {m.valueDate ? (
          <p className="mt-1 text-sm">As at {m.valueDate}</p>
        ) : null}
      </div>

      <div className="mt-6">
        <Facts
          values={v}
          fields={["prop_assignment", "insp_purpose", "prop_owner", "prop_rights"]}
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

      <div className="mt-10">
        <div className="h-14 w-56 border-b border-[var(--page-foreground)]/70" />
        <p className="mt-2 font-semibold">{m.valuerName || get(v, "insp_valuer")}</p>
        {get(v, "sign_member") ? (
          <p className="text-sm">{get(v, "sign_member")}</p>
        ) : null}
        <p className="text-sm">{m.firmName || get(v, "insp_firm")}</p>
        {m.valueDate ? <p className="mt-1 text-sm">{m.valueDate}</p> : null}
      </div>

      {/* ---- 1. Instructions & purpose ---- */}
      <Section number="1." title="Instructions and Purpose of Valuation">
        <Facts
          values={v}
          fields={["insp_purpose", "prop_assignment", "prop_rights"]}
          extra={[
            { label: "Date of inspection", value: m.inspectionDate },
            { label: "Date of valuation", value: m.valueDate },
          ]}
        />
        <Para>{BOILERPLATE.natureOfInterest}</Para>
      </Section>

      {/* ---- 2. Property details ---- */}
      <Section number="2." title="Property Details">
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
      </Section>

      {/* ---- 3. Statutory ---- */}
      <Section number="3." title="Statutory Details">
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
      </Section>

      {/* ---- 4. Town planning ---- */}
      <Section number="4." title="Town Planning">
        <Facts
          values={v}
          fields={["prop_zoning", "prop_zoning_desc", "prop_zoning_comp", "prop_hbu"]}
        />
        <Para>{BOILERPLATE.townPlanningConsent}</Para>
        <Sub title="Development potential">
          <Para>{BOILERPLATE.developmentPotential}</Para>
        </Sub>
      </Section>

      {/* ---- 5. Location ---- */}
      <Section number="5." title="Location and Neighbourhood">
        <Prose text={get(v, "nbhd_description")} />
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
      </Section>

      {/* ---- 6. Site ---- */}
      <Section number="6." title="Site Details">
        <Facts
          values={v}
          fields={["prop_dimensions", "prop_shape", "topo", "land", "va", "fence", "exc", "prop_view"]}
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
        <Sub title="Encroachments">
          <Para>{BOILERPLATE.encroachments}</Para>
        </Sub>
      </Section>

      {/* ---- 7. Improvements ---- */}
      <Section number="7." title="Improvements">
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
      </Section>

      {/* ---- 8. Accommodation ---- */}
      <Section number="8." title="Accommodation">
        <Prose text={draft.narrative.accommodation} />
        <Facts
          values={v}
          fields={["imp_rooms", "imp_beds", "imp_baths", "accom", "park", "anc"]}
        />
      </Section>

      {/* ---- 9. Other issues ---- */}
      <Section number="9." title="Other Issues">
        <Prose text={get(v, "other_notes")} />
        <Prose text={get(v, "defects_notes")} />
        <Para>{BOILERPLATE.addedValue}</Para>
      </Section>

      {/* ---- 10. Environmental ---- */}
      <Section number="10." title="Environmental Issues">
        <Facts values={v} fields={["prop_flood", "prop_flood_map", "prop_adverse_site"]} />
        <Para>{BOILERPLATE.contaminatedLand}</Para>
        <Para>{BOILERPLATE.heritageListing}</Para>
        <Para>{BOILERPLATE.vegetationProtection}</Para>
        <Para>{BOILERPLATE.asbestos}</Para>
      </Section>

      {/* ---- 11. Basis of valuation ---- */}
      <Section number="11." title="Basis of Valuation">
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
      <Section number="12." title="Sales Evidence">
        {draft.sales.length === 0 ? (
          <Para>No sales evidence has been recorded.</Para>
        ) : (
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
              {draft.sales.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="border border-[var(--rule)] px-2 py-1.5">{s.address}</td>
                  <td className="border border-[var(--rule)] px-2 py-1.5 whitespace-nowrap">
                    {s.saleDate}
                  </td>
                  <td className="border border-[var(--rule)] px-2 py-1.5 whitespace-nowrap">
                    {s.salePrice}
                  </td>
                  <td className="border border-[var(--rule)] px-2 py-1.5 whitespace-nowrap">
                    {s.landArea}
                  </td>
                  <td className="border border-[var(--rule)] px-2 py-1.5">{s.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ---- 13. Remarks ---- */}
      <Section number="13." title="Remarks">
        <Prose text={draft.narrative.remarks || BOILERPLATE.remarksDefault} />
      </Section>

      {/* ---- 14. Limitations ---- */}
      <Section number="14." title="Limitations">
        <Para>{BOILERPLATE.assumptionsAndLimitations}</Para>
        {BOILERPLATE.limitations.map((l) => (
          <Para key={l}>{l}</Para>
        ))}
      </Section>

      {/* ---- 15. Critical assumptions ---- */}
      <Section number="15." title="Critical Assumptions">
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
      <Section number="16." title="Valuation">
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

      {/* ---- Photo annexure ---- */}
      <section className="mt-12 break-before-page">
        <h2 className="report-h1 text-center">Annexure 2 — Photographs</h2>
        {annexurePhotos.length === 0 ? (
          <p className="mt-4 text-center text-sm italic text-[var(--page-foreground)]/70">
            No photographs have been attached.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {annexurePhotos.map((photo) => (
              <figure key={photo.id}>
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="aspect-4/3 w-full border border-[var(--rule)] object-cover"
                />
                <figcaption className="mt-1.5 text-center text-sm">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
