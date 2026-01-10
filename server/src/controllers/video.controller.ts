import type { Request, Response } from "express";
import { downloadVideo } from "../services/downloader.service.js";

export async function resolveVideoUrl(req: Request, res: Response) {
  const { url, index } = req.body;

  console.log("[RESOLVE] Incoming URL request:", url, "index:", index);

  if (!url) {
    return res.status(400).json({ error: "No URL provided" });
  }

  try {
    const result = await downloadVideo(url, index || 0);
    // Convert local file path to accessible URL
    // Assuming uploads are served statically from /uploads
    // Result.filePath is absolute or relative to root?
    // downloader.service says: path.join("uploads", ...)
    // So if we serve "uploads" directory, we can use the basename.
    const filename = result.filePath.split(/[\\/]/).pop();
    const resolvedUrl = `http://localhost:4000/uploads/${filename}`;

    res.json({
      success: true,
      data: {
        originalUrl: url,
        resolvedUrl,
        platform: result.platform,
      },
    });
  } catch (err) {
    console.error("Video resolution failed:", err);
    res
      .status(500)
      .json({ error: (err as Error).message || "Failed to resolve video" });
  }
}

export async function createVideo(req: Request, res: Response) {
  // Keeping this stub or removing if unused, but user might need it later?
  // Leaving it empty or basic error for now as it was commented out.
  res.status(501).json({ error: "Not implemented" });
}
