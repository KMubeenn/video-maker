// Ranking feature types
// Re-exports and feature-specific type extensions

import type { TextSegment } from "../../components/RichTextInput";
import type { VideoMemeSound } from "../../types/timeline";
import type { RankingVideoInput } from "../../api/video.api";

/**
 * Extended VideoInput for the ranking feature.
 * Includes all fields from RankingVideoInput plus UI-specific state.
 */
export interface VideoInput {
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
  localPath?: string; // Downloaded video path for Remotion
}

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
  videos: VideoInput[];
  width: number;
  height: number;
  previewState: PreviewState;
  onGeneratePreview: () => void;
}

/**
 * Default empty video input factory.
 */
export function createEmptyVideoInput(id: number): VideoInput {
  return {
    id,
    url: "",
    title: [{ text: "", color: "white", fontSize: 52 }],
    memeSounds: [],
  };
}

/**
 * Default main title factory.
 */
export function createDefaultMainTitle(): TextSegment[] {
  return [{ text: "", color: "white", fontSize: 64 }];
}
