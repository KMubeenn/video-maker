import path from "path";
import type { Request, Response } from "express";
import {
  downloadVideo,
  downloadMultipleVideos,
  type MultiDownloadResult,
  type DownloadError,
} from "../services/downloader.service.js";
import {
  createRankingVideo,
  getVideoMetadata,
  type TextSegment,
} from "../services/ffmpeg.service.js";

// ... existing code ...

/**
 * Prepare resources for client-side realtime preview
 * Downloads videos and returns their local paths + metadata
 */
export async function preparePreview(req: Request, res: Response) {
  try {
    const { videos } = req.body as {
      videos: { url: string; id: number }[];
    };

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    console.log(`Preparing preview resources for ${videos.length} videos...`);

    // Download videos
    const urls = videos.map((v) => v.url);
    const downloadResults = await downloadMultipleVideos(urls);

    if (downloadResults.successful.length === 0) {
      return res.status(400).json({
        error: "All video downloads failed",
        failedVideos: downloadResults.failed,
      });
    }

    // Get metadata for each downloaded video
    const readyVideos = await Promise.all(
      downloadResults.successful.map(async (downloaded) => {
        const originalIndex = downloaded.index;
        const originalId = videos[originalIndex]?.id;

        try {
          const metadata = await getVideoMetadata(downloaded.filePath);
          // Convert absolute path to relative path served by static middleware
          // Assuming uploads are served at /uploads
          const parts = downloaded.filePath.split("uploads");
          const relativePath =
            parts.length > 1
              ? parts[1]
              : `/${path.basename(downloaded.filePath)}`;
          const servedUrl = `http://localhost:4000/uploads${(
            relativePath || ""
          ).replace(/\\/g, "/")}`;

          return {
            id: originalId,
            url: servedUrl,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            originalUrl: downloaded.originalUrl,
          };
        } catch (err) {
          console.error(
            `Failed to get metadata for ${downloaded.filePath}:`,
            err
          );
          return null;
        }
      })
    );

    const successfulVideos = readyVideos.filter((v) => v !== null);

    res.json({
      success: true,
      videos: successfulVideos,
      warnings:
        downloadResults.failed.length > 0
          ? {
              message: `${downloadResults.failed.length} video(s) failed to download`,
              failedVideos: downloadResults.failed,
            }
          : undefined,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Prepare preview failed:", err);
    res.status(500).json({
      error: "Failed to prepare preview",
      details: err.message,
    });
  }
}

export interface VideoRankInput {
  url: string;
  title: TextSegment[];
  trimStart?: number;
  trimEnd?: number;
  // Crop values (in source video pixels)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  // Meme sounds to mix into the audio
  memeSounds?: {
    file: string; // URL like http://localhost:4000/assets/sounds/file.mp3
    startTime: number;
    volume: number;
  }[];
}

export interface CreateRankingRequest {
  mainTitle: TextSegment[];
  videos: VideoRankInput[];
  width?: number;
  height?: number;
  firstToPlay?: number;
}

export async function createRanking(req: Request, res: Response) {
  try {
    const { mainTitle, videos, width, height } =
      req.body as CreateRankingRequest;

    // Validate input
    const mainTitleText = mainTitle[0]?.text || "";
    if (!mainTitleText.trim()) {
      return res.status(400).json({ error: "Main title is required" });
    }

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    if (videos.length < 3 || videos.length > 6) {
      return res
        .status(400)
        .json({ error: "Please provide between 3 and 6 videos" });
    }

    // Validate each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video) {
        return res.status(400).json({ error: `Video ${i + 1} is missing` });
      }
      const videoTitleText = video.title[0]?.text || "";
      if (!video.url || !videoTitleText.trim()) {
        return res
          .status(400)
          .json({ error: `Video ${i + 1} must have both url and title` });
      }
    }

    console.log(`Creating ranking video with ${videos.length} videos...`);

    // Download all videos
    console.log("Step 1: Downloading videos...");
    const urls = videos.map((v) => v.url);
    const downloadResults = await downloadMultipleVideos(urls);

    // Check if we have enough successful downloads
    if (downloadResults.successful.length === 0) {
      return res.status(400).json({
        error: "All video downloads failed",
        failedVideos: downloadResults.failed,
      });
    }

    if (downloadResults.successful.length < 3) {
      return res.status(400).json({
        error: "At least 3 videos are required for ranking",
        message: `Only ${downloadResults.successful.length} out of ${urls.length} videos downloaded successfully`,
        failedVideos: downloadResults.failed,
      });
    }

    // Log warnings for failed downloads
    if (downloadResults.failed.length > 0) {
      console.warn(
        `\n⚠️  Warning: ${downloadResults.failed.length} video(s) failed to download:`
      );
      downloadResults.failed.forEach((failure) => {
        console.warn(
          `  - Video ${failure.index + 1} (${failure.url}): ${failure.error}`
        );
      });
      console.warn(
        `Proceeding with ${downloadResults.successful.length} successful downloads\n`
      );
    }

    console.log(
      `Successfully downloaded ${downloadResults.successful.length} videos`
    );

    // Prepare ranking video inputs (maintaining original order with successful downloads only)
    const rankingInputs = downloadResults.successful.map((downloaded) => {
      // Find the original index of this video
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
        // Include crop values for FFmpeg
        cropX: originalVideo?.cropX,
        cropY: originalVideo?.cropY,
        cropWidth: originalVideo?.cropWidth,
        cropHeight: originalVideo?.cropHeight,
        // Pass meme sound URLs directly - FFmpeg service will download if needed
        memeSounds: originalVideo?.memeSounds?.map((s) => ({
          file: s.file, // Keep the URL as-is (Supabase or other)
          startTime: s.startTime,
          volume: s.volume,
        })),
      };
    });

    // Shuffle video order: randomize positions 2-N, keep rank 1 for last
    console.log("Shuffling video playback order (rank 1 plays last)...");

    // Separate rank 1 video from the rest
    const rank1Video = rankingInputs[0]!; // Rank 1 is at index 0 (guaranteed to exist)
    const otherVideos = rankingInputs.slice(1); // Ranks 2, 3, 4, etc.

    // Deterministic shuffle to match frontend "random" look
    // Using simple hash sort based on rank (equivalent to id in frontend)
    // Formula: ((rank * 13 + 7) % 5)
    otherVideos.sort((a, b) => {
      const valA = (a.rank * 13 + 7) % 5;
      const valB = (b.rank * 13 + 7) % 5;
      return valA - valB;
    });

    // Reconstruct array: shuffled videos + rank 1 at the end
    const shuffledInputs = [...otherVideos, rank1Video];

    console.log(
      `Playback order: ${shuffledInputs.map((v) => `#${v.rank}`).join(" → ")}`
    );

    // Create ranking video
    console.log("Step 2: Creating ranking video with overlays...");
    const outputFilename = `ranking-${Date.now()}.mp4`;
    const outputPath = await createRankingVideo(
      {
        mainTitle,
        videos: shuffledInputs, // Use shuffled order
        ...(width && { width }),
        ...(height && { height }),
      },
      outputFilename
    );

    // Note: Not cleaning up downloaded files - they are cached for reuse

    // Return success response with warnings if any videos failed
    const response: any = {
      success: true,
      videoUrl: `http://localhost:4000/${outputPath.replace(/\\/g, "/")}`,
      message: `Successfully created ranking video with ${downloadResults.successful.length} videos`,
      rankings: rankingInputs.map((v) => ({
        rank: v.rank,
        title: v.title,
      })),
    };

    if (downloadResults.failed.length > 0) {
      response.warnings = {
        message: `${downloadResults.failed.length} video(s) were skipped due to download errors`,
        failedVideos: downloadResults.failed,
      };
    }

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Ranking video creation failed:", err);
    res.status(500).json({
      error: "Failed to create ranking video",
      details: err.message,
    });
  }
}

