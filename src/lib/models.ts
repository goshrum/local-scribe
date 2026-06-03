import type { ModelId } from "./types.ts";

export interface ModelOption {
  id: ModelId;
  label: string;
  /** Rough on-disk size of the quantized ONNX weights, for the UI. */
  approxSize: string;
  /** Short tradeoff note shown in the selector. */
  note: string;
}

/**
 * Selectable Whisper models. Both are multilingual (so Russian works) and are
 * downloaded once from the HuggingFace CDN, then cached by the browser.
 */
export const MODELS: readonly ModelOption[] = [
  {
    id: "Xenova/whisper-tiny",
    label: "Whisper Tiny",
    approxSize: "~40 MB",
    note: "Fastest, lowest accuracy. Good for quick drafts.",
  },
  {
    id: "onnx-community/whisper-base",
    label: "Whisper Base",
    approxSize: "~80 MB",
    note: "Slower, more accurate. Recommended default.",
  },
] as const;

export const DEFAULT_MODEL: ModelId = "onnx-community/whisper-base";

export function findModel(id: ModelId): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isSupportedModel(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}
