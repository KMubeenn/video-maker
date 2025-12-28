// Editor feature types
// Types for video editing modal (trim, crop, meme sounds)

import type { MemeSound, VideoMemeSound } from "../../types/timeline";
import type { CropPreset, CropState } from "../../utils/cropUtils";

/**
 * Props for the VideoEditor component.
 */
export interface VideoEditorProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    trimStart: number,
    trimEnd: number,
    cropX?: number,
    cropY?: number,
    cropWidth?: number,
    cropHeight?: number,
    memeSounds?: VideoMemeSound[]
  ) => void;
  initialTrimStart?: number;
  initialTrimEnd?: number;
  initialCropX?: number;
  initialCropY?: number;
  initialCropWidth?: number;
  initialCropHeight?: number;
  initialMemeSounds?: VideoMemeSound[];
}

/**
 * State for video playback within the editor.
 */
export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

/**
 * State for trim handles on the timeline.
 */
export interface TrimState {
  start: number;
  end: number;
}

/**
 * Drag operation types in the editor.
 */
export type DragOperation =
  | "idle"
  | "trim-start"
  | "trim-end"
  | "playhead"
  | "crop-move"
  | "crop-resize"
  | "sound-drag";

/**
 * State for drag interactions in the editor.
 */
export interface DragState {
  operation: DragOperation;
  startX: number;
  startY: number;
  itemId?: string;
}

// Re-export from cropUtils for convenience
export type { CropPreset, CropState };
