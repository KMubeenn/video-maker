/**
 * RankingVideoTemplate - Main Remotion Composition
 * Root composition that renders the entire ranking video
 */

import { AbsoluteFill, Sequence, Audio } from "remotion";
import type { RankingVideoComposition } from "@/types/ranking-video.schema";
import { calculateClipTimings } from "./utils/calculateDuration";
import { ClipSequence } from "./components/ClipSequence";
import { MainTitleOverlay } from "./components/MainTitleOverlay";
import { RankingOverlay } from "./components/RankingOverlay";

interface RankingVideoTemplateProps {
  data: RankingVideoComposition;
}

export const RankingVideoTemplate: React.FC<RankingVideoTemplateProps> = ({
  data,
}) => {
  const { metadata, globalSettings, clips } = data;
  const { width, height, fps } = metadata;

  // Calculate clip timings
  const clipTimings = calculateClipTimings(clips, fps);

  // For now, assume all videos are 1080x1920 (will be dynamic once we load metadata)
  const videoWidth = 1080;
  const videoHeight = 1920;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Render video clips sequentially */}
      {clips.map((clip, index) => {
        const timing = clipTimings[index];
        if (!timing) return null;

        return (
          <Sequence
            key={clip.id}
            from={timing.from}
            durationInFrames={timing.durationInFrames}
          >
            <ClipSequence
              clip={clip}
              videoWidth={videoWidth}
              videoHeight={videoHeight}
              canvasWidth={width}
              canvasHeight={height}
            />
          </Sequence>
        );
      })}

      {/* Main title overlay (entire duration) */}
      {clipTimings.length > 0 && (
        <Sequence
          from={0}
          durationInFrames={
            clipTimings[clipTimings.length - 1].from +
            clipTimings[clipTimings.length - 1].durationInFrames
          }
        >
          <MainTitleOverlay
            textSegments={globalSettings.mainTitle}
            canvasWidth={width}
          />
        </Sequence>
      )}

      {/* Ranking overlays (accumulated reveal) */}
      {clips.map((clip, clipIndex) => {
        const timing = clipTimings[clipIndex];
        if (!timing) return null;

        const revealedClips = clips.slice(0, clipIndex + 1);

        return (
          <Sequence
            key={`ranking-${clip.id}`}
            from={timing.from}
            durationInFrames={timing.durationInFrames}
          >
            <RankingOverlay
              allClips={clips}
              revealedRanks={revealedClips}
              currentRank={clip.rank}
              canvasHeight={height}
            />
          </Sequence>
        );
      })}

      {/* Audio layers for meme sounds */}
      {clips.map((clip, clipIndex) => {
        const timing = clipTimings[clipIndex];
        if (!timing || !clip.memeSounds) return null;

        return clip.memeSounds.map((sound, soundIndex) => (
          <Audio
            key={`sound-${clip.id}-${soundIndex}`}
            src={sound.soundUrl}
            startFrom={timing.from + Math.round(sound.startTime * fps)}
            volume={sound.volume}
          />
        ));
      })}
    </AbsoluteFill>
  );
};
