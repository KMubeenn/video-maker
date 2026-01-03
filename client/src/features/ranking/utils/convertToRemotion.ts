/**
 * Simple Remotion Preview Integration
 * Converts current app state to Remotion composition format
 */

import type {
  RankingVideoComposition,
  RankingClip as RemotionClip,
} from "@/types/ranking-video.schema";
import type { VideoInput } from "../types/ranking";
import type { TextSegment } from "../api/video.api";

/**
 * Convert app state to Remotion composition
 */
export function convertToRemotionComposition(
  mainTitle: TextSegment[],
  videos: VideoInput[],
  width: number,
  height: number
): RankingVideoComposition {
  const clips: RemotionClip[] = videos.map((video, index) => ({
    id: `clip-${video.id}`,
    rank: index + 1,
    source: {
      url: video.url,
      localPath: (video as any).localPath, // Pass downloaded path if available
    },
    trim: {
      start: video.trimStart || 0,
      end: video.trimEnd || 10, // Default 10s if not set
    },
    crop: {
      preset: "9:16",
      scale: 1.0,
      align: "center",
    },
    label: video.title,
    memeSounds: video.memeSounds?.map((sound, idx) => ({
      id: `sound-${video.id}-${idx}`,
      soundUrl: sound.file,
      startTime: sound.startTime,
      volume: sound.volume,
    })),
  }));

  return {
    version: "1.0",
    metadata: {
      createdAt: new Date().toISOString(),
      width,
      height,
      fps: 30,
    },
    globalSettings: {
      mainTitle,
    },
    clips,
  };
}
