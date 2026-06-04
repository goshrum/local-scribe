import type { Segment } from "./types.ts";

/**
 * A small bundled demo transcript (English) so a first-time visitor can try
 * editing, search, find-and-replace, and the exporters immediately — without
 * recording audio or downloading the Whisper model.
 */
export const SAMPLE_SEGMENTS: Segment[] = [
  { start: 0, end: 3.2, text: "Welcome to Local Scribe, the in-browser transcription tool." },
  { start: 3.2, end: 7.1, text: "Everything runs on your device, so your audio never leaves the browser." },
  { start: 7.1, end: 11.4, text: "Click any segment text to edit it, then export to SRT, VTT, JSON, or plain text." },
  { start: 11.4, end: 15.8, text: "Use find and replace to fix a recurring mis-transcription across the whole transcript." },
  { start: 15.8, end: 19.5, text: "This is a sample transcript, so feel free to experiment with every feature." },
];

/** Return a fresh copy of the sample segments (so callers can mutate state freely). */
export function loadSampleSegments(): Segment[] {
  return SAMPLE_SEGMENTS.map((s) => ({ ...s }));
}