/**
 * Generate a full preview video - downloads all videos and creates the complete ranking video
 * This is identical to the final output, just saved as a preview
 */
export async function generateFullPreview(req: Request, res: Response) {
  try {
    const { mainTitle, videos, width, height, firstToPlay } = req.body as {
      mainTitle: TextSegment[];
      videos: VideoRankInput[];
      width?: number;
      height?: number;
      firstToPlay?: number; // Index of video to play first (must be >= 1, not rank #1)
    };

    // Validation (same as createRanking)
    const mainTitleText = mainTitle[0]?.text || "";
    if (!mainTitleText.trim()) {
      return res.status(400).json({ error: "Main title is required" });
    }

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    if (videos.length < 3 || videos.length > 6) {
      return res
        .status(400)
        .json({ error: "Please provide between 3 and 6 videos" });
    }

    // Validate each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video) {
        return res.status(400).json({ error: `Video ${i + 1} is missing` });
      }
      const videoTitleText = video.title[0]?.text || "";
      if (!video.url || !videoTitleText.trim()) {
        return res
          .status(400)
          .json({ error: `Video ${i + 1} must have both url and title` });
      }
    }

    console.log(`Generating full preview with ${videos.length} videos...`);

    // Download all videos
    console.log("Step 1: Downloading all videos...");
    const urls = videos.map((v) => v.url);
    const downloadResults = await downloadMultipleVideos(urls);

    // Check if we have enough successful downloads
    if (downloadResults.successful.length === 0) {
      return res.status(400).json({
        error: "All video downloads failed",
        failedVideos: downloadResults.failed,
      });
    }

    if (downloadResults.successful.length < 3) {
      return res.status(400).json({
        error: "At least 3 videos are required for ranking",
        message: `Only ${downloadResults.successful.length} out of ${urls.length} videos downloaded successfully`,
        failedVideos: downloadResults.failed,
      });
    }

    // Log warnings for failed downloads
    if (downloadResults.failed.length > 0) {
      console.warn(
        `\n⚠️  Warning: ${downloadResults.failed.length} video(s) failed to download:`
      );
      downloadResults.failed.forEach((failure) => {
        console.warn(
          `  - Video ${failure.index + 1} (${failure.url}): ${failure.error}`
        );
      });
      console.warn(
        `Proceeding with ${downloadResults.successful.length} successful downloads\n`
      );
    }

    console.log(
      `Successfully downloaded ${downloadResults.successful.length} videos`
    );

    // Prepare ranking video inputs (maintaining original order with successful downloads only)
    const rankingInputs = downloadResults.successful.map((downloaded) => {
      // Find the original index of this video
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
        // Include crop values for FFmpeg
        cropX: originalVideo?.cropX,
        cropY: originalVideo?.cropY,
        cropWidth: originalVideo?.cropWidth,
        cropHeight: originalVideo?.cropHeight,
        // Pass meme sound URLs directly - FFmpeg service will download if needed
        memeSounds: originalVideo?.memeSounds?.map((s) => ({
          file: s.file, // Keep the URL as-is (Supabase or other)
          startTime: s.startTime,
          volume: s.volume,
        })),
      };
    });

    // Shuffle video order: randomize positions 2-N, keep rank 1 for last
    console.log("Shuffling video playback order (rank 1 plays last)...");

    // Separate rank 1 video from the rest
    const rank1Video = rankingInputs[0]!; // Rank 1 is at index 0 (guaranteed to exist)
    const otherVideos = rankingInputs.slice(1); // Ranks 2, 3, 4, etc.

    // Deterministic shuffle to match frontend "random" look
    // Using simple hash sort based on rank (equivalent to id in frontend)
    // Formula: ((rank * 13 + 7) % 5)
    let sortedOthers = [...otherVideos].sort((a, b) => {
      const valA = (a.rank * 13 + 7) % 5;
      const valB = (b.rank * 13 + 7) % 5;
      return valA - valB;
    });

    // If firstToPlay is specified (and valid), move that video to the front
    if (firstToPlay !== undefined && firstToPlay !== null && firstToPlay >= 1) {
      // firstToPlay is the 0-based index in the original videos array
      // rank = index + 1
      const targetRank = firstToPlay + 1;
      const selectedVideo = sortedOthers.find((v) => v.rank === targetRank);
      if (selectedVideo) {
        // Remove from list and prepend
        sortedOthers = sortedOthers.filter((v) => v.rank !== targetRank);
        sortedOthers.unshift(selectedVideo);
        console.log(`User selected rank #${targetRank} to play first`);
      }
    }

    // Reconstruct array: sorted videos + rank 1 at the end
    const shuffledInputs = [...sortedOthers, rank1Video];

    console.log(
      `Playback order: ${shuffledInputs.map((v) => `#${v.rank}`).join(" → ")}`
    );

    // Create preview video (same as final, but saved in previews folder)
    console.log("Step 2: Creating preview with FFmpeg overlays...");
    const outputFilename = `preview-full-${Date.now()}.mp4`;

    // Use the same createRankingVideo function
    const outputPath = await createRankingVideo(
      {
        mainTitle,
        videos: shuffledInputs, // Use shuffled order
        ...(width && { width }),
        ...(height && { height }),
      },
      outputFilename
    );

    // Note: Not cleaning up downloaded files - they are cached for reuse

    const response: any = {
      success: true,
      // Extract just outputs/filename from the absolute path
      videoUrl: `http://localhost:4000/outputs/${outputFilename}`,
      message: `Successfully created preview with ${downloadResults.successful.length} videos`,
    };

    if (downloadResults.failed.length > 0) {
      response.warnings = {
        message: `${downloadResults.failed.length} video(s) were skipped due to download errors`,
        failedVideos: downloadResults.failed,
      };
    }

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Full preview generation failed:", err);
    res.status(500).json({
      error: "Failed to generate preview",
      details: err.message,
    });
  }
}
