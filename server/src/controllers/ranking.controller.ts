import type { Request, Response } from "express";
import {
  downloadVideo,
  downloadMultipleVideos,
  type MultiDownloadResult,
  type DownloadError,
} from "../services/downloader.service.js";
import {
  createRankingVideo,
  generateRankingPreview,
  type TextSegment,
} from "../services/ffmpeg.service.js";

export interface VideoRankInput {
  url: string;
  title: TextSegment[]; // Changed to TextSegment[]
}

export interface CreateRankingRequest {
  mainTitle: TextSegment[]; // Changed to TextSegment[]
  videos: VideoRankInput[];
  width?: number;
  height?: number;
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
      const originalIndex = urls.findIndex(
        (url) => url === downloaded.originalUrl
      );
      return {
        filePath: downloaded.filePath,
        title: videos[originalIndex]?.title || [
          { text: `Video ${originalIndex + 1}`, color: "white", fontSize: 48 },
        ],
        rank: originalIndex + 1,
      };
    });

    // Shuffle video order: randomize positions 2-N, keep rank 1 for last
    console.log("Shuffling video playback order (rank 1 plays last)...");

    // Separate rank 1 video from the rest
    const rank1Video = rankingInputs[0]!; // Rank 1 is at index 0 (guaranteed to exist)
    const otherVideos = rankingInputs.slice(1); // Ranks 2, 3, 4, etc.

    // Shuffle the other videos (Fisher-Yates shuffle)
    for (let i = otherVideos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherVideos[i], otherVideos[j]] = [otherVideos[j]!, otherVideos[i]!];
    }

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
    const { mainTitle, videos, width, height } = req.body as {
      mainTitle: TextSegment[];
      videos: VideoRankInput[];
      width?: number;
      height?: number;
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
      const originalIndex = urls.findIndex(
        (url) => url === downloaded.originalUrl
      );
      return {
        filePath: downloaded.filePath,
        title: videos[originalIndex]?.title || [
          { text: `Video ${originalIndex + 1}`, color: "white", fontSize: 48 },
        ],
        rank: originalIndex + 1,
      };
    });

    // Shuffle video order: randomize positions 2-N, keep rank 1 for last
    console.log("Shuffling video playback order (rank 1 plays last)...");

    // Separate rank 1 video from the rest
    const rank1Video = rankingInputs[0]!; // Rank 1 is at index 0 (guaranteed to exist)
    const otherVideos = rankingInputs.slice(1); // Ranks 2, 3, 4, etc.

    // Shuffle the other videos (Fisher-Yates shuffle)
    for (let i = otherVideos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherVideos[i], otherVideos[j]] = [otherVideos[j]!, otherVideos[i]!];
    }

    // Reconstruct array: shuffled videos + rank 1 at the end
    const shuffledInputs = [...otherVideos, rank1Video];

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
      videoUrl: `http://localhost:4000/${outputPath.replace(/\\/g, "/")}`,
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
