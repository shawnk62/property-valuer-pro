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

const GenerateBlockInput = z.object({
  settings: SettingsInput,
  blockKey: z.string().min(1),
  values: z.record(z.union([z.string(), z.boolean(), z.array(z.string()), z.undefined()])),
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

const ExtractionSchema = z.object({
  candidates: z.record(z.string().nullable()),
});

export const extractPropertyData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractPropertyInput.parse(input))
  .handler(async ({ data }) => {
    const settings = asAiSettings(data.settings);
    const model = createModel(settings);

    const system = `You are extracting property identification details from a Landchecker or similar property summary.
Return a JSON object with a single key "candidates" whose value is an object mapping field names to extracted string values.
Use null when a field is not present. Do not guess — only extract what is explicitly stated.`;

    const fieldList = [
      "prop_address",
      "prop_suburb",
      "prop_state",
      "prop_postcode",
      "prop_lot_plan",
      "prop_title_ref",
      "prop_legal_desc",
      "prop_lga",
      "prop_land_area",
      "prop_zoning",
      "prop_use",
      "prop_town_planning",
    ];

    const extractionPrompt = `Extract the following fields from the property summary below and return them as JSON:
${fieldList.join(", ")}

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
        try {
          const parsed = JSON.parse(text);
          return ExtractionSchema.parse(parsed);
        } catch {
          return { candidates: {} };
        }
      }
    }

    const { text } = await generateText({
      model,
      system,
      prompt: extractionPrompt,
    });

    try {
      const parsed = JSON.parse(text);
      return ExtractionSchema.parse(parsed);
    } catch {
      return { candidates: {} };
    }
  });
