/// <reference lib="webworker" />
import {
  pipeline,
  WhisperTextStreamer,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";
import { chunksToSegments, type AsrResult } from "../lib/transcript.ts";
import type { Segment } from "../lib/types.ts";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

/**
 * Web Worker that runs Whisper inference off the main thread.
 *
 * Networking: the ONLY network access in this whole app happens here, when
 * transformers.js fetches model weights from the HuggingFace CDN
 * (huggingface.co / cdn-lfs). After the first download the browser caches the
 * weights. No telemetry, no API keys, no uploads of user media.
 */

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerResponse): void {
  ctx.postMessage(message);
}

/**
 * Lazily-instantiated pipeline, keyed by model id so switching models rebuilds
 * it. Prefers WebGPU and silently falls back to WASM if WebGPU is unavailable.
 */
class PipelineSingleton {
  private static instance: AutomaticSpeechRecognitionPipeline | null = null;
  private static currentModel: string | null = null;

  static async get(
    model: string,
    onProgress: (info: ProgressInfo) => void,
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    if (this.instance && this.currentModel === model) {
      return this.instance;
    }
    if (this.instance) {
      try {
        await this.instance.dispose();
      } catch {
        /* ignore */
      }
      this.instance = null;
    }

    const device = (await hasWebGPU()) ? "webgpu" : "wasm";
    post({ type: "status", message: `Loading model on ${device.toUpperCase()}…` });

    // `pipeline()` returns a giant union across every task; narrow via unknown
    // to the ASR pipeline we requested (avoids TS2590 "union too complex").
    const built: unknown = await pipeline("automatic-speech-recognition", model, {
      device,
      dtype: device === "webgpu" ? "fp16" : "fp32",
      progress_callback: onProgress,
    });
    this.instance = built as AutomaticSpeechRecognitionPipeline;
    this.currentModel = model;
    return this.instance;
  }
}

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } })
      .gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

/** Aggregate per-file download progress into a single 0..1 value. */
function makeProgressReporter() {
  const files = new Map<string, { loaded: number; total: number }>();
  return (info: ProgressInfo) => {
    if (info.status === "progress") {
      files.set(info.file, {
        loaded: info.loaded ?? 0,
        total: info.total ?? 0,
      });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      const progress = total > 0 ? loaded / total : 0;
      post({ type: "model-progress", progress, file: info.file });
    } else if (info.status === "initiate") {
      post({ type: "status", message: `Downloading ${info.file}…` });
    }
  };
}

async function handleTranscribe(req: Extract<WorkerRequest, { type: "transcribe" }>) {
  const reporter = makeProgressReporter();
  const transcriber = await PipelineSingleton.get(req.model, reporter);
  post({ type: "model-ready" });
  post({ type: "status", message: "Transcribing…" });

  // Stream partial results using Whisper's chunk streamer. We accumulate
  // finished segments and emit them as `partial` updates so the UI fills in
  // live during decode. `tokenizer` exists on the ASR pipeline base.
  const tokenizer = (transcriber as unknown as { tokenizer: never }).tokenizer;

  const liveSegments: Segment[] = [];
  let segStart = 0;
  let segText = "";

  const flush = (end: number) => {
    const text = segText.trim();
    if (text.length > 0) {
      liveSegments.push({ start: segStart, end: Math.max(end, segStart), text });
      post({ type: "partial", segments: liveSegments.slice() });
    }
    segText = "";
  };

  const streamer = new WhisperTextStreamer(tokenizer, {
    time_precision: 0.02,
    on_chunk_start: (t: number) => {
      segStart = t;
    },
    callback_function: (text: string) => {
      segText += text;
    },
    on_chunk_end: (t: number) => {
      flush(t);
    },
    on_finalize: () => {
      // Emit any text after the final chunk boundary.
      flush(segStart);
    },
  });

  const result = (await transcriber(req.audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
    language: req.language ?? undefined,
    task: req.task,
    streamer,
  })) as AsrResult;

  // Authoritative segments come from the final result's chunks (precise
  // timestamps). Fall back to the streamed segments if chunks are missing.
  const segments = result.chunks ? chunksToSegments(result.chunks) : liveSegments;
  post({ type: "done", segments, text: (result.text ?? "").trim() });
}

ctx.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === "transcribe") {
      await handleTranscribe(req);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "error", message });
  }
});
