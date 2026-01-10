import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import { URL } from "url";

// Import from centralized types
import type { TextSegment, RenderSpec } from "../types/index.js";
export type { TextSegment };

// Import FFmpeg filters from infrastructure
import {
  createFormattedTextFiltersWithEmojis,
  createEmojiOverlayFilters,
  type EmojiOverlayConfig,
} from "../infrastructure/ffmpeg/index.js";

// Import emoji cache service
import { getEmojiPath } from "./emoji.cache.js";

// Import shared timeline builder (used only for legacy fallback if absolutely needed, but we prefer Spec)

export interface RankingVideoInput {
  filePath: string;
  title: TextSegment[];
  rank: number;
  trimStart?: number | undefined;
  trimEnd?: number | undefined;
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
  spec?: RenderSpec;
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

  try {
    const width = options.width || 1080;
    const height = options.height || 1920;
    const processedVideos: string[] = [];
    const totalVideos = options.videos.length;

    // Layout constants
    const titleHeight = 300;
    const videoHeight = height - titleHeight;
    const rankingItemHeight = 200;

    // Calculate starting Y position to center rankings vertically
    const totalRankingHeight = totalVideos * rankingItemHeight;
    const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

    const getSystemFont = (): string => {
      const isWindows = process.platform === "win32";
      if (isWindows) {
        return "C\\:/Windows/Fonts/impact.ttf";
      }
      return "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";
    };

    const titleFont = getSystemFont();
    const rankingFont = getSystemFont();

    // Determine Timeline Logic
    const timelineClips: {
      startTime: number;
      endTime: number;
      videoId: number; // Index in options.videos
      rank: number;
    }[] = [];

    // Use RenderSpec if provided
    if (options.spec) {
      console.log("[FFmpeg] Using RenderSpec for timing");
      options.spec.sequence.forEach((item, idx) => {
        const fps = options.spec!.fps;
        timelineClips.push({
          startTime: item.startFrame / fps,
          endTime: (item.startFrame + item.durationInFrames) / fps,
          videoId: idx,
          rank: item.clip.slotIndex,
        });
      });
    } else {
      throw new Error("RenderSpec is required for video generation.");
    }

    // Process each video
    for (let i = 0; i < options.videos.length; i++) {
      const video = options.videos[i];
      if (!video) continue;
      const clipInfo = timelineClips[i];
      if (!clipInfo) continue;

      const inputPath = path.resolve(video.filePath).replace(/\\/g, "/");
      const outputPathNative = path.resolve(
        tempDir,
        `processed-${video.rank}.mp4`
      );
      const outputPath = outputPathNative.replace(/\\/g, "/");

      console.log(`Processing video ${video.rank}...`);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input video file not found: ${inputPath}`);
      }

      // Pre-process meme sounds
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

            await downloadFile(sound.file, localSoundPath);
            processedMemeSounds.push({
              ...sound,
              file: localSoundPath,
            });
          } catch (err) {
            console.error(`Failed to download sound ${sound.file}:`, err);
          }
        } else {
          processedMemeSounds.push(sound);
        }
      }

      // Async inputs metadata
      const metadata = await getVideoMetadata(inputPath);
      // We don't check hasAudio strict here, we try to map streams if present.

      const videoFilters: string[] = [];
      const emojiConfigs: EmojiOverlayConfig[] = [];

      // 1. Trim/Crop/Scale
      const trimStart = video.trimStart ?? 0;
      const trimEnd = video.trimEnd;

      let trimFilter = "";
      if (trimEnd && trimEnd > trimStart) {
        trimFilter = `trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS`;
      } else {
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

      // Scale & Fill & Pad
      videoFilters.push(
        `scale=${width}:${videoHeight}:force_original_aspect_ratio=increase`
      );
      videoFilters.push(
        `crop=${width}:${videoHeight}:(iw-${width})/2:(ih-${videoHeight})/2`
      );
      videoFilters.push(`pad=${width}:${height}:0:${titleHeight}:black`);

      // 2. Overlays
      // Main Title (Always visible)
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
      for (const e of mainTitleRes.emojis) {
        try {
          const emojiPath = await getEmojiPath(e.codepoint);
          emojiConfigs.push({
            emojiPath,
            x: e.x,
            y: e.y,
            width: e.size,
            height: e.size,
            inputIndex: -1,
          });
        } catch (err) {
          console.error(`Failed to load emoji ${e.codepoint}:`, err);
        }
      }

      // Ranking Titles Intersection Logic
      // "Titles must appear only during each clip’s active frames"
      for (const otherClip of timelineClips) {
        // Check visibility
        const isCurrent = otherClip.rank === video.rank;

        const yPos = rankingStartY + (otherClip.rank - 1) * rankingItemHeight;
        const numColor = isCurrent ? "yellow" : "white";

        // Always show Slot Number
        videoFilters.push(
          `drawtext=fontfile='${rankingFont}':text='${otherClip.rank}.':fontsize=52:fontcolor=${numColor}:x=30:y=${yPos}:borderw=3:bordercolor=black`
        );

        // Show Title ONLY if current
        if (isCurrent) {
          const refVideo = options.videos[otherClip.videoId];
          if (!refVideo) continue;

          const titleSegs = refVideo.title;
          const fontSize = titleSegs[0]?.fontSize || 52;
          const titleRes = createFormattedTextFiltersWithEmojis(
            titleSegs,
            90,
            yPos + 4,
            rankingFont,
            "yellow",
            fontSize,
            "black",
            3
          );
          videoFilters.push(...titleRes.textFilters);
          for (const e of titleRes.emojis) {
            try {
              const ep = await getEmojiPath(e.codepoint);
              emojiConfigs.push({
                emojiPath: ep,
                x: e.x,
                y: e.y,
                width: e.size,
                height: e.size,
                inputIndex: -1,
              });
            } catch (err) {}
          }
        }
      }

      // Execute FFmpeg
      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(inputPath);
        const complexFilters: string[] = [];

        // Audio Inputs
        const memeSounds = processedMemeSounds;
        if (memeSounds.length > 0) {
          memeSounds.forEach((s) => command.input(s.file));
        }

        // Emoji Inputs
        const startEmojiInputIndex = 1 + memeSounds.length;
        emojiConfigs.forEach((cfg, idx) => {
          cfg.inputIndex = startEmojiInputIndex + idx;
          command.input(cfg.emojiPath).inputOption(["-loop 1"]);
        });

        // Video Chain
        const hasEmojis = emojiConfigs.length > 0;
        const textOutLabel = hasEmojis ? "v_text" : "outv";
        complexFilters.push(`[0:v]${videoFilters.join(",")}[${textOutLabel}]`);

        if (hasEmojis) {
          const emojiRes = createEmojiOverlayFilters(
            emojiConfigs,
            "v_text",
            startEmojiInputIndex
          );
          complexFilters.push(...emojiRes.scaleFilters);
          complexFilters.push(...emojiRes.overlayFilters);
          complexFilters.push(`[${emojiRes.finalOutputLabel}]null[outv]`);
        }

        // Audio Chain
        let hasInputAudio = false;
        // We really should check standard metadata for audio.
        // For robustness, we assume if we can't probe audio, we pad.
        // But for filters, we need to know if [0:a] is valid.
        // 'getVideoMetadata' doesn't return stream info fully.
        // Let's assume input has audio for simplicty, OR try/catch filter issues?
        // Better: check metadata.streams (requires modifying getVideoMetadata or inline probe)
        // We'll rely on the existing try/catch around the process helper if needed.
        // Or assume Input always has audio? No.

        // Let's just generate strict silence source if no audio is confirmed?
        // Actually, let's use the 'anullsrc' approach for robustness if unsure,
        // BUT we need to mix original audio if present.

        // Given I can't easily check hasAudio with the provided helper (it returns bool-ish logic upstream?),
        // I will use `amix` with `anullsrc` which is safe even if 0:a is missing?
        // No, referencing [0:a] fails if no audio stream.

        // I will assume the input MIGHT have audio.
        // Since I can't check easily without re-probing, I'll reuse the logic from previous implementation if I recall it:
        // it probed `metadata.streams`.
        // I will use `metadata` which I fetched above (but I typed it to limit props).
        // Wait, `await getVideoMetadata(inputPath)` returns `{duration, width, height}`.
        // To be safe, I will re-probe or assume audio exists.
        // Actually, FFmpeg command fails fast if stream missing.
        // I will insert a check.

        // Re-probe full metadata strictly for audio check
        ffmpeg.ffprobe(inputPath, (err, data) => {
          const hasAudioStream =
            !err && data.streams.some((s) => s.codec_type === "audio");

          // Construct Audio Filter Block
          if (hasAudioStream) {
            // Trim Audio
            const atrim = trimEnd
              ? `[0:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo[a_trimmed]`
              : `[0:a]atrim=start=${trimStart},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo[a_trimmed]`;
            complexFilters.push(atrim);
          } else {
            // Generate Silence matching video duration (approx)
            complexFilters.push(
              `anullsrc=channel_layout=stereo:sample_rate=44100[a_trimmed]`
            );
            // Note: anullsrc is infinite, we need to trim it to video length?
            // ffmpeg -shortest handles output duration cut.
          }

          let finalAudioMap = "[a_trimmed]";

          if (memeSounds.length > 0) {
            const mixInputs = ["[a_trimmed]"];
            let idx = 1;
            memeSounds.forEach((s) => {
              const d = Math.round(s.startTime * 1000);
              complexFilters.push(
                `[${idx}:a]aresample=44100,volume=${s.volume},adelay=${d}|${d}[d${idx}]`
              );
              mixInputs.push(`[d${idx}]`);
              idx++;
            });
            complexFilters.push(
              `${mixInputs.join("")}amix=inputs=${
                mixInputs.length
              }:duration=first:dropout_transition=0[outa]`
            );
            finalAudioMap = "[outa]";
          }

          command
            .complexFilter(complexFilters)
            .outputOptions([
              "-map",
              "[outv]",
              "-map",
              finalAudioMap,
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
            .on("end", () => {
              console.log(`Successfully processed video ${video.rank}`);
              processedVideos.push(outputPath);
              resolve();
            })
            .on("error", (err, stdout, stderr) => {
              console.error(`Error processing video ${video.rank}:`, err);
              console.error(stderr);
              reject(err);
            })
            .run();
        });
      });
    }

    // Concatenate
    const fileListPath = path.resolve(tempDir, "filelist.txt");
    const fileListContent = processedVideos
      .map((p) => `file '${p}'`)
      .join("\n");
    fs.writeFileSync(fileListPath, fileListContent);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
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

// Helper: Download File
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            downloadFile(response.headers.location, dest)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error("Redirect without location"));
          }
          return;
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

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
