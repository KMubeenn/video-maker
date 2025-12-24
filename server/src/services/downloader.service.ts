import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import ytdl from "@distube/ytdl-core";
import { videoCache } from "./cache.service.js";

const execPromise = promisify(exec);

export interface DownloadResult {
  filePath: string;
  platform: string;
  originalUrl: string;
}

export interface DownloadError {
  url: string;
  index: number;
  error: string;
  platform: string;
}

export interface MultiDownloadResult {
  successful: DownloadResult[];
  failed: DownloadError[];
}

/**
 * Detect the platform from URL
 */
function detectPlatform(url: string): string {
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "unknown";
}

/**
 * Download YouTube video using ytdl-core
 */
async function downloadYouTube(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const video = ytdl(url, {
        quality: "highest",
        filter: (format) => format.container === "mp4",
      });

      const writeStream = fs.createWriteStream(outputPath);

      video.pipe(writeStream);

      video.on("error", (error) => {
        reject(new Error(`YouTube download failed: ${error.message}`));
      });

      writeStream.on("finish", () => {
        resolve();
      });

      writeStream.on("error", (error) => {
        reject(new Error(`File write failed: ${error.message}`));
      });
    } catch (error: unknown) {
      const err = error as Error;
      reject(new Error(`YouTube download error: ${err.message}`));
    }
  });
}

/**
 * Download video using yt-dlp (for TikTok and Instagram)
 * Note: Requires yt-dlp to be installed on the system
 */
async function downloadWithYtDlp(
  url: string,
  outputPath: string
): Promise<void> {
  try {
    // Check if yt-dlp is installed
    try {
      await execPromise("yt-dlp --version");
    } catch {
      throw new Error(
        "yt-dlp is not installed. Please install it: https://github.com/yt-dlp/yt-dlp#installation"
      );
    }

    const command = `yt-dlp --format "best[ext=mp4]/best" --output "${outputPath}" --no-playlist "${url}"`;

    console.log(`Executing: ${command}`);
    await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Download completed but file was not created");
    }
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`yt-dlp download failed: ${err.message}`);
  }
}

/**
 * Download a single video from any supported platform
 */
export async function downloadVideo(
  url: string,
  index: number
): Promise<DownloadResult> {
  const uploadsDir = path.join("uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const platform = detectPlatform(url);
  const outputPath = path.join(
    uploadsDir,
    `video-${timestamp}-${index}-${platform}.mp4`
  );

  console.log(`Starting download from ${platform}: ${url}`);

  try {
    if (platform === "youtube") {
      await downloadYouTube(url, outputPath);
    } else if (platform === "tiktok" || platform === "instagram") {
      await downloadWithYtDlp(url, outputPath);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Successfully downloaded: ${outputPath}`);

    return {
      filePath: outputPath,
      platform,
      originalUrl: url,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`Download error for ${url}:`, err.message);
    throw error;
  }
}

/**
 * Download multiple videos sequentially, using cache when available
 * Now handles partial failures - returns both successful and failed downloads
 */
export async function downloadMultipleVideos(
  urls: string[]
): Promise<MultiDownloadResult> {
  const successful: DownloadResult[] = [];
  const failed: DownloadError[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) {
      failed.push({
        url: url || "undefined",
        index: i,
        error: "URL is undefined or empty",
        platform: "unknown",
      });
      continue;
    }

    const platform = detectPlatform(url);

    try {
      // Check if video is cached
      const cachedPath = videoCache.get(url);
      if (cachedPath) {
        console.log(`Using cached video for: ${url}`);
        successful.push({
          filePath: cachedPath,
          platform,
          originalUrl: url,
        });
        continue;
      }

      // Not cached, download it
      console.log(`Cache miss, downloading: ${url}`);
      const result = await downloadVideo(url, i);

      // Cache the downloaded video
      videoCache.set(url, result.filePath);

      // Update result to use cached path
      const cachedPath2 = videoCache.get(url);
      if (cachedPath2) {
        successful.push({
          ...result,
          filePath: cachedPath2,
        });
      } else {
        successful.push(result);
      }
    } catch (error: unknown) {
      const err = error as Error;

      // Extract more meaningful error message
      let errorMessage = err.message;

      // Check for specific Instagram errors
      if (
        errorMessage.includes("inappropriate") ||
        errorMessage.includes("unavailable for certain audiences")
      ) {
        errorMessage =
          "Content is age-restricted or unavailable for certain audiences";
      } else if (errorMessage.includes("private")) {
        errorMessage = "Content is private and requires authentication";
      } else if (errorMessage.includes("not available")) {
        errorMessage = "Video not available or has been removed";
      }

      console.error(
        `Failed to download video ${i + 1}/${urls.length} (${url}):`,
        errorMessage
      );

      failed.push({
        url,
        index: i,
        error: errorMessage,
        platform,
      });
    }
  }

  return { successful, failed };
}

/**
 * Cleanup downloaded files
 */
export function cleanupFiles(filePaths: string[]): void {
  filePaths.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup ${filePath}:`, error);
    }
  });
}
