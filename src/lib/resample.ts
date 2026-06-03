/**
 * Pure audio helpers for preparing decoded PCM for Whisper.
 *
 * Whisper expects 16 kHz mono Float32 samples in the range roughly [-1, 1].
 * Browsers decode media at the device sample rate (often 44.1 / 48 kHz) and
 * may produce multiple channels, so we:
 *   1. down-mix all channels to mono (average), and
 *   2. resample to 16 kHz with linear interpolation.
 *
 * Linear interpolation is not a brick-wall anti-alias filter, but for speech
 * recognition it is entirely adequate and is what most transformers.js demos
 * use. Keeping it pure lets us unit-test the math without an AudioContext.
 */

export const WHISPER_SAMPLE_RATE = 16000;

/**
 * Average an array of equal-length channel buffers into a single mono buffer.
 * Returns the sole channel unchanged when there is only one.
 */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const length = channels[0].length;
  const mono = new Float32Array(length);
  const n = channels.length;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < n; c++) sum += channels[c][i] ?? 0;
    mono[i] = sum / n;
  }
  return mono;
}

/**
 * Compute the output length for a resample, rounding to the nearest sample.
 * Exposed for testing and for pre-allocating buffers.
 */
export function resampledLength(
  inputLength: number,
  inputRate: number,
  outputRate: number,
): number {
  if (inputLength <= 0 || inputRate <= 0 || outputRate <= 0) return 0;
  return Math.round((inputLength * outputRate) / inputRate);
}

/**
 * Linearly resample a mono Float32 buffer from `inputRate` to `outputRate`.
 *
 * - Returns the input unchanged when the rates already match.
 * - Returns an empty buffer for empty / invalid input.
 */
export function resampleLinear(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (input.length === 0 || inputRate <= 0 || outputRate <= 0) {
    return new Float32Array(0);
  }
  if (inputRate === outputRate) {
    return input;
  }

  const outLength = resampledLength(input.length, inputRate, outputRate);
  const output = new Float32Array(outLength);
  if (outLength === 0) return output;

  // Map each output sample back to a fractional input index and interpolate.
  const ratio = inputRate / outputRate;
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcPos - i0;
    output[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return output;
}

/**
 * Full pipeline: down-mix channels to mono and resample to 16 kHz.
 * This is what the worker calls after `AudioContext.decodeAudioData`.
 */
export function toWhisperInput(
  channels: Float32Array[],
  inputRate: number,
): Float32Array {
  const mono = downmixToMono(channels);
  return resampleLinear(mono, inputRate, WHISPER_SAMPLE_RATE);
}
