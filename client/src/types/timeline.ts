import type { TextSegment } from "../components/RichTextInput";

export interface TimelineClip {
  id: number;
  url: string; // The served URL (http://localhost:4000/uploads/...)
  originalUrl: string; // The source URL (TikTok etc)
  duration: number; // Total duration of the source file
  startTime: number; // Start time on the timeline
  endTime: number; // End time on the timeline
  sourceStart: number; // Start time within the source file (trim start)
  volume: number;
  videoElement?: HTMLVideoElement; // Reference to the DOM element
  audioBuffer?: AudioBuffer; // Decoded audio
}

export interface TextOverlay {
  id: string; // Unique ID
  text: TextSegment[];
  startTime: number;
  endTime: number;
  x: number | string; // Can be pixel value or "center" logic
  y: number;
  type: "main-title" | "ranking-title" | "ranking-number";
  opacity: number;
  scale: number;
  rank?: number; // For ranking specific logic
}

export interface TimelineState {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  clips: TimelineClip[];
  overlays: TextOverlay[];
  width: number;
  height: number;
}
