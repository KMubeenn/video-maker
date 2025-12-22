import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

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
    const drawtextFilter = `drawtext=fontfile='C\\:/Windows/Fonts/Arial.ttf':text='${title.replace(
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

  // Create a temporary file list for FFmpeg concat demuxer
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
        "-c copy", // Copy streams without re-encoding for faster processing
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
  title: string;
  rank: number;
}

export interface RankingVideoOptions {
  mainTitle: string;
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

    for (const video of options.videos) {
      const inputPath = path.resolve(video.filePath);
      const outputPath = path.join(tempDir, `processed-${video.rank}.mp4`);

      // Escape single quotes in text (same as addTitleToVideo)
      const escapeText = (text: string) => text.replace(/'/g, "\\'");

      const mainTitleText = escapeText(options.mainTitle);
      const rankTitleText = escapeText(`${video.rank}. ${video.title}`);

      // Build filters using the same pattern as addTitleToVideo
      const filters = [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
        `drawtext=fontfile='C\\:/Windows/Fonts/Arial.ttf':text='${mainTitleText}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=50:box=1:boxcolor=black@0.6:boxborderw=10`,
        `drawtext=fontfile='C\\:/Windows/Fonts/Arial.ttf':text='${rankTitleText}':fontsize=50:fontcolor=yellow:x=(w-text_w)/2:y=h-150:box=1:boxcolor=black@0.7:boxborderw=10`,
      ];

      console.log(`Processing video ${video.rank}...`);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters(filters)
          .outputOptions([
            "-c:v libx264",
            "-preset medium",
            "-crf 23",
            "-c:a aac",
            "-b:a 128k",
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
    }

    // Create file list for concatenation
    const fileListPath = path.join(tempDir, "filelist.txt");
    const fileListContent = processedVideos
      .map((p) => `file '${path.resolve(p).replace(/\\/g, "/")}'`)
      .join("\n");
    fs.writeFileSync(fileListPath, fileListContent);

    console.log("File list content:");
    console.log(fileListContent);

    // Concatenate videos using fluent-ffmpeg
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
