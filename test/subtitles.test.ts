import { describe, it, expect } from "vitest";
import {
  toSrt,
  toVtt,
  toPlainText,
  normalizeSegments,
} from "../src/lib/subtitles.ts";
import type { Segment } from "../src/lib/types.ts";

const sample: Segment[] = [
  { start: 0, end: 1.5, text: " Hello there." },
  { start: 1.5, end: 3.25, text: "General Kenobi. " },
  { start: 3.25, end: 5, text: "You are a bold one." },
];

describe("normalizeSegments", () => {
  it("trims text and drops empties", () => {
    const out = normalizeSegments([
      { start: 0, end: 1, text: "  hi  " },
      { start: 1, end: 2, text: "   " },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("hi");
  });

  it("sorts by start time", () => {
    const out = normalizeSegments([
      { start: 5, end: 6, text: "b" },
      { start: 1, end: 2, text: "a" },
    ]);
    expect(out.map((s) => s.text)).toEqual(["a", "b"]);
  });

  it("gives a missing/zero-duration segment a positive duration", () => {
    const out = normalizeSegments([{ start: 2, end: 2, text: "x" }]);
    expect(out[0].end).toBeGreaterThan(out[0].start);
  });

  it("trims overlap so a cue does not extend past the next start", () => {
    const out = normalizeSegments([
      { start: 0, end: 5, text: "a" },
      { start: 2, end: 6, text: "b" },
    ]);
    expect(out[0].end).toBeLessThanOrEqual(out[1].start);
  });

  it("clamps negative times to 0", () => {
    const out = normalizeSegments([{ start: -3, end: 1, text: "a" }]);
    expect(out[0].start).toBe(0);
  });
});

describe("toSrt", () => {
  it("produces sequential 1-based indices", () => {
    const srt = toSrt(sample);
    expect(srt).toMatch(/^1\n/);
    expect(srt).toContain("\n2\n");
    expect(srt).toContain("\n3\n");
  });

  it("uses comma-millisecond timecodes with the arrow", () => {
    const srt = toSrt(sample);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,500");
    expect(srt).toContain("00:00:01,500 --> 00:00:03,250");
  });

  it("separates blocks with a blank line and trims text", () => {
    const srt = toSrt(sample);
    expect(srt).toContain("Hello there.");
    expect(srt).not.toContain(" Hello there.");
    // Blocks separated by exactly one blank line.
    expect(srt).toMatch(/Hello there\.\n\n2/);
  });

  it("ends with a trailing newline", () => {
    expect(toSrt(sample).endsWith("\n")).toBe(true);
  });

  it("renders the full expected document", () => {
    const expected =
      "1\n00:00:00,000 --> 00:00:01,500\nHello there.\n\n" +
      "2\n00:00:01,500 --> 00:00:03,250\nGeneral Kenobi.\n\n" +
      "3\n00:00:03,250 --> 00:00:05,000\nYou are a bold one.\n";
    expect(toSrt(sample)).toBe(expected);
  });

  it("returns an empty string for no segments", () => {
    expect(toSrt([])).toBe("");
  });
});

describe("toVtt", () => {
  it("starts with the WEBVTT header followed by a blank line", () => {
    const vtt = toVtt(sample);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
  });

  it("uses dot-millisecond timecodes", () => {
    const vtt = toVtt(sample);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500");
  });

  it("does not include numeric indices like SRT", () => {
    const vtt = toVtt(sample);
    expect(vtt).not.toMatch(/\n1\n00:00:00/);
  });

  it("still emits the WEBVTT header with no segments", () => {
    expect(toVtt([])).toBe("WEBVTT\n\n");
  });

  it("renders the full expected document", () => {
    const expected =
      "WEBVTT\n\n" +
      "00:00:00.000 --> 00:00:01.500\nHello there.\n\n" +
      "00:00:01.500 --> 00:00:03.250\nGeneral Kenobi.\n\n" +
      "00:00:03.250 --> 00:00:05.000\nYou are a bold one.\n";
    expect(toVtt(sample)).toBe(expected);
  });
});

describe("toPlainText", () => {
  it("joins trimmed segment text with newlines", () => {
    expect(toPlainText(sample)).toBe(
      "Hello there.\nGeneral Kenobi.\nYou are a bold one.",
    );
  });
  it("returns empty string for no segments", () => {
    expect(toPlainText([])).toBe("");
  });
});
