import type { Segment } from "./types.ts";

/** A segment paired with its original index, used for filtered display. */
export interface IndexedSegment {
  /** Index of the segment in the original (rendered) list. */
  index: number;
  segment: Segment;
}

/**
 * Case-insensitive substring filter over segments.
 *
 * An empty/whitespace-only query returns every segment (with its original
 * index) so the caller can treat "no filter" and "filter" uniformly. Matching
 * is plain substring (no regex), so arbitrary user input is always safe.
 */
export function filterSegments(
  segments: Segment[],
  query: string,
): IndexedSegment[] {
  const needle = query.trim().toLowerCase();
  const all = segments.map((segment, index) => ({ index, segment }));
  if (needle.length === 0) return all;
  return all.filter(({ segment }) =>
    segment.text.toLowerCase().includes(needle),
  );
}
