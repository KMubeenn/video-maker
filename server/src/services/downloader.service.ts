import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import ytdl from "@distube/ytdl-core";

const execPromise = promisify(exec);

export interface DownloadResult {
  filePath: string;
  platform: string;
  originalUrl: string;
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
 * Download multiple videos sequentially
 */
export async function downloadMultipleVideos(
  urls: string[]
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) {
      throw new Error(`URL at index ${i} is undefined or empty`);
    }

    try {
      const result = await downloadVideo(url, i);
      results.push(result);
    } catch (error: unknown) {
      // If one download fails, clean up already downloaded files
      cleanupFiles(results.map((r) => r.filePath));
      const err = error as Error;
      throw new Error(
        `Failed to download video ${i + 1}/${urls.length}: ${err.message}`
      );
    }
  }

  return results;
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
