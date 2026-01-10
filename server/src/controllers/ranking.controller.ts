import path from "path";
import type { Request, Response } from "express";
import {
  downloadVideo,
  downloadMultipleVideos,
  type MultiDownloadResult,
  type DownloadError,
} from "../services/downloader.service.js";
import {
  getVideoMetadata,
  type TextSegment,
} from "../services/ffmpeg.service.js";
import { renderRankingVideo } from "../services/remotion.service.js";
import type { RenderSpec, EditedClip } from "../types/ranking.js";
// path is already imported at the top

// ... existing code ...

/**
 * Prepare resources for client-side realtime preview
 * Downloads videos and returns their local paths + metadata
 */
export async function preparePreview(req: Request, res: Response) {
  try {
    const { videos } = req.body as {
      videos: { url: string; id: number }[];
    };

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    console.log(`Preparing preview resources for ${videos.length} videos...`);

    // Download videos
    const urls = videos.map((v) => v.url);
    const downloadResults = await downloadMultipleVideos(urls);

    if (downloadResults.successful.length === 0) {
      return res.status(400).json({
        error: "All video downloads failed",
        failedVideos: downloadResults.failed,
      });
    }

    // Get metadata for each downloaded video
    const readyVideos = await Promise.all(
      downloadResults.successful.map(async (downloaded) => {
        const originalIndex = downloaded.index;
        const originalId = videos[originalIndex]?.id;

        try {
          const metadata = await getVideoMetadata(downloaded.filePath);
          // Convert absolute path to relative path served by static middleware
          // Assuming uploads are served at /uploads
          const parts = downloaded.filePath.split("uploads");
          const relativePath =
            parts.length > 1
              ? parts[1]
              : `/${path.basename(downloaded.filePath)}`;
          const servedUrl = `http://localhost:4000/uploads${(
            relativePath || ""
          ).replace(/\\/g, "/")}`;

          return {
            id: originalId,
            url: servedUrl,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            originalUrl: downloaded.originalUrl,
          };
        } catch (err) {
          console.error(
            `Failed to get metadata for ${downloaded.filePath}:`,
            err
          );
          return null;
        }
      })
    );

    const successfulVideos = readyVideos.filter((v) => v !== null);

    res.json({
      success: true,
      videos: successfulVideos,
      warnings:
        downloadResults.failed.length > 0
          ? {
              message: `${downloadResults.failed.length} video(s) failed to download`,
              failedVideos: downloadResults.failed,
            }
          : undefined,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Prepare preview failed:", err);
    res.status(500).json({
      error: "Failed to prepare preview",
      details: err.message,
    });
  }
}

export interface VideoRankInput {
  videoNumber?: number; // Immutable display number from client (optional for backward compatibility)
  url: string;
  title: TextSegment[];
  trimStart?: number;
  trimEnd?: number;
  // Crop values (in source video pixels)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  // Meme sounds to mix into the audio
  memeSounds?: {
    file: string; // URL like http://localhost:4000/assets/sounds/file.mp3
    startTime: number;
    volume: number;
  }[];
}

export interface CreateRankingRequest {
  mainTitle: TextSegment[];
  videos: VideoRankInput[];
  width?: number;
  height?: number;
  firstToPlay?: number;
}

export async function createRanking(req: Request, res: Response) {
  try {
    const { mainTitle, videos, width, height } =
      req.body as CreateRankingRequest;

    // Validate input
    const mainTitleText = mainTitle[0]?.text || "";
    if (!mainTitleText.trim()) {
      return res.status(400).json({ error: "Main title is required" });
    }

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    if (videos.length < 3 || videos.length > 6) {
      return res
        .status(400)
        .json({ error: "Please provide between 3 and 6 videos" });
    }

    // Validate each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video) {
        return res.status(400).json({ error: `Video ${i + 1} is missing` });
      }
      const videoTitleText = video.title[0]?.text || "";
      if (!video.url || !videoTitleText.trim()) {
        return res
          .status(400)
          .json({ error: `Video ${i + 1} must have both url and title` });
      }
    }

    console.log(`Creating ranking video with ${videos.length} videos...`);

    // Download all videos
    console.log("Step 1: Downloading videos...");
    const urls = videos.map((v) => v.url);
    const downloadResults = await downloadMultipleVideos(urls);

    // Check if we have enough successful downloads
    if (downloadResults.successful.length === 0) {
      return res.status(400).json({
        error: "All video downloads failed",
        failedVideos: downloadResults.failed,
      });
    }

    if (downloadResults.successful.length < 3) {
      return res.status(400).json({
        error: "At least 3 videos are required for ranking",
        message: `Only ${downloadResults.successful.length} out of ${urls.length} videos downloaded successfully`,
        failedVideos: downloadResults.failed,
      });
    }

    // Log warnings for failed downloads
    if (downloadResults.failed.length > 0) {
      console.warn(
        `\n⚠️  Warning: ${downloadResults.failed.length} video(s) failed to download:`
      );
      downloadResults.failed.forEach((failure) => {
        console.warn(
          `  - Video ${failure.index + 1} (${failure.url}): ${failure.error}`
        );
      });
      console.warn(
        `Proceeding with ${downloadResults.successful.length} successful downloads\n`
      );
    }

    console.log(
      `Successfully downloaded ${downloadResults.successful.length} videos`
    );

    // Prepare ranking video inputs (maintaining original order with successful downloads only)
    const rankingInputs = downloadResults.successful.map((downloaded) => {
      // Find the original index of this video
      const originalIndex = downloaded.index;
      const originalVideo = videos[originalIndex];
      return {
        filePath: downloaded.filePath,
        title: originalVideo?.title || [
          { text: `Video ${originalIndex + 1}`, color: "white", fontSize: 48 },
        ],
        rank: originalIndex + 1,
        trimStart: originalVideo?.trimStart,
        trimEnd: originalVideo?.trimEnd,
        // Include crop values for FFmpeg
        cropX: originalVideo?.cropX,
        cropY: originalVideo?.cropY,
        cropWidth: originalVideo?.cropWidth,
        cropHeight: originalVideo?.cropHeight,
        // Pass meme sound URLs directly - FFmpeg service will download if needed
        memeSounds: originalVideo?.memeSounds?.map((s) => ({
          file: s.file, // Keep the URL as-is (Supabase or other)
          startTime: s.startTime,
          volume: s.volume,
        })),
      };
    });

    // Shuffle video order: randomize positions 2-N, keep rank 1 for last
    console.log("Shuffling video playback order (rank 1 plays last)...");

    // Separate rank 1 video from the rest
    const rank1Video = rankingInputs[0]!; // Rank 1 is at index 0 (guaranteed to exist)
    const otherVideos = rankingInputs.slice(1); // Ranks 2, 3, 4, etc.

    // Deterministic shuffle to match frontend "random" look
    // Using simple hash sort based on rank (equivalent to id in frontend)
    // Formula: ((rank * 13 + 7) % 5)
    otherVideos.sort((a, b) => {
      const valA = (a.rank * 13 + 7) % 5;
      const valB = (b.rank * 13 + 7) % 5;
      return valA - valB;
    });

    // Reconstruct array: shuffled videos + rank 1 at the end
    const shuffledInputs = [...otherVideos, rank1Video];

    console.log(
      `Playback order: ${shuffledInputs.map((v) => `#${v.rank}`).join(" → ")}`
    );

    // Create ranking video with Remotion
    console.log("Step 2: Creating ranking video with Remotion...");
    const outputFilename = `ranking-${Date.now()}.mp4`;

    // Construct a RenderSpec from the shuffled inputs
    // This endpoint (/create) is called by "Create Video" button which might NOT send a spec?
    // Let's assume for now we need to construct it or fallback.
    // However, user constraint is "Export must use the same RenderSpec".
    // This implies /create should also receive a spec?
    // If not, we have to support the legacy way for now via FFmpeg OR build a Spec here.
    // But the user said "Replace FFmpeg with Remotion".
    // Let's check if 'req.body.spec' is available here too.
    const spec = req.body.spec as RenderSpec;

    let relativeOutputPath: string;

    if (spec) {
      // Same patching logic as preview
      const urlToPathMap = new Map<string, string>();
      downloadResults.successful.forEach((d) => {
        const originalUrl = videos[d.index]?.url;
        if (originalUrl) urlToPathMap.set(originalUrl, d.filePath);
      });

      const patchedSpec = JSON.parse(JSON.stringify(spec)) as RenderSpec;
      // Patch sequence
      for (const item of patchedSpec.sequence) {
        const matchedPath = urlToPathMap.get(item.clip.src);
        if (matchedPath) item.clip.src = matchedPath.replace(/\\/g, "/");
      }
      // Patch slots ordering if shuffle happened?
      // But the client already sent the spec. If the client did the shuffle, the spec is already shuffled.
      // If `createRanking` does the shuffle, the spec from client might be wrong?
      // Ideally client does EVERYTHING.
      // If spec is present, we TRUST the spec and IGNORE the server-side shuffle logic.

      relativeOutputPath = await renderRankingVideo(
        patchedSpec,
        outputFilename
      );
    } else {
      // Fallback: If no spec provided, we might need to fail or use legacy FFmpeg (which we are replacing).
      // For now, let's assume client sends spec. If not, error.
      throw new Error(
        "RenderSpec is required for Remotion export. Please refresh client."
      );
    }

    /*
    const outputPath = await createRankingVideo(
      {
        mainTitle,
        videos: shuffledInputs, // Use shuffled order
        ...(width && { width }),
        ...(height && { height }),
      },
      outputFilename
    );
    */

    // Note: Not cleaning up downloaded files - they are cached for reuse

    // Return success response with warnings if any videos failed
    const response: any = {
      success: true,
      videoUrl: `http://localhost:4000/${relativeOutputPath}`,
      message: `Successfully created ranking video`,
      /*
      rankings: rankingInputs.map((v) => ({
        rank: v.rank,
        title: v.title,
      })),
      */
    };

    if (downloadResults.failed.length > 0) {
      response.warnings = {
        message: `${downloadResults.failed.length} video(s) were skipped due to download errors`,
        failedVideos: downloadResults.failed,
      };
    }

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Ranking video creation failed:", err);
    res.status(500).json({
      error: "Failed to create ranking video",
      details: err.message,
    });
  }
}

