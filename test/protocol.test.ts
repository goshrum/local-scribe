import { describe, it, expect } from "vitest";
import {
  buildTranscribeRequest,
  taskForTranslate,
} from "../src/worker/protocol.ts";
import type { ModelId } from "../src/lib/types.ts";

const MODEL: ModelId = "Xenova/whisper-tiny";

describe("taskForTranslate", () => {
  it("maps true to the translate task", () => {
    expect(taskForTranslate(true)).toBe("translate");
  });
  it("maps false to the transcribe task", () => {
    expect(taskForTranslate(false)).toBe("transcribe");
  });
  it("defaults undefined to the transcribe task", () => {
    expect(taskForTranslate(undefined)).toBe("transcribe");
  });
});

describe("buildTranscribeRequest", () => {
  const audio = new Float32Array([0.1, 0.2, 0.3]);

  it("builds a transcribe request by default (no translate flag)", () => {
    const req = buildTranscribeRequest(audio, { model: MODEL, language: "es" });
    expect(req).toEqual({
      type: "transcribe",
      audio,
      model: MODEL,
      language: "es",
      task: "transcribe",
    });
  });

  it("sets task=translate when translate is true", () => {
    const req = buildTranscribeRequest(audio, {
      model: MODEL,
      language: "ru",
      translate: true,
    });
    expect(req.task).toBe("translate");
    expect(req.language).toBe("ru");
  });

  it("keeps task=transcribe when translate is explicitly false", () => {
    const req = buildTranscribeRequest(audio, {
      model: MODEL,
      language: null,
      translate: false,
    });
    expect(req.task).toBe("transcribe");
  });

  it("normalizes a null language (auto-detect) and carries the audio buffer", () => {
    const req = buildTranscribeRequest(audio, {
      model: MODEL,
      language: null,
      translate: true,
    });
    expect(req.language).toBeNull();
    expect(req.audio).toBe(audio);
    expect(req.type).toBe("transcribe");
  });

  it("preserves the selected model", () => {
    const other: ModelId = "onnx-community/whisper-base";
    const req = buildTranscribeRequest(audio, { model: other, language: "en" });
    expect(req.model).toBe(other);
  });
});
