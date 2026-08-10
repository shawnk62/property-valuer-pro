export type AiProviderId = "openai" | "xai" | "custom";

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  /** Required for xAI and custom OpenAI-compatible providers. */
  baseUrl?: string | undefined;
}

export interface ProviderMeta {
  id: AiProviderId;
  label: string;
  description: string;
  defaultModel: string;
  modelSuggestions: string[];
  baseUrl?: string;
  requiresBaseUrl: boolean;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "Official OpenAI API (GPT models).",
    defaultModel: "gpt-4o",
    modelSuggestions: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3-mini"],
    baseUrl: "https://api.openai.com/v1",
    requiresBaseUrl: false,
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    description: "Direct connection to the xAI OpenAI-compatible API.",
    defaultModel: "grok-3-latest",
    modelSuggestions: ["grok-3-latest", "grok-3-mini-latest", "grok-2-latest"],
    baseUrl: "https://api.x.ai/v1",
    requiresBaseUrl: false,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    description: "Any OpenAI-compatible endpoint (bring your own base URL).",
    defaultModel: "gpt-4o",
    modelSuggestions: ["gpt-4o", "gpt-4o-mini"],
    requiresBaseUrl: true,
  },
];

export function providerMeta(id: AiProviderId): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
