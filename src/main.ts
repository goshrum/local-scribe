import "./style.css";
import { fileToWhisperPcm } from "./lib/audio.ts";
import { LANGUAGES } from "./lib/languages.ts";
import { MODELS, DEFAULT_MODEL, findModel } from "./lib/models.ts";
import { toSrt, toVtt, toPlainText } from "./lib/subtitles.ts";
import { formatClock } from "./lib/timecode.ts";
import { activeSegmentIndex } from "./lib/transcript.ts";
import { deriveDownloadName } from "./lib/filename.ts";
import type { ModelId, Segment } from "./lib/types.ts";
import type { WorkerRequest, WorkerResponse } from "./worker/protocol.ts";

/* ----------------------------- DOM helpers ----------------------------- */
function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const modelSelect = $<HTMLSelectElement>("model-select");
const modelNote = $<HTMLElement>("model-note");
const langSelect = $<HTMLSelectElement>("lang-select");
const dropzone = $<HTMLElement>("dropzone");
const fileInput = $<HTMLInputElement>("file-input");
const recordBtn = $<HTMLButtonElement>("record-btn");
const progressEl = $<HTMLElement>("progress");
const statusText = $<HTMLElement>("status-text");
const barFill = $<HTMLElement>("bar-fill");
const playerWrap = $<HTMLElement>("player-wrap");
const errorEl = $<HTMLElement>("error");
const resultsEl = $<HTMLElement>("results");
const segmentsEl = $<HTMLOListElement>("segments");
const copyBtn = $<HTMLButtonElement>("copy-btn");
const txtBtn = $<HTMLButtonElement>("txt-btn");
const srtBtn = $<HTMLButtonElement>("srt-btn");
const vttBtn = $<HTMLButtonElement>("vtt-btn");

/* ----------------------------- App state ----------------------------- */
let worker: Worker | null = null;
let currentSegments: Segment[] = [];
let currentFileName = "transcript";
let mediaEl: HTMLMediaElement | null = null;
let busy = false;

/* ----------------------------- Populate selectors ----------------------------- */
for (const m of MODELS) {
  const opt = document.createElement("option");
  opt.value = m.id;
  opt.textContent = `${m.label} (${m.approxSize})`;
  if (m.id === DEFAULT_MODEL) opt.selected = true;
  modelSelect.append(opt);
}
function updateModelNote() {
  const m = findModel(modelSelect.value as ModelId);
  modelNote.textContent = m ? m.note : "";
}
updateModelNote();
modelSelect.addEventListener("change", updateModelNote);

for (const l of LANGUAGES) {
  const opt = document.createElement("option");
  opt.value = l.code ?? "";
  opt.textContent = l.label;
  langSelect.append(opt);
}

/* ----------------------------- UI helpers ----------------------------- */
function show(el: HTMLElement) {
  el.classList.remove("hidden");
}
function hide(el: HTMLElement) {
  el.classList.add("hidden");
}
function setStatus(text: string) {
  statusText.textContent = text;
}
function setBar(progress01: number | null) {
  if (progress01 == null) {
    barFill.classList.add("indeterminate");
    barFill.style.width = "";
  } else {
    barFill.classList.remove("indeterminate");
    barFill.style.width = `${Math.round(Math.min(1, Math.max(0, progress01)) * 100)}%`;
  }
}
function showError(message: string) {
  errorEl.textContent = message;
  show(errorEl);
}
function clearError() {
  hide(errorEl);
  errorEl.textContent = "";
}

let toastTimer: number | undefined;
function toast(message: string) {
  let t = document.querySelector<HTMLElement>(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove("show"), 1600);
}

/* ----------------------------- Rendering ----------------------------- */
function renderSegments(segments: Segment[]) {
  currentSegments = segments;
  segmentsEl.replaceChildren();
  for (const seg of segments) {
    const li = document.createElement("li");
    li.className = "segment";
    li.dataset.start = String(seg.start);

    const ts = document.createElement("span");
    ts.className = "ts";
    ts.textContent = formatClock(seg.start);

    const text = document.createElement("span");
    text.className = "seg-text";
    text.textContent = seg.text;

    li.append(ts, text);
    li.addEventListener("click", () => {
      if (mediaEl) {
        mediaEl.currentTime = seg.start;
        void mediaEl.play().catch(() => {});
      }
    });
    segmentsEl.append(li);
  }
  if (segments.length > 0) show(resultsEl);
}

function highlightActive() {
  if (!mediaEl) return;
  const idx = activeSegmentIndex(currentSegments, mediaEl.currentTime);
  const items = segmentsEl.children;
  for (let i = 0; i < items.length; i++) {
    items[i].classList.toggle("active", i === idx);
  }
  if (idx >= 0) {
    const active = items[idx] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }
}

