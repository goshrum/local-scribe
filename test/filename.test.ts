import { describe, it, expect } from "vitest";
import { deriveBaseName, deriveDownloadName } from "../src/lib/filename.ts";

describe("deriveBaseName", () => {
  it("strips a single extension", () => {
    expect(deriveBaseName("interview.mp3")).toBe("interview");
  });
  it("strips a directory path", () => {
    expect(deriveBaseName("/Users/me/Downloads/clip.mp4")).toBe("clip");
    expect(deriveBaseName("C:\\media\\song.wav")).toBe("song");
  });
  it("keeps internal dots when stripping only the last extension", () => {
    expect(deriveBaseName("my.long.name.webm")).toBe("my.long.name");
  });
  it("replaces illegal characters with spaces and collapses them", () => {
    expect(deriveBaseName("a:b?c*d.mp3")).toBe("a b c d");
  });
  it("preserves digits (regression: range bug)", () => {
    expect(deriveBaseName("episode-007.mp3")).toBe("episode 007");
  });
  it("falls back to transcript for empty/missing input", () => {
    expect(deriveBaseName("")).toBe("transcript");
    expect(deriveBaseName(null)).toBe("transcript");
    expect(deriveBaseName(undefined)).toBe("transcript");
  });
  it("falls back to transcript when nothing usable remains", () => {
    expect(deriveBaseName("???.mp3")).toBe("transcript");
  });
  it("trims trailing dots", () => {
    expect(deriveBaseName("name...mp3")).toBe("name");
  });
});

describe("deriveDownloadName", () => {
  it("appends the requested extension", () => {
    expect(deriveDownloadName("talk.mp4", "srt")).toBe("talk.srt");
    expect(deriveDownloadName("talk.mp4", "vtt")).toBe("talk.vtt");
    expect(deriveDownloadName("talk.mp4", "txt")).toBe("talk.txt");
  });
  it("tolerates a leading dot on the extension", () => {
    expect(deriveDownloadName("talk.mp4", ".srt")).toBe("talk.srt");
  });
  it("uses the fallback base when name is missing", () => {
    expect(deriveDownloadName(null, "srt")).toBe("transcript.srt");
  });
});
