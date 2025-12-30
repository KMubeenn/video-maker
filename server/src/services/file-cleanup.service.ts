/**
 * File Cleanup Service
 *
 * A bulletproof cleanup system that automatically deletes expired files
 * from configured directories. Designed to survive app restarts, handle
 * locked files gracefully, and never affect concurrent video processing.
 *
 * Features:
 * - Startup scan: Immediately cleans expired files on server start
 * - Periodic rescan: Scheduled cleanup based on configured interval
 * - Safe deletion: Handles locked files, missing folders, permission errors
 * - Path validation: Never deletes files outside configured directories
 * - Detailed logging: Full audit trail of all cleanup actions
 */

import fs from "fs";
import path from "path";
import {
  cleanupConfig,
  validateCleanupConfig,
} from "../config/cleanup.config.js";
import type { CleanupFolderConfig } from "../config/cleanup.config.js";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface CleanupStats {
  scannedFiles: number;
  deletedFiles: number;
  deletedBytes: number;
  skippedFiles: number;
  errors: number;
}

interface FileInfo {
  path: string;
  size: number;
  mtime: Date;
  ageHours: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const LOG_PREFIX = "[Cleanup]";
const HOURS_MS = 60 * 60 * 1000;

// ──────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format hours to human-readable string
 */
function formatAge(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
}

/**
 * Get current timestamp for logging
 */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Log a cleanup message
 */
function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

/**
 * Log a warning
 */
function warn(message: string): void {
  console.warn(`${LOG_PREFIX} ⚠️  ${message}`);
}

/**
 * Log an error
 */
function logError(message: string): void {
  console.error(`${LOG_PREFIX} ❌ ${message}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Core Cleanup Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ensure a directory exists, creating it if necessary
 */
function ensureDirectoryExists(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log(`Created missing directory: ${dirPath}`);
    }
    return true;
  } catch (error) {
    logError(`Failed to create directory ${dirPath}: ${error}`);
    return false;
  }
}

/**
 * Get file stats safely, returns null if file cannot be accessed
 */
function getFileInfo(filePath: string): FileInfo | null {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return null;
    }
    const now = Date.now();
    const mtime = stats.mtime.getTime();
    const ageHours = (now - mtime) / HOURS_MS;

    return {
      path: filePath,
      size: stats.size,
      mtime: stats.mtime,
      ageHours,
    };
  } catch {
    // File might be deleted or inaccessible
    return null;
  }
}

/**
 * Check if a file should be cleaned based on extension filter
 */
function shouldCleanFile(filePath: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) {
    return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  return extensions.includes(ext);
}

/**
 * Safely delete a file, handling errors gracefully
 */
function safeDelete(
  filePath: string,
  dryRun: boolean
): { success: boolean; error?: string } {
  try {
    if (dryRun) {
      return { success: true };
    }
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error: any) {
    const code = error?.code || "UNKNOWN";
    const message = error?.message || String(error);

    // Common error codes:
    // EBUSY - file is being used by another process
    // EPERM - permission denied
    // ENOENT - file doesn't exist (already deleted)
    // EACCES - access denied

    if (code === "ENOENT") {
      // File already deleted, consider it success
      return { success: true };
    }

    return { success: false, error: `${code}: ${message}` };
  }
}

/**
 * Recursively collect all files in a directory
 */
function collectFiles(dirPath: string, recursive: boolean): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory() && recursive) {
        // Recursively collect files from subdirectories
        files.push(...collectFiles(fullPath, recursive));
      }
    }
  } catch (error: any) {
    // Directory might not exist or be inaccessible
    if (error?.code !== "ENOENT") {
      warn(`Cannot read directory ${dirPath}: ${error?.message || error}`);
    }
  }

  return files;
}

/**
 * Clean expired files from a single folder
 */
function cleanFolder(
  folderConfig: CleanupFolderConfig,
  dryRun: boolean
): CleanupStats {
  const stats: CleanupStats = {
    scannedFiles: 0,
    deletedFiles: 0,
    deletedBytes: 0,
    skippedFiles: 0,
    errors: 0,
  };

  const {
    name,
    path: folderPath,
    ttlHours,
    recursive,
    extensions,
  } = folderConfig;

  // Resolve to absolute path
  const absolutePath = path.resolve(folderPath);

  log(`Scanning ${name} (TTL: ${ttlHours}h, path: ${absolutePath})`);

  // Ensure directory exists
  if (!ensureDirectoryExists(absolutePath)) {
    return stats;
  }

  // Collect all files
  const files = collectFiles(absolutePath, recursive);
  stats.scannedFiles = files.length;

  if (files.length === 0) {
    log(`No files found in ${name}`);
    return stats;
  }

  // Process each file
  for (const filePath of files) {
    // Skip files that don't match extension filter
    if (!shouldCleanFile(filePath, extensions)) {
      continue;
    }

    // Get file info
    const fileInfo = getFileInfo(filePath);
    if (!fileInfo) {
      continue;
    }

    // Check if file is expired
    if (fileInfo.ageHours < ttlHours) {
      continue;
    }

    // Validate path is within the target folder (security check)
    const relativePath = path.relative(absolutePath, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      warn(`Skipping file outside target directory: ${filePath}`);
      stats.skippedFiles++;
      continue;
    }

    // Attempt deletion
    const fileName = path.basename(filePath);
    const result = safeDelete(filePath, dryRun);

    if (result.success) {
      const action = dryRun ? "Would delete" : "Deleted";
      log(
        `${action}: ${fileName} (${formatBytes(
          fileInfo.size
        )}, age: ${formatAge(fileInfo.ageHours)})`
      );
      stats.deletedFiles++;
      stats.deletedBytes += fileInfo.size;
    } else {
      warn(`Skipped (${result.error}): ${fileName}`);
      stats.skippedFiles++;
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Protected directory names that should never be deleted
 * even if they become empty (e.g., cache directories)
 */
const PROTECTED_DIRECTORIES = new Set([
  "cache", // Video cache directory - must persist
  "temp", // Temporary files directory
  "emojis", // Emoji assets
  "emojis-apple", // Apple emoji assets
]);

/**
 * Clean empty directories left after file cleanup
 */
function cleanEmptyDirectories(folderPath: string): number {
  let cleaned = 0;
  const absolutePath = path.resolve(folderPath);

  try {
    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(absolutePath, entry.name);

      // Skip protected directories entirely - don't recurse into them
      // and never delete them even if empty
      if (PROTECTED_DIRECTORIES.has(entry.name.toLowerCase())) {
        continue;
      }

      // Recursively clean subdirectories first
      cleaned += cleanEmptyDirectories(dirPath);

      // Check if directory is now empty
      try {
        const contents = fs.readdirSync(dirPath);
        if (contents.length === 0) {
          fs.rmdirSync(dirPath);
          log(`Removed empty directory: ${entry.name}`);
          cleaned++;
        }
      } catch {
        // Ignore errors for individual directories
      }
    }
  } catch {
    // Ignore errors
  }

  return cleaned;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Cleanup Orchestration
// ──────────────────────────────────────────────────────────────────────────────

let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Run a complete cleanup cycle across all configured folders
 */
async function runCleanup(): Promise<void> {
  if (isRunning) {
    log("Cleanup already in progress, skipping...");
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const { enabled, dryRun, folders } = cleanupConfig;

    if (!enabled) {
      log("Cleanup is disabled");
      return;
    }

    log(
      `Starting cleanup cycle${dryRun ? " (DRY RUN)" : ""} at ${timestamp()}`
    );

    const totalStats: CleanupStats = {
      scannedFiles: 0,
      deletedFiles: 0,
      deletedBytes: 0,
      skippedFiles: 0,
      errors: 0,
    };

    // Clean each configured folder
    for (const folder of folders) {
      const stats = cleanFolder(folder, dryRun);
      totalStats.scannedFiles += stats.scannedFiles;
      totalStats.deletedFiles += stats.deletedFiles;
      totalStats.deletedBytes += stats.deletedBytes;
      totalStats.skippedFiles += stats.skippedFiles;
      totalStats.errors += stats.errors;

      // Clean empty directories in this folder (only if not dry run)
      if (!dryRun && folder.recursive) {
        cleanEmptyDirectories(folder.path);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const action = dryRun ? "Would delete" : "Deleted";

    log(
      `Completed: ${action} ${totalStats.deletedFiles} files ` +
        `(${formatBytes(totalStats.deletedBytes)} freed), ` +
        `${totalStats.skippedFiles} skipped, ` +
        `${totalStats.errors} errors, ` +
        `took ${duration}s`
    );
  } catch (error) {
    logError(`Cleanup cycle failed: ${error}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize the cleanup system
 * Should be called once when the server starts
 */
export function initializeCleanup(): void {
  log("Initializing file cleanup system...");

  // Validate configuration
  const errors = validateCleanupConfig(cleanupConfig);
  if (errors.length > 0) {
    logError("Invalid cleanup configuration:");
    errors.forEach((e) => logError(`  - ${e}`));
    return;
  }

  const { enabled, scanIntervalMinutes, dryRun, folders } = cleanupConfig;

  if (!enabled) {
    log("Cleanup is disabled via configuration");
    return;
  }

  // Log configuration
  log(`Configuration:`);
  log(`  Scan interval: ${scanIntervalMinutes} minutes`);
  log(`  Dry run: ${dryRun}`);
  log(`  Folders:`);
  for (const folder of folders) {
    log(`    - ${folder.name}: TTL ${folder.ttlHours}h, path: ${folder.path}`);
  }

  // Run immediate cleanup on startup
  log("Running initial cleanup scan...");
  runCleanup();

  // Schedule periodic cleanup
  const intervalMs = scanIntervalMinutes * 60 * 1000;
  cleanupInterval = setInterval(() => {
    log(`Scheduled cleanup triggered at ${timestamp()}`);
    runCleanup();
  }, intervalMs);

  // Prevent the interval from keeping the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  log(`Next scheduled cleanup in ${scanIntervalMinutes} minutes`);
}

/**
 * Stop the cleanup system
 * Useful for graceful shutdown or testing
 */
export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log("Cleanup system stopped");
  }
}

/**
 * Manually trigger a cleanup cycle
 * Useful for admin endpoints or testing
 */
export async function triggerCleanup(): Promise<void> {
  log("Manual cleanup triggered");
  await runCleanup();
}

/**
 * Get the current cleanup configuration (for debugging/admin)
 */
export function getCleanupConfig() {
  return { ...cleanupConfig };
}
