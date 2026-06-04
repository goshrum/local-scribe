# Changelog

All notable changes to Local Scribe are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Translate to English.** A new checkbox runs Whisper's `translate` task,
  turning non-English speech (e.g. Spanish or Russian audio) directly into
  English text. Timestamps and segments are preserved, so the `.srt`, `.vtt`,
  and `.json` exports continue to work. The summary panel shows
  "Translated to English" when the toggle is active. The worker protocol message
  now carries a `task` field (`transcribe` | `translate`).
- **JSON export.** Download the transcript as structured JSON (versioned schema
  with `segments` carrying `start`/`end` timestamps in seconds and `text`),
  alongside the existing `.txt`, `.srt`, and `.vtt` exports.
- **Summary panel.** A compact panel above the transcript shows word count,
  segment count, total duration, and the selected language.
- **Search / filter.** A search box filters the transcript to matching segments
  (case-insensitive substring match) and shows a "matches of total" count.
- **Copy individual segment.** Each segment now has a hover-revealed "Copy"
  button to copy just that line.

## [1.0.0]

### Added

- In-browser speech-to-text and subtitle generation, powered by
  transformers.js + Whisper. 100% on-device — no upload, no API key.
- Drag-and-drop or file-picker input for audio and video files.
- Microphone recording.
- Auto-detect plus a selectable transcription language (English names).
- Click-to-seek transcript with active-cue highlighting during playback.
- Export to plain text, SubRip (`.srt`), and WebVTT (`.vtt`).