/**
 * Generate a full preview video - downloads all videos and creates the complete ranking video
 * This is identical to the final output, just saved as a preview
 */
export async function generateFullPreview(req: Request, res: Response) {
  try {
    const { mainTitle, videos, width, height } = req.body as {
      mainTitle: TextSegment[];
      videos: VideoRankInput[];
      width?: number;
      height?: number;
    };

    // Validation (same as createRanking)
    const mainTitleText = mainTitle[0]?.text || "";
    if (!mainTitleText.trim()) {
      return res.status(400).json({ error: "Main title is required" });
    }

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: "Videos must be an array" });
    }

    if (videos.length < 3 || videos.length > 6) {
      return res
        .status(400)
        .json({ error: "Please provide between 3 and 6 videos" });
    }

    // Validate each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video) {
        return res.status(400).json({ error: `Video ${i + 1} is missing` });
      }
      const videoTitleText = video.title[0]?.text || "";
      if (!video.url || !videoTitleText.trim()) {
        return res
          .status(400)
          .json({ error: `Video ${i + 1} must have both url and title` });
      }
    }

    console.log(`Generating full preview with ${videos.length} videos...`);

    // Download all videos
    console.log("Step 1: Downloading all videos...");
    const urls = videos.map((v) => v.url);
    const downloadResults = await downloadMultipleVideos(urls);

    // Check if we have enough successful downloads
    if (downloadResults.successful.length === 0) {
      return res.status(400).json({
        error: "All video downloads failed",
        failedVideos: downloadResults.failed,
      });
    }

    if (downloadResults.successful.length < 3) {
      return res.status(400).json({
        error: "At least 3 videos are required for ranking",
        message: `Only ${downloadResults.successful.length} out of ${urls.length} videos downloaded successfully`,
        failedVideos: downloadResults.failed,
      });
    }

    // Log warnings for failed downloads
    if (downloadResults.failed.length > 0) {
      console.warn(
        `\n⚠️  Warning: ${downloadResults.failed.length} video(s) failed to download:`
      );
      downloadResults.failed.forEach((failure) => {
        console.warn(
          `  - Video ${failure.index + 1} (${failure.url}): ${failure.error}`
        );
      });
      console.warn(
        `Proceeding with ${downloadResults.successful.length} successful downloads\n`
      );
    }

    console.log(
      `Successfully downloaded ${downloadResults.successful.length} videos`
    );

    // Use videos in exact array order as received (user-defined via drag-and-drop)
    console.log("Using user-defined video order (top to bottom)");
    const rankingInputs = downloadResults.successful.map((downloaded) => {
      // Find the original index of this video
      const originalIndex = downloaded.index;
      const originalVideo = videos[originalIndex];

      // CRITICAL: rank must be the videoNumber (immutable slot), not array index
      console.log(
        `[RankingController] Video ${originalIndex}: videoNumber=${originalVideo?.videoNumber}, title="${originalVideo?.title[0]?.text}"`
      );

      return {
        filePath: downloaded.filePath,
        title: originalVideo?.title || [
          { text: `Video ${originalIndex + 1}`, color: "white", fontSize: 48 },
        ],
        rank: originalVideo?.videoNumber || originalIndex + 1, // Use immutable videoNumber as rank for slot positioning
        trimStart: originalVideo?.trimStart,
        trimEnd: originalVideo?.trimEnd,
        // Include crop values for FFmpeg
        cropX: originalVideo?.cropX,
        cropY: originalVideo?.cropY,
        cropWidth: originalVideo?.cropWidth,
        cropHeight: originalVideo?.cropHeight,
        // Pass meme sound URLs directly - FFmpeg service will download if needed
        memeSounds: originalVideo?.memeSounds?.map((s) => ({
          file: s.file, // Keep the URL as-is (Supabase or other)
          startTime: s.startTime,
          volume: s.volume,
        })),
      };
    });

    console.log("Ranking inputs with videoNumber:");
    rankingInputs.forEach((input, idx) => {
      console.log(
        `  [${idx}] rank=${input.rank}, title=${input.title[0]?.text}`
      );
    });

    // Pass videos to FFmpeg in exact array order
    const orderedInputs = rankingInputs;

    console.log(
      `Playback order: ${orderedInputs.map((v) => `#${v.rank}`).join(" → ")}`
    );

    // Create preview video via Remotion
    console.log("Step 2: Creating preview with Remotion...");
    const outputFilename = `preview-remotion-${Date.now()}.mp4`;

    // 1. Get the Spec from request
    const spec = req.body.spec as RenderSpec;
    if (!spec) {
      throw new Error("RenderSpec is required for Remotion export");
    }

    // 2. Patch the Spec with local file paths
    // The spec.sequence[i].clip.src likely contains "blob:..." or "http://..."
    // We need to map it to the downloaded local paths
    // Strategy: Map based on slotIndex or ID if possible.
    // Spec clips correspond to 'videos' array.
    // The 'videos' array order corresponds to 'downloadResults.successful' (assuming all success for now).
    // Actually downloadResults.successful contains index mapping.

    // Create a map of Url -> LocalPath
    const urlToPathMap = new Map<string, string>();
    downloadResults.successful.forEach((d) => {
      const originalUrl = videos[d.index]?.url;
      if (originalUrl) {
        // Convert absolute path to proper file URL for Remotion or absolute path
        // Remotion (server-side) can read absolute paths.
        urlToPathMap.set(originalUrl, d.filePath);
      }
    });

    // Deep clone spec to avoid mutation issues
    const patchedSpec = JSON.parse(JSON.stringify(spec)) as RenderSpec;

    // Patch sequences
    for (const item of patchedSpec.sequence) {
      // Find the local path for this clip's source
      // The clip.src coming from client might be the same 'url' we used for download,
      // OR it might be a blob url if the user uploaded it directly?
      // If it's a blob url, the client also sent specific 'videos' array with 'url'?
      // In RankingVideos.tsx: 'videos' state has 'src'. 'RankingVideoInput' has 'url'.
      // Implementation detail: client sends 'url' in video inputs.

      // Try to find the matching local path.
      // We can iterate through 'videos' to find which one matches the clip.id if possible?
      // EditedClip has 'id'. 'VideoRankInput' doesn't explicitly have 'id' in the interface in this file,
      // but the client sends it?
      // Let's rely on the URL if it matches.

      const matchedPath = urlToPathMap.get(item.clip.src);
      if (matchedPath) {
        // Normalize path for cross-platform (Remotion might need forward slashes)
        item.clip.src = matchedPath.replace(/\\/g, "/");
      } else {
        console.warn(
          `Could not find local download for clip src: ${item.clip.src}`
        );
        // Fallback: If it's already a local path? or we uploaded it?
        // For now, assuming direct URL match.
      }

      // Also patch audio tracks if they are remote
      if (item.clip.audio) {
        for (const track of item.clip.audio) {
          // If track.src was downloaded? Current downloader only downloads the main video.
          // If audio is remote, Remotion might handle it if it's http, but for performance local is better.
          // For now, let Remotion handle remote audio URLs if they are not in our download list.
        }
      }
    }

    // 3. Render
    const relativeOutputPath = await renderRankingVideo(
      patchedSpec,
      outputFilename
    );

    const response: any = {
      success: true,
      videoUrl: `http://localhost:4000/${relativeOutputPath}`,
      message: `Successfully created Remotion preview with ${downloadResults.successful.length} videos`,
    };

    if (downloadResults.failed.length > 0) {
      response.warnings = {
        message: `${downloadResults.failed.length} video(s) were skipped due to download errors`,
        failedVideos: downloadResults.failed,
      };
    }

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Full preview generation failed:", err);
    res.status(500).json({
      error: "Failed to generate preview",
      details: err.message,
    });
  }
}