function setupPlayer(file: File) {
  playerWrap.replaceChildren();
  if (mediaEl) {
    URL.revokeObjectURL(mediaEl.src);
    mediaEl = null;
  }
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video/");
  const el = document.createElement(isVideo ? "video" : "audio");
  el.src = url;
  el.controls = true;
  el.addEventListener("timeupdate", highlightActive);
  playerWrap.append(el);
  mediaEl = el;
  show(playerWrap);
}

/* ----------------------------- Worker ----------------------------- */
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker/transcribe.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) =>
    onWorkerMessage(e.data),
  );
  worker.addEventListener("error", (e) => {
    finishBusy();
    showError(`Worker error: ${e.message}`);
  });
  return worker;
}

function onWorkerMessage(msg: WorkerResponse) {
  switch (msg.type) {
    case "status":
      setStatus(msg.message);
      break;
    case "model-progress":
      setStatus("Downloading model (one-time)…");
      setBar(msg.progress);
      break;
    case "model-ready":
      setBar(null);
      setStatus("Transcribing…");
      break;
    case "partial":
      renderSegments(msg.segments);
      break;
    case "done":
      renderSegments(msg.segments);
      setBar(1);
      setStatus(`Done · ${msg.segments.length} segments`);
      finishBusy();
      if (msg.segments.length === 0) {
        showError("No speech was detected in this file.");
      }
      break;
    case "error":
      showError(`Transcription failed: ${msg.message}`);
      finishBusy();
      break;
  }
}

function finishBusy() {
  busy = false;
  recordBtn.disabled = false;
}

/* ----------------------------- Transcription flow ----------------------------- */
async function transcribeFile(file: File) {
  if (busy) return;
  busy = true;
  recordBtn.disabled = true;
  clearError();
  hide(resultsEl);
  currentSegments = [];
  segmentsEl.replaceChildren();

  currentFileName = file.name || "recording";
  setupPlayer(file);

  show(progressEl);
  setStatus("Decoding audio…");
  setBar(null);

  let pcm: Float32Array;
  try {
    pcm = await fileToWhisperPcm(file);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
    finishBusy();
    return;
  }

  setStatus("Preparing model…");
  const w = getWorker();
  const req: WorkerRequest = {
    type: "transcribe",
    audio: pcm,
    model: modelSelect.value as ModelId,
    language: langSelect.value === "" ? null : langSelect.value,
  };
  // Transfer the PCM buffer to avoid a copy.
  w.postMessage(req, [pcm.buffer]);
}

/* ----------------------------- File input / drag-drop ----------------------------- */
function isMediaFile(file: File): boolean {
  return file.type.startsWith("audio/") || file.type.startsWith("video/") ||
    /\.(mp3|wav|m4a|aac|ogg|opus|flac|mp4|webm|mov|mkv|m4v)$/i.test(file.name);
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void transcribeFile(file);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  }),
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  }),
);
dropzone.addEventListener("drop", (e) => {
  const dt = (e as DragEvent).dataTransfer;
  const file = dt?.files?.[0];
  if (!file) return;
  if (!isMediaFile(file)) {
    showError("Unsupported file. Please drop an audio or video file.");
    return;
  }
  void transcribeFile(file);
});

/* ----------------------------- Microphone recording ----------------------------- */
let recorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

recordBtn.addEventListener("click", async () => {
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }
  if (busy) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    showError("Microphone recording is not supported in this browser.");
    return;
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showError("Microphone permission was denied or unavailable.");
    return;
  }

  recordedChunks = [];
  recorder = new MediaRecorder(stream);
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  });
  recorder.addEventListener("stop", () => {
    stream.getTracks().forEach((t) => t.stop());
    recordBtn.classList.remove("recording");
    recordBtn.textContent = "● Record from microphone";
    const type = recorder?.mimeType || "audio/webm";
    const blob = new Blob(recordedChunks, { type });
    const file = new File([blob], "recording.webm", { type });
    void transcribeFile(file);
  });
  recorder.start();
  recordBtn.classList.add("recording");
  recordBtn.textContent = "■ Stop recording";
});

/* ----------------------------- Exports ----------------------------- */
function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

copyBtn.addEventListener("click", async () => {
  const text = toPlainText(currentSegments);
  try {
    await navigator.clipboard.writeText(text);
    toast("Transcript copied");
  } catch {
    toast("Copy failed — select and copy manually");
  }
});
txtBtn.addEventListener("click", () =>
  download(toPlainText(currentSegments), deriveDownloadName(currentFileName, "txt"), "text/plain"),
);
srtBtn.addEventListener("click", () =>
  download(toSrt(currentSegments), deriveDownloadName(currentFileName, "srt"), "text/plain"),
);
vttBtn.addEventListener("click", () =>
  download(toVtt(currentSegments), deriveDownloadName(currentFileName, "vtt"), "text/vtt"),
);
