/**
 * Remotion Ranking Orchestrator
 * Domain logic for creating ranking videos using Remotion
 */

import type { TextSegment } from "../../types/index.js";
import {
  downloadMultipleVideos,
  type MultiDownloadResult,
} from "../../services/downloader.service.js";
import {
  renderRankingVideo,
  type RenderResult,
} from "../../services/remotion-renderer.service.js";
import type {
  RankingVideoComposition,
  RankingClip,
  TextSegment as RemotionTextSegment,
} from "../../../shared/schemas/ranking-video.schema.js";
import path from "path";

// Re-export types for convenience
export { type TextSegment };

/**
 * Input for a single video in the ranking
 */
export interface VideoInput {
  url: string;
  title: TextSegment[];
  trimStart?: number;
  trimEnd?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  memeSounds?: {
    file: string;
    startTime: number;
    volume: number;
  }[];
}

/**
 * Options for ranking video creation
 */
export interface RankingOptions {
  mainTitle: TextSegment[];
  videos: VideoInput[];
  width?: number;
  height?: number;
  firstToPlay?: number;
  outputFilename?: string;
  useRemotion?: boolean; // Toggle between Remotion and FFmpeg
}

/**
 * Convert app TextSegment to Remotion TextSegment
 */
function convertTextSegments(segments: TextSegment[]): RemotionTextSegment[] {
  return segments.map((seg) => ({
    text: seg.text,
    color: seg.color || "white",
    fontSize: seg.fontSize || 52,
    hasBorder: seg.hasBorder,
  }));
}

/**
 * Create ranking video composition for Remotion
 */
function createRankingComposition(
  options: RankingOptions,
  downloadedVideos: string[]
): RankingVideoComposition {
  const { mainTitle, videos, width = 1080, height = 1920 } = options;

  const clips: RankingClip[] = videos.map((video, index) => ({
    id: `clip-${index}`,
    rank: index + 1,
    source: {
      url: video.url,
      localPath: downloadedVideos[index],
    },
    trim: {
      start: video.trimStart || 0,
      end: video.trimEnd || 10,
    },
    crop: {
      preset: "9:16",
      scale: 1.0,
      align: "center",
    },
    label: convertTextSegments(video.title),
    memeSounds: video.memeSounds?.map((sound, idx) => ({
      id: `sound-${index}-${idx}`,
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
      mainTitle: convertTextSegments(mainTitle),
    },
    clips,
  };
}

/**
 * Create a ranking video using Remotion
 */
export async function createRankingVideoWithRemotion(
  options: RankingOptions
): Promise<string> {
  // Step 1: Validate inputs
  if (!options.mainTitle || options.mainTitle.length === 0) {
    throw new Error("Main title is required");
  }

  if (!options.videos || options.videos.length === 0) {
    throw new Error("At least one video is required");
  }

  // Step 2: Download videos
  console.log("Step 1: Downloading videos...");
  const downloadResult: MultiDownloadResult = await downloadMultipleVideos(
    options.videos.map((v) => v.url)
  );

  if (downloadResult.failures.length > 0) {
    console.warn("Some videos failed to download:", downloadResult.failures);
  }

  if (downloadResult.successes.length === 0) {
    throw new Error("No videos could be downloaded");
  }

  // Step 3: Create Remotion composition
  console.log("Step 2: Creating Remotion composition...");
  const composition = createRankingComposition(
    options,
    downloadResult.successes.map((s) => s.path)
  );

  // Step 4: Render with Remotion
  console.log("Step 3: Rendering video with Remotion...");
  const outputFilename = options.outputFilename || `ranking-${Date.now()}.mp4`;
  const outputPath = path.resolve("uploads", "outputs", outputFilename);

  const renderResult: RenderResult = await renderRankingVideo({
    composition,
    outputPath,
  });

  if (!renderResult.success) {
    throw new Error(`Remotion rendering failed: ${renderResult.error}`);
  }

  console.log("Video created successfully:", outputPath);
  return outputPath;
}
