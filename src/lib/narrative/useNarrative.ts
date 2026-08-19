import { useCallback, useEffect, useState } from "react";
import { generateNarrativeBlock } from "@/lib/ai/ai.functions";
import { loadAiSettings } from "@/lib/ai/settings";
import type { InspectionValues } from "@/lib/inspection/types";
import { NARRATIVE_BLOCKS, type NarrativeBlock, type NarrativeState } from "./types";

const KEY = "qld-narrative-v1";

function storageKey(recordId: string) {
  return `${KEY}-${recordId}`;
}

function normalizeNarrativeState(raw: unknown): NarrativeState {
  const fallback = defaultNarrativeState();
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Partial<NarrativeState>;
  if (!Array.isArray(obj.blocks) || obj.blocks.length === 0) return fallback;
  // Reconcile against canonical block list (keys/headings)
  const byKey = new Map(
    obj.blocks
      .filter((b) => b && typeof b === "object" && typeof (b as NarrativeBlock).key === "string")
      .map((b) => [(b as NarrativeBlock).key, b as NarrativeBlock]),
  );
  return {
    startedAt: typeof obj.startedAt === "string" ? obj.startedAt : undefined,
    completedAt: typeof obj.completedAt === "string" ? obj.completedAt : undefined,
    blocks: NARRATIVE_BLOCKS.map((meta) => {
      const existing = byKey.get(meta.key);
      if (!existing) {
        return { key: meta.key, heading: meta.heading, status: "pending" as const, text: "" };
      }
      return {
        key: meta.key,
        heading: meta.heading,
        status: existing.status ?? "pending",
        text: typeof existing.text === "string" ? existing.text : "",
        model: existing.model,
        generatedAt: existing.generatedAt,
        error: existing.error,
      };
    }),
  };
}

function read(recordId: string): NarrativeState {
  if (typeof window === "undefined") return defaultNarrativeState();
  try {
    const raw = window.localStorage.getItem(storageKey(recordId));
    if (!raw) return defaultNarrativeState();
    return normalizeNarrativeState(JSON.parse(raw));
  } catch {
    return defaultNarrativeState();
  }
}

function write(recordId: string, state: NarrativeState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(recordId), JSON.stringify(state));
}

type BlockUpdate = {
  [K in keyof Omit<NarrativeBlock, "key" | "heading">]?: NarrativeBlock[K] | undefined;
};

function updateBlockState(
  state: NarrativeState,
  key: string,
  update: BlockUpdate,
): NarrativeState {
  return {
    ...state,
    blocks: state.blocks.map((b) => {
      if (b.key !== key) return b;
      const next: NarrativeBlock = { ...b };
      if (update.status !== undefined) next.status = update.status;
      if (update.text !== undefined) next.text = update.text;
      if (update.model !== undefined) next.model = update.model;
      if (update.generatedAt !== undefined) next.generatedAt = update.generatedAt;
      if (update.error !== undefined) next.error = update.error;
      else if ("error" in update) delete next.error;
      return next;
    }),
  };
}

export function defaultNarrativeState(): NarrativeState {
  return {
    blocks: NARRATIVE_BLOCKS.map((b) => ({
      key: b.key,
      heading: b.heading,
      status: "pending",
      text: "",
    })),
  };
}

export function useNarrative(recordId: string, values: InspectionValues, isSubmitted: boolean) {
  const [state, setState] = useState<NarrativeState>(() => read(recordId));

  useEffect(() => {
    setState(read(recordId));
  }, [recordId]);

  useEffect(() => {
    write(recordId, state);
  }, [recordId, state]);

  const generateBlock = useCallback(
    async (key: string) => {
      const settings = loadAiSettings();
      setState((prev) => updateBlockState(prev, key, { status: "writing" }));

      try {
        const { text } = await generateNarrativeBlock({
          data: { settings, blockKey: key, values },
        });
        setState((prev) =>
          updateBlockState(prev, key, {
            status: "done",
            text,
            model: settings.model,
            generatedAt: new Date().toISOString(),
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        setState((prev) => updateBlockState(prev, key, { status: "failed", error: message }));
      }
    },
    [values],
  );

  const generateAll = useCallback(async () => {
    const settings = loadAiSettings();
    if (!settings.apiKey || !settings.model) {
      const error = "AI provider not configured. Go to Settings and add your API key and model.";
      setState((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.status === "edited" ? b : { ...b, status: "failed", error },
        ),
      }));
      return;
    }

    setState((prev) => ({ ...prev, startedAt: new Date().toISOString() }));

    // Run blocks in parallel.
    await Promise.all(
      state.blocks.map((b) => {
        if (b.status === "edited") return Promise.resolve();
        return generateBlock(b.key);
      }),
    );

    setState((prev) => ({ ...prev, completedAt: new Date().toISOString() }));
  }, [generateBlock, state.blocks]);

  const updateBlock = useCallback((key: string, text: string) => {
    setState((prev) => updateBlockState(prev, key, { text, status: "edited" }));
  }, []);

  const resetBlock = useCallback(
    (key: string) => {
      setState((prev) => updateBlockState(prev, key, { status: "pending", text: "", error: undefined }));
      void generateBlock(key);
    },
    [generateBlock],
  );

  useEffect(() => {
    if (isSubmitted) {
      const pending = state.blocks.some((b) => b.status === "pending");
      if (pending) {
        void generateAll();
      }
    }
  }, [isSubmitted, generateAll, state.blocks]);

  return { state, generateBlock, generateAll, updateBlock, resetBlock };
}
