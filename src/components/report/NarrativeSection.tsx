import { Fragment, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import {
  generateNarrativeBlock,
  searchMarketFacts,
  searchNeighbourhoodFacts,
} from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import {
  buildExecutiveSummaryLead,
  buildPhilRemarks,
  generateNarrative,
  isPhilAssignment,
} from "@/lib/report/narrative";
import { australianiseSpelling } from "@/lib/report/australianEnglish";
import type { ReportNarrative } from "@/lib/report/types";
import {
  buildLocationFacts,
  locationFactsFromDraft,
  subjectCoordsFromPins,
} from "@/lib/narrative/locationFacts";
import { subjectAddressLine, type SalesMapPin } from "@/lib/maps/salesMapPins";
import { skipAiNarrativeBlock } from "@/lib/inspection/visibility";
import { isGoogleMapsConfigured, loadGoogleMapsKey } from "@/lib/maps/googleSettings";
import { fetchNearbyAmenities, fetchPlaceTextSearch, geocodeGoogleAddresses } from "@/lib/maps/maps.functions";
import { buildSubjectLocationMap } from "@/lib/maps/generateMaps";
import {
  claimDistanceKm,
  measuredClaim,
  mergeNbhdClaims,
  ensureAcceptedFactsInProse,
  MARKET_ASSIST,
  NBHD_CLAIM_GROUPS,
  neighbourhoodAssistEnabled,
  narrativePrints,
  parseNbhdClaims,
  isShawnReportAssignment,
  type MarketScale,
  type NbhdClaim,
} from "@/lib/narrative/neighbourhoodAssist";
import {
  collectReportReferences,
  referencesProse,
  reformatReferences,
  type ReportReference,
} from "@/lib/report/references";
import { CannedCommentsBar } from "@/components/report/CannedCommentsBar";
import { RiskRatingsPanel } from "@/components/report/RiskRatingsPanel";
import { isShawnExamType, getReportTypeConfig } from "@/lib/report/reportTypes";

function narrativeBlocks(murray: boolean, shawnExam: boolean): {
  key: keyof ReportNarrative;
  label: string;
  hint: string;
}[] {
  const blocks: {
    key: keyof ReportNarrative;
    label: string;
    hint: string;
  }[] = shawnExam
    ? [
        {
          key: "executiveSummary",
          label: "Executive Summary — opening paragraph",
          hint: "Prints above the Executive Summary grid only. Does not change 1.1 Instructions.",
        },
        {
          key: "brief",
          label: "Executive Summary — Brief Description",
          hint: "Prints in the Brief description row of the Executive Summary grid.",
        },
        {
          key: "instructions",
          label: "1.1 Instructions",
          hint: "Prints under 1.0 Basis of Value only.",
        },
        {
          key: "sitePhysical",
          label: "2.1 Property Description",
          hint: "Prints under 2.0 Title and Property Details.",
        },
        {
          key: "siteIdentification",
          label: "2.2 How the site was identified",
          hint: "Prints in 2.2 Title Particulars. Built from the Site identification ticks.",
        },
        {
          key: "legalAccess",
          label: "2.2 Legal access",
          hint: "Prints under 2.2 Title Particulars. How and where the allotment gains vehicular access, including any easement.",
        },
        {
          key: "titleSearchNarrative",
          label: "2.2 Title search",
          hint: "Prints under Title Particulars only when it adds a fact that is not already in the 2.2 or 2.3 tables. Manual text is kept.",
        },
        {
          key: "encumbrancesSummary",
          label: "2.3 Easements, encumbrances and restrictions",
          hint: "Prints in the easements cell. Uses the recorded interests and the vegetation notice, in the same words as the title narrative. Manual text is kept.",
        },
        {
          key: "physicalAccess",
          label: "2.3 Physical ingress / egress",
          hint: "Prints under 2.3 only if ticked. Defaults off except industrial and commercial.",
        },
        {
          key: "servicesAmenities",
          label: "2.3 Particulars of Land — Utilities",
          hint: "Prints in 2.3 Particulars of Land.",
        },
        {
          key: "zoningPurpose",
          label: "Planning Controls — Zoning purpose",
          hint: "Prints in the zoning purpose cell. Starts from the scheme wording, rewritten as a sentence. Manual text is kept.",
        },
        {
          key: "highestBestUse",
          label: "3.2 Highest and Best Use",
          hint: "Prints under 3.0 Planning Controls.",
        },
        {
          key: "envIntro",
          label: "4.0 Environmental Issues",
          hint: "Prints as the opening of 4.0 Environmental Issues.",
        },
        {
          key: "acidSulphate",
          label: "4.1 Acid sulphate soils",
          hint: "Acid sulphate soils only. Other overlays belong in their own sections.",
        },
        {
          key: "floodAssessment",
          label: "4.2 Flood assessment",
          hint: "Prints under 4.2 Flood assessment.",
        },
        {
          key: "noiseNuisances",
          label: "4.3 Noise and other nuisances",
          hint: "Prints under 4.3 Noise and other nuisances.",
        },
        {
          key: "titleNotices",
          label: "4.4 Title notices",
          hint: "Prints under 4.4. Filled from administrative advices on the imported title search, including a Vegetation Management Act VEG NOTICE or restoration notice. Edit the paragraph. Re-import the title search if this is empty.",
        },
        {
          key: "location",
          label: "5.1 Location",
          hint: "Prints under 5.0 Locality and Location.",
        },
        {
          key: "neighbourhood",
          label: "5.2 Locality",
          hint: "Prints under 5.0 Locality and Location. Immediate locality only.",
        },
        {
          key: "amenities",
          label: "5.3 Amenities",
          hint: "Prints under 5.3 Amenities.",
        },
        {
          key: "popularDestinations",
          label: "5.4 Popular destinations",
          hint: "Prints under 5.4 Popular destinations.",
        },
        {
          key: "marketAustralia",
          label: "6.1 Market commentary — Australia",
          hint: "Prints under 6.1 Australia.",
        },
        {
          key: "marketState",
          label: "6.2 Market commentary — State",
          hint: "Prints under 6.2 State.",
        },
        {
          key: "marketRegion",
          label: "6.3 Market commentary — Region",
          hint: "Prints under 6.3 Region.",
        },
        {
          key: "marketLocality",
          label: "6.4 Market commentary — Locality",
          hint: "Prints under 6.4 Locality.",
        },
        {
          key: "valuationApproach",
          label: "8.0 Valuation Approach",
          hint: "Prints at the start of 8.0 Valuation Approach.",
        },
        {
          key: "salesComments",
          label: "8.2 Comments on comparable sales",
          hint: "Prints once, immediately under the sales grids that are included.",
        },
        {
          key: "valueReconciliation",
          label: "8.3 Final reconciliation of value",
          hint: "Prints immediately after the comments on comparable sales.",
        },
        {
          key: "salesAnalysis",
          label: "8.5 Analysis",
          hint: "Prints under 8.5 Analysis.",
        },
        {
          key: "disclaimer",
          label: "Reliance and terms of use",
          hint: "Prints under its own heading before the references. States who instructed the report, the purpose, who may rely on it, and the terms. Manual text is kept.",
        },
        {
          key: "assumptions",
          label: "Assumptions",
          hint: "Prints after the disclaimer.",
        },
        {
          key: "references",
          label: "9.0 References",
          hint: "Prints under 9.0 References. Choose Harvard or APA. Tick sources to include.",
        },
      ]
    : [
    {
      key: "instructions",
      label: "1.1 Instructions",
      hint: "Section 1.1. Built from the inspection-form instructions and instructing-party fields. Manual text is kept.",
    },
    {
      key: "brief",
      label: "Brief Description of the Property",
      hint: "Prints on the valuation summary.",
    },
    {
      key: "location",
      label: "5.1 Location",
      hint: "Distance and direction from the CBD or nearest main town. Do not describe the locality here.",
    },
    {
      key: "neighbourhood",
      label: "5.2 Neighbourhood",
      hint: "Immediate locality and neighbouring development. No CBD distances, site shape, services or zoning.",
    },
    {
      key: "sitePhysical",
      label: "6.1 Physical Description",
      hint: "Allotment shape, lot position, topography, dimensions and related site fields.",
    },
    {
      key: "siteIdentification",
      label: "How the site was identified",
      hint: "Prints with the site description. Built from the Site identification ticks.",
    },
    {
      key: "servicesAmenities",
      label: "6.2 Services/Amenities",
      hint: "Site services. Saved or edited text is not overwritten by AI.",
    },
    {
      key: "improvements",
      label: "7.1 General Description",
      hint: "Prints under 7. Improvements.",
    },
    {
      key: "accommodation",
      label: murray ? "7.4 Accommodation Details" : "8. Accommodation – Fixtures and Fittings",
      hint: murray
        ? "Prints under 7. Improvements."
        : "Prints as section 8.",
    },
    {
      key: "conditionImprovements",
      label: murray ? "7.6 Condition of Improvements" : "9.2 Condition of Improvements",
      hint: murray
        ? "Prints under 7. Improvements."
        : "Prints under 9. Improvements – Other Valuation Issues.",
    },
    {
      key: "highestBestUse",
      label: murray ? "Highest and Best Use" : "1.8 Highest and Best Use",
      hint: murray
        ? "Prints under Basis of Valuation."
        : "Prints under 1. Instructions and Purpose.",
    },
    {
      key: "valuationApproach",
      label: "Valuation Approach",
      hint: "Direct Comparison Approach and the points of difference considered. Saved text is not overwritten on reopen.",
    },
    {
      key: "salesComments",
      label: "Comments on comparable sales",
      hint: "Prints once, immediately under the sales grids that are included.",
    },
    {
      key: "valueReconciliation",
      label: "Final reconciliation of value",
      hint: "Prints immediately after the comments on comparable sales.",
    },
    {
      key: "remarks",
      label: murray ? "10. Remarks" : "13. Remarks",
      hint: murray ? "Prints as section 10." : "Prints as section 13.",
    },
  ];
  return blocks;
}

/** Make inspection values safe for the server function (JSON-serializable, no proxies). */
function serializableValues(
  values: ReportDraftController["draft"]["values"],
): Record<string, string | boolean | string[] | number | null | undefined> {
  const raw = JSON.parse(JSON.stringify(values ?? {})) as Record<string, unknown>;
  const out: Record<string, string | boolean | string[] | number | null | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) {
      out[k] = v as null | undefined;
    } else if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) => String(x));
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

