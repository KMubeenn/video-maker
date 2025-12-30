/**
 * Ranking Video Orchestrator
 * Domain logic for creating ranking videos, separated from HTTP concerns
 */

import type { TextSegment } from "../../types/index.js";
import {
  downloadMultipleVideos,
  type MultiDownloadResult,
} from "../../services/downloader.service.js";
import {
  createRankingVideo,
  type RankingVideoInput,
} from "../../services/ffmpeg.service.js";

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
  firstToPlay?: number; // Index of video to play first (0-based, must be >= 1)
  outputFilename?: string;
}

/**
 * Result of ranking video creation
 */
export interface RankingResult {
  success: boolean;
  outputPath: string;
  successfulCount: number;
  failedDownloads?: Array<{
    url: string;
    index: number;
    error: string;
    platform: string;
  }>;
}

/**
 * Validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate ranking options
 */
export function validateRankingOptions(options: RankingOptions): void {
  const mainTitleText = options.mainTitle[0]?.text || "";
  if (!mainTitleText.trim()) {
    throw new ValidationError("Main title is required");
  }

  if (!options.videos || !Array.isArray(options.videos)) {
    throw new ValidationError("Videos must be an array");
  }

  if (options.videos.length < 3 || options.videos.length > 6) {
    throw new ValidationError("Please provide between 3 and 6 videos");
  }

  for (let i = 0; i < options.videos.length; i++) {
    const video = options.videos[i];
    if (!video) {
      throw new ValidationError(`Video ${i + 1} is missing`);
    }
    const videoTitleText = video.title[0]?.text || "";
    if (!video.url || !videoTitleText.trim()) {
      throw new ValidationError(`Video ${i + 1} must have both url and title`);
    }
  }
}

/**
 * Prepare ranking inputs from download results
 */
function prepareRankingInputs(
  downloadResults: MultiDownloadResult,
  videos: VideoInput[],
  urls: string[]
): RankingVideoInput[] {
  return downloadResults.successful.map((downloaded) => {
    const originalIndex = downloaded.index;
    const originalVideo = videos[originalIndex];

    return {
      filePath: downloaded.filePath,
      title: originalVideo?.title || [
        { text: `Video ${originalIndex + 1}`, color: "white", fontSize: 48 },
      ],
      rank: originalIndex + 1,
      trimStart: originalVideo?.trimStart,
      trimEnd: originalVideo?.trimEnd,
      cropX: originalVideo?.cropX,
      cropY: originalVideo?.cropY,
      cropWidth: originalVideo?.cropWidth,
      cropHeight: originalVideo?.cropHeight,
      memeSounds: originalVideo?.memeSounds?.map((s) => ({
        file: s.file,
        startTime: s.startTime,
        volume: s.volume,
      })),
    };
  });
}

/**
 * Shuffle videos for playback order
 * Rank 1 always plays last, others are sorted deterministically
 */
function shuffleVideos(
  inputs: RankingVideoInput[],
  firstToPlay?: number
): RankingVideoInput[] {
  // Separate rank 1 video from the rest
  const rank1Video = inputs[0]!;
  const otherVideos = inputs.slice(1);

  // Deterministic shuffle using hash sort
  let sortedOthers = [...otherVideos].sort((a, b) => {
    const valA = (a.rank * 13 + 7) % 5;
    const valB = (b.rank * 13 + 7) % 5;
    return valA - valB;
  });

  // If firstToPlay specified, move that video to front
  if (firstToPlay !== undefined && firstToPlay !== null && firstToPlay >= 1) {
    const targetRank = firstToPlay + 1;
    const selectedVideo = sortedOthers.find((v) => v.rank === targetRank);
    if (selectedVideo) {
      sortedOthers = sortedOthers.filter((v) => v.rank !== targetRank);
      sortedOthers.unshift(selectedVideo);
      console.log(`User selected rank #${targetRank} to play first`);
    }
  }

  // Rank 1 always at the end
  const shuffled = [...sortedOthers, rank1Video];
  console.log(
    `Playback order: ${shuffled.map((v) => `#${v.rank}`).join(" → ")}`
  );

  return shuffled;
}

/**
 * Main orchestration function for creating ranking videos
 * Handles downloading, shuffling, and FFmpeg processing
 */
export async function orchestrateRankingVideo(
  options: RankingOptions
): Promise<RankingResult> {
  // Validate inputs
  validateRankingOptions(options);

  console.log(`Creating ranking video with ${options.videos.length} videos...`);

  // Step 1: Download videos
  console.log("Step 1: Downloading videos...");
  const urls = options.videos.map((v) => v.url);
  const downloadResults = await downloadMultipleVideos(urls);

  // Check download results
  if (downloadResults.successful.length === 0) {
    throw new Error("All video downloads failed");
  }

  if (downloadResults.successful.length < 3) {
    throw new Error(
      `At least 3 videos required, only ${downloadResults.successful.length} downloaded`
    );
  }

  // Log warnings for failed downloads
  if (downloadResults.failed.length > 0) {
    console.warn(
      `⚠️ ${downloadResults.failed.length} video(s) failed to download`
    );
    downloadResults.failed.forEach((f) => {
      console.warn(`  - Video ${f.index + 1} (${f.url}): ${f.error}`);
    });
  }

  console.log(
    `Successfully downloaded ${downloadResults.successful.length} videos`
  );

  // Step 2: Prepare and shuffle inputs
  const rankingInputs = prepareRankingInputs(
    downloadResults,
    options.videos,
    urls
  );
  const shuffledInputs = shuffleVideos(rankingInputs, options.firstToPlay);

  // Step 3: Create ranking video
  console.log("Step 2: Creating ranking video with overlays...");
  const outputFilename = options.outputFilename || `ranking-${Date.now()}.mp4`;

  const outputPath = await createRankingVideo(
    {
      mainTitle: options.mainTitle,
      videos: shuffledInputs,
      ...(options.width && { width: options.width }),
      ...(options.height && { height: options.height }),
    },
    outputFilename
  );

  return {
    success: true,
    outputPath,
    successfulCount: downloadResults.successful.length,
    failedDownloads:
      downloadResults.failed.length > 0
        ? downloadResults.failed.map((f) => ({
            url: f.url,
            index: f.index,
            error: f.error,
            platform: f.platform,
          }))
        : undefined,
  };
}
