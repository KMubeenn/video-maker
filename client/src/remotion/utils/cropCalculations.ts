/**
 * Crop Calculation Utilities
 * Pure functions for calculating crop regions from presets
 */

import type { CropConfig } from "@/types/ranking-video.schema";

/**
 * Crop region in pixels
 */
export interface CropRegion {
  x: number; // Left offset
  y: number; // Top offset
  width: number; // Crop width
  height: number; // Crop height
}

/**
 * CSS style for crop transform
 */
export interface CropStyle {
  transform: string;
  transformOrigin: string;
  width: string;
  height: string;
  position: "absolute";
  left: string;
  top: string;
}

/**
 * Calculate crop region from preset
 * @param videoWidth - Source video width in pixels
 * @param videoHeight - Source video height in pixels
 * @param cropConfig - Crop configuration
 * @param canvasWidth - Target canvas width (default: 1080)
 * @param canvasHeight - Target canvas height (default: 1920)
 * @returns Crop region in pixels
 */
export function calculateCropRegion(
  videoWidth: number,
  videoHeight: number,
  cropConfig: CropConfig,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920
): CropRegion {
  const { preset, scale, align } = cropConfig;

  // Full frame - no crop
  if (preset === "full") {
    return {
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    };
  }

  // Calculate target aspect ratio
  let targetAspectRatio: number;
  switch (preset) {
    case "9:16":
      targetAspectRatio = 9 / 16;
      break;
    case "1:1":
      targetAspectRatio = 1;
      break;
    case "16:9":
      targetAspectRatio = 16 / 9;
      break;
    default:
      targetAspectRatio = 9 / 16;
  }

  // Calculate crop dimensions
  const sourceAspectRatio = videoWidth / videoHeight;
  let cropWidth: number;
  let cropHeight: number;

  if (sourceAspectRatio > targetAspectRatio) {
    // Video is wider than target - crop width
    cropHeight = videoHeight;
    cropWidth = cropHeight * targetAspectRatio;
  } else {
    // Video is taller than target - crop height
    cropWidth = videoWidth;
    cropHeight = cropWidth / targetAspectRatio;
  }

  // Apply scale
  cropWidth = cropWidth / scale;
  cropHeight = cropHeight / scale;

  // Ensure crop doesn't exceed video bounds
  cropWidth = Math.min(cropWidth, videoWidth);
  cropHeight = Math.min(cropHeight, videoHeight);

  // Calculate position based on alignment
  let x = (videoWidth - cropWidth) / 2; // Center horizontally by default

  let y: number;
  switch (align) {
    case "top":
      y = 0;
      break;
    case "bottom":
      y = videoHeight - cropHeight;
      break;
    case "center":
    default:
      y = (videoHeight - cropHeight) / 2;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

/**
 * Convert crop region to CSS style for Remotion Video component
 * @param cropRegion - Crop region in pixels
 * @param canvasWidth - Canvas width (default: 1080)
 * @param canvasHeight - Canvas height (default: 1920)
 * @returns CSS style object
 */
export function cropRegionToStyle(
  cropRegion: CropRegion,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920
): CropStyle {
  // Calculate scale to fill canvas
  const scaleX = canvasWidth / cropRegion.width;
  const scaleY = canvasHeight / cropRegion.height;
  const scale = Math.max(scaleX, scaleY);

  // Calculate position to center the crop
  const scaledWidth = cropRegion.width * scale;
  const scaledHeight = cropRegion.height * scale;
  const left = (canvasWidth - scaledWidth) / 2;
  const top = (canvasHeight - scaledHeight) / 2;

  return {
    position: "absolute",
    width: `${cropRegion.width}px`,
    height: `${cropRegion.height}px`,
    left: `${left}px`,
    top: `${top}px`,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };
}

/**
 * Apply crop configuration to get CSS style
 * @param videoWidth - Source video width
 * @param videoHeight - Source video height
 * @param cropConfig - Crop configuration
 * @param canvasWidth - Canvas width
 * @param canvasHeight - Canvas height
 * @returns CSS style for Video component
 */
export function applyCrop(
  videoWidth: number,
  videoHeight: number,
  cropConfig: CropConfig,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920
): CropStyle {
  const cropRegion = calculateCropRegion(
    videoWidth,
    videoHeight,
    cropConfig,
    canvasWidth,
    canvasHeight
  );

  return cropRegionToStyle(cropRegion, canvasWidth, canvasHeight);
}
