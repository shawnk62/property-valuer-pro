import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Eye, EyeOff, Save, TestTube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROVIDERS, type AiProviderId } from "@/lib/ai/types";
import { testAiConnection } from "@/lib/ai/ai.functions";
import { defaultSettings, loadAiSettings, saveAiSettings } from "@/lib/ai/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "AI Settings — QLD Inspections" },
      {
        name: "description",
        content: "Configure the AI provider and model used for narrative generation and Landchecker data extraction.",
      },
      { property: "og:title", content: "AI Settings — QLD Inspections" },
      {
        property: "og:description",
        content: "Configure the AI provider and model used for narrative generation and Landchecker data extraction.",
      },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const initial = useMemo(() => loadAiSettings(), []);
  const [provider, setProvider] = useState<AiProviderId>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  const meta = PROVIDERS.find((p) => p.id === provider)!;
  const isCustom = !meta.usesLovableGateway;

  const settings = useMemo(
    () => ({
      provider,
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseUrl: isCustom ? baseUrl.trim() || undefined : undefined,
    }),
    [provider, model, apiKey, baseUrl, isCustom],
  );

  const save = () => {
    saveAiSettings(settings);
    toast.success("AI settings saved");
  };

  const test = async () => {
    if (!settings.apiKey || !settings.model) {
      toast.error("Provider and API key are required");
      return;
    }
    setTesting(true);
    try {
      const result = await testAiConnection({ data: settings });
      if (result.ok) {
        toast.success("Connection OK", { description: result.response });
      } else {
        toast.error("Connection failed", { description: result.response });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection test failed";
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to inspections">
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Settings</p>
            <h1 className="font-serif text-xl font-semibold text-foreground">AI provider</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">LLM configuration</CardTitle>
            <CardDescription>
              Choose the provider and model used for narrative generation and Landchecker extraction. Your API key is
              stored in this browser only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={provider}
                onValueChange={(value) => {
                  const next = value as AiProviderId;
                  setProvider(next);
                  const nextMeta = PROVIDERS.find((p) => p.id === next)!;
                  if (!model.trim() || PROVIDERS.some((p) => p.modelSuggestions.includes(model.trim()))) {
                    setModel(nextMeta.defaultModel);
                  }
                  setBaseUrl(nextMeta.baseUrl ?? "");
                }}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={meta.defaultModel}
                list="model-suggestions"
              />
              <datalist id="model-suggestions">
                {meta.modelSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">Suggested: {meta.modelSuggestions.join(", ")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Never shared outside this app.</p>
            </div>

            {isCustom && (
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.x.ai/v1"
                />
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button variant="outline" onClick={test} disabled={testing} className="flex-1">
                <TestTube className="size-4" />
                {testing ? "Testing..." : "Test connection"}
              </Button>
              <Button onClick={save} className="flex-1">
                <Save className="size-4" />
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline underline-offset-2">
            Back to inspections
          </Link>
        </p>
      </main>
    </div>
  );
}
