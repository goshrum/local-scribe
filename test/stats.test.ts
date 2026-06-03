import { describe, it, expect } from "vitest";
import { computeStats, countWords, formatDuration } from "../src/lib/stats.ts";
import type { Segment } from "../src/lib/types.ts";

const sample: Segment[] = [
  { start: 0, end: 1.5, text: " Hello there." },
  { start: 1.5, end: 3.25, text: "General Kenobi. " },
  { start: 3.25, end: 5, text: "You are a bold one." },
];

describe("countWords", () => {
  it("counts whitespace-delimited words", () => {
    expect(countWords("hello there friend")).toBe(3);
  });
  it("collapses runs of whitespace", () => {
    expect(countWords("  a   b \n c ")).toBe(3);
  });
  it("returns 0 for empty or whitespace-only", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });
});

describe("computeStats", () => {
  it("returns zeroed stats for no segments", () => {
    expect(computeStats([])).toEqual({
      segmentCount: 0,
      wordCount: 0,
      charCount: 0,
      durationSeconds: 0,
    });
  });

  it("counts words and segments across the transcript", () => {
    const stats = computeStats(sample);
    // "Hello there." (2) + "General Kenobi." (2) + "You are a bold one." (5)
    expect(stats.wordCount).toBe(9);
    expect(stats.segmentCount).toBe(3);
  });

  it("measures duration from first start to last end", () => {
    expect(computeStats(sample).durationSeconds).toBe(5);
  });

  it("ignores empty segments (normalized away)", () => {
    const stats = computeStats([
      { start: 0, end: 1, text: "word" },
      { start: 1, end: 2, text: "   " },
    ]);
    expect(stats.segmentCount).toBe(1);
    expect(stats.wordCount).toBe(1);
  });

  it("counts characters of trimmed text", () => {
    const stats = computeStats([{ start: 0, end: 1, text: "  abcde  " }]);
    expect(stats.charCount).toBe(5);
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(8)).toBe("8s");
  });
  it("formats minutes and seconds with zero padding", () => {
    expect(formatDuration(64)).toBe("1m 04s");
  });
  it("formats hours, minutes and seconds", () => {
    expect(formatDuration(3661)).toBe("1h 01m 01s");
  });
  it("treats negative / non-finite as zero", () => {
    expect(formatDuration(-5)).toBe("0s");
    expect(formatDuration(NaN)).toBe("0s");
  });
});
