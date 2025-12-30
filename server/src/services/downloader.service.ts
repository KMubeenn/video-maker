import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import ytdl from "@distube/ytdl-core";
import { videoCache } from "./cache.service.js";
import {
  downloadWithFallback,
  isFallbackAvailable,
  isFallbackSupported,
} from "./fallback-downloader.service.js";

const execPromise = promisify(exec);

export interface DownloadResult {
  filePath: string;
  platform: string;
  originalUrl: string;
  index: number;
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
  if (url.includes("localhost") || url.includes("127.0.0.1")) return "local";
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
 * Resolve the path to the cookies file for a specific platform.
 * Priority:
 * 1. server/cookies-{platform}.txt
 * 2. root/cookies-{platform}.txt
 * 3. server/cookies.txt
 * 4. root/cookies.txt
 */
function resolveCookiePath(platform: string): string | null {
  const fileNames = [`cookies-${platform}.txt`, "cookies.txt"];
  const searchDirs = [process.cwd(), path.join(process.cwd(), "..")];

  for (const fileName of fileNames) {
    for (const dir of searchDirs) {
      const filePath = path.join(dir, fileName);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
  }

  return null;
}

/**
 * Download video using yt-dlp (for TikTok and Instagram)
 * Note: Requires yt-dlp to be installed on the system
 * Falls back to RapidAPI if yt-dlp fails and fallback is available
 */
async function downloadWithYtDlp(
  url: string,
  outputPath: string
): Promise<void> {
  const platform = detectPlatform(url);
  let ytDlpError: Error | null = null;

  try {
    // Check if yt-dlp is installed
    try {
      await execPromise("yt-dlp --version");
    } catch {
      throw new Error(
        "yt-dlp is not installed. Please install it: https://github.com/yt-dlp/yt-dlp#installation"
      );
    }

    const cookiePath = resolveCookiePath(platform);

    // Build command arguments
    const args: string[] = [];

    // Add cookies if available
    if (cookiePath) {
      console.log(`Using cookies from: ${cookiePath}`);
      args.push(`--cookies "${cookiePath}"`);
    } else {
      console.warn(
        `No cookies found for ${platform}. Downloads might fail. (Checked cookies-${platform}.txt and cookies.txt)`
      );
    }

    // Add impersonation for TikTok to bypass bot detection
    // Requires curl_cffi: pip install curl_cffi
    if (platform === "tiktok") {
      args.push("--impersonate chrome");
      // Use extractor args to try mobile API which is sometimes more reliable
      args.push(
        '--extractor-args "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com"'
      );
    }

    // Add impersonation for Instagram as well
    if (platform === "instagram") {
      args.push("--impersonate chrome");
    }

    // Common arguments
    args.push('--format "best[ext=mp4]/best"');
    args.push(`--output "${outputPath}"`);
    args.push("--no-playlist");
    args.push("--no-check-certificate"); // Sometimes helps with SSL issues
    args.push(`"${url}"`);

    const command = `yt-dlp ${args.join(" ")}`;

    console.log(`Executing: ${command}`);
    await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Download completed but file was not created");
    }

    // Success - return early
    return;
  } catch (error: unknown) {
    ytDlpError = error as Error;
    console.error(`yt-dlp failed: ${ytDlpError.message}`);
  }

  // yt-dlp failed - try fallback if available
  if (
    isFallbackAvailable() &&
    isFallbackSupported(url) &&
    (platform === "tiktok" || platform === "instagram")
  ) {
    console.log(`Attempting fallback download for ${platform}...`);
    try {
      await downloadWithFallback(url, outputPath, platform);
      console.log(`Fallback download successful for: ${url}`);
      return;
    } catch (fallbackError: unknown) {
      const fbErr = fallbackError as Error;
      console.error(`Fallback also failed: ${fbErr.message}`);
      // Throw combined error showing both failures
      throw new Error(
        `yt-dlp failed: ${ytDlpError?.message}. Fallback also failed: ${fbErr.message}`
      );
    }
  }

  // Fallback not supported for this platform
  if (!isFallbackSupported(url)) {
    console.warn(
      `No fallback available for this platform. Only TikTok is currently supported.`
    );
  }

  throw new Error(`yt-dlp download failed: ${ytDlpError?.message}`);
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
    } else if (platform === "local") {
      // Handle local file
      // URL format: http://localhost:4000/uploads/filename.mp4
      const parts = url.split("uploads/");
      if (parts.length < 2) throw new Error("Invalid local URL format");

      const filename = parts[1] || "";
      // Sanitize filename to prevent directory traversal
      const safeFilename = path.basename(filename);
      const sourcePath = path.join(process.cwd(), "uploads", safeFilename);

      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Local file not found: ${sourcePath}`);
      }

      // Copy file to the expected output path (so it follows the specific naming convention of the pipeline)
      // Or we could just symlink, but copying is safer for cleanup logic
      fs.copyFileSync(sourcePath, outputPath);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Successfully downloaded: ${outputPath}`);

    return {
      filePath: outputPath,
      platform,
      originalUrl: url,
      index,
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
          index: i,
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
