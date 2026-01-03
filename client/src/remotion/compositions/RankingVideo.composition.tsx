/**
 * Remotion Composition Registration
 * Defines the RankingVideo composition for Remotion CLI
 */

import { Composition } from "remotion";
import { RankingVideoTemplate } from "../RankingVideoTemplate";
import type { RankingVideoComposition } from "@/types/ranking-video.schema";
import { calculateTotalDuration } from "../utils/calculateDuration";

// Default test data for development
const defaultInputProps: RankingVideoComposition = {
  version: "1.0",
  metadata: {
    createdAt: new Date().toISOString(),
    width: 1080,
    height: 1920,
    fps: 30,
  },
  globalSettings: {
    mainTitle: [
      { text: "Top 3 ", color: "white", fontSize: 64 },
      { text: "Videos", color: "#FFD700", fontSize: 64, hasBorder: true },
    ],
  },
  clips: [
    {
      id: "clip-1",
      rank: 1,
      source: {
        url: "https://example.com/video1.mp4",
      },
      trim: { start: 0, end: 5 },
      crop: { preset: "9:16", scale: 1.0, align: "center" },
      label: [{ text: "Amazing Video!", color: "white" }],
    },
    {
      id: "clip-2",
      rank: 2,
      source: {
        url: "https://example.com/video2.mp4",
      },
      trim: { start: 0, end: 5 },
      crop: { preset: "9:16", scale: 1.0, align: "center" },
      label: [{ text: "Great Content", color: "white" }],
    },
    {
      id: "clip-3",
      rank: 3,
      source: {
        url: "https://example.com/video3.mp4",
      },
      trim: { start: 0, end: 5 },
      crop: { preset: "9:16", scale: 1.0, align: "center" },
      label: [{ text: "Cool Stuff", color: "white" }],
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  const durationInFrames = calculateTotalDuration(
    defaultInputProps.clips,
    defaultInputProps.metadata.fps
  );

  return (
    <>
      <Composition
        id="RankingVideo"
        component={RankingVideoTemplate}
        durationInFrames={durationInFrames}
        fps={defaultInputProps.metadata.fps}
        width={defaultInputProps.metadata.width}
        height={defaultInputProps.metadata.height}
        defaultProps={{ data: defaultInputProps }}
      />
    </>
  );
};
