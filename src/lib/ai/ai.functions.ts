import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createAiProvider } from "./ai-gateway.server";
import type { AiSettings } from "./types";
import { providerMeta } from "./types";
import { buildBlockPrompt } from "@/lib/narrative/promptBuilders";
import type { InspectionValues } from "@/lib/inspection/types";

/** Strip zero-width / smart-paste characters common on iPad when pasting keys. */
function cleanSecret(s: string): string {
  let out = s
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
  // Pasted "Bearer xai-..." would become Authorization: Bearer Bearer xai-...
  out = out.replace(/^(Bearer\s+)/i, "").trim();
  // Surrounding quotes from some password managers
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

/** Safe fingerprint so the user can compare iPad vs desktop without exposing the key. */
function keyFingerprint(apiKey: string): string {
  const k = cleanSecret(apiKey);
  if (!k) return "(empty)";
  const prefix = k.slice(0, Math.min(7, k.length));
  const suffix = k.length > 10 ? k.slice(-4) : "";
  return `${prefix}…${suffix} (len ${k.length})`;
}

const SettingsInput = z
  .object({
    provider: z.enum(["openai", "xai", "custom"]),
    model: z.string().min(1),
    apiKey: z.string().min(1),
    baseUrl: z.union([z.string(), z.null(), z.undefined()]).optional(),
  })
  .transform((raw) => {
    const model = raw.model.trim();
    const apiKey = cleanSecret(raw.apiKey);
    const baseUrlRaw = typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : "";
    const out: {
      provider: "openai" | "xai" | "custom";
      model: string;
      apiKey: string;
      baseUrl?: string;
    } = {
      provider: raw.provider,
      model,
      apiKey,
    };
    if (baseUrlRaw) out.baseUrl = baseUrlRaw;
    return out;
  });

function parseSettingsInput(input: unknown) {
  // Accept either the settings object or { data: settings } if a client double-wraps.
  const raw =
    input &&
    typeof input === "object" &&
    "data" in input &&
    (input as { data: unknown }).data &&
    typeof (input as { data: unknown }).data === "object" &&
    "provider" in ((input as { data: unknown }).data as object)
      ? (input as { data: unknown }).data
      : input;
  try {
    return SettingsInput.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const detail = err.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`).join("; ");
      throw new Error(`Invalid AI settings (${detail})`);
    }
    throw err;
  }
}

function asAiSettings(data: z.infer<typeof SettingsInput>): AiSettings {
  const settings: AiSettings = {
    provider: data.provider,
    model: data.model,
    apiKey: data.apiKey,
  };
  if (data.baseUrl) settings.baseUrl = data.baseUrl;
  return settings;
}

function formatAiError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const any = err as Error & { statusCode?: number; responseBody?: string; data?: unknown; cause?: unknown };
  const parts = [any.message];
  if (any.statusCode) parts.push(`HTTP ${any.statusCode}`);
  if (typeof any.responseBody === "string" && any.responseBody.trim()) {
    parts.push(any.responseBody.slice(0, 400));
  } else if (any.cause instanceof Error && any.cause.message) {
    parts.push(any.cause.message);
  }
  return parts.filter(Boolean).join(" — ");
}

const ValueCell = z.union([
  z.string(),
  z.boolean(),
  z.array(z.string()),
  z.number(),
  z.null(),
  z.undefined(),
]);

const GenerateBlockInput = z.object({
  settings: SettingsInput,
  blockKey: z.string().min(1),
  // Allow extra shapes from stored inspection JSON; prompt builder reads safely.
  values: z.record(z.unknown()),
  locationContext: z.string().optional(),
});

const ExtractPropertyInput = z.object({
  settings: SettingsInput,
  source: z.enum(["text", "file"]),
  text: z.string().optional(),
  file: z.object({ mimeType: z.string(), base64: z.string() }).optional(),
});

function createModel(settings: AiSettings) {
  const meta = providerMeta(settings.provider);
  if (!meta) throw new Error("Unknown AI provider");
  const provider = createAiProvider(settings);
  return provider(settings.model);
}


/**
 * xAI Grok API rejects role:"system" in messages / the system field on some models
 * ("Use the instructions option instead"). Fold system text into the user turn so
 * OpenAI, xAI, and custom OpenAI-compatible endpoints all accept the same calls.
 */
function foldSystemIntoPrompt(system: string | undefined, prompt: string): string {
  const s = system?.trim();
  if (!s) return prompt;
  return `${s}\n\n${prompt}`;
}


export const testAiConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => parseSettingsInput(input))
  .handler(async ({ data }) => {
    try {
      const settings = asAiSettings(data);
      if (!settings.apiKey) {
        return { ok: false, response: "API key is empty after cleaning. Re-paste the key and Save." };
      }
      const model = createModel(settings);
      const { text } = await generateText({
        model,
        prompt: "Reply with exactly: connection ok",
      });
      return { ok: text.toLowerCase().includes("ok"), response: text };
    } catch (err) {
      let message = formatAiError(err);
      try {
        const settings = asAiSettings(data);
        message = `${message} | key sent: ${keyFingerprint(settings.apiKey)}`;
      } catch {
        /* ignore */
      }
      // Return structured failure so the iPad UI shows the real cause (not generic Bad Request)
      return { ok: false, response: message };
    }
  });

function parseGenerateBlockInput(input: unknown) {
  const raw =
    input &&
    typeof input === "object" &&
    "data" in input &&
    (input as { data: unknown }).data &&
    typeof (input as { data: unknown }).data === "object" &&
    "blockKey" in ((input as { data: unknown }).data as object)
      ? (input as { data: unknown }).data
      : input;
  return GenerateBlockInput.parse(raw);
}

export const generateNarrativeBlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => parseGenerateBlockInput(input))
  .handler(async ({ data }) => {
    try {
      const settings = asAiSettings(data.settings);
      const model = createModel(settings);
      const { system, prompt } = buildBlockPrompt(
        data.blockKey,
        data.values as InspectionValues,
        { locationContext: data.locationContext },
      );

      const { text } = await generateText({
        model,
        prompt: foldSystemIntoPrompt(system, prompt),
      });

      return { text: text.trim() };
    } catch (err) {
      throw new Error(formatAiError(err));
    }
  });

const SearchNbhdInput = z.object({
  settings: SettingsInput,
  suburb: z.string(),
  city: z.string().optional(),
  address: z.string().optional(),
  estate: z.string().optional(),
});

export const searchNeighbourhoodFacts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchNbhdInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const place = [data.suburb, data.city, "Queensland", "Australia"].filter(Boolean).join(", ");
    const estateHint = data.estate?.trim();
    const prompt = `Search the public web for factual suburb-profile notes about ${place}${
      data.address ? ` (property near ${data.address})` : ""
    }${estateHint ? ` including any estate named ${estateHint}` : ""}. Also identify the named housing estate or masterplanned community that contains or adjoins the address if sources name one.

Return ONLY a JSON array of as many supported facts as you find (aim for 10–25 items). Each item:
{"kind":"city"|"population"|"gentrification"|"estate"|"character"|"amenities"|"transport"|"other","text":"one sentence","source":"url or publisher"}

Prefer ABS, QGSO, Queensland Government, the local council, and named official suburb or estate pages. Retail suburb-profile pages may be used if they cite a source.

Collect, do not filter for the valuer:
- city / region placement and whether the suburb is established, developing or in a growth corridor
- census or official population and year
- named estates and any stated completion population
- gentrification or demographic change if a source discusses it
- character (hinterland, beachside, family residential, industrial)
- named shopping centres, town centres, schools, stations or motorways if a reputable page names them (no invented distances)

Do not invent numbers or names. Do not omit a sourced fact because it might be unused. If a source conflicts, include both lines with their sources.`;

    const estatePrompt = `Search the public web for the named housing estate, residential estate or masterplanned community at or next to ${
      data.address || place
    } in ${place}.
${estateHint ? `The inspection may refer to ${estateHint}. Confirm and expand from official or developer pages.` : "If the address sits in a named estate, identify that estate."}

Return ONLY a JSON array. Each item:
{"kind":"estate","text":"one sentence","source":"url or publisher"}

Include every sourced detail you find: estate name, developer, stages, dwelling yield, completion or expected population, lot size character, and adjoining estates. Prefer council, developer and Queensland Government pages. Do not invent names or figures. Do not omit a named estate because you already described the suburb.`;

    const base = (settings.baseUrl || "https://api.x.ai/v1").replace(/\/$/, "");

    async function xaiSearch(userPrompt: string): Promise<string> {
      const res = await fetch(`${base}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          input: [{ role: "user", content: userPrompt }],
          tools: [{ type: "web_search" }],
        }),
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        output_text?: string;
        output?: Array<{
          type?: string;
          content?: Array<{ type?: string; text?: string }>;
        }>;
        choices?: Array<{ message?: { content?: string } }>;
      };
      if (!res.ok) {
        throw new Error(json.error?.message || `Neighbourhood search failed (${res.status})`);
      }
      const fromOutput = (json.output ?? [])
        .flatMap((item) => item.content ?? [])
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();
      const walked: string[] = [];
      const walk = (node: unknown) => {
        if (!node) return;
        if (typeof node === "string" && node.length > 20) walked.push(node);
        else if (Array.isArray(node)) node.forEach(walk);
        else if (typeof node === "object") Object.values(node as object).forEach(walk);
      };
      walk(json.output);
      return (
        json.output_text?.trim() ||
        fromOutput ||
        walked.filter((s) => s.includes("kind") || s.includes("estate")).join("\n") ||
        json.choices?.[0]?.message?.content?.trim() ||
        "[]"
      );
    }

    if (settings.provider === "xai") {
      const suburbRaw = await xaiSearch(prompt);
      const estateRaw = await xaiSearch(estatePrompt);
      return { raw: `${suburbRaw}\n\n${estateRaw}` };
    }

    const model = createModel(settings);
    const first = await generateText({ model, prompt });
    const second = await generateText({ model, prompt: estatePrompt });
    return { raw: `${first.text.trim()}\n\n${second.text.trim()}` };
  });

