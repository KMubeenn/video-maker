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
