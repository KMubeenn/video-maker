import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

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
      ratio = 0.45; // Space is about 45% of font size (increased for better spacing)
    } else if (/[A-Z]/.test(char)) {
      // Uppercase varies by letter, using specific measurements
      const wideChars = "MWOQ";
      const narrowChars = "IJ";
      const mediumWideChars = "VCDG"; // V, C, D, G are medium-wide
      if (wideChars.includes(char)) {
        ratio = 0.65;
      } else if (narrowChars.includes(char)) {
        ratio = 0.35;
      } else if (mediumWideChars.includes(char)) {
        ratio = 0.62;
      } else {
        ratio = 0.54; // Average uppercase
      }
    } else if (/[a-z]/.test(char)) {
      // Lowercase average
      const wideChars = "mw";
      const narrowChars = "ijlt";
      const mediumChars = "vng";
      if (wideChars.includes(char)) {
        ratio = 0.58;
      } else if (narrowChars.includes(char)) {
        ratio = 0.28;
      } else if (mediumChars.includes(char)) {
        ratio = 0.5;
      } else {
        ratio = 0.47;
      }
    } else if (/[0-9]/.test(char)) {
      ratio = 0.52; // Numbers are fairly consistent
    } else {
      ratio = 0.4; // Punctuation and others
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
      for (const segment of lineSegments) {
        totalWidth += estimateTextWidth(
          segment.text,
          segment.fontSize || defaultFontSize
        );
      }

      // Start position: center of screen minus half of total width
      let currentXOffset = -totalWidth / 2;

      for (const segment of lineSegments) {
        const escText = segment.text.replace(/'/g, "\\'");
        const color = normalizeColor(segment.color) || defaultColor;
        const fontSize = segment.fontSize || defaultFontSize;

        // Calculate x position
        let xOffset = currentXOffset;

        // Ensure text doesn't go off-screen (min x = 10, max x = w-10)
        // For centered text: (w/2) + offset should be >= 10
        // This means offset >= 10 - (w/2) = 10 - 540 = -530 for 1080px width
        if (xOffset < -530) {
          xOffset = -530; // Prevent going off left edge
        }

        // Position this segment
        const xPos = `(w/2)${xOffset >= 0 ? "+" : ""}${Math.round(xOffset)}`;

        const borderParams = addBorder ? ":borderw=3:bordercolor=black" : "";
        filters.push(
          `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${xPos}:y=${currentY}${borderParams}`
        );

        // Move offset right by this segment's width (no buffers)
        currentXOffset += estimateTextWidth(segment.text, fontSize);
      }

      // Move to next line
      currentY += lineHeight;
    }
  } else {
    // For left-aligned or absolute positioning - also support wrapping
    const startX =
      typeof baseX === "number" ? baseX : parseInt(baseX as string, 10);

    // For left-aligned text, limit width so it doesn't cover too much of the video
    // Use a conservative max width of 600px to leave video visible
    const maxWidth = 700;
    const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);

    // Calculate line height
    const lineHeight = defaultFontSize + 8; // Slightly tighter spacing for list items

    let currentY =
      typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

    // Render each line
    for (const lineSegments of lines) {
      let currentXOffset = startX;

      for (const segment of lineSegments) {
        const escText = segment.text.replace(/'/g, "\\'");
        const color = normalizeColor(segment.color) || defaultColor;
        const fontSize = segment.fontSize || defaultFontSize;

        const borderParams = addBorder ? ":borderw=3:bordercolor=black" : "";
        filters.push(
          `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${currentXOffset}:y=${currentY}${borderParams}`
        );

        // Move position right for next segment (no buffers)
        currentXOffset += estimateTextWidth(segment.text, fontSize);
      }

      // Move to next line
      currentY += lineHeight;
    }
  }

  return filters;
}

