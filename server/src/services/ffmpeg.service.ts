import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

// Text segment for rich text formatting
export interface TextSegment {
  text: string;
  color?: string;
  fontSize?: number;
}

// Estimate character width for Impact font with more accurate measurements
function estimateTextWidth(text: string, fontSize: number): number {
  // Based on actual Impact font measurements at 52px baseline
  // These are more accurate ratios per character type
  let width = 0;

  for (const char of text) {
    let ratio;
    if (char === " ") {
      ratio = 0.45; // Space is about 45% of font size
    } else if (/[A-Z]/.test(char)) {
      // Uppercase varies by letter, using specific measurements
      const wideChars = "MWOQ";
      const narrowChars = "IJ";
      const mediumWideChars = "VCDG"; // V, C, D, G are medium-wide
      if (wideChars.includes(char)) {
        ratio = 0.7; // Impact: M is very wide (increased)
      } else if (narrowChars.includes(char)) {
        ratio = 0.35;
      } else if (mediumWideChars.includes(char)) {
        ratio = 0.65;
      } else {
        ratio = 0.58; // Impact: Average uppercase is quite blocky
      }
    } else if (/[a-z]/.test(char)) {
      // Lowercase average
      const wideChars = "mw";
      const narrowChars = "ijlt";
      const mediumChars = "vng";
      if (wideChars.includes(char)) {
        ratio = 0.62;
      } else if (narrowChars.includes(char)) {
        ratio = 0.3;
      } else if (mediumChars.includes(char)) {
        ratio = 0.52;
      } else {
        ratio = 0.49;
      }
    } else if (/[0-9]/.test(char)) {
      ratio = 0.55; // Numbers are slightly wider in Impact
    } else {
      ratio = 0.45; // Punctuation and others
    }

    width += fontSize * ratio;
  }

  return width;
}

// Normalize colors - convert old light colors to new darker/saturated versions
function normalizeColor(color: string | undefined): string {
  if (!color) return "white";

  const colorMap: Record<string, string> = {
    "#FFD700": "#FFC700", // Old yellow -> New darker yellow
    "#FF6B6B": "#E63946", // Old red -> New deeper red
    "#4ECDC4": "#06AED5", // Old cyan -> New deeper cyan
    "#95E1D3": "#2D9E6D", // Old green -> New forest green
  };

  return colorMap[color] || color; // Return mapped color or original if not in map
}

