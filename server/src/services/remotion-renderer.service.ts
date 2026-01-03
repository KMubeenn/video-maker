/**
 * Remotion Renderer Service
 * Server-side video rendering using Remotion CLI
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import type { RankingVideoComposition } from "../../../shared/schemas/ranking-video.schema.js";

const execAsync = promisify(exec);

export interface RenderOptions {
  composition: RankingVideoComposition;
  outputPath: string;
  onProgress?: (progress: number) => void;
}

export interface RenderResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * Render a Remotion composition to video file
 */
export async function renderRankingVideo(
  options: RenderOptions
): Promise<RenderResult> {
  const { composition, outputPath } = options;

  try {
    // Create temporary props file
    const tempPropsPath = path.join(
      path.dirname(outputPath),
      `props-${Date.now()}.json`
    );

    await fs.writeFile(
      tempPropsPath,
      JSON.stringify({ data: composition }, null, 2)
    );

    // Build Remotion CLI command
    // Note: This assumes the client folder is accessible from server
    const clientPath = path.resolve(__dirname, "../../../client");
    const remotionEntry = path.join(clientPath, "src/remotion/index.ts");

    const command = [
      "npx",
      "remotion",
      "render",
      remotionEntry,
      "RankingVideo",
      outputPath,
      `--props=${tempPropsPath}`,
      "--overwrite",
    ].join(" ");

    console.log("Remotion render command:", command);

    // Execute Remotion CLI
    const { stdout, stderr } = await execAsync(command, {
      cwd: clientPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for logs
    });

    console.log("Remotion render stdout:", stdout);
    if (stderr) {
      console.warn("Remotion render stderr:", stderr);
    }

    // Clean up temporary props file
    await fs.unlink(tempPropsPath).catch(() => {});

    // Verify output file was created
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error("Output video file is empty");
    }

    return {
      success: true,
      outputPath,
    };
  } catch (error: any) {
    console.error("Remotion rendering failed:", error);
    return {
      success: false,
      error: error.message || "Unknown rendering error",
    };
  }
}

/**
 * Alternative: Bundle-based rendering (more reliable for production)
 * This uses @remotion/renderer which doesn't require CLI
 */
export async function renderRankingVideoWithBundle(
  options: RenderOptions
): Promise<RenderResult> {
  // TODO: Implement using @remotion/renderer for more control
  // This requires bundling the Remotion code first, then rendering
  // For now, use CLI-based rendering as it's simpler
  return renderRankingVideo(options);
}
