/**
 * Emoji Asset Cache Service
 *
 * Downloads and caches Twemoji PNG images for FFmpeg overlay usage.
 * Ensures deterministic emoji rendering across all platforms.
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

/**
 * Configuration for emoji cache
 */
interface EmojiCacheConfig {
  cacheDir: string;
  twemojiSize: 72 | 36;
  twemojiBaseUrl: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EmojiCacheConfig = {
  cacheDir: path.resolve("assets", "emojis"),
  twemojiSize: 72,
  twemojiBaseUrl: "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets",
};

/**
 * In-memory cache of available emoji paths
 */
const pathCache: Map<string, string> = new Map();

/**
 * Pending download promises to prevent duplicate requests
 */
const pendingDownloads: Map<string, Promise<string>> = new Map();

/**
 * Initialize the emoji cache directory.
 * Call this at server startup.
 */
export function initEmojiCache(config?: Partial<EmojiCacheConfig>): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!fs.existsSync(cfg.cacheDir)) {
    fs.mkdirSync(cfg.cacheDir, { recursive: true });
    console.log(`[EmojiCache] Created cache directory: ${cfg.cacheDir}`);
  }

  // Pre-populate pathCache with existing files
  try {
    const files = fs.readdirSync(cfg.cacheDir);
    for (const file of files) {
      if (file.endsWith(".png")) {
        const codepoint = path.basename(file, ".png");
        pathCache.set(codepoint, path.join(cfg.cacheDir, file));
      }
    }
    console.log(`[EmojiCache] Loaded ${pathCache.size} cached emojis`);
  } catch (err) {
    console.warn("[EmojiCache] Could not read cache directory:", err);
  }
}

/**
 * Get the local file path for an emoji, downloading if necessary.
 *
 * @param codepoint - Twemoji codepoint format (e.g., "1f600", "1f1fa-1f1f8")
 * @param config - Optional config overrides
 * @returns Promise resolving to absolute path of PNG file
 */
export async function getEmojiPath(
  codepoint: string,
  config?: Partial<EmojiCacheConfig>
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const normalizedCodepoint = codepoint.toLowerCase();

  // Check memory cache first
  const cachedPath = pathCache.get(normalizedCodepoint);
  if (cachedPath && fs.existsSync(cachedPath)) {
    return cachedPath;
  }

  // Check if download is already in progress
  const pending = pendingDownloads.get(normalizedCodepoint);
  if (pending) {
    return pending;
  }

  // Check filesystem
  const localPath = path.join(cfg.cacheDir, `${normalizedCodepoint}.png`);
  if (fs.existsSync(localPath)) {
    pathCache.set(normalizedCodepoint, localPath);
    return localPath;
  }

  // Download from Twemoji CDN
  const downloadPromise = downloadEmoji(normalizedCodepoint, localPath, cfg);
  pendingDownloads.set(normalizedCodepoint, downloadPromise);

  try {
    const result = await downloadPromise;
    pathCache.set(normalizedCodepoint, result);
    return result;
  } finally {
    pendingDownloads.delete(normalizedCodepoint);
  }
}

/**
 * Get emoji paths for multiple emojis in batch.
 * More efficient than calling getEmojiPath individually.
 */
export async function getEmojiPaths(
  codepoints: string[],
  config?: Partial<EmojiCacheConfig>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  await Promise.all(
    codepoints.map(async (codepoint) => {
      try {
        const path = await getEmojiPath(codepoint, config);
        results.set(codepoint, path);
      } catch (err) {
        console.warn(`[EmojiCache] Failed to get emoji ${codepoint}:`, err);
      }
    })
  );

  return results;
}

/**
 * Download an emoji PNG from Twemoji CDN.
 */
async function downloadEmoji(
  codepoint: string,
  localPath: string,
  config: EmojiCacheConfig
): Promise<string> {
  const url = `${config.twemojiBaseUrl}/${config.twemojiSize}x${config.twemojiSize}/${codepoint}.png`;

  console.log(`[EmojiCache] Downloading: ${url}`);

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    // Ensure directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(localPath);

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(localPath);
          downloadEmoji(codepoint, localPath, {
            ...config,
            twemojiBaseUrl:
              new URL(redirectUrl).origin +
              path.dirname(new URL(redirectUrl).pathname),
          })
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(localPath, () => {});
        reject(new Error(`HTTP ${response.statusCode} for emoji ${codepoint}`));
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        console.log(`[EmojiCache] Downloaded: ${codepoint}`);
        resolve(localPath);
      });
    });

    request.on("error", (err) => {
      file.close();
      fs.unlink(localPath, () => {});
      reject(err);
    });

    file.on("error", (err) => {
      file.close();
      fs.unlink(localPath, () => {});
      reject(err);
    });
  });
}

/**
 * Convert emoji character to Twemoji codepoint format.
 * Removes variation selectors for cleaner filenames.
 */
export function emojiToCodepoint(emoji: string): string {
  const codepoints: string[] = [];

  for (const char of emoji) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined && codepoint !== 0xfe0f) {
      codepoints.push(codepoint.toString(16).toLowerCase());
    }
  }

  return codepoints.join("-");
}

/**
 * Preload common emojis to reduce latency during video generation.
 * Call this at server startup after initEmojiCache.
 */
export async function preloadCommonEmojis(): Promise<void> {
  const commonEmojis = [
    "1f44d",
    "1f44e",
    "2764",
    "1f525",
    "1f4af",
    "1f389",
    "1f38a",
    "1f600",
    "1f602",
    "1f605",
    "1f609",
    "1f60d",
    "1f618",
    "1f60e",
    "1f622",
    "1f62d",
    "1f633",
    "1f914",
    "1f92f",
    "1f4a1",
    "1f3c6",
    "1f451",
    "1f31f",
    "2b50",
    "1f4a5",
    "1f4aa",
    "1f64f",
    "1f44b",
  ];

  console.log(
    `[EmojiCache] Preloading ${commonEmojis.length} common emojis...`
  );

  await getEmojiPaths(commonEmojis);

  console.log("[EmojiCache] Preload complete");
}

/**
 * Clear the emoji cache.
 * Used for testing or maintenance.
 */
export function clearEmojiCache(config?: Partial<EmojiCacheConfig>): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  pathCache.clear();

  if (fs.existsSync(cfg.cacheDir)) {
    const files = fs.readdirSync(cfg.cacheDir);
    for (const file of files) {
      if (file.endsWith(".png")) {
        fs.unlinkSync(path.join(cfg.cacheDir, file));
      }
    }
    console.log(`[EmojiCache] Cache cleared`);
  }
}

/**
 * Get cache statistics.
 */
export function getEmojiCacheStats(): { cached: number; cacheDir: string } {
  return {
    cached: pathCache.size,
    cacheDir: DEFAULT_CONFIG.cacheDir,
  };
}
