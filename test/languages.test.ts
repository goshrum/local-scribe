import { describe, it, expect } from "vitest";
import {
  LANGUAGES,
  findLanguage,
  isSupportedLanguage,
} from "../src/lib/languages.ts";

describe("LANGUAGES list integrity", () => {
  it("starts with auto-detect (null code)", () => {
    expect(LANGUAGES[0].code).toBeNull();
    expect(LANGUAGES[0].label).toMatch(/auto/i);
  });

  it("includes English and Russian per the spec", () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("ru");
  });

  it("has unique codes", () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has a non-empty label for every entry", () => {
    for (const l of LANGUAGES) {
      expect(l.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses two-letter codes for non-auto entries", () => {
    for (const l of LANGUAGES) {
      if (l.code !== null) expect(l.code).toMatch(/^[a-z]{2}$/);
    }
  });
});

describe("findLanguage", () => {
  it("finds by code", () => {
    expect(findLanguage("ru")?.label).toBe("Russian");
  });
  it("finds auto-detect by null", () => {
    expect(findLanguage(null)?.code).toBeNull();
  });
  it("returns undefined for unknown codes", () => {
    expect(findLanguage("zz")).toBeUndefined();
  });
});

describe("isSupportedLanguage", () => {
  it("accepts known codes and null", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage(null)).toBe(true);
  });
  it("rejects unknown codes", () => {
    expect(isSupportedLanguage("zz")).toBe(false);
  });
});
