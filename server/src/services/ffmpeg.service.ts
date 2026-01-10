import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

// Import from centralized types - re-export for backward compatibility
import type { TextSegment } from "../types/index.js";
export type { TextSegment };

// Import utility functions from centralized utils
import {
  estimateTextWidth,
  normalizeColor,
  splitIntoLines,
} from "../utils/index.js";

// Import FFmpeg filters from infrastructure
import {
  createFormattedTextFilters,
  createFormattedTextFiltersWithEmojis,
  createEmojiOverlayFilters,
  type EmojiOverlayConfig,
} from "../infrastructure/ffmpeg/index.js";

// Import emoji cache service
import { getEmojiPath } from "./emoji.cache.js";

// Import shared timeline builder
import { buildRankingTimeline } from "video-maker-shared";

// ... types
export interface RankingVideoInput {
  filePath: string;
  title: TextSegment[];
  rank: number;
  trimStart?: number | undefined;
  trimEnd?: number | undefined;
  // Crop values (in source video pixels, applied after trim)
  cropX?: number | undefined;
  cropY?: number | undefined;
  cropWidth?: number | undefined;
  cropHeight?: number | undefined;
  memeSounds?:
    | {
        file: string; // Absolute path to sound file
        startTime: number; // Start time in seconds (relative to trimmed clip start)
        volume: number; // Volume multiplier (1.0 = 100%)
      }[]
    | undefined;
}

