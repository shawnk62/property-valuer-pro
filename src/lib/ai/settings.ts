import type { AiProviderId, AiSettings } from "./types";
import { providerMeta } from "./types";

const KEY = "qld-ai-settings-v1";

function read(): Partial<AiSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<AiSettings>;
  } catch {
    return {};
  }
}

function write(settings: AiSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}

function buildSettings(
  provider: AiProviderId,
  model: string,
  apiKey: string,
  baseUrl?: string,
): AiSettings {
  const settings: AiSettings = { provider, model, apiKey };
  if (baseUrl) settings.baseUrl = baseUrl;
  return settings;
}

export function defaultSettings(): AiSettings {
  const provider: AiProviderId = "openai";
  const meta = providerMeta(provider)!;
  return buildSettings(provider, meta.defaultModel, "", meta.baseUrl);
}

export function loadAiSettings(): AiSettings {
  const saved = read();
  const provider = (saved.provider ?? "openai") as AiProviderId;
  const meta = providerMeta(provider) ?? providerMeta("openai")!;
  return buildSettings(
    provider,
    saved.model?.trim() || meta.defaultModel,
    saved.apiKey?.trim() ?? "",
    saved.baseUrl?.trim() || meta.baseUrl,
  );
}

export function saveAiSettings(settings: AiSettings) {
  write(settings);
}

export function isAiConfigured(settings?: AiSettings): boolean {
  const s = settings ?? loadAiSettings();
  return s.provider.length > 0 && s.model.trim().length > 0 && s.apiKey.trim().length > 0;
}
