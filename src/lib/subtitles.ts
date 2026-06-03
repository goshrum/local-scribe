import type { Segment } from "./types.ts";
import { formatSrtTime, formatVttTime, sanitizeSeconds } from "./timecode.ts";

/**
 * Subtitle exporters (SRT / VTT / plain text) and the segment normalization
 * they rely on. All pure and unit-tested.
 */

/**
 * Normalize raw pipeline segments into something safe to export:
 *  - drops segments with empty text after trimming,
 *  - clamps negative/NaN times to 0,
 *  - if `end` is missing/<= start, derives a minimal end so the cue is valid,
 *  - guarantees monotonic, non-overlapping ordering by start time.
 */
export function normalizeSegments(segments: Segment[]): Segment[] {
  const cleaned = segments
    .map((s) => ({
      start: sanitizeSeconds(s.start),
      end: sanitizeSeconds(s.end),
      text: (s.text ?? "").trim(),
    }))
    .filter((s) => s.text.length > 0)
    .sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  for (const seg of cleaned) {
    let { start, end } = seg;
    // Ensure end is strictly after start (subtitles need a positive duration).
    if (!(end > start)) {
      end = start + 0.5;
    }
    // Prevent the previous cue from overlapping this one's start.
    const prev = out[out.length - 1];
    if (prev && prev.end > start) {
      prev.end = start;
      if (!(prev.end > prev.start)) {
        // Degenerate (same start); nudge so it still has duration.
        prev.end = prev.start + 0.001;
      }
    }
    out.push({ start, end, text: seg.text });
  }
  return out;
}

/** Build a SubRip (.srt) document from segments. */
export function toSrt(segments: Segment[]): string {
  const norm = normalizeSegments(segments);
  const blocks = norm.map((seg, i) => {
    const index = i + 1;
    const time = `${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}`;
    return `${index}\n${time}\n${seg.text}`;
  });
  // Blocks separated by a blank line; trailing newline at EOF.
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

/** Build a WebVTT (.vtt) document from segments. */
export function toVtt(segments: Segment[]): string {
  const norm = normalizeSegments(segments);
  const blocks = norm.map((seg) => {
    const time = `${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}`;
    return `${time}\n${seg.text}`;
  });
  const body = blocks.join("\n\n");
  return `WEBVTT\n\n${body}${blocks.length ? "\n" : ""}`;
}

/** Join all segment text into a single plain-text transcript. */
export function toPlainText(segments: Segment[]): string {
  return normalizeSegments(segments)
    .map((s) => s.text)
    .join("\n");
}