export function NarrativeSection({ controller }: { controller: ReportDraftController }) {
  const { draft, setNarrative, setMeta, setPhotos, loaded } = controller;
  const murray = /murray/i.test(String(draft.values["prop_assignment"] ?? ""));
  const shawnExam =
    isShawnExamType(getReportTypeConfig(String(draft.values["prop_assignment"] ?? "")).id) ||
    isShawnReportAssignment(String(draft.values["prop_assignment"] ?? ""));
  const BLOCKS = narrativeBlocks(murray, shawnExam);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<"template" | "ai" | null>(null);
  const [busy, setBusy] = useState<"template" | "ai" | keyof ReportNarrative | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  // Local mirror so the Remarks textarea always updates even if a parent re-render races
  const [localRemarks, setLocalRemarks] = useState(() =>
    String(draft.narrative.remarks ?? ""),
  );
  /** Last non-empty highlight in each block textarea (survives Save-button blur). */
  const [selectionByKey, setSelectionByKey] = useState<
    Partial<Record<keyof ReportNarrative, string>>
  >({});
  useEffect(() => {
    setLocalRemarks(String(draft.narrative.remarks ?? ""));
  }, [draft.narrative.remarks, draft.inspectionId]);
  const autoStarted = useRef(false);
  const summarySeeded = useRef(false);
  useEffect(() => {
    if (!loaded || !shawnExam || summarySeeded.current) return;
    if (String(draft.narrative.executiveSummary ?? "").trim()) {
      summarySeeded.current = true;
      return;
    }
    const lead = buildExecutiveSummaryLead(draft.values);
    if (!lead.trim()) return;
    summarySeeded.current = true;
    setNarrative({ executiveSummary: lead });
  }, [loaded, shawnExam, draft.inspectionId, draft.narrative.executiveSummary, draft.values, setNarrative]);
  const narrativeRef = useRef(draft.narrative);
  narrativeRef.current = draft.narrative;

  function emptyNarrativeKeys(
    narrative: ReportDraftController["draft"]["narrative"] = narrativeRef.current,
  ): (keyof ReportNarrative)[] {
    return BLOCKS.map((b) => b.key).filter(
      (key) => !String(narrative[key] ?? "").trim(),
    );
  }

  /** Fill only empty keys from the inspection-data template (never overwrites). */
  function locationFacts() {
    return locationFactsFromDraft({
      values: draft.values,
      pins: (draft.reportMeta.salesMapPins as SalesMapPin[] | undefined) ?? null,
      subjectLat: draft.reportMeta.subjectLat,
      subjectLng: draft.reportMeta.subjectLng,
    });
  }

  async function locationFactsResolved() {
    const existing = locationFacts();
    if (
      subjectCoordsFromPins(
        (draft.reportMeta.salesMapPins as SalesMapPin[] | undefined) ?? null,
      ) ||
      (draft.reportMeta.subjectLat != null && draft.reportMeta.subjectLng != null)
    ) {
      return existing;
    }
    if (!isGoogleMapsConfigured()) return existing;
    const address = subjectAddressLine(draft.values);
    if (!address) return existing;
    try {
      const geo = await geocodeGoogleAddresses({
        data: { apiKey: loadGoogleMapsKey(), addresses: [address] },
      });
      const hit = geo.results[0];
      if (hit?.lat != null && hit.lng != null) {
        setMeta({ subjectLat: hit.lat, subjectLng: hit.lng });
        return buildLocationFacts({
          values: draft.values,
          coords: { lat: hit.lat, lng: hit.lng },
        });
      }
    } catch {
      /* keep address-only facts */
    }
    return existing;
  }

  async function neighbourhoodContext(acceptedOnly: boolean): Promise<string> {
    const lines: string[] = [];
    const claims = (draft.reportMeta.nbhdClaims ?? []) as NbhdClaim[];
    const use = acceptedOnly ? claims.filter((c) => c.accepted) : claims;
    if (use.length) {
      lines.push(
        `MUST INCLUDE all ${use.length} accepted fact(s) below. Do not omit any name, distance or figure.`,
      );
      use.forEach((c, i) => {
        lines.push(
          `${i + 1}. [${c.kind}] ${c.text}${c.source ? ` (${c.source})` : ""}`,
        );
      });
    } else {
      lines.push("ACCEPTED FACTS: none.");
    }
    return lines.filter(Boolean).join("\n");
  }

  function marketAssistFor(key: keyof ReportNarrative) {
    return MARKET_ASSIST.find((row) => row.key === key);
  }

  function marketClaims(scale: MarketScale): NbhdClaim[] {
    const row = MARKET_ASSIST.find((item) => item.scale === scale);
    if (!row) return [];
    return (draft.reportMeta[row.metaKey] as NbhdClaim[] | undefined) ?? [];
  }

  async function marketContext(scale: MarketScale, acceptedOnly: boolean): Promise<string> {
    const claims = marketClaims(scale);
    const use = acceptedOnly ? claims.filter((c) => c.accepted) : claims;
    if (!use.length) return "ACCEPTED FACTS: none.";
    return [
      `ACCEPTED FACTS (${use.length}). Cover each topic. If several lines give different figures for the same measure, write one range from the lowest to the highest accepted figure — do not list the figures separately.`,
      ...use.map(
        (c, i) => `${i + 1}. [${c.kind}] ${c.text}${c.source ? ` (${c.source})` : ""}`,
      ),
    ].join("\n");
  }

  function applyReferences(items: ReportReference[]) {
    flushSync(() => {
      setMeta({ reportReferences: items });
      setNarrative({ references: referencesProse(items) });
    });
  }

  function refreshReferences(metaPatch?: Partial<typeof draft.reportMeta>) {
    const items = collectReportReferences(
      { ...draft.reportMeta, ...(metaPatch ?? {}) },
      draft.values,
      (draft.reportMeta.reportReferences as ReportReference[] | undefined) ?? [],
    );
    applyReferences(items);
    return items;
  }

  function collectReferencesNow() {
    const items = refreshReferences();
    setLastStatus(
      items.length
        ? `References on file: ${items.length}. Untick any you do not want printed.`
        : "No sources were found on the report notes yet.",
    );
    toast.message(
      items.length ? `Collected ${items.length} reference(s)` : "No sources found",
    );
  }

  async function runMarketSearch(scale: MarketScale) {
    const row = MARKET_ASSIST.find((item) => item.scale === scale);
    if (!row) return;
    const settings = loadAiSettings();
    if (!isAiConfigured(settings)) {
      toast.error("AI is not configured", {
        description: "Open Settings, add an API key, then search again.",
      });
      return;
    }
    setBusy(row.key);
    setLastStatus(`Searching ${row.scale} market sources…`);
    try {
      const searched = await searchMarketFacts({
        data: {
          settings: {
            provider: settings.provider,
            model: settings.model,
            apiKey: settings.apiKey,
            ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
          },
          scale,
          suburb: String(draft.values["prop_suburb"] ?? ""),
          city: String(draft.values["prop_lga"] ?? ""),
          state: String(draft.values["prop_state"] ?? "Queensland"),
          address: subjectAddressLine(draft.values),
        },
      });
      const incoming = parseNbhdClaims(searched.raw).map((claim) => ({
        ...claim,
        kind: (claim.kind === "other" ? scale : claim.kind) as NbhdClaim["kind"],
      }));
      const merged = mergeNbhdClaims(marketClaims(scale), incoming);
      setMeta({ [row.metaKey]: merged });
      refreshReferences({ [row.metaKey]: merged });
      setLastStatus(
        merged.length
          ? `${row.heading.split(".")[0]}: ${merged.length} on file. Untick what you do not want.`
          : "No market notes were returned.",
      );
      toast.message(
        incoming.length ? `Prepared ${incoming.length} ${scale} note(s)` : "No market notes found",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastStatus(`Market search failed: ${message}`);
      toast.error("Market search failed", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function narrativeOpts() {
    const facts = await locationFactsResolved();
    return {
      salesCount: Array.isArray(draft.sales) ? draft.sales.length : 0,
      valueAmount:
        typeof draft.reportMeta?.valueAmount === "string"
          ? draft.reportMeta.valueAmount
          : "",
      brief: String(narrativeRef.current.brief ?? "").trim() || undefined,
      locationSentence: facts.sentence || undefined,
    };
  }

  async function applyTemplateToEmptyKeys(
    keys: (keyof ReportNarrative)[],
  ): Promise<Partial<ReportNarrative>> {
    const full = generateNarrative(draft.values, await narrativeOpts());
    const current = narrativeRef.current;
    const patch: Partial<ReportNarrative> = {};
    for (const key of keys) {
      const currentText = String(current[key] ?? "").trim();
      const thinDisclaimer =
        key === "disclaimer" &&
        /prepared for the stated purpose and the instructing party only/i.test(currentText);
      if ((!currentText || thinDisclaimer) && String(full[key] ?? "").trim()) {
        patch[key] = full[key];
      }
    }
    if (Object.keys(patch).length > 0) {
      setNarrative(patch);
    }
    return patch;
  }

  // Auto-fill only truly empty blocks, and only after the draft has loaded from
  // cloud/local cache — never race AI against a reopened report's saved text.
  // Prefer AI when configured; otherwise use the inspection-data template.
  useEffect(() => {
    if (!loaded) return;
    if (autoStarted.current) return;
    let keys = emptyNarrativeKeys(draft.narrative);
    const thinDisclaimer =
      /prepared for the stated purpose and the instructing party only/i.test(
        String(draft.narrative.disclaimer ?? ""),
      ) && draft.reportMeta.manualNarrative?.disclaimer !== true;
    if (thinDisclaimer && !keys.includes("disclaimer")) keys = [...keys, "disclaimer"];
    if (keys.length === 0) {
      autoStarted.current = true; // mark done so we don't fire later if user clears a block
      return;
    }
    autoStarted.current = true;
    const alreadyWritten = (Object.keys(draft.narrative) as (keyof ReportNarrative)[]).some(
      (k) => String(draft.narrative[k] ?? "").trim(),
    );
    if (alreadyWritten) {
      void applyTemplateToEmptyKeys([
        "envIntro",
        "acidSulphate",
        "floodAssessment",
        "noiseNuisances",
        "amenities",
        "popularDestinations",
        "marketAustralia",
        "marketState",
        "marketRegion",
        "marketLocality",
        "salesAnalysis",
        "disclaimer",
        "assumptions",
        "valuationApproach",
        "legalAccess",
        "physicalAccess",
        "encumbrancesSummary",
      ]);
      return;
    }
    // Remarks always from local builder when empty
    if (keys.includes("remarks")) {
      generateRemarksNow(false);
      keys = keys.filter((k) => k !== "remarks");
    }
    if (keys.length === 0) return;
    if (isAiConfigured()) {
      void generateWithAi(keys, false);
    } else {
      void applyTemplateToEmptyKeys(keys).then((patch) => {
        if (Object.keys(patch).length > 0) {
          setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
          setSource("template");
          setLastStatus(
            `Filled empty blocks from inspection data (AI not configured).`,
          );
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once after load when empty blocks exist
  }, [loaded, draft.inspectionId]);

  /** Always fills Remarks from local builder (Phil structure or generic template). */
  function generateRemarksNow(overwrite = true) {
    const opts = {
      salesCount: Array.isArray(draft.sales) ? draft.sales.length : 0,
      valueAmount:
        typeof draft.reportMeta?.valueAmount === "string"
          ? draft.reportMeta.valueAmount
          : "",
      brief: String(narrativeRef.current.brief ?? "").trim() || undefined,
      locationSentence: locationFacts().sentence || undefined,
    };
    try {
      const full = generateNarrative(draft.values, opts);
      const text = String(full.remarks ?? "").trim();
      if (!text) {
        setLastStatus("Remarks builder returned empty text.");
        toast.error("Remarks could not be generated");
        return false;
      }
      if (!overwrite && String(localRemarks || narrativeRef.current.remarks || "").trim()) {
        setLastStatus("Remarks already has text — not overwritten.");
        return false;
      }
      // Synchronous write: local textarea + draft narrative in one paint
      flushSync(() => {
        setLocalRemarks(text);
        setNarrative({ remarks: text });
      });
      narrativeRef.current = { ...narrativeRef.current, remarks: text };
      setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setSource("template");
      setLastStatus(`Remarks (${text.length} chars): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`);
      toast.success("Remarks filled (local builder v36)");
      return true;
    } catch (err) {
      console.error("[remarks]", err);
      const message = err instanceof Error ? err.message : String(err);
      setLastStatus(`Remarks failed: ${message}`);
      toast.error("Remarks failed", { description: message });
      return false;
    }
  }

  async function runNbhdSearch() {
    setBusy("neighbourhood");
    setLastStatus("Collecting suburb, amenity and transport notes…");
    const claims: NbhdClaim[] = [];
    try {
      const facts = await locationFactsResolved();
      if (facts.sentence) {
        claims.push(measuredClaim("city", facts.sentence, "Google geocode / measured centres"));
      }

      const lat = draft.reportMeta.subjectLat;
      const lng = draft.reportMeta.subjectLng;
      const origin =
        lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng }
          : subjectCoordsFromPins(
              (draft.reportMeta.salesMapPins as SalesMapPin[] | undefined) ?? null,
            );
      const suburb = String(draft.values["prop_suburb"] ?? "");
      const industrial = Boolean(String(draft.values["prop_type_industrial"] ?? "").trim());

      if (isGoogleMapsConfigured() && origin) {
        try {
          const nearby = await fetchNearbyAmenities({
            data: { apiKey: loadGoogleMapsKey(), lat: origin.lat, lng: origin.lng, radiusM: 5000 },
          });
          const schools = nearby.school ?? [];
          if (schools.length) {
            const named = schools[0]?.name ? ` Nearest recorded is ${schools[0].name}.` : "";
            claims.push(
              measuredClaim(
                "amenities",
                `There are ${schools.length} school${schools.length === 1 ? "" : "s"} within about five kilometres of the property.${named}`,
              ),
            );
          }
          const shops = [...(nearby.supermarket ?? []), ...(nearby.shopping_mall ?? [])].slice(0, 4);
          shops.forEach((shop, i) => {
            if (!shop.name) return;
            if (shop.lat != null && shop.lng != null) {
              const d = claimDistanceKm(origin, { lat: shop.lat, lng: shop.lng });
              claims.push(
                measuredClaim(
                  "amenities",
                  `${i === 0 ? "Nearest shopping" : "Shopping"} includes ${shop.name}, approximately ${d.label} ${d.dir} of the property.`,
                ),
              );
            } else {
              claims.push(measuredClaim("amenities", `Shopping recorded includes ${shop.name}.`));
            }
          });
          const station = nearby.train_station?.[0];
          if (station?.name && station.lat != null && station.lng != null) {
            const d = claimDistanceKm(origin, { lat: station.lat, lng: station.lng });
            claims.push(
              measuredClaim(
                "transport",
                `${station.name} is approximately ${d.label} ${d.dir} of the property.`,
              ),
            );
          }
          const bus = nearby.bus_station?.[0] || nearby.transit_station?.[0];
          if (bus?.name && bus.lat != null && bus.lng != null) {
            const d = claimDistanceKm(origin, { lat: bus.lat, lng: bus.lng });
            claims.push(
              measuredClaim(
                "transport",
                `A bus stop at ${bus.name} is approximately ${d.label} ${d.dir} of the property.`,
              ),
            );
          }
        } catch {
          /* Places optional */
        }

        const key = loadGoogleMapsKey();
        const near = suburb || subjectAddressLine(draft.values) || "Queensland";
        for (const q of [
          `M1 motorway exit near ${near}`,
          `railway station near ${near}`,
          `shopping centre near ${near}`,
          `housing estate near ${near}`,
          `master planned community near ${near}`,
        ]) {
        try {
          const m1 = await fetchPlaceTextSearch({
            data: { apiKey: key, query: q, lat: origin.lat, lng: origin.lng },
          });
          const hit = m1.results[0];
          if (hit?.name && hit.lat != null && hit.lng != null) {
            const d = claimDistanceKm(origin, { lat: hit.lat, lng: hit.lng });
            claims.push(
              measuredClaim(
                /shop/i.test(q) ? "amenities" : /estate|planned/i.test(q) ? "estate" : "transport",
                `${hit.name} is approximately ${d.label} ${d.dir} of the property.`,
              ),
            );
          }
        } catch {
          /* text search optional */
        }
        }
        if (industrial) {
          for (const q of [`airport near ${near}`, `port near ${near}`]) {
            try {
              const found = await fetchPlaceTextSearch({
                data: { apiKey: key, query: q, lat: origin.lat, lng: origin.lng },
              });
              const hit = found.results[0];
              if (hit?.name && hit.lat != null && hit.lng != null) {
                const d = claimDistanceKm(origin, { lat: hit.lat, lng: hit.lng });
                claims.push(
                  measuredClaim(
                    "transport",
                    `${hit.name} is approximately ${d.label} ${d.dir} of the property.`,
                  ),
                );
              }
            } catch {
              /* optional */
            }
          }
        }

        const hasLocMap = draft.photos.some((p) => p.slot === "map_location" && p.url);
        if (!hasLocMap) {
          try {
            const built = await buildSubjectLocationMap({
              apiKey: key,
              subject: {
                id: "pin-subject",
                label: subjectAddressLine(draft.values) || suburb || "Subject",
                shortLabel: "S",
                lat: origin.lat,
                lng: origin.lng,
                kind: "subject",
              },
            });
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result ?? ""));
              reader.onerror = () => reject(new Error("map read failed"));
              reader.readAsDataURL(built.file);
            });
            setPhotos((prev) => [
              ...prev.filter((p) => p.slot !== "map_location"),
              {
                id: "photo-map-location",
                slot: "map_location",
                caption: `Locality map — subject and ${built.centreName}`,
                url: dataUrl,
                kind: "map",
              },
            ]);
          } catch {
            /* map optional */
          }
        }
      }

      const settings = loadAiSettings();
      if (isAiConfigured(settings)) {
        try {
          const searched = await searchNeighbourhoodFacts({
            data: {
              settings: {
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKey,
                ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
              },
              suburb: suburb || String(draft.values["prop_address"] ?? "subject suburb"),
              city: String(draft.values["prop_lga"] ?? ""),
              address: subjectAddressLine(draft.values),
              estate:
                String(draft.reportMeta.nbhdEstateHint ?? "").trim() ||
                String(draft.values["nbhd_estate"] ?? ""),
            },
          });
          claims.push(...parseNbhdClaims(searched.raw));
        } catch (searchErr) {
          console.warn("[nbhd search]", searchErr);
        }
      }

      const mergedNbhd = mergeNbhdClaims(
        (draft.reportMeta.nbhdClaims as NbhdClaim[] | undefined) ?? [],
        claims,
      );
      setMeta({
        nbhdClaims: mergedNbhd,
      });
      refreshReferences({ nbhdClaims: mergedNbhd });
      const estateN = mergedNbhd.filter((c) => c.kind === "estate").length;
      setLastStatus(
        mergedNbhd.length
          ? `Notes on file: ${merged.length}. Estate lines: ${estateN}. Untick what you do not want.`
          : "No suburb notes were returned.",
      );
      toast.message(
        claims.length ? `Prepared ${claims.length} suburb note(s)` : "No suburb notes found",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLastStatus(`Suburb search failed: ${message}`);
      toast.error("Suburb search failed", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function generateFromTemplate() {
    setBusy("template");
    setLastStatus(null);
    try {
      const full = generateNarrative(draft.values, await narrativeOpts());
      setNarrative(full);
      narrativeRef.current = { ...narrativeRef.current, ...full };
      setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
      setSource("template");
      setLastStatus(
        `Template applied. Remarks length=${String(full.remarks ?? "").length}.`,
      );
      toast.success("Narrative filled from inspection data");
    } catch (err) {
      console.error("[template]", err);
      toast.error(err instanceof Error ? err.message : "Template failed");
    } finally {
      setBusy(null);
    }
  }

  /**
   * @param keys blocks to generate
   * @param overwrite when true (default for single-block), replace existing text
   */
  async function generateWithAi(
    keys: (keyof ReportNarrative)[] = BLOCKS.map((b) => b.key),
    overwrite = keys.length === 1,
  ) {
    // Remarks never go through the AI RPC — always local structured text
    if (keys.length === 1 && keys[0] === "remarks") {
      generateRemarksNow(overwrite);
      return;
    }

    const settings = loadAiSettings();
    const opts = await narrativeOpts();

    // If bulk includes remarks, fill it first locally
    if (keys.includes("remarks")) {
      generateRemarksNow(overwrite);
    }
    const remaining = keys.filter((k) => {
      if (k === "remarks" || k === "riskAnalysis" || k === "references") return false;
      if (k === "salesComments" || k === "valueReconciliation") return false;
      if (skipAiNarrativeBlock(draft.values, k)) return false;
      if (!overwrite && draft.reportMeta.manualNarrative?.[k]) return false;
      if (!overwrite && String(narrativeRef.current[k] ?? "").trim()) return false;
      return true;
    });
    const skipped = keys.filter((k) => skipAiNarrativeBlock(draft.values, k));
    if (skipped.length > 0) {
      const skipPatch = await applyTemplateToEmptyKeys(skipped);
      if (overwrite) {
        const full = generateNarrative(draft.values, opts);
        const forced: Partial<ReportNarrative> = {};
        for (const key of skipped) {
          if (String(full[key] ?? "").trim()) forced[key] = full[key];
        }
        if (Object.keys(forced).length > 0) setNarrative(forced);
      } else if (Object.keys(skipPatch).length === 0) {
        /* nothing to fill */
      }
    }
    if (remaining.length === 0) {
      if (skipped.length > 0) {
        setLastStatus("Filled inapplicable blocks from inspection data.");
      }
      return;
    }

    if (!isAiConfigured(settings)) {
      const emptyKeys = remaining.filter(
        (k) => overwrite || !String(narrativeRef.current[k] ?? "").trim(),
      );
      const patch = emptyKeys.length ? await applyTemplateToEmptyKeys(emptyKeys) : {};
      if (Object.keys(patch).length > 0) {
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        setSource("template");
        setLastStatus(`Filled from inspection data: ${Object.keys(patch).join(", ")}.`);
        toast.message("Filled from inspection data");
      } else {
        toast.error("AI is not configured", {
          description: "Open Settings, add an API key, Save, then Test connection.",
        });
      }
      return;
    }

    setBusy(remaining.length === 1 ? remaining[0]! : "ai");
    setLastStatus("Generating…");
    const next: Partial<ReportNarrative> = {};
    const values = serializableValues(draft.values);
    let quotaHit = false;
    let quotaDetail = "";

    const applyInspectionFill = (keysToFill: (keyof ReportNarrative)[]) => {
      const full = generateNarrative(draft.values, opts);
      for (const key of keysToFill) {
        const fallback = String(full[key] ?? "").trim();
        if (!fallback) continue;
        if (overwrite || !String(narrativeRef.current[key] ?? "").trim() || !next[key]) {
          next[key] = fallback;
        }
      }
    };

    try {
      for (const key of remaining) {
        if (quotaHit) break;
        try {
          setLastStatus(`Generating “${key}”…`);
          if (
            key === "neighbourhood" &&
            neighbourhoodAssistEnabled(String(draft.values["prop_assignment"] ?? "")) &&
            !(draft.reportMeta.nbhdClaims ?? []).length
          ) {
            try {
              setLastStatus("Searching suburb sources…");
              const suburb = String(draft.values["prop_suburb"] ?? "");
              const searched = await searchNeighbourhoodFacts({
                data: {
                  settings: {
                    provider: settings.provider,
                    model: settings.model,
                    apiKey: settings.apiKey,
                    ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
                  },
                  suburb: suburb || String(draft.values["prop_address"] ?? "subject suburb"),
                  city: String(draft.values["prop_lga"] ?? ""),
                  address: subjectAddressLine(draft.values),
                  estate:
                String(draft.reportMeta.nbhdEstateHint ?? "").trim() ||
                String(draft.values["nbhd_estate"] ?? ""),
                },
              });
              const claims = parseNbhdClaims(searched.raw);
              setMeta({ nbhdClaims: claims });
            } catch (searchErr) {
              console.warn("[nbhd search]", searchErr);
            }
          }
          const result = await generateNarrativeBlock({
            data: {
              settings: {
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKey,
                ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
              },
              blockKey: key,
              values,
              ...(key === "location"
                ? { locationContext: (await locationFactsResolved()).promptBlock }
                : {}),
              ...(key === "neighbourhood"
                ? { locationContext: await neighbourhoodContext(true) }
                : {}),
              ...(key === "marketAustralia"
                ? { locationContext: await marketContext("australia", true) }
                : {}),
              ...(key === "marketState"
                ? { locationContext: await marketContext("state", true) }
                : {}),
              ...(key === "marketRegion"
                ? { locationContext: await marketContext("region", true) }
                : {}),
              ...(key === "titleSearchNarrative"
                ? {
                    locationContext: String(draft.values["title_search_text"] ?? "").slice(0, 14000),
                  }
                : {}),
            },
          });

          const text =
            typeof result === "string"
              ? result
              : result && typeof result === "object" && "text" in result
                ? String((result as { text: unknown }).text ?? "")
                : "";

          if (text.trim()) {
            next[key] =
              key === "neighbourhood"
                ? ensureAcceptedFactsInProse(
                    text.trim(),
                    (draft.reportMeta.nbhdClaims as NbhdClaim[] | undefined) ?? [],
                  )
                : text.trim();
          } else applyInspectionFill([key]);
        } catch (err) {
          console.error("[narrative AI]", key, err);
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : JSON.stringify(err);
          if (
            /permission-denied|spending limit|available credits|monthly spending|quota|insufficient.?credit/i.test(
              message,
            )
          ) {
            quotaHit = true;
            quotaDetail = message;
            applyInspectionFill(remaining);
            break;
          }
          applyInspectionFill([key]);
        }
      }

      const safe: Partial<ReportNarrative> = {};
      const current = narrativeRef.current;
      for (const [k, v] of Object.entries(next) as [keyof ReportNarrative, string][]) {
        if (!v.trim()) continue;
        if (overwrite || !String(current[k] ?? "").trim()) safe[k] = australianiseSpelling(v);
      }

      if (Object.keys(safe).length > 0) {
        setNarrative(safe);
        narrativeRef.current = { ...narrativeRef.current, ...safe };
        setGeneratedAt(new Date().toLocaleTimeString("en-AU", { hour12: false }));
        if (quotaHit) {
          setSource("template");
          setLastStatus(
            `AI credits are used up. Filled from inspection data: ${Object.keys(safe).join(", ")}.`,
          );
          toast.message("AI credits used up — filled from inspection data");
        } else {
          setSource("ai");
          setLastStatus(`Updated: ${Object.keys(safe).join(", ")}.`);
          toast.success(
            remaining.length === 1
              ? `Generated “${remaining[0]}”`
              : "Narrative generated",
          );
        }
      } else if (quotaHit) {
        setSource("template");
        setLastStatus(
          "AI credits are used up. Use Regenerate from inspection data, or add credits in the AI provider account.",
        );
        toast.message("AI credits used up", {
          description: "Use Regenerate from inspection data. Narratives were not overwritten.",
        });
      } else {
        setLastStatus("Existing text was kept.");
      }
    } catch (err) {
      console.error("[narrative AI]", err);
      applyInspectionFill(remaining);
      if (Object.keys(next).length > 0) {
        setNarrative(next);
        narrativeRef.current = { ...narrativeRef.current, ...next };
        setSource("template");
        setLastStatus(`AI failed. Filled from inspection data: ${Object.keys(next).join(", ")}.`);
        toast.message("Filled from inspection data");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setLastStatus(`Failed: ${message}`);
        toast.error("Generation failed", { description: message });
      }
    } finally {
      setBusy(null);
    }
  }

  const aiBusy = busy === "ai" || (busy !== null && busy !== "template");
  const templateBusy = busy === "template";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Narrative{" "}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              build 10dd1f6
            </span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Empty sections generate with AI once after the draft loads (Settings required). Saved text is never overwritten on reopen — use Regenerate or AI this block to replace a block.
            Insert canned appends a labelled paragraph; it does not replace the block. Edit any block before exporting the report.
            {generatedAt ? (
              <>
                {" "}
                Last generated {generatedAt}
                {source ? ` (${source === "ai" ? "AI" : "template"})` : ""}.
              </>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            AI uses the provider in{" "}
            <Link to="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
              Settings
            </Link>
            . Template does not need an API key.
          </p>
          {lastStatus ? (
            <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs text-foreground whitespace-pre-wrap break-words">
              {lastStatus}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={generateFromTemplate}
            className="rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {templateBusy ? "Filling…" : "Regenerate from inspection data"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void generateWithAi()}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy === "ai" ? "Generating with AI…" : "Generate with AI"}
          </button>
        </div>
      </div>

      {BLOCKS.map((block) => {
        const blockText =
          block.key === "remarks"
            ? localRemarks
            : String(draft.narrative[block.key] ?? "");
        return (
        <Fragment key={block.key}>
        {shawnExam && block.key === "valuationApproach" ? (
          <RiskRatingsPanel controller={controller} />
        ) : null}
        <div className="block">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{block.label}</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={narrativePrints(draft.reportMeta, block.key, draft.values)}
                  onChange={(e) =>
                    setMeta({
                      printNarrative: {
                        ...(draft.reportMeta.printNarrative ?? {}),
                        [block.key]: e.target.checked,
                      },
                    })
                  }
                  className="size-3.5 rounded border-input"
                />
                Include in printed report
              </label>
              <CannedCommentsBar
                section={block.key}
                currentText={blockText}
                selectedText={selectionByKey[block.key]}
                onApply={(next) => {
                  if (block.key === "remarks") setLocalRemarks(next);
                  setNarrative({ [block.key]: next });
                }}
              />
              {block.key === "salesComments" || block.key === "valueReconciliation" ? null : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (block.key === "remarks") {
                    generateRemarksNow(true);
                    return;
                  }
                  void generateWithAi([block.key]);
                }}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {busy === block.key ? "Generating…" : "AI this block"}
              </button>
              )}
            </div>
          </div>
          <span className="mb-2 block text-sm text-muted-foreground">{block.hint}</span>
          <textarea
            value={blockText}
            onChange={(e) => {
              const val = e.target.value;
              if (block.key === "remarks") setLocalRemarks(val);
              setNarrative({ [block.key]: val });
              setMeta({
                manualNarrative: {
                  ...(draft.reportMeta.manualNarrative ?? {}),
                  [block.key]: true,
                },
              });
              const start = e.target.selectionStart ?? 0;
              const end = e.target.selectionEnd ?? 0;
              const sel = val.slice(start, end);
              setSelectionByKey((prev) => ({
                ...prev,
                [block.key]: sel.trim() ? sel : "",
              }));
            }}
            onSelect={(e) => {
              const el = e.currentTarget;
              const sel = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
              if (sel.trim()) {
                setSelectionByKey((prev) => ({ ...prev, [block.key]: sel }));
              }
            }}
            rows={
              block.key === "salesComments" || block.key === "valueReconciliation"
                ? 16
                : block.key === "remarks"
                  ? 12
                  : 7
            }
            className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {block.key === "neighbourhood" &&
          (neighbourhoodAssistEnabled(String(draft.values["prop_assignment"] ?? "")) ||
            shawnExam) ? (
            <div className="mt-2 space-y-2 rounded-md border border-amber-300/80 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-foreground">
                Suburb notes. Search first, tick the lines you accept, then rewrite the
                paragraph. Unticked lines stay in this working box and do not print.
              </p>
              <label className="block text-xs text-foreground">
                Named estate (optional — improves the estate search)
                <input
                  value={String(draft.reportMeta.nbhdEstateHint ?? "")}
                  onChange={(e) => setMeta({ nbhdEstateHint: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-xs"
                  placeholder="e.g. Highland Reserve"
                />
              </label>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void runNbhdSearch()}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium"
              >
                {busy === "neighbourhood" ? "Searching…" : "Find suburb notes"}
              </button>
              {NBHD_CLAIM_GROUPS.map((group) => {
                const rows = ((draft.reportMeta.nbhdClaims as NbhdClaim[] | undefined) ?? []).filter(
                  (c) => c.kind === group.kind,
                );
                if (!rows.length) return null;
                return (
                  <div key={group.kind} className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    {rows.map((claim) => (
                <label
                  key={claim.id}
                  className="flex items-start gap-2 rounded bg-amber-100/80 px-2 py-1.5 text-xs dark:bg-amber-900/40"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                    checked={claim.accepted}
                    onChange={(e) =>
                      setMeta({
                        nbhdClaims: (draft.reportMeta.nbhdClaims as NbhdClaim[]).map((c) =>
                          c.id === claim.id ? { ...c, accepted: e.target.checked } : c,
                        ),
                      })
                    }
                  />
                  <span>
                    <span className="font-medium capitalize">{claim.kind}. </span>
                    {claim.text}
                    {claim.source ? (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {claim.source}
                      </span>
                    ) : null}
                  </span>
                </label>
                    ))}
                  </div>
                );
              })}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void generateWithAi(["neighbourhood"])}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium"
              >
                Rewrite neighbourhood with accepted facts
              </button>
            </div>
          ) : null}
          {marketAssistFor(block.key) &&
          (neighbourhoodAssistEnabled(String(draft.values["prop_assignment"] ?? "")) ||
            shawnExam) ? (
            <div className="mt-2 space-y-2 rounded-md border border-amber-300/80 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-foreground">
                {marketAssistFor(block.key)!.heading} Unticked lines stay in this working box
                and do not print.
              </p>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void runMarketSearch(marketAssistFor(block.key)!.scale)}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium"
              >
                {busy === block.key
                  ? "Searching…"
                  : marketAssistFor(block.key)!.findLabel}
              </button>
              {marketClaims(marketAssistFor(block.key)!.scale).map((claim) => (
                <label
                  key={claim.id}
                  className="flex items-start gap-2 rounded bg-amber-100/80 px-2 py-1.5 text-xs dark:bg-amber-900/40"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                    checked={claim.accepted}
                    onChange={(e) => {
                      const row = marketAssistFor(block.key)!;
                      setMeta({
                        [row.metaKey]: marketClaims(row.scale).map((c) =>
                          c.id === claim.id ? { ...c, accepted: e.target.checked } : c,
                        ),
                      });
                    }}
                  />
                  <span>
                    {claim.text}
                    {claim.source ? (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {claim.source}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void generateWithAi([block.key])}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium"
              >
                {marketAssistFor(block.key)!.rewriteLabel}
              </button>
            </div>
          ) : null}
          {block.key === "references" &&
          (neighbourhoodAssistEnabled(String(draft.values["prop_assignment"] ?? "")) ||
            shawnExam) ? (
            <div className="mt-2 space-y-2 rounded-md border border-amber-300/80 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-foreground">
                Sources used in the report. Each line names the publisher and, where available, the page address so the source can be located. Tick to print.
              </p>
              <div className="flex gap-2">
                {(["harvard", "apa"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      const items = reformatReferences(
                        (draft.reportMeta.reportReferences as ReportReference[] | undefined) ?? [],
                        style,
                      );
                      flushSync(() => {
                        setMeta({ referenceStyle: style, reportReferences: items });
                        setNarrative({ references: referencesProse(items) });
                      });
                    }}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      (draft.reportMeta.referenceStyle ?? "harvard") === style
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-card"
                    }`}
                  >
                    {style === "harvard" ? "Harvard" : "APA"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={collectReferencesNow}
                className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium"
              >
                Collect sources from report
              </button>
              {((draft.reportMeta.reportReferences as ReportReference[] | undefined) ?? [])
                .length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No sources on file yet. Run Find notes on 5.2 or 6.1–6.4 first, then collect
                  again. Publisher names in those notes are enough — a URL is not required.
                </p>
              ) : null}
              {(((draft.reportMeta.reportReferences as ReportReference[] | undefined) ??
                []) as ReportReference[]).map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2 rounded bg-amber-100/80 px-2 py-1.5 text-xs dark:bg-amber-900/40"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                    checked={item.accepted}
                    onChange={(e) => {
                      const next = (
                        (draft.reportMeta.reportReferences as ReportReference[] | undefined) ??
                        []
                      ).map((r) =>
                        r.id === item.id ? { ...r, accepted: e.target.checked } : r,
                      );
                      applyReferences(next);
                    }}
                  />
                  <span>{item.text}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
        </Fragment>
        );
      })}
    </div>
  );
}
