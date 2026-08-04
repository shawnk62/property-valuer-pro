import { useCallback, useEffect, useState } from "react";
import { generateNarrativeBlock } from "@/lib/ai/ai.functions";
import { loadAiSettings } from "@/lib/ai/settings";
import type { InspectionValues } from "@/lib/inspection/types";
import { NARRATIVE_BLOCKS, type NarrativeBlock, type NarrativeState } from "./types";

const KEY = "qld-narrative-v1";

function storageKey(recordId: string) {
  return `${KEY}-${recordId}`;
}

function read(recordId: string): NarrativeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(recordId));
    if (!raw) return null;
    return JSON.parse(raw) as NarrativeState;
  } catch {
    return null;
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
  const [state, setState] = useState<NarrativeState>(() => read(recordId) ?? defaultNarrativeState());

  useEffect(() => {
    setState(read(recordId) ?? defaultNarrativeState());
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
    if (!settings.apiKey || !settings.model) return;

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
