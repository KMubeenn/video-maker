import type { Request, Response } from "express";
import {
  downloadMultipleVideos,
  cleanupFiles,
} from "../services/downloader.service.js";
import { createRankingVideo } from "../services/ffmpeg.service.js";

export interface VideoRankInput {
  url: string;
  title: string;
}

export interface CreateRankingRequest {
  mainTitle: string;
  videos: VideoRankInput[];
  width?: number;
  height?: number;
}

export async function createRanking(req: Request, res: Response) {
  try {
    const { mainTitle, videos, width, height } =
      req.body as CreateRankingRequest;

    // Validate input
    if (!mainTitle || !mainTitle.trim()) {
      return res.status(400).json({ error: "Main title is required" });
    }

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    if (videos.length < 2 || videos.length > 4) {
      return res
        .status(400)
        .json({ error: "Please provide between 2 and 4 videos" });
    }

    // Validate each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video || !video.url || !video.title) {
        return res
          .status(400)
          .json({ error: `Video ${i + 1} must have both url and title` });
      }
    }

    console.log(`Creating ranking video with ${videos.length} videos...`);

    // Download all videos
    console.log("Step 1: Downloading videos...");
    const urls = videos.map((v) => v.url);
    const downloadedVideos = await downloadMultipleVideos(urls);
    console.log(`Successfully downloaded ${downloadedVideos.length} videos`);

    // Prepare ranking video inputs
    const rankingInputs = downloadedVideos.map((downloaded, index) => ({
      filePath: downloaded.filePath,
      title: videos[index]?.title || `Video ${index + 1}`,
      rank: index + 1,
    }));

    // Create ranking video
    console.log("Step 2: Creating ranking video with overlays...");
    const outputFilename = `ranking-${Date.now()}.mp4`;
    const outputPath = await createRankingVideo(
      {
        mainTitle,
        videos: rankingInputs,
        ...(width && { width }),
        ...(height && { height }),
      },
      outputFilename
    );

    // Clean up downloaded files
    console.log("Step 3: Cleaning up temporary files...");
    cleanupFiles(downloadedVideos.map((v) => v.filePath));

    // Return success response
    res.json({
      success: true,
      videoUrl: `http://localhost:4000/${outputPath.replace(/\\/g, "/")}`,
      message: `Successfully created ranking video with ${videos.length} videos`,
      rankings: videos.map((v, i) => ({
        rank: i + 1,
        title: v.title,
        url: v.url,
      })),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Ranking video creation failed:", err);
    res.status(500).json({
      error: "Failed to create ranking video",
      details: err.message,
    });
  }
}
