import "./style.css";
import { fileToWhisperPcm } from "./lib/audio.ts";
import { LANGUAGES } from "./lib/languages.ts";
import { MODELS, DEFAULT_MODEL, findModel } from "./lib/models.ts";
import { toSrt, toVtt, toPlainText, toJson } from "./lib/subtitles.ts";
import { formatClock } from "./lib/timecode.ts";
import { activeSegmentIndex } from "./lib/transcript.ts";
import { deriveDownloadName } from "./lib/filename.ts";
import { computeStats, formatDuration } from "./lib/stats.ts";
import { filterSegments } from "./lib/search.ts";
import { applyEdit, findReplaceAll } from "./lib/edit.ts";
import { loadSampleSegments } from "./lib/sample.ts";
import type { ModelId, Segment } from "./lib/types.ts";
import { buildTranscribeRequest } from "./worker/protocol.ts";
import type { WorkerResponse } from "./worker/protocol.ts";

/* ----------------------------- DOM helpers ----------------------------- */
function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const modelSelect = $<HTMLSelectElement>("model-select");
const modelNote = $<HTMLElement>("model-note");
const langSelect = $<HTMLSelectElement>("lang-select");
const translateCheckbox = $<HTMLInputElement>("translate-checkbox");
const dropzone = $<HTMLElement>("dropzone");
const fileInput = $<HTMLInputElement>("file-input");
const recordBtn = $<HTMLButtonElement>("record-btn");
const sampleBtn = $<HTMLButtonElement>("sample-btn");
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
const jsonBtn = $<HTMLButtonElement>("json-btn");
const summaryEl = $<HTMLElement>("summary");
const searchInput = $<HTMLInputElement>("search-input");
const searchCount = $<HTMLElement>("search-count");
const noMatchesEl = $<HTMLElement>("no-matches");
const findInput = $<HTMLInputElement>("find-input");
const replaceInput = $<HTMLInputElement>("replace-input");
const caseCheckbox = $<HTMLInputElement>("case-checkbox");
const replaceBtn = $<HTMLButtonElement>("replace-btn");
const replaceCount = $<HTMLElement>("replace-count");

/* ----------------------------- App state ----------------------------- */
let worker: Worker | null = null;
let currentSegments: Segment[] = [];
let currentFileName = "transcript";
let mediaEl: HTMLMediaElement | null = null;
let busy = false;
/** Whether the current/last run used the translate-to-English task. */
let currentTranslated = false;

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
function renderSummary(segments: Segment[]) {
  const stats = computeStats(segments);
  if (stats.segmentCount === 0) {
    summaryEl.replaceChildren();
    return;
  }
  const langOpt = langSelect.options[langSelect.selectedIndex];
  const langLabel = langOpt ? langOpt.textContent ?? "" : "";
  const parts: [string, string][] = [
    ["Words", String(stats.wordCount)],
    ["Segments", String(stats.segmentCount)],
    ["Duration", formatDuration(stats.durationSeconds)],
    [currentTranslated ? "Mode" : "Language", currentTranslated ? "Translated to English" : langLabel],
  ];
  summaryEl.replaceChildren();
  for (const [label, value] of parts) {
    const stat = document.createElement("div");
    stat.className = "stat";
    const v = document.createElement("span");
    v.className = "stat-value";
    v.textContent = value;
    const l = document.createElement("span");
    l.className = "stat-label";
    l.textContent = label;
    stat.append(v, l);
    summaryEl.append(stat);
  }
}

