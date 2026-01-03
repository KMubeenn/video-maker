/**
 * Shared Type Schema for Ranking Video Composition
 * Version 1.0
 *
 * This schema defines the JSON-serializable data structure for Remotion-based
 * video compositions. All video editing operations are represented as parameters
 * in this structure rather than timeline events.
 */

/**
 * Text segment with styling options
 */
export interface TextSegment {
  text: string;
  color?: string; // CSS color (e.g., "#FFD700", "white")
  fontSize?: number; // Font size in pixels
  hasBorder?: boolean; // Whether to show yellow border (default: true for non-white text)
}

/**
 * Meme sound overlay on a clip
 */
export interface MemeSound {
  id: string; // Unique instance ID
  soundUrl: string; // Public URL to sound file
  startTime: number; // Start time in seconds (relative to clip trim start)
  volume: number; // Volume level (0.0 - 1.0)
}

/**
 * Crop preset types
 */
export type CropPreset = "9:16" | "1:1" | "16:9" | "full";

/**
 * Crop alignment options
 */
export type CropAlign = "top" | "center" | "bottom";

/**
 * Crop configuration
 */
export interface CropConfig {
  preset: CropPreset; // Crop aspect ratio preset
  scale: number; // Scale factor (1.0 = 100%, 1.2 = 120%)
  align: CropAlign; // Vertical alignment for cropped region
}

/**
 * Trim configuration
 */
export interface TrimConfig {
  start: number; // Start time in seconds
  end: number; // End time in seconds
}

/**
 * Video source information
 */
export interface VideoSource {
  url: string; // Original URL (TikTok, YouTube, etc.)
  localPath?: string; // Downloaded file path (server-side only)
}

/**
 * Single video clip in the ranking
 */
export interface RankingClip {
  id: string; // Unique clip ID (UUID)
  rank: number; // Rank position (1-6)

  source: VideoSource; // Video source
  trim: TrimConfig; // Trim settings
  crop: CropConfig; // Crop settings

  label: TextSegment[]; // Clip title/label (rich text)
  memeSounds?: MemeSound[]; // Optional meme sound overlays
}

/**
 * Global video settings
 */
export interface GlobalSettings {
  mainTitle: TextSegment[]; // Main video title (rich text)
}

/**
 * Video composition metadata
 */
export interface CompositionMetadata {
  createdAt: string; // ISO 8601 timestamp
  width: number; // Video width in pixels (default: 1080)
  height: number; // Video height in pixels (default: 1920)
  fps: number; // Frames per second (default: 30)
}

/**
 * Complete ranking video composition
 * This is the root data structure that fully describes a ranking video.
 */
export interface RankingVideoComposition {
  version: "1.0"; // Schema version for future migrations
  metadata: CompositionMetadata;
  globalSettings: GlobalSettings;
  clips: RankingClip[];
}

/**
 * Default values for new compositions
 */
export const DEFAULT_COMPOSITION_METADATA: CompositionMetadata = {
  createdAt: new Date().toISOString(),
  width: 1080,
  height: 1920,
  fps: 30,
};

export const DEFAULT_CROP_CONFIG: CropConfig = {
  preset: "9:16",
  scale: 1.0,
  align: "center",
};

export const DEFAULT_TRIM_CONFIG: TrimConfig = {
  start: 0,
  end: 0, // Will be set to video duration
};
