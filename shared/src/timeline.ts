/**
 * Shared Timeline Builder for Ranking Videos
 *
 * This module provides a single source of truth for timeline logic,
 * ensuring the preview and FFmpeg export show identical title behavior.
 */

import type { TextSegment } from "./types/index.js";

/**
 * A title segment represents when a specific video title should be visible
 */
export interface TitleSegment {
  videoId: number; // Which video's title this is
  startTime: number; // Global timeline start (seconds)
  endTime: number; // Global timeline end (seconds)
  slotIndex: number; // Fixed rank slot (1-6)
  title: TextSegment[]; // Title content
  isCurrentlyPlaying: boolean; // Yellow (true) vs white (false)
}

/**
 * Information about a clip in the timeline
 */
export interface TimelineClipInfo {
  videoId: number;
  videoNumber: number; // Immutable display slot
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Complete timeline model for a ranking video
 */
export interface RankingTimeline {
  clips: TimelineClipInfo[];
  titleSegments: TitleSegment[];
  totalDuration: number;
}

/**
 * Input video metadata for timeline calculation
 */
export interface VideoMetadata {
  id: number; // Stable unique ID
  videoNumber: number; // Immutable display slot (1-6)
  title: TextSegment[]; // Title content
  duration: number; // Duration in seconds (after trim)
}

/**
 * Build a deterministic timeline for ranking video export
 *
 * @param videos - Videos in playback order (as determined by drag-and-drop)
 * @returns Timeline with clip info and title segments
 *
 * Timeline Logic:
 * - Videos play in the order provided (playbackOrder from drag-and-drop)
 * - Each video occupies a fixed rank slot (videoNumber, never changes)
 * - Progressive reveal: titles appear when their video plays, persist afterward
 * - Currently playing video title is highlighted (isCurrentlyPlaying = true)
 */
export function buildRankingTimeline(videos: VideoMetadata[]): RankingTimeline {
  const clips: TimelineClipInfo[] = [];
  const titleSegments: TitleSegment[] = [];
  let currentOffset = 0;

  // Step 1: Build clip timeline (calculate start/end times)
  for (const video of videos) {
    if (video.duration <= 0) continue;

    clips.push({
      videoId: video.id,
      videoNumber: video.videoNumber,
      startTime: currentOffset,
      endTime: currentOffset + video.duration,
      duration: video.duration,
    });

    currentOffset += video.duration;
  }

  const totalDuration = currentOffset;

  // Step 2: Generate title segments with progressive reveal
  // For each clip playing, determine which titles should be visible
  clips.forEach((clip, playbackIndex) => {
    // Track which videos have been revealed so far
    // (all videos that have played up to and including current)
    const revealedVideoIds = new Set<number>();
    clips.slice(0, playbackIndex + 1).forEach((c) => {
      revealedVideoIds.add(c.videoId);
    });

    // Iterate through ALL video slots to determine which titles to show
    videos.forEach((video) => {
      // Check if this video is currently playing
      const isThisVideoPlaying = video.id === clip.videoId;

      // Show title if this video is currently playing OR has been revealed
      if (isThisVideoPlaying || revealedVideoIds.has(video.id)) {
        titleSegments.push({
          videoId: video.id,
          startTime: clip.startTime,
          endTime: clip.endTime,
          slotIndex: video.videoNumber,
          title: video.title,
          isCurrentlyPlaying: isThisVideoPlaying,
        });
      }
    });
  });

  return {
    clips,
    titleSegments,
    totalDuration,
  };
}
