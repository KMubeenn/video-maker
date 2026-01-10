import { TextSegment } from "./video.types.js";

export interface AudioTrack {
  src: string;
  start: number; // Start time regarding the clip start (seconds)
  volume?: number;
}

export interface EditedClip {
  id: string;
  slotIndex: number; // 1-based index for rank display
  title: TextSegment[];
  src: string;
  duration: number; // Original duration of the source
  trim?: {
    start: number;
    end: number;
  };
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  resolution?: {
    width: number;
    height: number;
  };
  audio?: AudioTrack[];
}

export interface RenderSpec {
  fps: number;
  sequence: {
    clip: EditedClip;
    startFrame: number;
    durationInFrames: number;
  }[];
}
