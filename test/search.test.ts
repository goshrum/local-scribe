import { describe, it, expect } from "vitest";
import { filterSegments } from "../src/lib/search.ts";
import type { Segment } from "../src/lib/types.ts";

const sample: Segment[] = [
  { start: 0, end: 1, text: "Hello there." },
  { start: 1, end: 2, text: "General Kenobi." },
  { start: 2, end: 3, text: "You are a bold one." },
];

describe("filterSegments", () => {
  it("returns every segment with its original index for an empty query", () => {
    const out = filterSegments(sample, "");
    expect(out.map((m) => m.index)).toEqual([0, 1, 2]);
    expect(out.map((m) => m.segment.text)).toEqual(sample.map((s) => s.text));
  });

  it("treats a whitespace-only query as no filter", () => {
    expect(filterSegments(sample, "   ")).toHaveLength(3);
  });

  it("matches case-insensitively", () => {
    const out = filterSegments(sample, "KENOBI");
    expect(out).toHaveLength(1);
    expect(out[0].segment.text).toBe("General Kenobi.");
  });

  it("preserves original indices on filtered results", () => {
    const out = filterSegments(sample, "bold");
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe(2);
  });

  it("matches substrings", () => {
    const out = filterSegments(sample, "are a");
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe(2);
  });

  it("returns nothing when there is no match", () => {
    expect(filterSegments(sample, "zzz")).toHaveLength(0);
  });

  it("treats the query as a plain string, not a regex", () => {
    const segs: Segment[] = [{ start: 0, end: 1, text: "a.b" }];
    // "." would match any char as a regex; here it must match the literal dot.
    expect(filterSegments(segs, "a.b")).toHaveLength(1);
    expect(filterSegments(segs, "axb")).toHaveLength(0);
  });
});
