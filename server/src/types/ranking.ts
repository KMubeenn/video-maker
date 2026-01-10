import type { TextSegment } from "./video.types.js";

export type AudioTrack = {
  src: string;
  start: number;
  volume?: number;
};

export type EditedClip = {
  id: string;
  src: string;
  duration: number;
  trim?: { start: number; end: number };
  crop?: { x: number; y: number; width: number; height: number };
  audio?: AudioTrack[];
  title?: TextSegment[];
  resolution?: { width: number; height: number };
  slotIndex: number;
};

export type RenderSpec = {
  fps: number;
  mainTitle: TextSegment[];
  slots: Array<{
    slotIndex: number;
    id: string;
  }>;
  sequence: Array<{
    clip: EditedClip;
    startFrame: number;
    durationInFrames: number;
  }>;
};
