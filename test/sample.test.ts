import { describe, it, expect } from "vitest";
import { SAMPLE_SEGMENTS, loadSampleSegments } from "../src/lib/sample.ts";
import { toSrt, toVtt, toJson } from "../src/lib/subtitles.ts";

describe("sample transcript", () => {
  it("has a few timestamped segments", () => {
    expect(SAMPLE_SEGMENTS.length).toBeGreaterThanOrEqual(3);
    for (const s of SAMPLE_SEGMENTS) {
      expect(s.end).toBeGreaterThan(s.start);
      expect(s.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("is in chronological, non-overlapping order", () => {
    for (let i = 1; i < SAMPLE_SEGMENTS.length; i++) {
      expect(SAMPLE_SEGMENTS[i].start).toBeGreaterThanOrEqual(
        SAMPLE_SEGMENTS[i - 1].end,
      );
    }
  });

  it("loadSampleSegments returns a fresh, mutable copy", () => {
    const a = loadSampleSegments();
    const b = loadSampleSegments();
    expect(a).toEqual(SAMPLE_SEGMENTS);
    expect(a).not.toBe(SAMPLE_SEGMENTS);
    expect(a[0]).not.toBe(SAMPLE_SEGMENTS[0]);
    a[0].text = "mutated";
    expect(b[0].text).not.toBe("mutated");
    expect(SAMPLE_SEGMENTS[0].text).not.toBe("mutated");
  });

  it("exports cleanly to SRT/VTT/JSON", () => {
    const segs = loadSampleSegments();
    expect(toSrt(segs)).toContain("Welcome to Local Scribe");
    expect(toVtt(segs).startsWith("WEBVTT")).toBe(true);
    expect(JSON.parse(toJson(segs)).segmentCount).toBe(segs.length);
  });
});
