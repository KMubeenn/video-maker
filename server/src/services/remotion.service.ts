import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { RenderSpec } from "../types/ranking.js";

// Path to client entry point (adjusted for server structure)
// client/src/remotion/index.ts relative to server/src/services
const CLIENT_ENTRY = path.join(
  process.cwd(),
  "../client/src/remotion/index.ts"
);

export async function renderRankingVideo(
  spec: RenderSpec,
  outputFilename: string
): Promise<string> {
  const bundleLocation = await bundle({
    entryPoint: CLIENT_ENTRY,
    // Ensure webpack config can resolve client paths if needed
    webpackOverride: (config) => {
      // Basic webpack tuning if required
      return config;
    },
  });

  const compositionId = "RankingVideo";

  // Use selectComposition to get metadata (width, height, fps)
  // This validates the composition exists and matches our expectations
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps: { spec },
  });

  const outputDir = path.join(process.cwd(), "outputs");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, outputFilename);

  console.log(`Starting Remotion render to ${outputPath}...`);
  console.log(
    `FPS: ${composition.fps}, Duration: ${composition.durationInFrames} frames`
  );

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { spec },
    // Optimize for server environment
    concurrency: require("os").cpus().length,
    crf: 20, // Quality level (standard for web)
  });

  console.log("Remotion render complete.");
  return `outputs/${outputFilename}`;
}
