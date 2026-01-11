/**
 * Crop Utilities
 * Shared crop calculation functions for VideoEditor, RealtimePreview, and FFmpeg export.
 * All crop values are in SOURCE VIDEO PIXELS (not percentages).
 */

/**
 * Crop state representing a rectangular crop region.
 * All values are in source video pixels.
 */
export interface CropState {
  x: number; // X offset from left edge of source video
  y: number; // Y offset from top edge of source video
  width: number; // Width of crop region
  height: number; // Height of crop region
}

/**
 * Available aspect ratio presets for cropping.
 */
/**
 * Available aspect ratio presets for cropping.
 */
export type CropPreset = "9:16" | "1:1" | "16:9" | "4:5" | "freeform";

export const CROP_PRESETS: { id: CropPreset; label: string; icon: string }[] = [
  { id: "freeform", label: "Freeform", icon: "🔳" },
  { id: "16:9", label: "16:9 Landscape", icon: "▭" },
  { id: "4:5", label: "4:5 Portrait", icon: "▯" },
  { id: "1:1", label: "1:1 Square", icon: "⬜" },
  { id: "9:16", label: "9:16 Story", icon: "📱" },
];

/**
 * Calculate a centered crop rectangle for a given aspect ratio preset.
 *
 * The crop is calculated to be as large as possible while maintaining
 * the target aspect ratio and staying within video bounds.
 *
 * @param videoWidth - Source video width in pixels
 * @param videoHeight - Source video height in pixels
 * @param preset - Target aspect ratio preset
 * @returns CropState with centered crop matching the preset
 */
export function calculateCropFromPreset(
  videoWidth: number,
  videoHeight: number,
  preset: CropPreset
): CropState {
  // For freeform, return full frame
  if (preset === "freeform") {
    return { x: 0, y: 0, width: videoWidth, height: videoHeight };
  }

  // Parse aspect ratio
  let targetRatio: number;
  switch (preset) {
    case "9:16":
      targetRatio = 9 / 16;
      break;
    case "1:1":
      targetRatio = 1;
      break;
    case "16:9":
      targetRatio = 16 / 9;
      break;
    case "4:5":
      targetRatio = 4 / 5;
      break;
    default:
      targetRatio = videoWidth / videoHeight;
  }

  const videoRatio = videoWidth / videoHeight;
  let cropWidth: number;
  let cropHeight: number;

  if (targetRatio > videoRatio) {
    // Target is wider than video - constrain by width, letterbox top/bottom
    cropWidth = videoWidth;
    cropHeight = videoWidth / targetRatio;
  } else {
    // Target is taller than video - constrain by height, pillarbox left/right
    cropHeight = videoHeight;
    cropWidth = videoHeight * targetRatio;
  }

  // Center the crop
  const x = (videoWidth - cropWidth) / 2;
  const y = (videoHeight - cropHeight) / 2;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

/**
 * Clamp crop values to ensure they stay within video bounds.
 * Also ensures minimum crop size of 50x50 pixels.
 *
 * @param crop - Current crop state
 * @param videoWidth - Source video width
 * @param videoHeight - Source video height
 * @returns Clamped CropState that fits within video bounds
 */
export function clampCropToBounds(
  crop: CropState,
  videoWidth: number,
  videoHeight: number
): CropState {
  const MIN_SIZE = 50;

  // Clamp dimensions first
  const width = Math.max(MIN_SIZE, Math.min(crop.width, videoWidth));
  const height = Math.max(MIN_SIZE, Math.min(crop.height, videoHeight));

  // Clamp position to keep crop within bounds
  const x = Math.max(0, Math.min(crop.x, videoWidth - width));
  const y = Math.max(0, Math.min(crop.y, videoHeight - height));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Parameters for canvas drawImage when rendering cropped video.
 */
export interface DrawCropParams {
  // Source rectangle (from video frame)
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  // Destination rectangle (on canvas)
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
}

/**
 * Calculate canvas drawImage parameters for rendering cropped video.
 *
 * This function calculates how to draw a cropped portion of a video
 * onto a target area, maintaining aspect ratio and centering.
 *
 * @param crop - Crop region in source video pixels
 * @param targetX - Target X position on canvas
 * @param targetY - Target Y position on canvas
 * @param targetWidth - Target area width on canvas
 * @param targetHeight - Target area height on canvas
 * @returns DrawCropParams for use with ctx.drawImage()
 */
export function getCropDrawParams(
  crop: CropState | undefined,
  sourceWidth: number,
  sourceHeight: number,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number
): DrawCropParams {
  // If no crop, use full source
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sWidth = crop?.width ?? sourceWidth;
  const sHeight = crop?.height ?? sourceHeight;

  // Calculate scale to fill target area (cover, not contain)
  const cropRatio = sWidth / sHeight;
  const targetRatio = targetWidth / targetHeight;

  let dWidth: number;
  let dHeight: number;

  if (cropRatio > targetRatio) {
    // Crop is wider - fit to height, overflow width
    dHeight = targetHeight;
    dWidth = targetHeight * cropRatio;
  } else {
    // Crop is taller - fit to width, overflow height
    dWidth = targetWidth;
    dHeight = targetWidth / cropRatio;
  }

  // Center within target area
  const dx = targetX + (targetWidth - dWidth) / 2;
  const dy = targetY + (targetHeight - dHeight) / 2;

  return { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight };
}

/**
 * Determine which preset matches the current crop aspect ratio (if any).
 * Returns 'freeform' if no preset matches within tolerance.
 *
 * @param crop - Current crop state
 * @returns The matching preset or 'freeform'
 */
export function detectCropPreset(crop: CropState): CropPreset {
  const ratio = crop.width / crop.height;
  const tolerance = 0.05;

  if (Math.abs(ratio - 9 / 16) < tolerance) return "9:16";
  if (Math.abs(ratio - 1) < tolerance) return "1:1";
  if (Math.abs(ratio - 16 / 9) < tolerance) return "16:9";
  if (Math.abs(ratio - 4 / 5) < tolerance) return "4:5";
  return "freeform";
}