/** Render the segment list, honouring the current search query. */
function renderSegmentList() {
  const matches = filterSegments(currentSegments, searchInput.value);
  segmentsEl.replaceChildren();
  for (const { index, segment: seg } of matches) {
    const li = document.createElement("li");
    li.className = "segment";
    li.dataset.start = String(seg.start);
    li.dataset.index = String(index);

    const ts = document.createElement("span");
    ts.className = "ts";
    ts.textContent = formatClock(seg.start);

    const text = document.createElement("span");
    text.className = "seg-text";
    text.textContent = seg.text;
    // Inline editing: click the text to edit it directly.
    text.contentEditable = "true";
    text.spellcheck = false;
    text.dataset.testid = `segment-${index}`;
    text.title = "Click to edit";
    // Don't let clicks on the editable text trigger the row's seek handler.
    text.addEventListener("click", (e) => e.stopPropagation());
    // Enter commits and blurs (Shift+Enter still inserts a newline).
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        text.blur();
      }
    });
    // Commit the edit on blur if the text actually changed.
    text.addEventListener("blur", () => {
      const newText = text.textContent ?? "";
      if (newText === currentSegments[index]?.text) return;
      currentSegments = applyEdit(currentSegments, index, newText);
      renderSummary(currentSegments);
    });

    const copyOne = document.createElement("button");
    copyOne.type = "button";
    copyOne.className = "seg-copy";
    copyOne.textContent = "Copy";
    copyOne.title = "Copy this segment";
    copyOne.addEventListener("click", (e) => {
      e.stopPropagation();
      void copyText(currentSegments[index]?.text ?? seg.text, "Segment copied");
    });

    li.append(ts, text, copyOne);
    li.addEventListener("click", () => {
      if (mediaEl) {
        mediaEl.currentTime = seg.start;
        void mediaEl.play().catch(() => {});
      }
    });
    segmentsEl.append(li);
  }

  const query = searchInput.value.trim();
  if (query.length > 0) {
    searchCount.textContent = `${matches.length} of ${currentSegments.length}`;
    noMatchesEl.classList.toggle("hidden", matches.length > 0);
  } else {
    searchCount.textContent = "";
    noMatchesEl.classList.add("hidden");
  }
  highlightActive();
}

function renderSegments(segments: Segment[]) {
  currentSegments = segments;
  renderSummary(segments);
  renderSegmentList();
  if (segments.length > 0) show(resultsEl);
}

function highlightActive() {
  if (!mediaEl) return;
  const idx = activeSegmentIndex(currentSegments, mediaEl.currentTime);
  const items = segmentsEl.children;
  let activeEl: HTMLElement | undefined;
  for (let i = 0; i < items.length; i++) {
    const el = items[i] as HTMLElement;
    const isActive = Number(el.dataset.index) === idx;
    el.classList.toggle("active", isActive);
    if (isActive) activeEl = el;
  }
  activeEl?.scrollIntoView({ block: "nearest" });
}

searchInput.addEventListener("input", renderSegmentList);

/* ----------------------------- Find & Replace ----------------------------- */
function applyFindReplace() {
  const find = findInput.value;
  if (find.length === 0) {
    replaceCount.textContent = "Enter text to find.";
    return;
  }
  const { segments, count } = findReplaceAll(
    currentSegments,
    find,
    replaceInput.value,
    { caseSensitive: caseCheckbox.checked },
  );
  currentSegments = segments;
  renderSummary(currentSegments);
  renderSegmentList();
  replaceCount.textContent =
    count === 0
      ? "No matches replaced."
      : `Replaced ${count} ${count === 1 ? "match" : "matches"}.`;
}
replaceBtn.addEventListener("click", applyFindReplace);

/* ----------------------------- Load sample transcript ----------------------------- */
sampleBtn.addEventListener("click", () => {
  if (busy) return;
  clearError();
  hide(progressEl);
  currentFileName = "sample-transcript";
  currentTranslated = false;
  searchInput.value = "";
  findInput.value = "";
  replaceInput.value = "";
  replaceCount.textContent = "";
  renderSegments(loadSampleSegments());
});

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
  searchInput.value = "";
  searchCount.textContent = "";
  noMatchesEl.classList.add("hidden");
  summaryEl.replaceChildren();
  segmentsEl.replaceChildren();

  currentFileName = file.name || "recording";
  currentTranslated = translateCheckbox.checked;
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

  setStatus(currentTranslated ? "Preparing model (translate to English)…" : "Preparing model…");
  const w = getWorker();
  const req = buildTranscribeRequest(pcm, {
    model: modelSelect.value as ModelId,
    language: langSelect.value === "" ? null : langSelect.value,
    translate: translateCheckbox.checked,
  });
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

async function copyText(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    toast("Copy failed — select and copy manually");
  }
}

copyBtn.addEventListener("click", () =>
  copyText(toPlainText(currentSegments), "Transcript copied"),
);
txtBtn.addEventListener("click", () =>
  download(toPlainText(currentSegments), deriveDownloadName(currentFileName, "txt"), "text/plain"),
);
srtBtn.addEventListener("click", () =>
  download(toSrt(currentSegments), deriveDownloadName(currentFileName, "srt"), "text/plain"),
);
vttBtn.addEventListener("click", () =>
  download(toVtt(currentSegments), deriveDownloadName(currentFileName, "vtt"), "text/vtt"),
);
jsonBtn.addEventListener("click", () =>
  download(toJson(currentSegments), deriveDownloadName(currentFileName, "json"), "application/json"),
);
