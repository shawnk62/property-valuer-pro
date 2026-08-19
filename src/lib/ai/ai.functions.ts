import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
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
  values: z.record(ValueCell),
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

export const generateNarrativeBlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateBlockInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const model = createModel(settings);
    const { system, prompt } = buildBlockPrompt(data.blockKey, data.values as InspectionValues);

    const { text } = await generateText({
      model,
      system,
      prompt,
    });

    return { text: text.trim() };
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
      system: data.system,
      prompt: data.prompt,
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

    try {
      if (data.source === "file" && data.file?.base64) {
        const filePart = {
          type: "file" as const,
          data: data.file.base64,
          mediaType: data.file.mimeType || "application/pdf",
        };

        try {
          const { output } = await generateText({
            model,
            output: Output.object({ schema: CmaSalesExtractionSchema }),
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract all comparable sales from the attached CMA PDF." },
                  filePart,
                ],
              },
            ],
          });
          return { sales: output?.sales ?? [], error: null as string | null };
        } catch (err1) {
          // Retry with plain text generation, still attaching the file
          try {
            const { text } = await generateText({
              model,
              messages: [
                { role: "system", content: system },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Extract all comparable sales from the attached CMA PDF. Return only JSON.",
                    },
                    filePart,
                  ],
                },
              ],
            });
            const parsed = parseCmaSalesResponse(text);
            return { sales: parsed.sales, error: null as string | null };
          } catch (err2) {
            const message =
              err2 instanceof Error
                ? err2.message
                : err1 instanceof Error
                  ? err1.message
                  : "PDF extract failed";
            return { sales: [], error: message };
          }
        }
      }

      const userText = data.text ?? "";
      if (!userText.trim()) {
        return { sales: [], error: "No CMA text provided." };
      }

      try {
        const { output } = await generateText({
          model,
          output: Output.object({ schema: CmaSalesExtractionSchema }),
          system,
          prompt: `CMA text:

${userText}`,
        });
        return { sales: output?.sales ?? [], error: null as string | null };
      } catch {
        const { text } = await generateText({
          model,
          system,
          prompt: `CMA text:

${userText}`,
        });
        const parsed = parseCmaSalesResponse(text);
        return { sales: parsed.sales, error: null as string | null };
      }
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
      "prop_zoning",
      "prop_zoning_desc",
      "prop_flood",
      "prop_flood_map",
      "prop_adverse_site",
      "imp_beds",
      "imp_baths",
    ];

    const extractionPrompt = `Extract the following fields from the Landchecker (or similar) property report / summary.
Return ONLY valid JSON: {"candidates": { "<field>": "<value or null>", ... }}.
Exact field names only:
${fieldList.join(", ")}

Landchecker Property Report mapping (page "Details" and related sections):
- prop_address = street line only (e.g. "13 Banksia Street"). Do NOT include suburb/state/postcode here.
- prop_suburb = locality (e.g. "Shelly Beach")
- prop_state = QLD / NSW / VIC / etc. (2–3 letter code preferred)
- prop_postcode = 4-digit postcode only
- prop_lga = LOCAL GOVERNMENT (COUNCIL) value (e.g. "Sunshine Coast Regional")
- prop_lotplan = LOT/PLAN value as written (e.g. "Lot 7 RP85297")
- prop_legal = same as lot/plan description if no separate legal description
- prop_title = title reference only if explicitly stated (else null)
- prop_sitearea = LAND SIZE numeric part only (e.g. "1915" from "1,915m² Approx"). Strip commas and unit text.
- prop_areaunit = "m2" when land size is in square metres; "ha" for hectares
- prop_dimensions = FRONTAGE and any stated side lengths, e.g. "Frontage 26.87m" or combined boundary lengths if listed. Do not invent lengths from a map image.
- prop_zoning = short zone name/code from ZONES (e.g. "Low Density Residential"). If a code like LDR appears, prefer the code; otherwise the short zone title.
- prop_zoning_desc = zone purpose paragraph if present ("The purpose of the Low density residential zone…"); otherwise the full zone title
- prop_flood = "Yes" if the FLOOD section says the property is affected / in a flood area; "No" if Unaffected / not specified as affected; "Unknown" only if flood is not mentioned at all
- prop_flood_map = short source note e.g. "Landchecker / Sunshine Coast Regional Council flood layers"
- prop_adverse_site = concise list of OVERLAYS and other hazards that affect the subject (e.g. obstacle limitation, moderate hazard, landslide affected, acid sulfate affected). Include bushfire only if affected. Do not dump nearby-only layers.
- imp_beds / imp_baths = from PropTrack or dwelling summary icons/numbers when explicitly stated (e.g. HOUSE 3 bed 1 bath)

Rules:
- Prefer null over guessing.
- "Unavailable" → null.
- Do not put suburb into prop_address.
- Do not put the full address into prop_suburb.

Property summary:
${data.source === "text" ? (data.text ?? "") : "[Landchecker or property report file attached — read text from the document carefully]"}`;

    if (data.source === "file" && data.file) {
      try {
        const { output } = await generateText({
          model,
          output: Output.object({ schema: ExtractionSchema }),
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: extractionPrompt },
                {
                  type: "file",
                  data: { type: "data", data: data.file.base64 },
                  mediaType: data.file.mimeType,
                },
              ],
            },
          ],
        });
        return output;
      } catch {
        const { text } = await generateText({
          model,
          system,
          prompt: extractionPrompt,
        });
        return parseExtractionResponse(text);
      }
    }

    const { text } = await generateText({
      model,
      system,
      prompt: extractionPrompt,
    });

    return parseExtractionResponse(text);
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
