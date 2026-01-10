// Ranking feature types
// Re-exports and feature-specific type extensions

import type { TextSegment } from "../../components/RichTextInput";

/**
 * Audio track for a clip (e.g., meme sound).
 */
export type AudioTrack = {
  src: string;
  start: number;
  volume?: number;
};

/**
 * Strict data model for a single edited clip.
 * Single source of truth for preview and export.
 */
export type EditedClip = {
  id: string;
  src: string;
  duration: number; // Duration of the source clip in seconds (0 if unknown/default)
  trim?: { start: number; end: number };
  crop?: { x: number; y: number; width: number; height: number };
  audio?: AudioTrack[]; // Accommodate multiple audio tracks (meme sounds)
  title?: TextSegment[]; // Accommodate rich text title
  resolution?: { width: number; height: number }; // Native resolution for accurate rendering
  slotIndex: number; // Display number (1-based)
};

/**
 * Specification for rendering the final video.
 * Calculated purely from EditedClip data.
 */
export type RenderSpec = {
  fps: number;
  mainTitle: TextSegment[];
  slots: Array<{
    slotIndex: number;
    id: string; // used for keying
  }>;
  sequence: Array<{
    clip: EditedClip;
    startFrame: number;
    durationInFrames: number;
  }>;
};

/**
 * State for the preview panel.
 */
export interface PreviewState {
  isGenerating: boolean;
  videoUrl: string | null;
  error: string | null;
  warnings?: {
    message: string;
    failedVideos: Array<{
      url: string;
      index: number;
      error: string;
      platform: string;
    }>;
  };
}

/**
 * Props for the VideoPreviewPanel component.
 */
export interface PreviewProps {
  mainTitle: TextSegment[];
  videos: EditedClip[];
  width: number;
  height: number;
  previewState: PreviewState;
  onGeneratePreview: () => void;
}

/**
 * Default empty video input factory.
 */
export function createEmptyEditedClip(
  id: string,
  slotIndex: number
): EditedClip {
  return {
    id,
    slotIndex,
    src: "",
    duration: 0,
    title: [{ text: "", color: "white", fontSize: 52 }],
    audio: [],
  };
}

/**
 * Default main title factory.
 */
export function createDefaultMainTitle(): TextSegment[] {
  return [{ text: "", color: "white", fontSize: 64 }];
}
