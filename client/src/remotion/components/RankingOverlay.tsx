/**
 * RankingOverlay Component
 * Renders rank numbers and titles with reveal animation
 */

import { AbsoluteFill } from "remotion";
import type {
  RankingClip,
  TextSegment,
} from "@/types/ranking-video.schema";

interface RankingOverlayProps {
  allClips: RankingClip[];
  revealedRanks: RankingClip[];
  currentRank: number;
  canvasHeight: number;
}

export const RankingOverlay: React.FC<RankingOverlayProps> = ({
  allClips,
  revealedRanks,
  currentRank,
  canvasHeight,
}) => {
  const titleHeight = 300;
  const videoHeight = canvasHeight - titleHeight;
  const rankingItemHeight = 200;
  const totalRankingHeight = allClips.length * rankingItemHeight;
  const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

  const revealedRankNumbers = new Set(revealedRanks.map((clip) => clip.rank));

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {allClips.map((clip, index) => {
        const isCurrentRank = clip.rank === currentRank;
        const isRevealed = revealedRankNumbers.has(clip.rank);
        const yPos = rankingStartY + index * rankingItemHeight;
        const color = isCurrentRank ? "#ffff00" : "white";

        return (
          <div
            key={clip.id}
            style={{
              position: "absolute",
              left: 30,
              top: yPos,
              display: "flex",
              alignItems: "flex-start",
              gap: 20,
            }}
          >
            {/* Rank Number */}
            <span
              style={{
                fontFamily: "Impact, Arial, sans-serif",
                fontSize: 52,
                color: color,
                fontWeight: 900,
                textShadow: `
                  -3px -3px 0 black,
                  3px -3px 0 black,
                  -3px 3px 0 black,
                  3px 3px 0 black
                `,
              }}
            >
              {clip.rank}.
            </span>

            {/* Clip Title (only if revealed) */}
            {isRevealed && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  maxWidth: 700,
                }}
              >
                {clip.label.map((segment: TextSegment, segIndex: number) => (
                  <span
                    key={segIndex}
                    style={{
                      fontFamily: "Impact, Arial, sans-serif",
                      fontSize: segment.fontSize || 52,
                      color: segment.color || color,
                      fontWeight: 900,
                      textShadow: `
                        -3px -3px 0 black,
                        3px -3px 0 black,
                        -3px 3px 0 black,
                        3px 3px 0 black
                      `,
                    }}
                  >
                    {segment.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
