import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AiSettings } from "./types";
import { providerMeta } from "./types";

/**
 * Creates an OpenAI-compatible provider for the selected settings.
 * Supports official OpenAI, xAI, and any custom base URL.
 */
export function createAiProvider(settings: AiSettings) {
  const meta = providerMeta(settings.provider);
  if (!meta) throw new Error(`Unknown AI provider: ${settings.provider}`);

  const baseURL =
    settings.baseUrl?.trim() ||
    meta.baseUrl ||
    (settings.provider === "openai" ? "https://api.openai.com/v1" : undefined);

  if (!baseURL) {
    throw new Error(
      settings.provider === "custom"
        ? "Custom provider requires a base URL"
        : `No base URL configured for provider ${settings.provider}`,
    );
  }

  return createOpenAICompatible({
    name: settings.provider,
    baseURL,
    apiKey: settings.apiKey,
  });
}
