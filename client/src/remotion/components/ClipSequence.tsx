/**
 * ClipSequence Component
 * Renders a single video clip with trim and crop settings
 */

import { Video, useVideoConfig } from "remotion";
import type { RankingClip } from "@/types/ranking-video.schema";
import { applyCrop } from "../utils/cropCalculations";

interface ClipSequenceProps {
  clip: RankingClip;
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const ClipSequence: React.FC<ClipSequenceProps> = ({
  clip,
  videoWidth,
  videoHeight,
  canvasWidth,
  canvasHeight,
}) => {
  const { fps } = useVideoConfig();

  // Calculate crop style
  const cropStyle = applyCrop(
    videoWidth,
    videoHeight,
    clip.crop,
    canvasWidth,
    canvasHeight
  );

  // Calculate trim frames
  const startFrom = Math.round(clip.trim.start * fps);
  const endAt = Math.round(clip.trim.end * fps);

  // If no local path, show placeholder (video needs to be downloaded first)
  if (!clip.source.localPath) {
    return (
      <div
        style={{
          ...cropStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          color: "white",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "4rem" }}>📹</div>
        <div
          style={{ fontSize: "1.5rem", textAlign: "center", padding: "0 2rem" }}
        >
          Video Preview Unavailable
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "#888",
            textAlign: "center",
            padding: "0 2rem",
          }}
        >
          {clip.source.url.includes("tiktok")
            ? "TikTok videos must be downloaded for preview"
            : "Video source not available"}
        </div>
      </div>
    );
  }

  return (
    <Video
      src={clip.source.localPath}
      startFrom={startFrom}
      endAt={endAt}
      style={{
        ...cropStyle,
        objectFit: "cover",
      }}
    />
  );
};