const SearchMarketInput = z.object({
  settings: SettingsInput,
  scale: z.enum(["australia", "state", "region", "locality"]),
  suburb: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
});

export const searchMarketFacts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchMarketInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const state = (data.state || "Queensland").trim();
    const city = (data.city || "").trim();
    const suburb = (data.suburb || "").trim();
    const place = [suburb, city, state, "Australia"].filter(Boolean).join(", ");
    const scalePrompt =
      data.scale === "australia"
        ? `Search the public web for current Australian residential property market commentary suitable for a valuation report.
Cover: national dwelling values and recent movement, credit / interest-rate conditions, housing supply and demand, and any official or widely cited outlook.
Prefer RBA, ABS, CoreLogic, PropTrack, Treasury and major bank research.`
        : data.scale === "state"
          ? `Search the public web for current ${state} residential property market commentary suitable for a valuation report.
Cover: state dwelling values and recent movement, supply, migration or population effects on housing, and any official or widely cited outlook.
Prefer Queensland Government, QGSO, CoreLogic state pages and major bank state reports.`
          : data.scale === "region"
            ? `Search the public web for current residential property market commentary for the region around ${place}.
Cover: local or city-region dwelling values and recent movement, supply of similar land or dwellings, demand drivers, and any official or widely cited local outlook.
Prefer council, CoreLogic suburb/city pages and state government regional notes.`
            : `Search the public web for current residential property market commentary for the suburb or immediate locality of ${place}${
                data.address ? ` (near ${data.address})` : ""
              }.
Cover: suburb or estate-level values and recent movement, days on market, supply of similar lots or dwellings, buyer demand, and any cited local price range.
Prefer CoreLogic / PropTrack suburb pages, council and reputable local market notes.
Do not write a physical locality description (character, amenities, transport distances) unless a market source uses it as a demand driver.`;

    const prompt = `${scalePrompt}

Return ONLY a JSON array of as many supported facts as you find (aim for 8–20 items). Each item:
{"kind":"${data.scale}","text":"one sentence","source":"url or publisher"}

Do not invent numbers. Do not omit a sourced fact because it might be unused. If sources conflict, include both lines with their sources.
Do not write suburb character, estate names or amenity distances unless a market source uses them as a demand driver.`;

    const base = (settings.baseUrl || "https://api.x.ai/v1").replace(/\/$/, "");
    if (settings.provider === "xai") {
      const res = await fetch(`${base}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          input: [{ role: "user", content: prompt }],
          tools: [{ type: "web_search" }],
        }),
      });
      const json = (await res.json()) as {
        error?: { message?: string };
        output_text?: string;
        output?: Array<{
          type?: string;
          content?: Array<{ type?: string; text?: string }>;
        }>;
        choices?: Array<{ message?: { content?: string } }>;
      };
      if (!res.ok) {
        throw new Error(json.error?.message || `Market search failed (${res.status})`);
      }
      const fromOutput = (json.output ?? [])
        .flatMap((item) => item.content ?? [])
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();
      return {
        raw:
          json.output_text?.trim() ||
          fromOutput ||
          json.choices?.[0]?.message?.content?.trim() ||
          "[]",
      };
    }
    const model = createModel(settings);
    const result = await generateText({ model, prompt });
    return { raw: result.text.trim() || "[]" };
  });

const SaleNarrativeInput = z.object({
  settings: SettingsInput,
  system: z.string().min(1),
  prompt: z.string().min(1),
});

export const generateSaleNarrative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaleNarrativeInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const model = createModel(settings);
    const { text } = await generateText({
      model,
      prompt: foldSystemIntoPrompt(data.system, data.prompt),
    });
    return { text: text.trim() };
  });


const ExtractionSchema = z.object({
  candidates: z.record(z.string().nullable()),
});


const CmaSaleSchema = z.object({
  address: z.string().nullable().optional(),
  saleDate: z.string().nullable().optional(),
  salePrice: z.string().nullable().optional(),
  landArea: z.string().nullable().optional(),
  gla: z.string().nullable().optional(),
  beds: z.string().nullable().optional(),
  baths: z.string().nullable().optional(),
  cars: z.string().nullable().optional(),
  yearBuilt: z.string().nullable().optional(),
  distance: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  comparisonNotes: z.string().nullable().optional(),
});

const CmaSalesExtractionSchema = z.object({
  sales: z.array(CmaSaleSchema),
});

const ExtractCmaSalesInput = z.object({
  settings: SettingsInput,
  source: z.enum(["text", "file"]),
  text: z.string().optional(),
  file: z
    .object({
      mimeType: z.string(),
      base64: z.string().min(1),
    })
    .optional(),
});

export const extractComparableSales = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractCmaSalesInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const model = createModel(settings);

    const system = `You extract comparable sales from an Australian Cotality / RP Data CMA (Comparative Market Analysis) PDF or pasted text.
Return JSON: { "sales": [ { ...fields } ] }.
For each comparable sale include:
- address (full street address including suburb/state/postcode when shown)
- saleDate (as printed, e.g. 16-Jun-26)
- salePrice (include $ and commas as printed)
- landArea (e.g. 390m²)
- gla (floor / living area e.g. 177m²)
- beds, baths, cars as strings when shown
- yearBuilt, distance when shown
- comments: short property description paragraph if present
- comparisonNotes: the COMPARABLE / SUPERIOR / INFERIOR lines exactly when present (preserve those labels)
Extract EVERY comparable sale listed (often 3–12+). Do not stop after three.
Skip floor-plan-only pages, disclaimer pages, and the subject property itself.
Do not invent sales. If none found, return { "sales": [] }.`;

    // xAI rejects role:"system" and also rejects structured-output paths that
    // inject a system message ("Use the instructions option instead").
    // Always send a single user turn with instructions folded into the prompt.
    try {
      if (data.source === "file" && data.file?.base64) {
        const filePart = {
          type: "file" as const,
          data: data.file.base64,
          mediaType: data.file.mimeType || "application/pdf",
        };
        try {
          const { text } = await generateText({
            model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: foldSystemIntoPrompt(
                      system,
                      "Extract all comparable sales from the attached CMA PDF. Return only JSON: {\"sales\":[...]}",
                    ),
                  },
                  filePart,
                ],
              },
            ],
          });
          const parsed = parseCmaSalesResponse(text);
          return { sales: parsed.sales, error: null as string | null };
        } catch (err) {
          const message = err instanceof Error ? err.message : "PDF extract failed";
          return { sales: [], error: message };
        }
      }

      const userText = data.text ?? "";
      if (!userText.trim()) {
        return { sales: [], error: "No CMA text provided." };
      }

      const { text } = await generateText({
        model,
        prompt: foldSystemIntoPrompt(
          system,
          `CMA text:

${userText}

Return only JSON: {"sales":[...]}`,
        ),
      });
      const parsed = parseCmaSalesResponse(text);
      return { sales: parsed.sales, error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "CMA extract failed";
      return { sales: [], error: message };
    }
  });

function parseCmaSalesResponse(text: string): { sales: z.infer<typeof CmaSaleSchema>[] } {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return CmaSalesExtractionSchema.parse(
      parsed?.sales ? parsed : { sales: Array.isArray(parsed) ? parsed : [] },
    );
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return CmaSalesExtractionSchema.parse(
          parsed?.sales ? parsed : { sales: Array.isArray(parsed) ? parsed : [] },
        );
      } catch {
        /* fall through */
      }
    }
  }
  return { sales: [] };
}


export const extractPropertyData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractPropertyInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const model = createModel(settings);

    const system = `You extract property identification data for a Queensland valuation inspection form.
Source documents are usually Landchecker Property Reports (or similar planning summaries).
Return JSON only: {"candidates": { "<field>": "<value or null>", ... }}.
Accuracy is critical. Extract only facts explicitly stated. Never invent values.
Ignore sales history, nearby permits lists, school lists, and terms-and-conditions unless needed for a mapped field.`;

    // Must match inspection-schema.json field names exactly
    const fieldList = [
      "prop_address",
      "prop_suburb",
      "prop_state",
      "prop_postcode",
      "prop_lotplan",
      "prop_title",
      "prop_legal",
      "prop_lga",
      "prop_sitearea",
      "prop_areaunit",
      "prop_dimensions",
      "prop_orientation",
      "prop_zoning",
      "prop_zoning_desc",
      "prop_flood",
      "prop_flood_map",
      "prop_adverse_site",
      "prop_place_based",
      "imp_beds",
      "imp_baths",
    ];

    const extractionPrompt = `Extract the following fields from the Landchecker Property Report (or similar planning summary).
Return ONLY valid JSON: {"candidates": { "<field>": "<value or null>", ... }}.
Exact field names only:
${fieldList.join(", ")}

Landchecker "Details" page (must capture when present):
- LOCAL GOVERNMENT (COUNCIL) → prop_lga (e.g. "Sunshine Coast Regional")
- LAND SIZE → prop_sitearea = numeric only (e.g. "1915" from "1,915m² Approx"); prop_areaunit = "m2" or "ha"
- ORIENTATION → prop_orientation (e.g. "East")
- FRONTAGE → include in prop_dimensions as "Frontage 26.87m" (strip "Approx")
- ZONES → prop_zoning = the zone title as written (e.g. "Low Density Residential")
- ZONES purpose paragraph on the Zones page ("The purpose of the Low density residential zone…") → prop_zoning_desc (full paragraph when present; else same as prop_zoning)
- OVERLAYS list → prop_adverse_site as a concise semicolon-separated list of each overlay name that affects the subject (e.g. "Caloundra Obstacle Limitation Surface Area; Caloundra Obstacle Limitation Surface Contour; Land Above 5m Ahd And Below 20m Ahd; Moderate Hazard Area")
- LOT/PLAN → prop_lotplan and prop_legal (e.g. "Lot 7 RP85297")
- PropTrack HOUSE bed/bath/car icons → imp_beds, imp_baths (numbers only, e.g. "3", "1"). Ignore car count if no field for it.
- Full address on cover → prop_address = street only ("13 Banksia Street"); prop_suburb; prop_state; prop_postcode

Flood / bushfire / landslide / acid sulfate pages:
- prop_flood = "Yes" if affected / in flood area; "No" if Unaffected / not subject to flood; "Unknown" if flood not mentioned
- prop_flood_map = short source (e.g. "Landchecker flood layers / Sunshine Coast Regional Council")
- If landslide or acid sulfate is Affected, append those facts to prop_adverse_site

Place-based plans section (critical):
- prop_place_based = the full place-based plan identification AND purpose / overall outcomes text for plans that affect the property (e.g. Caloundra Local Plan Area, Moffat Beach / Shelly Beach – CAL LPP-2 and the purpose paragraphs). Preserve structure; do not summarise away the purpose statements. If the report says there are no place-based plans, use null.

Rules:
- Prefer null over guessing. "Unavailable" → null.
- Do not invent boundary lengths from map images.
- Do not put suburb into prop_address.

Property summary:
${data.source === "text" ? (data.text ?? "") : "[Landchecker Property Report file attached — extract from Details, Zones, Flood, and Place-based Plans sections]"}`;

    // Prefer text path when the client already extracted PDF text (most reliable).
    // xAI rejects system messages and structured-output helpers that inject them —
    // use a single user message with instructions folded into the prompt.
    if (data.source === "file" && data.file?.base64) {
      const filePart = {
        type: "file" as const,
        data: data.file.base64,
        mediaType: data.file.mimeType || "application/pdf",
      };
      const userText = (data.text ?? "").trim();
      const promptWithOptionalText = userText
        ? `${extractionPrompt}

Additional extracted PDF text:
${userText.slice(0, 100_000)}`
        : extractionPrompt;

      try {
        const { text: raw } = await generateText({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: foldSystemIntoPrompt(
                    system,
                    `${promptWithOptionalText}

Return only JSON: {"candidates":{...}}.`,
                  ),
                },
                filePart,
              ],
            },
          ],
        });
        return parseExtractionResponse(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : "PDF extract failed";
        if (userText) {
          const { text: raw } = await generateText({
            model,
            prompt: foldSystemIntoPrompt(
              system,
              `${extractionPrompt}

${userText.slice(0, 100_000)}

Return only JSON: {"candidates":{...}}.`,
            ),
          });
          return parseExtractionResponse(raw);
        }
        throw new Error(message);
      }
    }

    const userText = (data.text ?? "").trim();
    if (!userText) {
      return { candidates: {} };
    }

    const { text: raw } = await generateText({
      model,
      prompt: foldSystemIntoPrompt(
        system,
        `${extractionPrompt}

Return only JSON: {"candidates":{...}}.`,
      ),
    });
    return parseExtractionResponse(raw);
  });

function parseExtractionResponse(text: string): { candidates: Record<string, string | null> } {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && parsed.candidates) {
      return ExtractionSchema.parse(parsed);
    }
    // Model sometimes returns flat field map
    if (parsed && typeof parsed === "object") {
      return ExtractionSchema.parse({ candidates: parsed });
    }
  } catch {
    // try to find first {...} block
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        if (parsed?.candidates) return ExtractionSchema.parse(parsed);
        if (parsed && typeof parsed === "object") {
          return ExtractionSchema.parse({ candidates: parsed });
        }
      } catch {
        /* fall through */
      }
    }
  }
  return { candidates: {} };
}
