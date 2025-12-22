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
