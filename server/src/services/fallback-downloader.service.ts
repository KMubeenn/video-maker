import fs from "fs";
import https from "https";
import axios from "axios";
// @ts-ignore - Module has no type declarations
import TiktokDownloader from "@tobyg74/tiktok-api-dl";

/**
 * Fallback Video Downloader Service
 *
 * Provides alternative download methods when yt-dlp fails.
 * Uses @tobyg74/tiktok-api-dl npm package - NO API KEY REQUIRED
 */

// Create a persistent HTTPS agent to handle keep-alive connections
const httpsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false, // Allow self-signed certs from CDN
});

/**
 * Fallback is always available (no API key needed)
 */
export function isFallbackAvailable(): boolean {
  return true;
}

/**
 * Download file from URL to local path with browser-like headers
 */
async function downloadFile(
  url: string,
  outputPath: string,
  attempt = 1
): Promise<void> {
  const maxRetries = 3;

  console.log(`[Fallback] Downloading from URL: ${url.substring(0, 100)}...`);

  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 120000, // 2 minute timeout for large files
      httpsAgent: httpsAgent,
      maxRedirects: 10,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity", // Don't compress video streams
        Referer: "https://www.tiktok.com/",
        Origin: "https://www.tiktok.com",
        "sec-ch-ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "video",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        Range: "bytes=0-", // Request full file
      },
    });

    const writer = fs.createWriteStream(outputPath);

    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);

      writer.on("finish", () => {
        // Verify file was created and has content
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            console.log(`[Fallback] Downloaded ${stats.size} bytes`);
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
        // Clean up partial file
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(new Error(`Download stream error: ${error.message}`));
      });
    });
  } catch (error: unknown) {
    const err = error as Error;
    // Clean up partial file on error
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    if (attempt < maxRetries) {
      const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s
      console.log(
        `[Fallback] Download failed: ${err.message}. Retrying in ${
          waitTime / 1000
        }s (${attempt}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return downloadFile(url, outputPath, attempt + 1);
    }
    throw err;
  }
}

/**
 * Download file using native Node.js https module (backup method)
 */
async function downloadFileNative(
  url: string,
  outputPath: string
): Promise<void> {
  console.log(`[Fallback] Trying native https download...`);

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        Referer: "https://www.tiktok.com/",
      },
      rejectUnauthorized: false,
    };

    const request = https.request(options, (response) => {
      // Handle redirects
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        console.log(
          `[Fallback] Following redirect to: ${response.headers.location}`
        );
        downloadFileNative(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200 && response.statusCode !== 206) {
        reject(
          new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`)
        );
        return;
      }

      const writer = fs.createWriteStream(outputPath);
      response.pipe(writer);

      writer.on("finish", () => {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            console.log(
              `[Fallback] Native download succeeded: ${stats.size} bytes`
            );
            resolve();
          } else {
            reject(new Error("Downloaded file is empty"));
          }
        } else {
          reject(new Error("File not created"));
        }
      });

      writer.on("error", reject);
      response.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(120000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
    request.end();
  });
}

/**
 * Download TikTok video using @tobyg74/tiktok-api-dl
 * Tries multiple API versions for reliability
 */
async function downloadTikTokWithPackage(
  url: string,
  outputPath: string
): Promise<void> {
  console.log(`[Fallback] Using tiktok-api-dl for: ${url}`);

  // Try different API versions - v1, v2, v3
  const versions = ["v3", "v2", "v1"] as const;
  let lastError: Error | null = null;
  let videoUrl: string | undefined;

  for (const version of versions) {
    try {
      console.log(`[Fallback] Trying API version: ${version}`);
      const result = await TiktokDownloader.Downloader(url, { version });

      if (result.status !== "success") {
        console.log(`[Fallback] ${version} failed: ${result.message}`);
        continue;
      }

      // Get the video download URL (prefer HD, then SD, then watermark)
      if (result.result) {
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
          console.log(`[Fallback] Using HD video URL from ${version}`);
        } else if (data.videoSD) {
          videoUrl = data.videoSD;
          console.log(`[Fallback] Using SD video URL from ${version}`);
        } else if (data.videoWatermark) {
          videoUrl = data.videoWatermark;
          console.log(`[Fallback] Using watermarked video URL from ${version}`);
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

        if (videoUrl) break;
      }
    } catch (error) {
      lastError = error as Error;
      console.log(`[Fallback] ${version} error: ${lastError.message}`);
    }
  }

  if (!videoUrl) {
    throw new Error(
      lastError?.message || "No video URL found in any API version"
    );
  }

  console.log(`[Fallback] Got video URL, downloading...`);

  // Try axios download first, then native https as backup
  try {
    await downloadFile(videoUrl, outputPath);
  } catch (axiosError) {
    console.log(`[Fallback] Axios download failed, trying native https...`);
    try {
      await downloadFileNative(videoUrl, outputPath);
    } catch (nativeError) {
      const err = nativeError as Error;
      throw new Error(
        `All download methods failed. Last error: ${err.message}`
      );
    }
  }

  console.log(`[Fallback] Successfully downloaded to: ${outputPath}`);
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
