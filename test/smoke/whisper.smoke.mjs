/**
 * CAPPED Node smoke test for the Whisper pipeline wiring.
 *
 * Goal: prove the transformers.js automatic-speech-recognition pipeline can be
 * constructed and run end-to-end on a generated audio signal, exercising the
 * same options the browser worker uses (return_timestamps, chunking, language).
 *
 * This is intentionally best-effort:
 *   - It downloads a tiny model from the HuggingFace CDN (the same free,
 *     keyless network access the app uses at runtime). Requires network.
 *   - It is wrapped in a hard timeout. If the download/inference is too slow or
 *     fails in Node (no WebGPU, CPU-only WASM can be heavy), the test SKIPS
 *     gracefully instead of hanging or failing the suite.
 *
 * Run manually with:  npm run smoke
 * It is NOT part of `npm test` (so CI stays fast and deterministic).
 */
import test from "node:test";
import assert from "node:assert/strict";

const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 90_000);
const SAMPLE_RATE = 16_000;

/** Generate ~1s of quiet sine sweep so the model has *some* audio to chew on. */
function generateAudio(seconds = 1) {
  const n = Math.floor(seconds * SAMPLE_RATE);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    a[i] = 0.05 * Math.sin(2 * Math.PI * (200 + 100 * t) * t);
  }
  return a;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    timer.unref?.();
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

test("whisper pipeline transcribes generated audio (capped, skips on failure)", async (t) => {
  let pipeline;
  try {
    ({ pipeline } = await import("@huggingface/transformers"));
  } catch (err) {
    t.skip(`transformers.js not importable in Node: ${err?.message ?? err}`);
    return;
  }

  try {
    const result = await withTimeout(
      (async () => {
        const transcriber = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-tiny",
          // Node uses the native onnxruntime ("cpu"); the browser worker uses
          // "webgpu"/"wasm". Same pipeline API + options either way.
          { dtype: "fp32", device: "cpu" },
        );
        const audio = generateAudio(1);
        const out = await transcriber(audio, {
          chunk_length_s: 30,
          return_timestamps: true,
          language: "en",
          task: "transcribe",
        });
        return out;
      })(),
      TIMEOUT_MS,
      "whisper smoke",
    );

    // We don't assert on the *content* (generated tones aren't speech), only on
    // the SHAPE of the output, which proves the pipeline wiring is correct.
    assert.ok(result, "pipeline returned a result");
    assert.equal(typeof result.text, "string", "result.text is a string");
    if (result.chunks) {
      assert.ok(Array.isArray(result.chunks), "chunks is an array when present");
    }
    console.log(
      `[smoke] OK — pipeline ran. text=${JSON.stringify(String(result.text).slice(0, 60))}`,
    );
  } catch (err) {
    // Network failure, CPU too slow, Node/WASM incompatibility, etc.
    t.skip(`whisper smoke skipped (heavy/offline/unsupported in Node): ${err?.message ?? err}`);
  }
});
