import type { VideoMemeSound } from "./timeline";
import type { CropPreset } from "../utils/cropUtils";

export interface ClipEditorState {
  source: string;
  duration: number; // Source duration
  nativeWidth: number;
  nativeHeight: number;

  trim: {
    start: number;
    end: number;
  };

  crop: {
    x: number; // Normalized (0-1)
    y: number; // Normalized (0-1)
    width: number; // Normalized (0-1)
    height: number; // Normalized (0-1)
    aspectRatio: number | null; // width / height
    preset: CropPreset;
  };

  // Using array to support existing multiple sounds feature
  audio: VideoMemeSound[];
}