export interface RankingVideoOptions {
  mainTitle: TextSegment[];
  videos: RankingVideoInput[];
  width?: number;
  height?: number;
}
export async function createRankingVideo(
  options: RankingVideoOptions,
  outputFilename: string
): Promise<string> {
  const outputsDir = path.resolve("outputs");
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  const finalOutputPathNative = path.resolve(outputsDir, outputFilename);
  const finalOutputPath = finalOutputPathNative.replace(/\\/g, "/");
  const tempDir = path.resolve(outputsDir, `temp-${Date.now()}`);

  // Create temp directory
  console.log(`Creating temp directory: ${tempDir}`);
  fs.mkdirSync(tempDir, { recursive: true });

  if (!fs.existsSync(tempDir)) {
    throw new Error(`Failed to create temp directory: ${tempDir}`);
  }
  console.log(`Temp directory created successfully`);

  try {
    const width = options.width || 1080;
    const height = options.height || 1920;
    const processedVideos: string[] = [];
    const totalVideos = options.videos.length;

    // Layout constants
    const titleHeight = 300; // Increased from 200 for more title space
    const videoHeight = height - titleHeight;
    const rankingItemHeight = 200;

    // Calculate starting Y position to center rankings vertically
    const totalRankingHeight = totalVideos * rankingItemHeight;
    const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

    // Font paths - cross-platform support
    // Windows: C:\Windows\Fonts\impact.ttf
    // Linux/Docker: /usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf
    const getSystemFont = (): string => {
      const isWindows = process.platform === "win32";
      if (isWindows) {
        // For FFmpeg drawtext filter, the colon needs to be escaped with a single backslash
        // In JavaScript, "\\" produces a single backslash in the output string
        return "C\\:/Windows/Fonts/impact.ttf";
      }
      // Linux - use Liberation Sans Bold (installed via fonts-liberation package)
      return "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";
    };

    const titleFont = getSystemFont();
    const rankingFont = getSystemFont();

    // STEP 1: Get video durations and build shared timeline BEFORE processing
    console.log("[Timeline] Building global timeline...");
    const videoMetadataForTimeline = [];
    for (const video of options.videos) {
      const inputPath = path.resolve(video.filePath).replace(/\\/g, "/");
      const metadata = await getVideoMetadata(inputPath);

      const trimStart = video.trimStart || 0;
      const trimEnd =
        video.trimEnd && video.trimEnd > 0 ? video.trimEnd : metadata.duration;
      const clipDuration = Math.max(0, trimEnd - trimStart);

      // Find the video's ID (use array index as proxy since we don't have explicit IDs)
      const videoId = options.videos.indexOf(video);

      videoMetadataForTimeline.push({
        id: videoId,
        videoNumber: video.rank, // rank is the immutable display slot
        title: video.title,
        duration: clipDuration,
      });
    }

    // Build shared timeline - single source of truth
    const sharedTimeline = buildRankingTimeline(videoMetadataForTimeline);
    console.log(`[Timeline] Total duration: ${sharedTimeline.totalDuration}s`);
    console.log(
      `[Timeline] Generated ${sharedTimeline.titleSegments.length} title segments`
    );

    for (const video of options.videos) {
      const inputPath = path.resolve(video.filePath).replace(/\\/g, "/");
      const outputPathNative = path.resolve(
        tempDir,
        `processed-${video.rank}.mp4`
      );
      const outputPath = outputPathNative.replace(/\\/g, "/");

      console.log(`Processing video ${video.rank}...`);
      console.log(`  Input path: ${inputPath}`);
      console.log(`  File exists: ${fs.existsSync(inputPath)}`);
      console.log(`  Trim: start=${video.trimStart}, end=${video.trimEnd}`);
      console.log(
        `  Crop: x=${video.cropX}, y=${video.cropY}, w=${video.cropWidth}, h=${video.cropHeight}`
      );
      console.log(`  Meme sounds count: ${video.memeSounds?.length || 0}`);
      if (video.memeSounds?.length) {
        video.memeSounds.forEach((s, i) => {
          console.log(
            `    Sound ${i}: file=${s.file}, startTime=${s.startTime}, volume=${s.volume}`
          );
        });
      }

      // Validate video file exists before processing
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input video file not found: ${inputPath}`);
      }

      // Pre-process meme sounds: Download remote URLs to local temp files
      const processedMemeSounds: typeof video.memeSounds = [];
      for (const sound of video.memeSounds || []) {
        if (sound.file.startsWith("http")) {
          try {
            const urlObj = new URL(sound.file);
            const ext = path.extname(urlObj.pathname) || ".mp3";
            const soundFileName = `sound-${Date.now()}-${Math.random()
              .toString(36)
              .substring(7)}${ext}`;
            const localSoundPath = path.join(tempDir, soundFileName);

            console.log(
              `Downloading sound: ${sound.file} -> ${localSoundPath}`
            );

            await new Promise<void>((resolve, reject) => {
              const protocol = sound.file.startsWith("https") ? https : http;
              const file = fs.createWriteStream(localSoundPath);
              protocol
                .get(sound.file, (response) => {
                  if (
                    response.statusCode === 301 ||
                    response.statusCode === 302
                  ) {
                    // Handle redirect
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                      const redirectProtocol = redirectUrl.startsWith("https")
                        ? https
                        : http;
                      redirectProtocol
                        .get(redirectUrl, (res2) => {
                          res2.pipe(file);
                          file.on("finish", () => {
                            file.close();
                            resolve();
                          });
                        })
                        .on("error", reject);
                    } else {
                      reject(new Error("Redirect without location"));
                    }
                  } else {
                    response.pipe(file);
                    file.on("finish", () => {
                      file.close();
                      resolve();
                    });
                  }
                })
                .on("error", (err) => {
                  fs.unlink(localSoundPath, () => {});
                  reject(err);
                });
            });

            processedMemeSounds.push({
              ...sound,
              file: localSoundPath,
            });
          } catch (err) {
            console.error(`Failed to download sound ${sound.file}:`, err);
            // Skip this sound if download fails
          }
        } else {
          // Local file path
          processedMemeSounds.push(sound);
        }
      }

      // Async metadata retrieval
      const metadata = await new Promise<ffmpeg.FfprobeData>(
        (resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        }
      );

      const hasAudio = metadata.streams.some(
        (stream) => stream.codec_type === "audio"
      );

      // Prepare text filters and emojis
      const videoFilters: string[] = [];
      const emojiConfigs: EmojiOverlayConfig[] = []; // Unified list of emojis to overlay

      // 1. Video Processing Chain (Trim/Crop/Scale)
      const trimStart =
        video.trimStart !== undefined ? Number(video.trimStart) : undefined;
      const trimEnd =
        video.trimEnd !== undefined ? Number(video.trimEnd) : undefined;

      let trimFilter = "";
      if (
        trimStart !== undefined &&
        !isNaN(trimStart) &&
        trimEnd !== undefined &&
        !isNaN(trimEnd) &&
        trimEnd > trimStart
      ) {
        trimFilter = `trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS`;
      } else if (trimStart !== undefined && !isNaN(trimStart)) {
        trimFilter = `trim=start=${trimStart},setpts=PTS-STARTPTS`;
      }

      if (trimFilter) videoFilters.push(trimFilter);

      // User Crop
      if (
        video.cropWidth &&
        video.cropHeight &&
        video.cropWidth > 0 &&
        video.cropHeight > 0
      ) {
        const cx = video.cropX ?? 0;
        const cy = video.cropY ?? 0;
        videoFilters.push(
          `crop=${video.cropWidth}:${video.cropHeight}:${cx}:${cy}`
        );
      }

      // Scale & Fill
      videoFilters.push(
        `scale=${width}:${videoHeight}:force_original_aspect_ratio=increase`
      );
      videoFilters.push(
        `crop=${width}:${videoHeight}:(iw-${width})/2:(ih-${videoHeight})/2`
      );

      // Pad
      videoFilters.push(`pad=${width}:${height}:0:${titleHeight}:black`);

      // 2. Text Overlays with Emojis

      // Main Title
      const mainTitleFontSize = options.mainTitle[0]?.fontSize || 64;
      const mainTitleRes = createFormattedTextFiltersWithEmojis(
        options.mainTitle,
        "(w-text_w)/2",
        180,
        titleFont,
        "white",
        mainTitleFontSize,
        "yellow",
        4,
        0
      );
      videoFilters.push(...mainTitleRes.textFilters);

      // Process emojis for main title
      for (const e of mainTitleRes.emojis) {
        try {
          const emojiPath = await getEmojiPath(e.codepoint);
          emojiConfigs.push({
            emojiPath,
            x: e.x,
            y: e.y,
            width: e.size,
            height: e.size,
            inputIndex: -1, // Will be set later
          });
        } catch (err) {
          console.error(`Failed to load emoji ${e.codepoint}:`, err);
        }
      }

      // STEP 2: Use shared timeline to generate title overlays with enable filters
      // Find the clip info for this video
      const videoIndex = options.videos.indexOf(video);
      const clipInfo = sharedTimeline.clips[videoIndex];
      if (!clipInfo) {
        console.warn(`[Timeline] No clip info found for video ${video.rank}`);
        continue;
      }

      console.log(
        `[Timeline] Video ${video.rank}: ${clipInfo.startTime}s - ${clipInfo.endTime}s`
      );

      // Slot numbers (always visible)
      for (let slotNumber = 1; slotNumber <= totalVideos; slotNumber++) {
        const yPos = rankingStartY + (slotNumber - 1) * rankingItemHeight;

        // Find slot video by rank
        const slotVideo = options.videos.find((v) => v.rank === slotNumber);
        if (!slotVideo) continue;

        const isThisVideoPlaying = slotVideo.rank === video.rank;
        const numColor = isThisVideoPlaying ? "yellow" : "white";

        // Always show slot number (no enable filter needed - visible entire clip)
        videoFilters.push(
          `drawtext=fontfile='${rankingFont}':text='${slotNumber}.':fontsize=52:fontcolor=${numColor}:x=30:y=${yPos}:borderw=3:bordercolor=black`
        );
      }

      // Title overlays from timeline segments (with enable filters for precise timing)
      // Filter segments that appear during THIS video's playback
      const relevantSegments = sharedTimeline.titleSegments.filter(
        (seg: any) =>
          seg.startTime >= clipInfo.startTime &&
          seg.startTime < clipInfo.endTime
      );

      console.log(
        `[Timeline] Video ${video.rank} (index ${videoIndex}) has ${relevantSegments.length} title segments`
      );
      console.log(`[Timeline] Clip info:`, JSON.stringify(clipInfo, null, 2));
      console.log(
        `[Timeline] Relevant segments:`,
        relevantSegments.map((s: any) => ({
          videoId: s.videoId,
          slot: s.slotIndex,
          start: s.startTime,
          end: s.endTime,
          title: s.title[0]?.text,
        }))
      );

      for (const segment of relevantSegments) {
        const yPos =
          rankingStartY + (segment.slotIndex - 1) * rankingItemHeight;
        const titleColor = segment.isCurrentlyPlaying ? "yellow" : "white";

        console.log(
          `[Timeline]   Segment: videoId=${segment.videoId}, slot=${segment.slotIndex}, yPos=${yPos}, title="${segment.title[0]?.text}"`
        );

        // Convert global timeline time to local video time (relative to this clip's start)
        // Note: FFmpeg time starts at 0 for each video after trim filter
        const localStart = segment.startTime - clipInfo.startTime;
        const localEnd = segment.endTime - clipInfo.startTime;

        console.log(
          `[Timeline]   Segment slot ${segment.slotIndex}: ${localStart}s - ${localEnd}s (local)`
        );

        const videoTitleFontSize = segment.title[0]?.fontSize || 52;
        const videoTitleRes = createFormattedTextFiltersWithEmojis(
          segment.title,
          90,
          yPos + 4,
          rankingFont,
          titleColor,
          videoTitleFontSize,
          "black",
          3
        );

        // Add enable filter to each text filter for precise timing
        const enabledFilters = videoTitleRes.textFilters.map((filter) => {
          // Add enable expression to show titles only during their time window
          return `${filter}:enable='between(t,${localStart},${localEnd})'`;
        });

        videoFilters.push(...enabledFilters);

        // Process emojis
        for (const e of videoTitleRes.emojis) {
          try {
            const emojiPath = await getEmojiPath(e.codepoint);
            emojiConfigs.push({
              emojiPath,
              x: e.x,
              y: e.y,
              width: e.size,
              height: e.size,
              inputIndex: -1,
              // TODO: Add enable timing for emoji overlays if needed
            });
          } catch (err) {
            console.error(`Failed to load emoji ${e.codepoint}:`, err);
          }
        }
      }

      // Execute FFmpeg
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(inputPath);
        const complexFilters: string[] = [];

        // Add Meme Sounds Inputs
        const memeSounds = processedMemeSounds;
        if (memeSounds.length > 0) {
          memeSounds.forEach((sound) => {
            const soundPath = path.resolve(sound.file);
            command.input(soundPath);
          });
        }

        // Add Emoji Inputs
        // Input Indices:
        // 0: Video
        // 1..memeSounds.length: Meme Sounds
        // memeSounds.length+1..: Emojis
        const startEmojiInputIndex = 1 + memeSounds.length;

        emojiConfigs.forEach((cfg, idx) => {
          cfg.inputIndex = startEmojiInputIndex + idx;
          command.input(cfg.emojiPath).inputOption(["-loop 1"]);
        });

        // Construct Video Chain
        // If emojis exist: [0:v]...[v_text] -> [v_text][e]overlay...[outv]
        // If no emojis: [0:v]...[outv]

        const hasEmojis = emojiConfigs.length > 0;
        const textOutLabel = hasEmojis ? "v_text" : "outv";

        const videoBaseChain = `[0:v]${videoFilters.join(
          ","
        )}[${textOutLabel}]`;
        complexFilters.push(videoBaseChain);

        if (hasEmojis) {
          const emojiRes = createEmojiOverlayFilters(
            emojiConfigs,
            "v_text",
            startEmojiInputIndex
          );
          complexFilters.push(...emojiRes.scaleFilters);
          complexFilters.push(...emojiRes.overlayFilters);
          // Rename final output to [outv] for consistency
          complexFilters.push(`[${emojiRes.finalOutputLabel}]null[outv]`);
        }

        // Audio Processing Chain
        // ... (Keep existing audio logic) ...
        let finalAudioMap = "[outa]";
        let inputCount = 1; // Used for audio mixing - tracks current input index

        if (hasAudio) {
          // Audio filters logic...
          const audioFilters: string[] = [];
          // Reuse trim logic from original
          if (
            trimStart !== undefined &&
            !isNaN(trimStart) &&
            trimEnd !== undefined &&
            !isNaN(trimEnd) &&
            trimEnd > trimStart
          ) {
            complexFilters.push(
              `[0:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo:sample_fmts=fltp[a_trimmed]`
            );
          } else if (trimStart !== undefined && !isNaN(trimStart)) {
            complexFilters.push(
              `[0:a]atrim=start=${trimStart},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo:sample_fmts=fltp[a_trimmed]`
            );
          } else {
            complexFilters.push(
              `[0:a]aresample=44100,aformat=channel_layouts=stereo:sample_fmts=fltp[a_trimmed]`
            );
          }

          if (memeSounds.length > 0) {
            const mixInputs = ["[a_trimmed]"];
            memeSounds.forEach((sound) => {
              const delayMs = Math.round(sound.startTime * 1000);
              const volume = sound.volume || 1.0;
              complexFilters.push(
                `[${inputCount}:a]aresample=44100,aformat=channel_layouts=stereo:sample_fmts=fltp,volume=${volume},adelay=${delayMs}|${delayMs}[delayed${inputCount}]`
              );
              mixInputs.push(`[delayed${inputCount}]`);
              inputCount++;
            });

            complexFilters.push(
              `${mixInputs.join("")}amix=inputs=${
                mixInputs.length
              }:duration=first:dropout_transition=0,aresample=44100:async=1[outa]`
            );
          } else {
            complexFilters.push(`[a_trimmed]aresample=44100:async=1[outa]`);
          }
        } else {
          // No Audio
          complexFilters.push(
            `anullsrc=channel_layout=stereo:sample_rate=44100[a_silence]`
          );

          if (memeSounds.length > 0) {
            const mixInputs = ["[a_silence]"];
            memeSounds.forEach((sound) => {
              const delayMs = Math.round(sound.startTime * 1000);
              const volume = sound.volume || 1.0;
              complexFilters.push(
                `[${inputCount}:a]aresample=44100,aformat=channel_layouts=stereo:sample_fmts=fltp,volume=${volume},adelay=${delayMs}|${delayMs}[delayed${inputCount}]`
              );
              mixInputs.push(`[delayed${inputCount}]`);
              inputCount++;
            });
            complexFilters.push(
              `${mixInputs.join("")}amix=inputs=${
                mixInputs.length
              }:duration=longest:dropout_transition=0,aresample=44100:async=1[outa]`
            );
          } else {
            complexFilters.push(`[a_silence]aresample=44100:async=1[outa]`);
          }
        }

        command
          .complexFilter(complexFilters)
          .outputOptions([
            "-map",
            "[outv]",
            "-map",
            "[outa]",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-r",
            "30",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "320k",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-shortest",
          ])
          .output(outputPath)
          .on("start", (cmd) => console.log(`FFmpeg command: ${cmd}`))
          // .on("stderr", (line) => console.log(`FFmpeg stderr: ${line}`))
          .on("end", () => {
            console.log(`Successfully processed video ${video.rank}`);
            processedVideos.push(outputPath);
            resolve();
          })
          .on("error", (err, stdout, stderr) => {
            console.error(`Error processing video ${video.rank}:`, err);
            console.error(`FFmpeg stderr output:\n${stderr}`);
            reject(err);
          })
          .run();
      });
    }

    // Concatenation
    const fileListPathNative = path.resolve(tempDir, "filelist.txt");
    const fileListContent = processedVideos
      .map((p) => `file '${p}'`)
      .join("\n");
    fs.writeFileSync(fileListPathNative, fileListContent);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(fileListPathNative)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions([
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "320k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-pix_fmt",
          "yuv420p",
        ])
        .output(finalOutputPath)
        .on("start", (cmd) => console.log("Concatenating videos:", cmd))
        .on("end", () => {
          console.log(`Ranking video created: ${finalOutputPath}`);
          resolve();
        })
        .on("error", (err) => {
          console.error("Concatenation error:", err);
          reject(err);
        })
        .run();
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
    return finalOutputPath;
  } catch (error) {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

/**
 * Generate a preview for a single video with ranking overlays
 * This creates the exact same output as the final ranking video, but for just one clip
 */

/**
 * Get video metadata (duration, width, height)
 */
export function getVideoMetadata(
  filePath: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video"
      );
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      const duration = metadata.format.duration || videoStream.duration;
      if (!duration) {
        reject(new Error("Could not determine video duration"));
        return;
      }

      resolve({
        duration: parseFloat(String(duration)),
        width: videoStream.width || 0,
        height: videoStream.height || 0,
      });
    });
  });
}
