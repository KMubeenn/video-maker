import type { Request, Response } from "express";
import {
  downloadMultipleVideos,
  cleanupFiles,
} from "../services/downloader.service.js";
import { concatenateVideos } from "../services/ffmpeg.service.js";

export interface MergeVideosRequest {
  urls: string[];
}

export async function mergeVideosFromUrls(req: Request, res: Response) {
  try {
    const { urls } = req.body as MergeVideosRequest;

    // Validate input
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: "URLs must be an array" });
    }

    if (urls.length < 2 || urls.length > 4) {
      return res
        .status(400)
        .json({ error: "Please provide between 2 and 4 video URLs" });
    }

    // Validate URL format
    for (const url of urls) {
      if (typeof url !== "string" || !url.trim()) {
        return res.status(400).json({ error: "Invalid URL provided" });
      }
    }

    console.log(`Starting to process ${urls.length} videos...`);

    // Download all videos
    console.log("Step 1: Downloading videos...");
    const downloadedVideos = await downloadMultipleVideos(urls);
    console.log(
      `Successfully downloaded ${downloadedVideos.length} videos:`,
      downloadedVideos.map((v) => v.platform)
    );

    const videoPaths = downloadedVideos.map((v) => v.filePath);

    // Merge videos
    console.log("Step 2: Merging videos...");
    const outputFilename = `merged-${Date.now()}.mp4`;
    const outputPath = await concatenateVideos(videoPaths, outputFilename);

    // Clean up downloaded files
    console.log("Step 3: Cleaning up temporary files...");
    cleanupFiles(videoPaths);

    // Return success response
    res.json({
      success: true,
      videoUrl: `http://localhost:4000/${outputPath.replace(/\\/g, "/")}`,
      message: `Successfully merged ${urls.length} videos`,
      sources: downloadedVideos.map((v) => ({
        platform: v.platform,
        url: v.originalUrl,
      })),
    });
  } catch (error: any) {
    console.error("Video merging failed:", error);
    res.status(500).json({
      error: "Failed to merge videos",
      details: error.message,
    });
  }
}
