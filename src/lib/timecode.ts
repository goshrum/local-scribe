/**
 * Timecode formatting helpers for subtitle export.
 *
 * All functions are pure and unit-tested. They take a time in seconds and
 * render an `HH:MM:SS` clock with millisecond precision. The millisecond
 * separator differs between formats (SRT uses a comma, VTT uses a dot), so the
 * separator is a parameter.
 */

/** Clamp negatives and non-finite numbers to 0; never produce a NaN clock. */
export function sanitizeSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return seconds;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * Format `seconds` as `HH:MM:SS<sep>mmm`.
 *
 * @param seconds time in seconds (fractional). Negatives / NaN become 0.
 * @param msSeparator the separator before milliseconds ("," for SRT, "." for VTT).
 *
 * Rounds to the nearest millisecond. Hours are not capped at 99 — a 100h+
 * recording will simply produce a 3-digit hour field, which is still valid.
 */
export function formatTimecode(seconds: number, msSeparator: "," | "."): string {
  const safe = sanitizeSeconds(seconds);

  // Work in integer milliseconds to avoid floating point drift.
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = (totalMs - ms) / 1000;
  const s = totalSeconds % 60;
  const totalMinutes = (totalSeconds - s) / 60;
  const m = totalMinutes % 60;
  const h = (totalMinutes - m) / 60;

  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${msSeparator}${pad(ms, 3)}`;
}

/** SRT timecode: `HH:MM:SS,mmm`. */
export function formatSrtTime(seconds: number): string {
  return formatTimecode(seconds, ",");
}

/** VTT timecode: `HH:MM:SS.mmm`. */
export function formatVttTime(seconds: number): string {
  return formatTimecode(seconds, ".");
}

/**
 * Compact `MM:SS` (or `H:MM:SS`) label for in-UI display next to a segment.
 * Not used by exporters; purely cosmetic.
 */
export function formatClock(seconds: number): string {
  const safe = sanitizeSeconds(seconds);
  const totalSeconds = Math.floor(safe);
  const s = totalSeconds % 60;
  const totalMinutes = (totalSeconds - s) / 60;
  const m = totalMinutes % 60;
  const h = (totalMinutes - m) / 60;
  if (h > 0) return `${h}:${pad(m, 2)}:${pad(s, 2)}`;
  return `${m}:${pad(s, 2)}`;
}
