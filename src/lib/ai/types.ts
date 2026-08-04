export type AiProviderId = "openai" | "google" | "anthropic" | "xai";

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  // Only used for the xAI / custom OpenAI-compatible option.
  baseUrl?: string | undefined;
}

export interface ProviderMeta {
  id: AiProviderId;
  label: string;
  description: string;
  defaultModel: string;
  modelSuggestions: string[];
  usesLovableGateway: boolean;
  baseUrl?: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT models via the Lovable AI Gateway.",
    defaultModel: "openai/gpt-5.6-sol",
    modelSuggestions: ["openai/gpt-5.6-sol", "openai/gpt-4.1", "openai/gpt-4o-mini"],
    usesLovableGateway: true,
  },
  {
    id: "google",
    label: "Google (Gemini)",
    description: "Gemini models via the Lovable AI Gateway.",
    defaultModel: "google/gemini-2.5-flash-preview",
    modelSuggestions: [
      "google/gemini-2.5-flash-preview",
      "google/gemini-2.5-pro-preview",
      "google/gemini-2.0-flash-001",
    ],
    usesLovableGateway: true,
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    description: "Claude models via the Lovable AI Gateway.",
    defaultModel: "anthropic/claude-sonnet-4-20250514",
    modelSuggestions: [
      "anthropic/claude-sonnet-4-20250514",
      "anthropic/claude-opus-4-20250514",
      "anthropic/claude-3-5-haiku-20241022",
    ],
    usesLovableGateway: true,
  },
  {
    id: "xai",
    label: "xAI (Grok) — custom endpoint",
    description: "Direct connection to the xAI OpenAI-compatible API.",
    defaultModel: "grok-3-latest",
    modelSuggestions: ["grok-3-latest", "grok-3-mini-latest", "grok-2-latest"],
    usesLovableGateway: false,
    baseUrl: "https://api.x.ai/v1",
  },
];

export function providerMeta(id: AiProviderId): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
