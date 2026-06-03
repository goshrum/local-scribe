import { describe, it, expect } from "vitest";
import {
  MODELS,
  DEFAULT_MODEL,
  findModel,
  isSupportedModel,
} from "../src/lib/models.ts";

describe("MODELS list integrity", () => {
  it("offers a tiny and a base model", () => {
    const ids = MODELS.map((m) => m.id);
    expect(ids).toContain("Xenova/whisper-tiny");
    expect(ids).toContain("onnx-community/whisper-base");
  });
  it("the default model is in the list", () => {
    expect(MODELS.some((m) => m.id === DEFAULT_MODEL)).toBe(true);
  });
  it("every model has a label, size and note", () => {
    for (const m of MODELS) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.approxSize.length).toBeGreaterThan(0);
      expect(m.note.length).toBeGreaterThan(0);
    }
  });
});

describe("findModel / isSupportedModel", () => {
  it("finds a known model", () => {
    expect(findModel("Xenova/whisper-tiny")?.label).toBe("Whisper Tiny");
  });
  it("validates ids", () => {
    expect(isSupportedModel("onnx-community/whisper-base")).toBe(true);
    expect(isSupportedModel("evil/whisper-huge")).toBe(false);
  });
});
