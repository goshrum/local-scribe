import type { ModelId, Segment } from "../lib/types.ts";

/** Messages sent from the main thread to the worker. */
export type WorkerRequest =
  | {
      type: "transcribe";
      /** 16 kHz mono Float32 PCM. Transferred, not copied. */
      audio: Float32Array;
      model: ModelId;
      /** Whisper language code, or null for auto-detect. */
      language: string | null;
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
