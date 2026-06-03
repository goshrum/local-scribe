import { toWhisperInput, WHISPER_SAMPLE_RATE } from "./resample.ts";

/**
 * Browser-side audio decoding. Lives on the main thread because
 * `AudioContext.decodeAudioData` is not available in Web Workers in all
 * browsers. The decoded + resampled Float32 buffer is then transferred to the
 * worker for inference.
 *
 * Works for both audio files and video files: `decodeAudioData` extracts the
 * audio track from container formats the browser can demux (mp4, webm, etc.).
 */

let sharedCtx: AudioContext | OfflineAudioContext | null = null;

function getDecodeContext(): BaseAudioContext {
  if (sharedCtx) return sharedCtx;
  const Ctor =
    (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    throw new Error("Web Audio API is not available in this browser.");
  }
  sharedCtx = new Ctor();
  return sharedCtx;
}

/**
 * Decode an arbitrary audio/video File into 16 kHz mono Float32 PCM ready for
 * Whisper. Throws a friendly error when the format cannot be decoded.
 */
export async function fileToWhisperPcm(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getDecodeContext();

  let audioBuffer: AudioBuffer;
  try {
    // decodeAudioData copies the buffer; slice() guards against detachment.
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error(
      "Could not decode this file's audio. Try a common format like MP3, WAV, M4A, MP4, or WebM.",
    );
  }

  const channels: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const pcm = toWhisperInput(channels, audioBuffer.sampleRate);
  if (pcm.length === 0) {
    throw new Error("The file contains no decodable audio.");
  }
  return pcm;
}

/** Sample rate Whisper expects; re-exported for convenience. */
export { WHISPER_SAMPLE_RATE };
