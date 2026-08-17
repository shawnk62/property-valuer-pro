import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAiProvider } from "./ai-gateway.server";
import type { AiSettings } from "./types";
import { providerMeta } from "./types";
import { buildBlockPrompt } from "@/lib/narrative/promptBuilders";
import type { InspectionValues } from "@/lib/inspection/types";

const SettingsInput = z.object({
  provider: z.enum(["openai", "xai", "custom"]),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
});

function asAiSettings(data: z.infer<typeof SettingsInput>): AiSettings {
  const settings: AiSettings = {
    provider: data.provider,
    model: data.model,
    apiKey: data.apiKey,
  };
  if (data.baseUrl) settings.baseUrl = data.baseUrl;
  return settings;
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
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data);
    const model = createModel(settings);
    const { text } = await generateText({
      model,
      prompt: "Reply with exactly: connection ok",
    });
    return { ok: text.toLowerCase().includes("ok"), response: text };
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

    const system = `You are extracting property identification details from a Landchecker or similar property summary.
Return a JSON object with a single key "candidates" whose value is an object mapping field names to extracted string values.
Use null when a field is not present. Do not guess — only extract what is explicitly stated.`;

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
      "prop_adverse_site",
    ];

    const extractionPrompt = `Extract the following fields from the property summary below.
Return ONLY valid JSON of the form {"candidates": { "<field>": "<value or null>", ... }}.
Use these exact field names (do not invent alternatives):
${fieldList.join(", ")}

Mapping hints:
- prop_lotplan = lot and plan (e.g. Lot 44 RP884458)
- prop_lga = council / local government
- prop_zoning = zone CODE only from the ZONES field (e.g. LDR, CR, MDR). Do not put the full name here.
- prop_zoning_desc = zone NAME / description (e.g. Low Density Residential). If the source says "LDR - Low Density Residential", put "LDR" in prop_zoning and "Low Density Residential" in prop_zoning_desc. If a longer purpose paragraph exists (e.g. "The purpose of the low density residential zone…"), put that full paragraph in prop_zoning_desc instead of or after the short name.
- prop_adverse_site = overlays, flood, noise, airport surfaces, or other constraints listed
- prop_sitearea = land size only if an actual figure is stated (not "Premium report only")
- prop_state = QLD / NSW etc.
Do not guess. Use null when not explicitly stated.

Property summary:
${data.source === "text" ? (data.text ?? "") : "[file attached]"}`;

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
