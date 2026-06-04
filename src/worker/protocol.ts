import type { ModelId, Segment } from "../lib/types.ts";

/**
 * Whisper pipeline task.
 *
 * - `transcribe`: produce text in the source language of the audio.
 * - `translate`: transcribe non-English speech directly into English text.
 */
export type WhisperTask = "transcribe" | "translate";

/** Messages sent from the main thread to the worker. */
export type WorkerRequest =
  | {
      type: "transcribe";
      /** 16 kHz mono Float32 PCM. Transferred, not copied. */
      audio: Float32Array;
      model: ModelId;
      /** Whisper language code, or null for auto-detect. */
      language: string | null;
      /**
       * Pipeline task. `translate` yields English output regardless of the
       * source language; `transcribe` keeps the source language.
       */
      task: WhisperTask;
    };

/** Messages sent from the worker back to the main thread. */
export type WorkerResponse =
  | { type: "status"; message: string }
  | {
      type: "model-progress";
      /** 0..1 overall download progress (best effort). */
      progress: number;
      file?: string;
    }
  | { type: "model-ready" }
  | {
      type: "partial";
      /** Segments decoded so far (cumulative). */
      segments: Segment[];
    }
  | {
      type: "done";
      segments: Segment[];
      text: string;
    }
  | { type: "error"; message: string };

/** Inputs for building a transcription request (the audio buffer aside). */
export interface TranscribeOptions {
  model: ModelId;
  /** Whisper language code, or null for auto-detect. */
  language: string | null;
  /**
   * When true, run the Whisper `translate` task (output English) instead of
   * `transcribe`. Defaults to false.
   */
  translate?: boolean;
}

/**
 * Map the boolean "translate to English" toggle to a Whisper task.
 * Defaults to `transcribe` when the flag is absent/false.
 */
export function taskForTranslate(translate: boolean | undefined): WhisperTask {
  return translate ? "translate" : "transcribe";
}

/**
 * Build the `transcribe` request message sent to the worker. Pure: keeps the
 * task/language defaulting logic in one place so it can be unit-tested without
 * a real Worker.
 */
export function buildTranscribeRequest(
  audio: Float32Array,
  opts: TranscribeOptions,
): Extract<WorkerRequest, { type: "transcribe" }> {
  return {
    type: "transcribe",
    audio,
    model: opts.model,
    language: opts.language ?? null,
    task: taskForTranslate(opts.translate),
  };
}
