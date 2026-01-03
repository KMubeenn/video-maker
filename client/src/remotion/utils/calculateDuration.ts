/**
 * Remotion Composition Utilities
 * Pure functions for calculating timing and layout
 */

import type { RankingClip } from "@/types/ranking-video.schema";

/**
 * Clip timing information in frames
 */
export interface ClipTiming {
  from: number; // Start frame
  durationInFrames: number; // Duration in frames
}

/**
 * Calculate frame timings for all clips
 * @param clips - Array of ranking clips
 * @param fps - Frames per second
 * @returns Array of timing info for each clip
 */
export function calculateClipTimings(
  clips: RankingClip[],
  fps: number
): ClipTiming[] {
  let currentFrame = 0;
  const timings: ClipTiming[] = [];

  for (const clip of clips) {
    const clipDurationSeconds = clip.trim.end - clip.trim.start;
    const clipDurationFrames = Math.round(clipDurationSeconds * fps);

    timings.push({
      from: currentFrame,
      durationInFrames: clipDurationFrames,
    });

    currentFrame += clipDurationFrames;
  }

  return timings;
}

/**
 * Calculate total video duration in frames
 * @param clips - Array of ranking clips
 * @param fps - Frames per second
 * @returns Total duration in frames
 */
export function calculateTotalDuration(
  clips: RankingClip[],
  fps: number
): number {
  const timings = calculateClipTimings(clips, fps);
  if (timings.length === 0) return 0;

  const lastTiming = timings[timings.length - 1];
  return lastTiming.from + lastTiming.durationInFrames;
}

/**
 * Convert seconds to frames
 */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/**
 * Convert frames to seconds
 */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}
