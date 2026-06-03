import type { LanguageOption } from "./types.ts";

/**
 * Language options for the selector. The first entry (code: null) means
 * "auto-detect" and is passed to the pipeline as `language: undefined`.
 *
 * Codes are Whisper's two-letter language codes. The list is intentionally a
 * useful subset (the full Whisper set is ~99 languages); Russian and English
 * are guaranteed present per the product spec.
 */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: null, label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "tr", label: "Turkish" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
] as const;

/** Look up a language option by code (null = auto-detect). */
export function findLanguage(code: string | null): LanguageOption | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/** True if the given code is a recognised selectable language (or null/auto). */
export function isSupportedLanguage(code: string | null): boolean {
  return LANGUAGES.some((l) => l.code === code);
}
