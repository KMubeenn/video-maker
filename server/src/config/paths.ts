/**
 * Centralized path constants for the server
 * Avoids hardcoding paths across multiple files
 */

import path from "path";

// Base directories
export const UPLOADS_DIR = "uploads";
export const OUTPUTS_DIR = "outputs";
export const ASSETS_DIR = "assets";
export const DOWNLOADS_DIR = "downloads";

// Subdirectories
export const CACHE_DIR = path.join(UPLOADS_DIR, "cache");
export const SOUNDS_DIR = path.join(ASSETS_DIR, "sounds");

// Generate unique filename with timestamp
export function generateTempFilename(
  prefix: string,
  extension: string
): string {
  return `${prefix}-${Date.now()}.${extension}`;
}

// Generate output path
export function getOutputPath(filename: string): string {
  return path.join(OUTPUTS_DIR, filename);
}

// Generate upload path
export function getUploadPath(filename: string): string {
  return path.join(UPLOADS_DIR, filename);
}
