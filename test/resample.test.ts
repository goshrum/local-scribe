import { describe, it, expect } from "vitest";
import {
  downmixToMono,
  resampleLinear,
  resampledLength,
  toWhisperInput,
  WHISPER_SAMPLE_RATE,
} from "../src/lib/resample.ts";

describe("downmixToMono", () => {
  it("returns empty for no channels", () => {
    expect(downmixToMono([]).length).toBe(0);
  });
  it("returns the single channel unchanged", () => {
    const ch = new Float32Array([0.1, 0.2, 0.3]);
    expect(downmixToMono([ch])).toBe(ch);
  });
  it("averages multiple channels sample-wise", () => {
    const l = new Float32Array([1, 0, -1, 0.5]);
    const r = new Float32Array([0, 1, 1, -0.5]);
    const mono = downmixToMono([l, r]);
    expect(Array.from(mono)).toEqual([0.5, 0.5, 0, 0]);
  });
});

describe("resampledLength", () => {
  it("computes the rounded output length", () => {
    // 48000 input samples at 48k -> 16k should be 16000.
    expect(resampledLength(48000, 48000, 16000)).toBe(16000);
  });
  it("halves the length when halving the rate", () => {
    expect(resampledLength(100, 32000, 16000)).toBe(50);
  });
  it("returns 0 for invalid input", () => {
    expect(resampledLength(0, 48000, 16000)).toBe(0);
    expect(resampledLength(100, 0, 16000)).toBe(0);
    expect(resampledLength(100, 48000, 0)).toBe(0);
  });
});

describe("resampleLinear", () => {
  it("returns the same reference when rates match", () => {
    const input = new Float32Array([0, 0.5, 1]);
    expect(resampleLinear(input, 16000, 16000)).toBe(input);
  });

  it("returns empty for empty input", () => {
    expect(resampleLinear(new Float32Array(0), 48000, 16000).length).toBe(0);
  });

  it("downsamples by an integer factor by picking every Nth sample", () => {
    // 4 -> 2 (factor 2): output[0]=in[0], output[1]=in[2].
    const input = new Float32Array([0, 1, 2, 3]);
    const out = resampleLinear(input, 4, 2);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(2, 6);
  });

  it("interpolates linearly when upsampling", () => {
    // 2 -> 4 (factor 0.5). Source positions: 0, 0.5, 1, 1.5.
    const input = new Float32Array([0, 1]);
    const out = resampleLinear(input, 2, 4);
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(0.5, 6);
    expect(out[2]).toBeCloseTo(1, 6);
    // Last sample clamps to the final input value.
    expect(out[3]).toBeCloseTo(1, 6);
  });

  it("preserves a constant signal", () => {
    const input = new Float32Array(100).fill(0.42);
    const out = resampleLinear(input, 44100, 16000);
    for (const v of out) expect(v).toBeCloseTo(0.42, 5);
  });
});

describe("toWhisperInput", () => {
  it("downmixes and resamples to 16k", () => {
    const sr = 48000;
    const l = new Float32Array(sr).fill(0.2);
    const r = new Float32Array(sr).fill(0.4);
    const out = toWhisperInput([l, r], sr);
    expect(out.length).toBe(WHISPER_SAMPLE_RATE); // 1 second -> 16000 samples
    expect(out[0]).toBeCloseTo(0.3, 5); // (0.2 + 0.4) / 2
  });

  it("WHISPER_SAMPLE_RATE is 16000", () => {
    expect(WHISPER_SAMPLE_RATE).toBe(16000);
  });
});
