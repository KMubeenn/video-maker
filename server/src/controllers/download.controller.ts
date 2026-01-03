import type { Request, Response } from "express";
import { downloadVideo } from "../services/downloader.service.js";
import path from "path";

/**
 * Download a single video and return its local path
 * For Remotion preview usage
 */
export async function downloadSingleVideo(req: Request, res: Response) {
  try {
    const { url } = req.body as { url: string };

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({ error: "Valid URL is required" });
    }

    console.log(`Downloading video for preview: ${url}`);

    // Download the video
    const result = await downloadVideo(url, 0);

    // Convert absolute path to served URL
    const parts = result.filePath.split("uploads");
    const relativePath =
      parts.length > 1 ? parts[1] : `/${path.basename(result.filePath)}`;
    const servedUrl = `http://localhost:4000/uploads${(
      relativePath || ""
    ).replace(/\\/g, "/")}`;

    res.json({
      success: true,
      localPath: servedUrl,
      platform: result.platform,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Download failed:", err.message);
    res.status(500).json({
      success: false,
      error: err.message || "Download failed",
    });
  }
}
