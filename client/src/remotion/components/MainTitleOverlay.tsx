/**
 * MainTitleOverlay Component
 * Renders the main title banner at the top of the video
 */

import { AbsoluteFill } from "remotion";
import type { TextSegment } from "@/types/ranking-video.schema";

interface MainTitleOverlayProps {
  textSegments: TextSegment[];
  canvasWidth: number;
}

export const MainTitleOverlay: React.FC<MainTitleOverlayProps> = ({
  textSegments,
  canvasWidth,
}) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 90,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          maxWidth: canvasWidth * 0.9,
        }}
      >
        <div
          style={{
            background: "rgba(0, 0, 0, 0.6)",
            padding: "20px 40px",
            borderRadius: 8,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {textSegments.map((segment, index) => {
            const fontSize = segment.fontSize || 64;
            const color = segment.color || "white";
            const isWhite =
              color === "white" || color === "#ffffff" || color === "#fff";
            const hasBorder = segment.hasBorder !== false && !isWhite;

            return (
              <span
                key={index}
                style={{
                  fontFamily: "Impact, Arial, sans-serif",
                  fontSize: `${fontSize}px`,
                  color: color,
                  fontWeight: 900,
                  letterSpacing: "4px",
                  textShadow: hasBorder
                    ? `
                        -4px -4px 0 #FFD700,
                        4px -4px 0 #FFD700,
                        -4px 4px 0 #FFD700,
                        4px 4px 0 #FFD700,
                        0 0 20px rgba(0,0,0,0.5)
                      `
                    : "2px 2px 4px rgba(0, 0, 0, 0.8)",
                }}
              >
                {segment.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
