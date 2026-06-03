import type { Segment } from "./types.ts";

/**
 * Shape of one chunk in the transformers.js ASR output when
 * `return_timestamps: true` is used:
 *   { text: " Hello.", timestamp: [0, 1.2] }
 * The end timestamp can be `null` for the final chunk while streaming.
 */
export interface AsrChunk {
  text: string;
  timestamp: [number, number | null];
}

/** Shape of the overall pipeline result we care about. */
export interface AsrResult {
  text: string;
  chunks?: AsrChunk[];
}

/**
 * Convert raw ASR chunks into clean `Segment[]`.
 *
 * - Trims text.
 * - Fills a missing end timestamp with the next chunk's start (or start + 2s
 *   for the last chunk), so partial/streaming results stay renderable.
 * - Drops chunks that are empty after trimming.
 */
export function chunksToSegments(chunks: AsrChunk[] | undefined): Segment[] {
  if (!chunks || chunks.length === 0) return [];

  const out: Segment[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const text = (chunk.text ?? "").trim();
    if (text.length === 0) continue;

    const start = chunk.timestamp?.[0] ?? 0;
    let end = chunk.timestamp?.[1];
    if (end == null) {
      const next = chunks[i + 1];
      end = next?.timestamp?.[0] ?? start + 2;
    }
    out.push({ start, end, text });
  }
  return out;
}

/**
 * Given a playback position (seconds), return the index of the active segment,
 * or -1 if none. Used to highlight the current cue during playback.
 */
export function activeSegmentIndex(segments: Segment[], currentTime: number): number {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (currentTime >= s.start && currentTime < s.end) return i;
  }
  // If past the last segment's end but still close, keep the last one active.
  if (segments.length > 0 && currentTime >= segments[segments.length - 1].end) {
    return segments.length - 1;
  }
  return -1;
}
