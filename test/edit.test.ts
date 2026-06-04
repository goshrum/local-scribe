import { describe, it, expect } from "vitest";
import { applyEdit, findReplaceAll } from "../src/lib/edit.ts";
import { toSrt, toVtt, toJson, toPlainText } from "../src/lib/subtitles.ts";
import type { Segment } from "../src/lib/types.ts";

const sample: Segment[] = [
  { start: 0, end: 1, text: "Hello there." },
  { start: 1, end: 2, text: "General Kenobi." },
  { start: 2, end: 3, text: "You are a bold one." },
];

describe("applyEdit", () => {
  it("replaces the text of the targeted segment", () => {
    const out = applyEdit(sample, 1, "Hello there!");
    expect(out[1].text).toBe("Hello there!");
  });

  it("leaves other segments untouched", () => {
    const out = applyEdit(sample, 1, "changed");
    expect(out[0]).toEqual(sample[0]);
    expect(out[2]).toEqual(sample[2]);
  });

  it("preserves start/end timestamps of the edited segment", () => {
    const out = applyEdit(sample, 1, "changed");
    expect(out[1].start).toBe(1);
    expect(out[1].end).toBe(2);
  });

  it("is immutable — does not mutate the input array or segments", () => {
    const input: Segment[] = [{ start: 0, end: 1, text: "original" }];
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = applyEdit(input, 0, "new");
    expect(input).toEqual(snapshot);
    expect(out).not.toBe(input);
    expect(out[0]).not.toBe(input[0]);
  });

  it("throws RangeError for a negative index", () => {
    expect(() => applyEdit(sample, -1, "x")).toThrow(RangeError);
  });

  it("throws RangeError for an index at or beyond length", () => {
    expect(() => applyEdit(sample, 3, "x")).toThrow(RangeError);
  });

  it("throws RangeError for a non-integer index", () => {
    expect(() => applyEdit(sample, 1.5, "x")).toThrow(RangeError);
  });

  it("allows replacing with empty text", () => {
    const out = applyEdit(sample, 0, "");
    expect(out[0].text).toBe("");
  });
});

describe("findReplaceAll", () => {
  const repeated: Segment[] = [
    { start: 0, end: 1, text: "the cat sat" },
    { start: 1, end: 2, text: "the dog ran" },
    { start: 2, end: 3, text: "no match here" },
  ];

  it("replaces across all segments and reports the count", () => {
    const res = findReplaceAll(repeated, "the", "THE");
    expect(res.count).toBe(2);
    expect(res.segments[0].text).toBe("THE cat sat");
    expect(res.segments[1].text).toBe("THE dog ran");
    expect(res.segments[2].text).toBe("no match here");
  });

  it("counts multiple occurrences within a single segment", () => {
    const segs: Segment[] = [{ start: 0, end: 1, text: "ba ba ba" }];
    const res = findReplaceAll(segs, "ba", "zo");
    expect(res.count).toBe(3);
    expect(res.segments[0].text).toBe("zo zo zo");
  });

  it("is case-insensitive by default", () => {
    const segs: Segment[] = [{ start: 0, end: 1, text: "Cat CAT cat" }];
    const res = findReplaceAll(segs, "cat", "dog");
    expect(res.count).toBe(3);
    expect(res.segments[0].text).toBe("dog dog dog");
  });

  it("honours caseSensitive option", () => {
    const segs: Segment[] = [{ start: 0, end: 1, text: "Cat CAT cat" }];
    const res = findReplaceAll(segs, "cat", "dog", { caseSensitive: true });
    expect(res.count).toBe(1);
    expect(res.segments[0].text).toBe("Cat CAT dog");
  });

  it("treats find as a literal string, not a regex", () => {
    const segs: Segment[] = [{ start: 0, end: 1, text: "a.b axb" }];
    const res = findReplaceAll(segs, "a.b", "Z");
    expect(res.count).toBe(1);
    expect(res.segments[0].text).toBe("Z axb");
  });

  it("uses the replacement literally (no $ substitution surprises)", () => {
    const segs: Segment[] = [{ start: 0, end: 1, text: "price is X" }];
    const res = findReplaceAll(segs, "X", "$5");
    expect(res.segments[0].text).toBe("price is $5");
  });

  it("empty find is a no-op returning the same segments and count 0", () => {
    const res = findReplaceAll(repeated, "", "x");
    expect(res.count).toBe(0);
    expect(res.segments).toBe(repeated);
  });

  it("is immutable — does not mutate inputs when replacing", () => {
    const input: Segment[] = [{ start: 0, end: 1, text: "the the" }];
    const snapshot = JSON.parse(JSON.stringify(input));
    const res = findReplaceAll(input, "the", "a");
    expect(input).toEqual(snapshot);
    expect(res.segments).not.toBe(input);
    expect(res.segments[0]).not.toBe(input[0]);
  });

  it("returns count 0 and unchanged text when nothing matches", () => {
    const res = findReplaceAll(repeated, "zzz", "x");
    expect(res.count).toBe(0);
    expect(res.segments.map((s) => s.text)).toEqual(
      repeated.map((s) => s.text),
    );
  });
});

describe("exporters consume edited segments", () => {
  it("SRT/VTT/JSON/TXT reflect an applyEdit change", () => {
    const edited = applyEdit(sample, 0, "Edited line.");
    expect(toSrt(edited)).toContain("Edited line.");
    expect(toSrt(edited)).not.toContain("Hello there.");
    expect(toVtt(edited)).toContain("Edited line.");
    expect(toPlainText(edited)).toContain("Edited line.");
    expect(JSON.parse(toJson(edited)).segments[0].text).toBe("Edited line.");
  });

  it("SRT/VTT/JSON/TXT reflect a findReplaceAll change", () => {
    const { segments } = findReplaceAll(sample, "Kenobi", "Skywalker");
    expect(toSrt(segments)).toContain("General Skywalker.");
    expect(toVtt(segments)).toContain("General Skywalker.");
    expect(toPlainText(segments)).toContain("General Skywalker.");
    expect(JSON.parse(toJson(segments)).segments[1].text).toBe(
      "General Skywalker.",
    );
  });
});
