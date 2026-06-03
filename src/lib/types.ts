/**
 * A single transcribed segment with start/end times (in seconds) and text.
 * This is the canonical shape produced by the Whisper pipeline
 * (`return_timestamps: true`) and consumed by every exporter.
 */
export interface Segment {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. May be null while a chunk is still streaming. */
  end: number;
  /** Segment text (already trimmed for display). */
  text: string;
}

/** Supported model identifiers (HuggingFace repo ids). */
export type ModelId =
  | "Xenova/whisper-tiny"
  | "onnx-community/whisper-base";

/** A language option for the selector. */
export interface LanguageOption {
  /** Whisper language code, or null for auto-detect. */
  code: string | null;
  /** Human readable label. */
  label: string;
}
