/**
 * Cleanup Configuration
 *
 * Centralized configuration for the file cleanup system.
 * Controls TTL, scan frequency, and target directories.
 */

import path from "path";
import { UPLOADS_DIR, OUTPUTS_DIR } from "./paths.js";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface CleanupFolderConfig {
  /** Display name for logging */
  name: string;
  /** Path to the folder (relative to server root or absolute) */
  path: string;
  /** Time-to-live in hours - files older than this will be deleted */
  ttlHours: number;
  /** Whether to recursively clean subdirectories */
  recursive: boolean;
  /** Optional: only clean files with these extensions (include the dot) */
  extensions?: string[];
}

export interface CleanupConfig {
  /** Master switch to enable/disable cleanup */
  enabled: boolean;
  /** How often to scan for expired files (in minutes) */
  scanIntervalMinutes: number;
  /** If true, log what would be deleted but don't actually delete */
  dryRun: boolean;
  /** List of folders to clean */
  folders: CleanupFolderConfig[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Environment variable parsing helpers
// ──────────────────────────────────────────────────────────────────────────────

function parseEnvBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseEnvNumber(
  value: string | undefined,
  defaultValue: number
): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ──────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Default cleanup configuration.
 *
 * Can be overridden via environment variables:
 * - CLEANUP_ENABLED: "true" or "false"
 * - CLEANUP_DRY_RUN: "true" or "false"
 * - CLEANUP_SCAN_INTERVAL_MINUTES: number
 * - CLEANUP_UPLOADS_TTL_HOURS: number
 * - CLEANUP_OUTPUTS_TTL_HOURS: number
 */
export const cleanupConfig: CleanupConfig = {
  enabled: parseEnvBoolean(process.env.CLEANUP_ENABLED, true),
  scanIntervalMinutes: parseEnvNumber(
    process.env.CLEANUP_SCAN_INTERVAL_MINUTES,
    60
  ),
  dryRun: parseEnvBoolean(process.env.CLEANUP_DRY_RUN, false),
  folders: [
    {
      name: "Uploads",
      path: UPLOADS_DIR,
      ttlHours: parseEnvNumber(process.env.CLEANUP_UPLOADS_TTL_HOURS, 4),
      recursive: true,
      // Common video extensions - only clean video files
      extensions: [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"],
    },
    {
      name: "Outputs",
      path: OUTPUTS_DIR,
      ttlHours: parseEnvNumber(process.env.CLEANUP_OUTPUTS_TTL_HOURS, 48),
      recursive: true,
      // Output videos and temp directories
      extensions: [".mp4", ".webm"],
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate the cleanup configuration
 */
export function validateCleanupConfig(config: CleanupConfig): string[] {
  const errors: string[] = [];

  if (config.scanIntervalMinutes < 1) {
    errors.push("scanIntervalMinutes must be at least 1");
  }

  if (config.scanIntervalMinutes > 1440) {
    errors.push("scanIntervalMinutes should not exceed 1440 (24 hours)");
  }

  for (const folder of config.folders) {
    if (folder.ttlHours < 1) {
      errors.push(`TTL for ${folder.name} must be at least 1 hour`);
    }

    if (!folder.path) {
      errors.push(`Path for ${folder.name} cannot be empty`);
    }
  }

  return errors;
}
