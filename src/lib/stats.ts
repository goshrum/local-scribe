import type { Segment } from "./types.ts";
import { normalizeSegments } from "./subtitles.ts";

/** Summary statistics for a transcript, shown in the UI summary panel. */
export interface TranscriptStats {
  /** Number of non-empty segments. */
  segmentCount: number;
  /** Total word count across all segments. */
  wordCount: number;
  /** Total character count (including spaces within segments). */
  charCount: number;
  /** Duration in seconds, from the first segment's start to the last end. */
  durationSeconds: number;
}

/** Count whitespace-delimited words in a string. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Compute summary statistics from raw segments.
 *
 * Segments are normalized first (empty/whitespace dropped, sorted by start),
 * so the numbers always match what is actually displayed and exported.
 */
export function computeStats(segments: Segment[]): TranscriptStats {
  const norm = normalizeSegments(segments);
  if (norm.length === 0) {
    return { segmentCount: 0, wordCount: 0, charCount: 0, durationSeconds: 0 };
  }

  let wordCount = 0;
  let charCount = 0;
  for (const seg of norm) {
    wordCount += countWords(seg.text);
    charCount += seg.text.length;
  }

  const start = norm[0].start;
  // The last segment by start time is last in the normalized array, but use the
  // maximum end to be safe against any residual ordering quirks.
  const end = norm.reduce((max, s) => (s.end > max ? s.end : max), norm[0].end);
  const durationSeconds = Math.max(0, end - start);

  return {
    segmentCount: norm.length,
    wordCount,
    charCount,
    durationSeconds,
  };
}

/** Format a duration in seconds as a compact human label, e.g. "1m 04s" or "3s". */
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.round(safe);
  const s = total % 60;
  const totalMinutes = (total - s) / 60;
  const m = totalMinutes % 60;
  const h = (totalMinutes - m) / 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
