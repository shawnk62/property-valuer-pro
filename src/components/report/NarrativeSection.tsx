import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { ReportDraftController } from "@/hooks/useReportDraft";
import { generateNarrativeBlock, searchNeighbourhoodFacts } from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import {
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
  NBHD_CLAIM_GROUPS,
  neighbourhoodAssistEnabled,
  narrativePrints,
  parseNbhdClaims,
  type NbhdClaim,
} from "@/lib/narrative/neighbourhoodAssist";
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
          key: "instructions",
          label: "1.1 Instructions",
          hint: "Prints under 1.0 Basis of Value.",
        },
        {
          key: "brief",
          label: "Brief Description of the Property",
          hint: "Prints in the Executive Summary.",
        },
        {
          key: "sitePhysical",
          label: "2.1 Property Description",
          hint: "Prints under 2.0 Title and Property Details.",
        },
        {
          key: "siteIdentification",
          label: "How the site was identified",
          hint: "Prints in 2.2 Title Particulars. Built from the Site identification ticks.",
        },
        {
          key: "highestBestUse",
          label: "3.2 Highest and Best Use",
          hint: "Prints under 3.0 Planning Controls.",
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
          key: "servicesAmenities",
          label: "2.3 Particulars of Land — Utilities",
          hint: "Prints in 2.3 Particulars of Land.",
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
  const shawnExam = isShawnExamType(
    getReportTypeConfig(String(draft.values["prop_assignment"] ?? "")).id,
  );
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
      if (!String(current[key] ?? "").trim() && String(full[key] ?? "").trim()) {
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
    if (keys.length === 0) {
      autoStarted.current = true; // mark done so we don't fire later if user clears a block
      return;
    }
    autoStarted.current = true;
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

  useEffect(() => {
    if (!loaded) return;
    const brief = String(narrativeRef.current.brief ?? "");
    const location = String(narrativeRef.current.location ?? "");
    const staleBrief = /vacant land\s*\(/i.test(brief);
    const staleLocation =
      /situated in a[^.]{0,40}%/i.test(location) ||
      /built up over 75/i.test(location) ||
      /built up under 25/i.test(location) ||
      /built up 25%\s*to\s*75/i.test(location);
    if (!staleBrief && !staleLocation) return;
    void narrativeOpts().then((opts) => {
      const full = generateNarrative(draft.values, opts);
      const patch: Partial<ReportNarrative> = {};
      if (staleBrief && full.brief) patch.brief = full.brief;
      if (staleLocation && full.location) patch.location = full.location;
      if (Object.keys(patch).length === 0) return;
      setNarrative(patch);
      narrativeRef.current = { ...narrativeRef.current, ...patch };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rewrite known stale templates once after load
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

      setMeta({
        nbhdClaims: mergeNbhdClaims(
          (draft.reportMeta.nbhdClaims as NbhdClaim[] | undefined) ?? [],
          claims,
        ),
      });
      const merged = mergeNbhdClaims(
        (draft.reportMeta.nbhdClaims as NbhdClaim[] | undefined) ?? [],
        claims,
      );
      const estateN = merged.filter((c) => c.kind === "estate").length;
      setLastStatus(
        merged.length
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
    const remaining = keys.filter(
      (k) => k !== "remarks" && k !== "riskAnalysis" && !skipAiNarrativeBlock(draft.values, k),
    );
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
            },
          });

          const text =
            typeof result === "string"
              ? result
              : result && typeof result === "object" && "text" in result
                ? String((result as { text: unknown }).text ?? "")
                : "";

          if (text.trim()) next[key] = text.trim();
          else applyInspectionFill([key]);
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

      {shawnExam ? <RiskRatingsPanel controller={controller} /> : null}

      {BLOCKS.map((block) => {
        const blockText =
          block.key === "remarks"
            ? localRemarks
            : String(draft.narrative[block.key] ?? "");
        return (
        <div key={block.key} className="block">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{block.label}</span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={narrativePrints(draft.reportMeta, block.key)}
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
            </div>
          </div>
          <span className="mb-2 block text-sm text-muted-foreground">{block.hint}</span>
          <textarea
            value={blockText}
            onChange={(e) => {
              const val = e.target.value;
              if (block.key === "remarks") setLocalRemarks(val);
              setNarrative({ [block.key]: val });
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
            rows={block.key === "remarks" ? 12 : 7}
            className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          {block.key === "neighbourhood" &&
          (neighbourhoodAssistEnabled(String(draft.values["prop_assignment"] ?? "")) ||
            shawnExam) ? (
            <div className="mt-2 space-y-2 rounded-md border border-amber-300/80 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-foreground">
                Suburb notes (trial). Search first, tick the lines you accept, then rewrite the
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
        </div>
        );
      })}
    </div>
  );
}
