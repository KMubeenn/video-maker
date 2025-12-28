// Preview feature types
// Types for real-time canvas preview and timeline management

import type { TextSegment } from "../../components/RichTextInput";
import type {
  TimelineClip,
  TextOverlay,
  VideoMemeSound,
} from "../../types/timeline";

/**
 * Props for the RealtimePreview component.
 */
export interface RealtimePreviewProps {
  mainTitle: TextSegment[];
  videos: {
    id: number;
    url: string;
    title: TextSegment[];
    trimStart?: number;
    trimEnd?: number;
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    memeSounds?: VideoMemeSound[];
  }[];
  width: number;
  height: number;
  firstToPlay?: number | null;
}

/**
 * Asset loaded from backend for preview playback.
 */
export interface LoadedAsset {
  url: string;
  originalUrl: string;
  duration: number;
  audioBuffer?: AudioBuffer;
}

/**
 * Timeline state for preview playback.
 */
export interface TimelinePlaybackState {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  clips: TimelineClip[];
  overlays: TextOverlay[];
  width: number;
  height: number;
}

/**
 * Normalize colors to match FFmpeg backend rendering.
 * Used to ensure preview matches final export.
 */
export const COLOR_MAP: Record<string, string> = {
  "#FFD700": "#FFC700",
  "#FF6B6B": "#E63946",
  "#4ECDC4": "#06AED5",
  "#95E1D3": "#2D9E6D",
};

export function normalizeColor(color: string | undefined): string {
  if (!color) return "white";
  return COLOR_MAP[color] || color;
}
