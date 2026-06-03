import { describe, it, expect } from "vitest";
import {
  chunksToSegments,
  activeSegmentIndex,
  type AsrChunk,
} from "../src/lib/transcript.ts";
import type { Segment } from "../src/lib/types.ts";

describe("chunksToSegments", () => {
  it("returns empty for undefined or empty chunks", () => {
    expect(chunksToSegments(undefined)).toEqual([]);
    expect(chunksToSegments([])).toEqual([]);
  });

  it("maps chunks to trimmed segments", () => {
    const chunks: AsrChunk[] = [
      { text: " Hello", timestamp: [0, 1] },
      { text: "world ", timestamp: [1, 2] },
    ];
    expect(chunksToSegments(chunks)).toEqual([
      { start: 0, end: 1, text: "Hello" },
      { start: 1, end: 2, text: "world" },
    ]);
  });

  it("drops chunks that are empty after trimming", () => {
    const chunks: AsrChunk[] = [
      { text: "   ", timestamp: [0, 1] },
      { text: "kept", timestamp: [1, 2] },
    ];
    const out = chunksToSegments(chunks);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("kept");
  });

  it("fills a null end with the next chunk start", () => {
    const chunks: AsrChunk[] = [
      { text: "a", timestamp: [0, null] },
      { text: "b", timestamp: [3, 4] },
    ];
    const out = chunksToSegments(chunks);
    expect(out[0].end).toBe(3);
  });

  it("fills a trailing null end with start + 2s", () => {
    const chunks: AsrChunk[] = [{ text: "a", timestamp: [10, null] }];
    const out = chunksToSegments(chunks);
    expect(out[0].end).toBe(12);
  });
});

describe("activeSegmentIndex", () => {
  const segs: Segment[] = [
    { start: 0, end: 2, text: "a" },
    { start: 2, end: 4, text: "b" },
    { start: 4, end: 6, text: "c" },
  ];

  it("returns -1 before the first segment", () => {
    expect(activeSegmentIndex([], 1)).toBe(-1);
  });
  it("finds the active segment by time (start inclusive, end exclusive)", () => {
    expect(activeSegmentIndex(segs, 0)).toBe(0);
    expect(activeSegmentIndex(segs, 1.9)).toBe(0);
    expect(activeSegmentIndex(segs, 2)).toBe(1);
    expect(activeSegmentIndex(segs, 5)).toBe(2);
  });
  it("keeps the last segment active past the end", () => {
    expect(activeSegmentIndex(segs, 99)).toBe(2);
  });
});
