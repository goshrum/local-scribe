# Local Scribe

**In-browser speech-to-text and subtitles. 100% on-device · no upload · no API key · free.**

Local Scribe turns audio and video into a timestamped transcript and exportable
subtitles (**SRT / VTT / TXT / JSON**) — entirely in your browser. A
[Whisper](https://github.com/openai/whisper) model runs on **your** device via
[transformers.js](https://github.com/huggingface/transformers.js) (WebGPU, with
an automatic WASM fallback). Your media never leaves your machine.

---

## Why it's private & free

- **No backend.** There is no server of ours. The page is static; all compute
  happens in your browser.
- **No API keys, no paid APIs.** Nothing to sign up for.
- **Your media never uploads.** Files are decoded and transcribed locally.
- **The only network access** is a **one-time download of the model weights**
  from the **free, keyless HuggingFace CDN** (`huggingface.co` / its LFS CDN).
  After the first run the browser caches the weights, so subsequent runs can
  work offline.

## How it works

1. You drop in (or record) an audio/video file.
2. The browser decodes it with the **Web Audio API**
   (`AudioContext.decodeAudioData`) — this also extracts the audio track from
   video containers (MP4, WebM, …).
3. The decoded PCM is **down-mixed to mono** and **resampled to 16 kHz**
   (the format Whisper expects), as pure, unit-tested math.
4. The 16 kHz Float32 buffer is handed to a **Web Worker**, which runs the
   transformers.js `automatic-speech-recognition` pipeline with
   `return_timestamps: true` and 30 s chunking.
5. Segments stream into the UI as they decode. You get a timestamped
   transcript, a synced media player, and one-click exports.

## Models

Both are **multilingual** (so Russian, English, and ~97 other languages work)
and are downloaded once from the HuggingFace CDN:

| Model | Repo | Approx. size | Tradeoff |
| --- | --- | --- | --- |
| Whisper Tiny | `Xenova/whisper-tiny` | ~40 MB | Fastest, lowest accuracy |
| Whisper Base *(default)* | `onnx-community/whisper-base` | ~80 MB | Slower, more accurate |

Pick the model and language (or **Auto-detect**) in the UI before transcribing.

## Features

- Drag-and-drop or file picker for **audio and video**.
- **Record from microphone** (MediaRecorder).
- **Language selector** (auto-detect + manual, incl. Russian / English) and
  **model-size selector**.
- One-time **model-download progress bar**; **streaming partial results** during
  decode.
- Timestamped transcript; **click a segment to seek** the synced
  `<audio>`/`<video>` player; the **current segment highlights** during playback.
- **Summary panel**: word count, segment count, total duration, and language.
- **Search / filter** the transcript (case-insensitive), with a match counter.
- **Copy a single segment** with a per-row Copy button.
- Export: **Copy text**, **.txt**, **.srt**, **.vtt**, **.json** (correct
  indices, timecodes, and blank lines — unit-tested).
- Clean, responsive, **dark-mode-friendly** hand-written CSS.
- Graceful errors for unsupported files, decode failures, and model-load
  failures.

## Run locally

```bash
npm install
npm run dev      # start the dev server (Vite)
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
npm test         # run the Vitest unit suite
npm run smoke    # OPTIONAL capped Node smoke test (downloads whisper-tiny)
```

## Deploy (free, on GitHub Pages)

This repo ships a CI/deploy workflow at `.github/workflows/deploy.yml` that runs
the tests, builds, and publishes `dist/` to **GitHub Pages** on every push to
`main`.

To enable it: in your GitHub repo, go to **Settings → Pages → Build and
deployment → Source: GitHub Actions**. The Vite `base` is set to `'./'` so the
build works under any Pages subpath.

## Browser support

- **Best:** a recent Chrome/Edge with **WebGPU** enabled (fastest).
- **Fallback:** any modern browser with **WebAssembly** (single-threaded) —
  Firefox, Safari, older Chrome. Slower, but works.
- Microphone recording requires a `getUserMedia`-capable browser and a secure
  context (HTTPS or `localhost`).

## Limitations (honest)

- **Speed.** On-device inference is much slower than a GPU server. Tiny/Base are
  chosen specifically so it stays usable in a browser, but a long recording
  (e.g. an hour) can take several minutes — especially on the WASM fallback
  without a GPU. Use **Tiny** for speed, **Base** for accuracy.
- **First run downloads the model** (~40–80 MB) from the HuggingFace CDN. This
  is the only network use; it's cached afterward.
- **COOP/COEP & multi-threaded WASM.** Multi-threaded WASM needs cross-origin
  isolation, which requires the `Cross-Origin-Opener-Policy` and
  `Cross-Origin-Embedder-Policy` response headers. **GitHub Pages cannot set
  custom headers**, so multi-threaded WASM is unavailable there. Local Scribe
  therefore defaults to a configuration that works **without** those headers:
  **single-threaded WASM** and **WebGPU** both run fine on plain Pages. If you
  self-host behind a server that *can* send COOP/COEP, transformers.js can use
  multi-threaded WASM for extra speed.
- **Accuracy** depends on audio quality, accents, and background noise, and on
  the model size you pick.

## Verification status (honest)

- **Unit tests** cover all pure logic: SRT/VTT/text/JSON export, timecode
  formatting (comma vs. dot ms, sub-second, > 1 h, rounding rollover), segment
  normalization/overlap handling, transcript statistics (word/segment count,
  duration), transcript search/filter, 16 kHz resampling math + mono down-mix,
  language-list integrity, model-list integrity, chunk→segment mapping, and
  filename derivation.
- A **capped Node smoke test** (`npm run smoke`) loads `Xenova/whisper-tiny`
  from the HF CDN and runs the real ASR pipeline on a generated signal to prove
  the wiring; it is time-boxed and skips gracefully if the environment can't run
  it.
- The **in-browser WebGPU/WASM runtime** itself is verified by build + code
  (written to the official transformers.js v3 API) + the Node pipeline smoke
  test. A headless browser/WebGPU run was not part of this verification.

## License

MIT © 2026 georgerum07. See [LICENSE](./LICENSE).
