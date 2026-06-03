import { describe, it, expect } from "vitest";
import {
  formatSrtTime,
  formatVttTime,
  formatTimecode,
  formatClock,
  sanitizeSeconds,
} from "../src/lib/timecode.ts";

describe("sanitizeSeconds", () => {
  it("passes through valid positive numbers", () => {
    expect(sanitizeSeconds(12.5)).toBe(12.5);
  });
  it("clamps negatives to 0", () => {
    expect(sanitizeSeconds(-5)).toBe(0);
  });
  it("clamps NaN and Infinity to 0", () => {
    expect(sanitizeSeconds(NaN)).toBe(0);
    expect(sanitizeSeconds(Infinity)).toBe(0);
    expect(sanitizeSeconds(-Infinity)).toBe(0);
  });
});

describe("formatSrtTime (comma ms)", () => {
  it("formats zero", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
  });
  it("formats sub-second values", () => {
    expect(formatSrtTime(0.5)).toBe("00:00:00,500");
    expect(formatSrtTime(0.001)).toBe("00:00:00,001");
  });
  it("formats seconds and minutes", () => {
    expect(formatSrtTime(61.25)).toBe("00:01:01,250");
  });
  it("formats values over one hour", () => {
    expect(formatSrtTime(3661.123)).toBe("01:01:01,123");
  });
  it("rounds to nearest millisecond", () => {
    expect(formatSrtTime(1.23456)).toBe("00:00:01,235");
  });
  it("clamps negatives", () => {
    expect(formatSrtTime(-1)).toBe("00:00:00,000");
  });
  it("handles 100+ hour clocks without breaking", () => {
    expect(formatSrtTime(360000)).toBe("100:00:00,000");
  });
});

describe("formatVttTime (dot ms)", () => {
  it("uses a dot separator", () => {
    expect(formatVttTime(0)).toBe("00:00:00.000");
    expect(formatVttTime(3661.123)).toBe("01:01:01.123");
  });
});

describe("formatTimecode separator param", () => {
  it("respects the chosen separator", () => {
    expect(formatTimecode(1.5, ",")).toBe("00:00:01,500");
    expect(formatTimecode(1.5, ".")).toBe("00:00:01.500");
  });
  it("carries milliseconds rounding into seconds", () => {
    // 0.9999s rounds to 1000ms -> should roll over to 1 second, 000 ms.
    expect(formatTimecode(0.9999, ",")).toBe("00:00:01,000");
  });
});

describe("formatClock (UI label)", () => {
  it("shows M:SS under an hour", () => {
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(65)).toBe("1:05");
  });
  it("shows H:MM:SS at or above an hour", () => {
    expect(formatClock(3661)).toBe("1:01:01");
  });
  it("floors fractional seconds", () => {
    expect(formatClock(5.9)).toBe("0:05");
  });
});
