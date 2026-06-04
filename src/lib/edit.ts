import type { Segment } from "./types.ts";

/**
 * Pure, immutable transcript editing helpers. None of these mutate their input;
 * they always return a fresh `Segment[]` so callers can swap state safely.
 */

/**
 * Replace the text of a single segment, returning a new array.
 *
 * - Immutable: the input array and its segments are never mutated.
 * - Validates `index`: throws a `RangeError` if it is not an integer in
 *   `[0, segments.length)`.
 * - The new text is stored verbatim (no trimming) so the caller controls
 *   formatting; exporters already trim on the way out.
 */
export function applyEdit(
  segments: Segment[],
  index: number,
  newText: string,
): Segment[] {
  if (!Number.isInteger(index) || index < 0 || index >= segments.length) {
    throw new RangeError(
      `applyEdit: index ${index} is out of range [0, ${segments.length})`,
    );
  }
  return segments.map((seg, i) =>
    i === index ? { ...seg, text: newText } : seg,
  );
}

/** Options for {@link findReplaceAll}. */
export interface FindReplaceOptions {
  /** When true, matching is case-sensitive. Defaults to false. */
  caseSensitive?: boolean;
}

/** Result of a find-and-replace pass. */
export interface FindReplaceResult {
  /** New segments with all replacements applied. */
  segments: Segment[];
  /** Total number of individual occurrences replaced across all segments. */
  count: number;
}

/** Escape a string so it can be used as a literal inside a RegExp. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every occurrence of `find` with `replace` across all segments.
 *
 * - Immutable: returns a new array; inputs are untouched.
 * - `find` is treated as a literal string (not a regex), so any user input is
 *   safe.
 * - An empty `find` is a no-op: returns the original segments and a count of 0.
 * - `count` is the total number of matches replaced across every segment.
 */
export function findReplaceAll(
  segments: Segment[],
  find: string,
  replace: string,
  options: FindReplaceOptions = {},
): FindReplaceResult {
  if (find.length === 0) {
    return { segments, count: 0 };
  }

  const flags = options.caseSensitive ? "g" : "gi";
  const pattern = new RegExp(escapeRegExp(find), flags);

  let count = 0;
  const next = segments.map((seg) => {
    let replacedHere = 0;
    const text = seg.text.replace(pattern, () => {
      replacedHere++;
      return replace;
    });
    if (replacedHere === 0) return seg;
    count += replacedHere;
    return { ...seg, text };
  });

  return { segments: next, count };
}