export function addTitleToVideo(
  inputPath: string,
  title: string,
  outputFilename: string
): Promise<string> {
  const outputsDir = path.join("outputs");
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  const outputPath = path.join(outputsDir, outputFilename);

  return new Promise((resolve, reject) => {
    // Build the drawtext filter as a string
    const drawtextFilter = `drawtext=fontfile='C\\\\:/Windows/Fonts/Arial.ttf':text='${title.replace(
      /'/g,
      "\\'"
    )}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=40:shadowcolor=black:shadowx=2:shadowy=2`;

    ffmpeg(inputPath)
      .videoFilters(drawtextFilter)
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

/**
 * Concatenate multiple videos into a single video
 * Uses concat filter with re-encoding to prevent audio overlap issues
 */
export function concatenateVideos(
  inputPaths: string[],
  outputFilename: string
): Promise<string> {
  const outputsDir = path.join("outputs");
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  const outputPath = path.join(outputsDir, outputFilename);

  // Create file list for concat protocol
  const fileListPath = path.join(outputsDir, `filelist-${Date.now()}.txt`);
  const fileListContent = inputPaths
    .map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`)
    .join("\n");

  fs.writeFileSync(fileListPath, fileListContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(fileListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions([
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
      ])
      .output(outputPath)
      .on("start", (cmd) => {
        console.log("FFmpeg command:", cmd);
      })
      .on("progress", (progress) => {
        console.log(`Processing: ${JSON.stringify(progress)}`);
      })
      .on("end", () => {
        // Clean up the temporary file list
        if (fs.existsSync(fileListPath)) {
          fs.unlinkSync(fileListPath);
        }
        console.log("Video concatenation completed:", outputPath);
        resolve(outputPath);
      })
      .on("error", (err) => {
        // Clean up the temporary file list
        if (fs.existsSync(fileListPath)) {
          fs.unlinkSync(fileListPath);
        }
        console.error("FFmpeg error:", err);
        reject(err);
      })
      .run();
  });
}

export interface RankingVideoInput {
  filePath: string;
  title: TextSegment[]; // Changed to TextSegment[]
  rank: number;
}

export interface RankingVideoOptions {
  mainTitle: TextSegment[]; // Changed to TextSegment[]
  videos: RankingVideoInput[];
  width?: number;
  height?: number;
}

/**
 * Create a ranking video with main title and individual video titles
 */
export async function createRankingVideo(
  options: RankingVideoOptions,
  outputFilename: string
): Promise<string> {
  const outputsDir = path.join("outputs");
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  const finalOutputPath = path.join(outputsDir, outputFilename);
  const tempDir = path.join(outputsDir, `temp-${Date.now()}`);

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
    const titleHeight = 200; // Height reserved for title at top
    const videoHeight = height - titleHeight; // Video goes below title
    const rankingItemHeight = 200; // Fixed spacing between ranking items

    // Calculate starting Y position to center rankings vertically
    const totalRankingHeight = totalVideos * rankingItemHeight;
    const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

    // Font paths - change these to use different fonts
    // Common fonts: Arial.ttf, arialbd.ttf (bold), impact.ttf, calibri.ttf, etc.
    const titleFont = "C\\:/Windows/Fonts/impact.ttf"; // Impact for main title
    const rankingFont = "C\\:/Windows/Fonts/impact.ttf"; // Impact for rankings

    for (const video of options.videos) {
      const inputPath = path.resolve(video.filePath);
      const outputPath = path.join(tempDir, `processed-${video.rank}.mp4`);

      // Build filters
      const filters: string[] = [];

      // 1. Scale video to fill full width (may crop top/bottom)
      filters.push(
        `scale=${width}:${videoHeight}:force_original_aspect_ratio=increase`
      );

      // 2. Crop to exact size if video is larger after scaling
      filters.push(
        `crop=${width}:${videoHeight}:(iw-${width})/2:(ih-${videoHeight})/2`
      );

      // 3. Pad to full canvas - video positioned below title area
      filters.push(`pad=${width}:${height}:0:${titleHeight}:black`);

      // 4. Add main title at the top center with background box using formatted text
      const mainTitleFilters = createFormattedTextFilters(
        options.mainTitle,
        "(w-text_w)/2",
        90,
        titleFont
      );
      // Add box background to first segment only
      if (mainTitleFilters.length > 0 && mainTitleFilters[0]) {
        mainTitleFilters[0] = mainTitleFilters[0].replace(
          `:y=90`,
          `:y=90:box=1:boxcolor=black@0.6:boxborderw=12`
        );
      }
      filters.push(...mainTitleFilters);

      // 5. Add all ranking numbers on the left (centered vertically)
      // Track which ranks have been revealed so far (based on playback order, not rank order)
      const revealedRanks = new Set<number>();
      for (let j = 0; j <= options.videos.indexOf(video); j++) {
        const revealedVideo = options.videos[j];
        if (revealedVideo) {
          revealedRanks.add(revealedVideo.rank);
        }
      }

      for (let i = 0; i < totalVideos; i++) {
        const rankNum = i + 1;
        const yPos = rankingStartY + i * rankingItemHeight;
        const videoInfo = options.videos.find((v) => v.rank === rankNum);

        // Determine color - yellow for current video, white for others
        const numColor = rankNum === video.rank ? "yellow" : "white";
        const titleColor = rankNum === video.rank ? "yellow" : "white";

        // Add rank number (always visible) with black border for visibility
        filters.push(
          `drawtext=fontfile='${rankingFont}':text='${rankNum}.':fontsize=52:fontcolor=${numColor}:x=30:y=${yPos}:borderw=3:bordercolor=black`
        );

        // Add title text (only show for videos that have been revealed so far) using formatted text
        if (revealedRanks.has(rankNum) && videoInfo) {
          const videoTitleFilters = createFormattedTextFilters(
            videoInfo.title,
            90,
            yPos + 4,
            rankingFont,
            titleColor,
            48,
            true // Add black border for visibility
          );
          filters.push(...videoTitleFilters);
        }
      }

      console.log(`Processing video ${video.rank}...`);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters(filters)
          .audioCodec("aac")
          .audioBitrate("128k")
          .videoCodec("libx264")
          .outputOptions(["-preset", "ultrafast", "-crf", "28"])
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
    }

    // Create file list for concatenation
    const fileListPath = path.join(tempDir, "filelist.txt");
    const fileListContent = processedVideos
      .map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`)
      .join("\n");
    fs.writeFileSync(fileListPath, fileListContent);

    console.log("File list content:");
    console.log(fileListContent);

    // Concatenate videos using concat protocol with re-encoding
    // This is more reliable than concat filter for handling different video properties
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions([
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "28",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
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

    // Clean up temp folder
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
export async function generateRankingPreview(
  inputVideoPath: string,
  options: {
    mainTitle: TextSegment[]; // Changed from string to TextSegment[]
    videoTitle: TextSegment[]; // Changed from string to TextSegment[]
    rank: number;
    totalVideos: number;
    allVideoTitles: TextSegment[][]; // Changed from string[] to TextSegment[][]
    width?: number;
    height?: number;
  }
): Promise<string> {
  const outputsDir = path.join("outputs");
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  const previewsDir = path.join(outputsDir, "previews");
  if (!fs.existsSync(previewsDir)) {
    fs.mkdirSync(previewsDir, { recursive: true });
  }

  const outputFilename = `preview-${options.rank}-${Date.now()}.mp4`;
  const outputPath = path.join(previewsDir, outputFilename);

  const width = options.width || 1080;
  const height = options.height || 1920;
  const totalVideos = options.totalVideos;

  // Layout constants (same as createRankingVideo)
  const titleHeight = 200;
  const videoHeight = height - titleHeight;
  const rankingItemHeight = 200;
  const totalRankingHeight = totalVideos * rankingItemHeight;
  const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

  const titleFont = "C\\:/Windows/Fonts/impact.ttf";
  const rankingFont = "C\\:/Windows/Fonts/impact.ttf";

  // Build filters (exact same as createRankingVideo)
  const filters: string[] = [];

  // 1. Scale video to fill full width
  filters.push(
    `scale=${width}:${videoHeight}:force_original_aspect_ratio=increase`
  );

  // 2. Crop to exact size
  filters.push(
    `crop=${width}:${videoHeight}:(iw-${width})/2:(ih-${videoHeight})/2`
  );

  // 3. Pad to full canvas - video positioned below title area
  filters.push(`pad=${width}:${height}:0:${titleHeight}:black`);

  // 4. Add main title at the top center with background box using formatted text
  const mainTitleFilters = createFormattedTextFilters(
    options.mainTitle,
    "(w-text_w)/2",
    90,
    titleFont
  );
  // Add box background to first segment only
  if (mainTitleFilters.length > 0 && mainTitleFilters[0]) {
    mainTitleFilters[0] = mainTitleFilters[0].replace(
      `:y=90`,
      `:y=90:box=1:boxcolor=black@0.6:boxborderw=12`
    );
  }
  filters.push(...mainTitleFilters);

  // 5. Add all ranking numbers and titles (same logic as createRankingVideo)
  for (let i = 0; i < totalVideos; i++) {
    const rankNum = i + 1;
    const yPos = rankingStartY + i * rankingItemHeight;
    const videoTitleSegments = options.allVideoTitles[i] || [];

    // Determine color - yellow for current video, white for others
    const numColor = rankNum === options.rank ? "yellow" : "white";
    const titleColor = rankNum === options.rank ? "yellow" : "white";

    // Add rank number (always visible)
    filters.push(
      `drawtext=fontfile='${rankingFont}':text='${rankNum}.':fontsize=52:fontcolor=${numColor}:x=30:y=${yPos}`
    );

    // Add title text (only show for current and previous videos) using formatted text
    if (rankNum <= options.rank && videoTitleSegments.length > 0) {
      const videoTitleFilters = createFormattedTextFilters(
        videoTitleSegments,
        90,
        yPos + 4,
        rankingFont,
        titleColor,
        48
      );
      filters.push(...videoTitleFilters);
    }
  }

  console.log(`Generating preview for rank ${options.rank}...`);

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputVideoPath)
      .videoFilters(filters)
      .outputOptions([
        "-c:v libx264",
        "-preset medium",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
      ])
      .output(outputPath)
      .on("start", (cmd) => console.log(`FFmpeg preview command: ${cmd}`))
      .on("end", () => {
        console.log(`Preview generated successfully: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error(`Error generating preview:`, err);
        reject(err);
      })
      .run();
  });
}
