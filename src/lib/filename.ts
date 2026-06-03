/**
 * Derive a safe download base name from a source media file name.
 *
 * Strips the directory and the final extension, replaces characters that are
 * awkward in download dialogs, collapses whitespace, and falls back to
 * "transcript" when nothing usable remains.
 */

// Characters that are illegal/awkward in file names, plus runs of whitespace
// and hyphens, are all normalized to a single space. Built from a class array
// (not a hand-typed range) to avoid accidental control-char ranges.
const SEPARATOR_CHARS = [
  "<", ">", ":", '"', "/", "\\", "|", "?", "*", "-",
];
const SEPARATOR_RE = new RegExp(
  "[" + SEPARATOR_CHARS.map((c) => "\\" + c).join("") + "\\s]+",
  "g",
);

export function deriveBaseName(sourceName: string | undefined | null): string {
  if (!sourceName) return "transcript";

  // Take just the file portion (handle both / and \ separators).
  const file = sourceName.split(/[\\/]/).pop() ?? "";

  // Remove a single trailing extension (the last dot group), but keep dots that
  // are part of the name when there is no extension-looking suffix.
  const withoutExt = file.replace(/\.[^.]+$/, "");

  const cleaned = withoutExt
    .normalize("NFKC")
    .replace(SEPARATOR_RE, " ")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "") // no trailing dots (Windows-hostile)
    .trim();

  return cleaned.length > 0 ? cleaned : "transcript";
}

/** Append an extension to a base name: `deriveDownloadName("a.mp3","srt")` -> `a.srt`. */
export function deriveDownloadName(
  sourceName: string | undefined | null,
  extension: string,
): string {
  const base = deriveBaseName(sourceName);
  const ext = extension.replace(/^\.+/, "");
  return `${base}.${ext}`;
}