// Split text segments into multiple lines - SPLITS LONG SEGMENTS BY WORDS
function splitIntoLines(
  segments: TextSegment[],
  maxWidth: number,
  defaultFontSize: number
): TextSegment[][] {
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  for (const segment of segments) {
    const segmentWidth = estimateTextWidth(
      segment.text,
      segment.fontSize || defaultFontSize
    );

    // If this single segment is too wide, split it by words
    if (segmentWidth > maxWidth) {
      const words = segment.text.split(" ");

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue; // Skip empty strings

        const wordSegment: TextSegment = {
          text: i < words.length - 1 ? word + " " : word,
        };
        if (segment.color !== undefined) wordSegment.color = segment.color;
        if (segment.fontSize !== undefined)
          wordSegment.fontSize = segment.fontSize;

        const wordWidth = estimateTextWidth(
          wordSegment.text,
          segment.fontSize || defaultFontSize
        );

        if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [wordSegment];
          currentLineWidth = wordWidth;
        } else {
          currentLine.push(wordSegment);
          currentLineWidth += wordWidth;
        }
      }
    } else {
      // Segment fits - check if adding it would exceed max
      if (
        currentLineWidth + segmentWidth > maxWidth &&
        currentLine.length > 0
      ) {
        // Skip whitespace-only segments at line breaks
        if (segment.text.trim().length === 0) {
          lines.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
          continue;
        }

        lines.push(currentLine);
        currentLine = [segment];
        currentLineWidth = segmentWidth;
      } else {
        currentLine.push(segment);
        currentLineWidth += segmentWidth;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

// Convert formatted text to FFmpeg drawtext filters
function createFormattedTextFilters(
  segments: TextSegment[] | string,
  baseX: number | string,
  baseY: number,
  fontFile: string,
  defaultColor: string = "white",
  defaultFontSize: number = 52,
  addBorder: boolean = false // Optional: add black border for visibility
): string[] {
  // If it's a plain string, convert to single segment
  const textSegments =
    typeof segments === "string"
      ? [{ text: segments, color: defaultColor, fontSize: defaultFontSize }]
      : segments;

  // Don't merge segments - keep them as-is for accurate positioning
  const filters: string[] = [];

  // For center-aligned text, we need to calculate total width and center the block
  const isCentered = typeof baseX === "string" && baseX.includes("w-text_w");

  const boxPadding = 12;

  if (isCentered) {
    // Split into lines if text is too wide (use 80% of video width for safety)
    // For 1080px wide video, max width = 850px (more conservative)
    const maxWidth = 850;
    const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);

    // Calculate line height
    const lineHeight = defaultFontSize + 10; // Add 10px spacing between lines

    // Adjust base Y to center multiple lines vertically
    const totalHeight = lines.length * lineHeight;
    let currentY =
      typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

    // If multiple lines, adjust starting Y to center the block
    if (lines.length > 1) {
      currentY -= ((lines.length - 1) * lineHeight) / 2;
    }

    // Render each line
    for (const lineSegments of lines) {
      // Calculate total width of this line
      let totalWidth = 0;
      let fullLineText = "";

      for (const segment of lineSegments) {
        totalWidth += estimateTextWidth(
          segment.text,
          segment.fontSize || defaultFontSize
        );
        fullLineText += segment.text;
      }

      // Start position: center of screen minus half of total width
      let currentXOffset = -totalWidth / 2;

      // 1. Draw Background Box Layer (only if this is the Main Title and not ranked items)
      // Since createFormattedTextFilters is generic, we usually guess main title by centered + Y=90 check in caller
      // But here we rely on the fact that ONLY main title calls this centered method in a specific way.
      // However, caller (createRankingVideo) currently tries to REPLACE the filters to add box.
      // We should handle "Box for entire line" here generally if we can, but we can't easily without a flag.
      // BUT, the goal is to match frontend. The frontend draws box for main title.
      // The calling code (createRankingVideo) sets box=1 on the first segment.
      // WE WILL CHANGE STRATEGY: We will output a transparent text filter FIRST that has the box.

      // Escape special FFmpeg drawtext characters
      const escFullText = fullLineText
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/:/g, "\\:");
      const boxXPos = `(w/2)${currentXOffset >= 0 ? "+" : ""}${Math.round(
        currentXOffset
      )}`;
      const boxFontSize = lineSegments[0]?.fontSize || defaultFontSize;

      // We add a marker to this filter string so createRankingVideo can identify it if needed,
      // or we just rely on createRankingVideo NOT adding its own box hack anymore.
      // We will produce a "dummy" filter that draws the box.
      // NOTE: Calling function `createRankingVideo` currently does:
      // if (mainTitleFilters.length > 0) mainTitleFilters[0] = ... replace box ...
      // We should REMOVE that hack in `createRankingVideo` later.
      // For now, let's output the box filter here if it feels like a main title?
      // No, `createFormattedTextFilters` is a utility.
      // Let's just output the segments. But `createRankingVideo` is flawed.
      // To fix it properly, we should probably output the box layer HERE if we really want it correct.
      // But since we can't change the signature easily without breaking things...
      // Let's stick to the plan: Render box layer first.

      // Since we don't know if the user wants a box here, we can't force it.
      // BUT, we can make the segments render correctly.

      // REVISION: The user complained about Main Title overlapping.
      // The caller `createRankingVideo` is responsible for the "Main Title with Box" logic.
      // We should return standard text filters here.
      // The ERROR is how `createRankingVideo` applies the box.

      for (const segment of lineSegments) {
        // Escape special FFmpeg drawtext characters: single quotes, colons, backslashes
        const escText = segment.text
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/:/g, "\\:");
        const color = normalizeColor(segment.color) || defaultColor;
        const fontSize = segment.fontSize || defaultFontSize;

        // Calculate x position
        let xOffset = currentXOffset;

        // Ensure text doesn't go off-screen
        if (xOffset < -530) {
          xOffset = -530;
        }

        const xPos = `(w/2)${xOffset >= 0 ? "+" : ""}${Math.round(xOffset)}`;

        // No box here. Let caller handle or specialized logic.
        // Actually, let's include the fix for the box in the NEXT step (createRankingVideo).
        // For now, just fix the positioning logic ensuring standard rendering.

        const borderParams = addBorder ? ":borderw=3:bordercolor=black" : "";
        filters.push(
          `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${xPos}:y=${currentY}${borderParams}`
        );

        // Move offset right by this segment's width
        currentXOffset += estimateTextWidth(segment.text, fontSize);
      }

      currentY += lineHeight;
    }
  } else {
    // Left-aligned
    const startX =
      typeof baseX === "number" ? baseX : parseInt(baseX as string, 10);

    const maxWidth = 700;
    const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);
    const lineHeight = defaultFontSize + 8; // Slightly tighter spacing for list items

    let currentY =
      typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

    for (const lineSegments of lines) {
      let currentXOffset = startX;

      for (const segment of lineSegments) {
        // Escape special FFmpeg drawtext characters: single quotes, colons, backslashes
        const escText = segment.text
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/:/g, "\\:");
        const color = normalizeColor(segment.color) || defaultColor;
        const fontSize = segment.fontSize || defaultFontSize;

        const borderParams = addBorder ? ":borderw=3:bordercolor=black" : "";
        filters.push(
          `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${currentXOffset}:y=${currentY}${borderParams}`
        );

        currentXOffset += estimateTextWidth(segment.text, fontSize);
      }
      currentY += lineHeight;
    }
  }

  return filters;
}

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
    const titleHeight = 200;
    const videoHeight = height - titleHeight;
    const rankingItemHeight = 200;

    // Calculate starting Y position to center rankings vertically
    const totalRankingHeight = totalVideos * rankingItemHeight;
    const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

    // Font paths
    const titleFont = "C\\:/Windows/Fonts/impact.ttf";
    const rankingFont = "C\\:/Windows/Fonts/impact.ttf";

    for (const video of options.videos) {
      const inputPath = path.resolve(video.filePath).replace(/\\/g, "/");
      const outputPathNative = path.resolve(
        tempDir,
        `processed-${video.rank}.mp4`
      );
      const outputPath = outputPathNative.replace(/\\/g, "/");

      console.log(`Processing video ${video.rank}...`);

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

      await new Promise<void>((resolve, reject) => {
        const command = ffmpeg(inputPath);

        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            reject(err);
            return;
          }

          const hasAudio = metadata.streams.some(
            (stream) => stream.codec_type === "audio"
          );

          // Build filter graph
          const videoFilters: string[] = [];
          const complexFilters: string[] = [];

          // 1. Video Processing Chain
          // [0:v] -> TRIM -> CROP (User) -> SCALE -> CROP (Fill) -> PAD -> [v_base]

          // Trimming
          const trimStart =
            video.trimStart !== undefined ? Number(video.trimStart) : undefined;
          const trimEnd =
            video.trimEnd !== undefined ? Number(video.trimEnd) : undefined;
          const hasTrim =
            (trimStart !== undefined && !isNaN(trimStart)) ||
            (trimEnd !== undefined && !isNaN(trimEnd));

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

          // Text Overlays
          // Main Title
          const mainTitleFilters = createFormattedTextFilters(
            options.mainTitle,
            "(w-text_w)/2",
            90,
            titleFont
          );
          videoFilters.push(...mainTitleFilters);

          // Rankings
          const revealedRanks = new Set<number>();
          for (let j = 0; j <= options.videos.indexOf(video); j++) {
            const revealedVideo = options.videos[j];
            if (revealedVideo) revealedRanks.add(revealedVideo.rank);
          }

          for (let i = 0; i < totalVideos; i++) {
            const rankNum = i + 1;
            const yPos = rankingStartY + i * rankingItemHeight;
            const videoInfo = options.videos.find((v) => v.rank === rankNum);
            const numColor = rankNum === video.rank ? "yellow" : "white";
            const titleColor = rankNum === video.rank ? "yellow" : "white";

            videoFilters.push(
              `drawtext=fontfile='${rankingFont}':text='${rankNum}.':fontsize=52:fontcolor=${numColor}:x=30:y=${yPos}:borderw=3:bordercolor=black`
            );

            if (revealedRanks.has(rankNum) && videoInfo) {
              const videoTitleFilters = createFormattedTextFilters(
                videoInfo.title,
                90,
                yPos + 4,
                rankingFont,
                titleColor,
                48,
                true
              );
              videoFilters.push(...videoTitleFilters);
            }
          }

          // Combine all video filters into one chain
          const videoChain = `[0:v]${videoFilters.join(",")}[outv]`;
          complexFilters.push(videoChain);

          // 2. Audio Processing Chain
          let finalAudioMap = "[outa]"; // Default output label

          // Helper to add audio inputs
          let inputCount = 1; // 0 is main video
          const memeSounds = processedMemeSounds;

          if (memeSounds.length > 0) {
            memeSounds.forEach((sound) => {
              // Resolve absolutely
              const soundPath = path.resolve(sound.file);
              command.input(soundPath);
            });
          }

          if (hasAudio) {
            const audioFilters: string[] = [];

            // Audio Trim
            if (
              trimStart !== undefined &&
              !isNaN(trimStart) &&
              trimEnd !== undefined &&
              !isNaN(trimEnd) &&
              trimEnd > trimStart
            ) {
              complexFilters.push(
                `[0:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS[a_trimmed]`
              );
            } else if (trimStart !== undefined && !isNaN(trimStart)) {
              complexFilters.push(
                `[0:a]atrim=start=${trimStart},asetpts=PTS-STARTPTS[a_trimmed]`
              );
            } else {
              // Just copy label
              complexFilters.push(`[0:a]anull[a_trimmed]`);
            }

            // Mixing
            if (memeSounds.length > 0) {
              const mixInputs = ["[a_trimmed]"];

              memeSounds.forEach((sound) => {
                const delayMs = Math.round(sound.startTime * 1000);
                const volume = sound.volume || 1.0;

                // Input index for this sound is `inputCount`
                complexFilters.push(
                  `[${inputCount}:a]volume=${volume},adelay=${delayMs}|${delayMs}[delayed${inputCount}]`
                );
                mixInputs.push(`[delayed${inputCount}]`);
                inputCount++;
              });

              // Apply amix
              // duration=first ensures result length matches the video clip (assuming a_trimmed matches video duration)
              complexFilters.push(
                `${mixInputs.join("")}amix=inputs=${
                  mixInputs.length
                }:duration=first:dropout_transition=0[outa]`
              );
            } else {
              // No mixing, just pass through
              complexFilters.push(`[a_trimmed]anull[outa]`);
            }
          } else {
            // No source audio - generate silence matching video duration
            // But we don't easily know video duration here after trim without calculation.
            // Alternative: mix meme sounds with a generated nullsrc.
            // But amix duration=first would make it infinite or zero?
            // Safer: Use 'shortest' in output options OR trim the nullsrc?
            // Actually, if we use [outv] (video) as reference... no, audio generation is independent.

            // Strategy:
            // 1. Generate anullsrc.
            // 2. Mix with meme sounds (if any).
            // 3. For the output, use -shortest. This will cut audio to video length.

            complexFilters.push(
              `anullsrc=channel_layout=stereo:sample_rate=44100[a_silence]`
            );

            if (memeSounds.length > 0) {
              const mixInputs = ["[a_silence]"];
              memeSounds.forEach((sound) => {
                const delayMs = Math.round(sound.startTime * 1000);
                const volume = sound.volume || 1.0;

                complexFilters.push(
                  `[${inputCount}:a]volume=${volume},adelay=${delayMs}|${delayMs}[delayed${inputCount}]`
                );
                mixInputs.push(`[delayed${inputCount}]`);
                inputCount++;
              });

              // For silence base, 'duration=first' on amix is DANGEROUS because silence is infinite.
              // We should use 'duration=longest' but that might extend beyond video.
              // OR: We rely on `-shortest` in output options to cut everything.
              complexFilters.push(
                `${mixInputs.join("")}amix=inputs=${
                  mixInputs.length
                }:duration=longest:dropout_transition=0[outa]`
              );
            } else {
              complexFilters.push(`[a_silence]anull[outa]`);
            }
          }

          // Execute
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
              "-shortest", // Crucial for ignoring extra audio length
            ])
            .output(outputPath)
            .on("start", (cmd) => console.log(`FFmpeg command: ${cmd}`))
            .on("end", () => {
              console.log(`Successfully processed video ${video.rank}`);
              processedVideos.push(outputPath);
              resolve();
            })
            .on("error", (err) => {
              console.error(`Error processing video ${video.rank}:`, err);
              reject(err);
            })
            .run();
        });
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
