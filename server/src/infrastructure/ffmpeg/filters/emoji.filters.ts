/**
 * FFmpeg Emoji Filter Generation
 * Creates overlay filters for emoji images in video overlays
 */

/**
 * Emoji overlay configuration for FFmpeg
 */
export interface EmojiOverlayConfig {
  emojiPath: string; // Absolute path to PNG file
  x: number; // X position in output video
  y: number; // Y position in output video
  width: number; // Target width (for scaling)
  height: number; // Target height (for scaling)
  inputIndex: number; // FFmpeg input index for this emoji
}

/**
 * Result of emoji filter generation
 */
export interface EmojiFilterResult {
  inputs: string[]; // Additional input paths for FFmpeg
  scaleFilters: string[]; // Scale filters for each emoji
  overlayFilters: string[]; // Overlay filters to chain
  finalOutputLabel: string; // Label of the final output stream
}

/**
 * Generate FFmpeg filter chains for emoji overlays.
 *
 * This function generates:
 * 1. Scale filters to resize each emoji to the target size
 * 2. Overlay filters to composite emojis onto the video
 *
 * @param emojis - Array of emoji configurations
 * @param baseInputLabel - The label of the video stream to overlay onto (e.g., "v_text")
 * @param startingInputIndex - The starting input index for emoji files (after video inputs)
 * @returns Filter configuration for FFmpeg
 *
 * @example
 * const result = createEmojiOverlayFilters([
 *   { emojiPath: '/path/to/1f600.png', x: 100, y: 50, width: 52, height: 52, inputIndex: 1 }
 * ], 'v_text', 1);
 *
 * // Result:
 * // inputs: ['/path/to/1f600.png']
 * // scaleFilters: ['[1:v]scale=52:52[emoji_0]']
 * // overlayFilters: ['[v_text][emoji_0]overlay=100:50[v_emoji_0]']
 * // finalOutputLabel: 'v_emoji_0'
 */
export function createEmojiOverlayFilters(
  emojis: EmojiOverlayConfig[],
  baseInputLabel: string,
  startingInputIndex: number
): EmojiFilterResult {
  if (emojis.length === 0) {
    return {
      inputs: [],
      scaleFilters: [],
      overlayFilters: [],
      finalOutputLabel: baseInputLabel,
    };
  }

  const inputs: string[] = [];
  const scaleFilters: string[] = [];
  const overlayFilters: string[] = [];

  let currentLabel = baseInputLabel;

  for (let i = 0; i < emojis.length; i++) {
    const emoji = emojis[i];
    if (!emoji) continue; // Safety check

    const inputIdx = startingInputIndex + i;
    const emojiLabel = `emoji_${i}`;
    const outputLabel = `v_emoji_${i}`;

    inputs.push(emoji.emojiPath);

    // Scale the emoji PNG to target size
    // Use lanczos for high-quality scaling
    scaleFilters.push(
      `[${inputIdx}:v]scale=${Math.round(emoji.width)}:${Math.round(
        emoji.height
      )}:flags=lanczos,format=rgba[${emojiLabel}]`
    );

    // Overlay the scaled emoji onto the current video stream
    // Round positions to avoid anti-aliasing artifacts
    const x = Math.round(emoji.x);
    const y = Math.round(emoji.y);

    overlayFilters.push(
      `[${currentLabel}][${emojiLabel}]overlay=${x}:${y}:format=auto[${outputLabel}]`
    );

    currentLabel = outputLabel;
  }

  return {
    inputs,
    scaleFilters,
    overlayFilters,
    finalOutputLabel: currentLabel,
  };
}

/**
 * Optimize emoji overlays by batching nearby emojis.
 * This reduces the number of overlay operations for better performance.
 *
 * Note: This is an advanced optimization that may not be needed for most cases.
 * The simple approach of one overlay per emoji works well for up to ~20 emojis.
 */
export function optimizeEmojiOverlays(
  emojis: EmojiOverlayConfig[]
): EmojiOverlayConfig[] {
  // For now, just return as-is
  // Future optimization: composite multiple emojis into a single PNG
  // when they're close together
  return emojis;
}

/**
 * Validate that an emoji path exists and is accessible.
 */
export function validateEmojiPath(emojiPath: string): boolean {
  try {
    const fs = require("fs");
    return fs.existsSync(emojiPath);
  } catch {
    return false;
  }
}

/**
 * Get the expected FFmpeg input options for an emoji image.
 * PNG images need specific options for proper alpha handling.
 */
export function getEmojiInputOptions(): string[] {
  return [
    "-loop",
    "1", // Loop single image for duration of video
  ];
}
