import crypto from "crypto";
import fs from "fs";
import path from "path";

interface CacheEntry {
  url: string;
  filePath: string;
  timestamp: number;
}

class VideoCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDir: string = path.join("uploads", "cache");
  private maxAge: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate a unique cache key from a URL
   */
  private getCacheKey(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex");
  }

  /**
   * Check if a video is cached and still valid
   */
  has(url: string): boolean {
    const key = this.getCacheKey(url);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if cache entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > this.maxAge) {
      this.delete(url);
      return false;
    }

    // Check if file still exists
    if (!fs.existsSync(entry.filePath)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cached video file path
   */
  get(url: string): string | null {
    if (!this.has(url)) {
      return null;
    }

    const key = this.getCacheKey(url);
    const entry = this.cache.get(key);
    return entry ? entry.filePath : null;
  }

  /**
   * Add a video to cache
   */
  set(url: string, filePath: string): void {
    const key = this.getCacheKey(url);

    // Move file to cache directory if not already there
    const cacheFileName = `${key}.mp4`;
    const cachePath = path.join(this.cacheDir, cacheFileName);

    // If file is not in cache directory, copy it
    if (filePath !== cachePath) {
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, cachePath);
      }
    }

    this.cache.set(key, {
      url,
      filePath: cachePath,
      timestamp: Date.now(),
    });

    console.log(`Cached video: ${url} -> ${cachePath}`);
  }

  /**
   * Delete a cached video
   */
  delete(url: string): void {
    const key = this.getCacheKey(url);
    const entry = this.cache.get(key);

    if (entry) {
      try {
        if (fs.existsSync(entry.filePath)) {
          fs.unlinkSync(entry.filePath);
        }
      } catch (error) {
        console.error(`Failed to delete cached file: ${entry.filePath}`, error);
      }
      this.cache.delete(key);
    }
  }

  /**
   * Clear all cached videos
   */
  clear(): void {
    for (const [key, entry] of this.cache.entries()) {
      try {
        if (fs.existsSync(entry.filePath)) {
          fs.unlinkSync(entry.filePath);
        }
      } catch (error) {
        console.error(`Failed to delete cached file: ${entry.filePath}`, error);
      }
    }
    this.cache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.maxAge) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => {
      const entry = this.cache.get(key);
      if (entry) {
        this.delete(entry.url);
      }
    });

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; urls: string[] } {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.values()).map((entry) => entry.url),
    };
  }
}

// Singleton instance
export const videoCache = new VideoCache();

// Run cleanup every hour
setInterval(() => {
  videoCache.cleanupExpired();
}, 60 * 60 * 1000);
