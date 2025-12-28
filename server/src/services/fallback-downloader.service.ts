import fs from "fs";
import axios from "axios";
// @ts-ignore - Module has no type declarations
import TiktokDownloader from "@tobyg74/tiktok-api-dl";

/**
 * Fallback Video Downloader Service
 *
 * Provides alternative download methods when yt-dlp fails.
 * Uses @tobyg74/tiktok-api-dl npm package - NO API KEY REQUIRED
 */

/**
 * Fallback is always available (no API key needed)
 */
export function isFallbackAvailable(): boolean {
  return true;
}

/**
 * Download file from URL to local path
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
    timeout: 120000, // 2 minute timeout for large files
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const writer = fs.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);

    writer.on("finish", () => {
      // Verify file was created and has content
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 0) {
          resolve();
        } else {
          reject(new Error("Downloaded file is empty"));
        }
      } else {
        reject(new Error("File was not created after download"));
      }
    });

    writer.on("error", (error) => {
      // Clean up partial file
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(new Error(`File write error: ${error.message}`));
    });

    response.data.on("error", (error: Error) => {
      reject(new Error(`Download stream error: ${error.message}`));
    });
  });
}

/**
 * Download TikTok video using @tobyg74/tiktok-api-dl
 */
async function downloadTikTokWithPackage(
  url: string,
  outputPath: string
): Promise<void> {
  console.log(`[Fallback] Using tiktok-api-dl for: ${url}`);

  try {
    const result = await TiktokDownloader.Downloader(url, {
      version: "v3", // Use v3 API (most reliable)
    });

    if (result.status !== "success") {
      throw new Error(`TiktokDL failed: ${result.message || "Unknown error"}`);
    }

    // Get the video download URL (prefer HD, then SD, then watermark)
    let videoUrl: string | undefined;

    if (result.result) {
      // Actual response structure from tiktok-api-dl
      const data = result.result as {
        type?: string;
        videoSD?: string;
        videoHD?: string;
        videoWatermark?: string;
        video?: string | string[];
        video_hd?: string;
        video_sd?: string;
        play?: string;
      };

      // Try HD first (best quality), then SD, then watermark as last resort
      if (data.videoHD) {
        videoUrl = data.videoHD;
        console.log(`[Fallback] Using HD video URL`);
      } else if (data.videoSD) {
        videoUrl = data.videoSD;
        console.log(`[Fallback] Using SD video URL`);
      } else if (data.videoWatermark) {
        videoUrl = data.videoWatermark;
        console.log(`[Fallback] Using watermarked video URL`);
      } else if (typeof data.video === "string") {
        videoUrl = data.video;
      } else if (Array.isArray(data.video) && data.video.length > 0) {
        videoUrl = data.video[0];
      } else if (data.video_hd) {
        videoUrl = data.video_hd;
      } else if (data.video_sd) {
        videoUrl = data.video_sd;
      } else if (data.play) {
        videoUrl = data.play;
      }
    }

    if (!videoUrl) {
      console.error(
        "[Fallback] Response data:",
        JSON.stringify(result, null, 2)
      );
      throw new Error("No video URL found in TiktokDL response");
    }

    console.log(`[Fallback] Got video URL, downloading...`);
    await downloadFile(videoUrl, outputPath);
    console.log(`[Fallback] Successfully downloaded to: ${outputPath}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Fallback] TiktokDL error:`, err.message);
    throw new Error(`TiktokDL download failed: ${err.message}`);
  }
}

/**
 * Download video using fallback method
 *
 * @param url - The video URL (TikTok or Instagram)
 * @param outputPath - Path to save the downloaded video
 * @param platform - The platform type ('tiktok' or 'instagram')
 */
export async function downloadWithFallback(
  url: string,
  outputPath: string,
  platform: "tiktok" | "instagram"
): Promise<void> {
  console.log(
    `[Fallback] Attempting fallback download for ${platform}: ${url}`
  );

  if (platform === "tiktok") {
    await downloadTikTokWithPackage(url, outputPath);
  } else if (platform === "instagram") {
    // Instagram fallback not implemented yet
    // Could add a similar package for Instagram in the future
    throw new Error(
      `Fallback not yet implemented for Instagram. yt-dlp is required.`
    );
  } else {
    throw new Error(`Fallback not supported for platform: ${platform}`);
  }
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): "tiktok" | "instagram" | "unknown" {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  return "unknown";
}

/**
 * Check if URL is supported by the fallback service
 */
export function isFallbackSupported(url: string): boolean {
  const platform = detectPlatform(url);
  // Currently only TikTok is supported by the fallback
  return platform === "tiktok";
}
