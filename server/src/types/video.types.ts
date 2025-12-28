/**
 * Text segment for rich text formatting
 * Used by both FFmpeg service and client-side rendering
 */
export interface TextSegment {
  text: string;
  color?: string;
  fontSize?: number;
  hasBorder?: boolean; // Enable border around text
}

/**
 * Video metadata from FFmpeg probe
 */
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}
