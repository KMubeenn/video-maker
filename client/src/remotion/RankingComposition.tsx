import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  OffthreadVideo,
  useVideoConfig,
} from "remotion";
import type { RenderSpec, EditedClip } from "../features/ranking/types";
import { type TextSegment } from "../components/RichTextInput";

// --- Helpers ---

const normalizeColor = (color: string | undefined): string => {
  if (!color) return "white";
  const map: Record<string, string> = {
    "#FFD700": "#FFC700",
    "#FF6B6B": "#E63946",
    "#4ECDC4": "#06AED5",
    "#95E1D3": "#2D9E6D",
  };
  return map[color] || color;
};

// --- Components ---

const ParsedTextToken: React.FC<{
  segment: TextSegment;
  text: string;
  isEmoji: boolean;
  fontSize: number;
}> = ({ segment, text, isEmoji, fontSize }) => {
  const color = normalizeColor(segment.color);

  // Emoji rendering
  if (isEmoji) {
    return <span style={{ fontSize }}>{text}</span>;
  }

  const isWhite =
    color === "white" ||
    color === "#ffffff" ||
    color === "#fff" ||
    color === "rgb(255, 255, 255)";
  const hasBorder = segment.hasBorder !== false && !isWhite;

  return (
    <span
      style={{
        color,
        fontFamily: "Impact, Arial, sans-serif",
        fontSize,
        WebkitTextStroke: hasBorder ? "4px #FFD700" : "none",
        paintOrder: "stroke fill",
        marginRight: 4,
      }}
    >
      {text}
    </span>
  );
};

const RenderRichText: React.FC<{
  segments: TextSegment[];
  type: "main" | "ranking";
  width: number;
}> = ({ segments, type }) => {
  const defaultFontSize = segments[0]?.fontSize || (type === "main" ? 64 : 52);

  return (
    <div
      style={{
        position: "absolute",
        width: type === "main" ? 900 : 700,
        left: "50%",
        top: type === "main" ? 180 : 0,
        transform: "translateX(-50%)",
        textAlign: "center",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignContent: "center",
      }}
    >
      {segments.map((seg, i) => (
        <ParsedTextToken
          key={i}
          segment={seg}
          text={seg.text}
          isEmoji={false}
          fontSize={seg.fontSize || defaultFontSize}
        />
      ))}
    </div>
  );
};

const ClipLayer: React.FC<{ clip: EditedClip }> = ({ clip }) => {
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();

  const hasCrop = clip.crop && clip.crop.width > 0;
  const titleHeight = 300;
  const videoAreaHeight = canvasHeight - titleHeight;

  // Calculate Crop Styles
  const { wrapperStyle, videoStyle } = useMemo(() => {
    if (!hasCrop || !clip.crop) {
      return {
        wrapperStyle: {
          width: "100%",
          height: "100%",
          overflow: "hidden" as const,
        },
        videoStyle: {
          width: "100%",
          height: "100%",
          objectFit: "cover" as const,
        },
      };
    }

    const { x: sx, y: sy, width: sw, height: sh } = clip.crop;

    // Scale to fill the video area covers
    const scale = Math.max(canvasWidth / sw, videoAreaHeight / sh);
    const scaledW = sw * scale;
    const scaledH = sh * scale;
    const dx = (canvasWidth - scaledW) / 2;
    const dy = titleHeight + (videoAreaHeight - scaledH) / 2;

    const wrapper: React.CSSProperties = {
      position: "absolute",
      left: dx,
      top: dy,
      width: scaledW,
      height: scaledH,
      overflow: "hidden",
    };

    const nativeW = clip.resolution?.width ?? 1080;
    const nativeH = clip.resolution?.height ?? 1920;

    const video: React.CSSProperties = {
      position: "absolute",
      left: -sx * scale,
      top: -sy * scale,
      width: nativeW * scale,
      height: nativeH * scale,
      maxWidth: "none",
    };

    return { wrapperStyle: wrapper, videoStyle: video };
  }, [canvasWidth, videoAreaHeight, clip.crop, hasCrop, clip.resolution]);

  return (
    <AbsoluteFill>
      <div style={wrapperStyle}>
        <OffthreadVideo
          src={clip.src}
          startFrom={(clip.trim?.start || 0) * 30}
          endAt={(clip.trim?.end || 1000) * 30}
          style={videoStyle}
        />
      </div>

      {/* Main Title Overlay */}
      {clip.title && (
        <AbsoluteFill>
          <RenderRichText
            segments={clip.title}
            type="main"
            width={canvasWidth}
          />
        </AbsoluteFill>
      )}

      {/* Audio Overlays */}
      {clip.audio?.map((track, i) => (
        <Sequence key={`audio-${i}`} from={Math.round(track.start * 30)}>
          <Audio src={track.src} volume={track.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const RankingComposition: React.FC<{ spec: RenderSpec }> = ({
  spec,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {spec.sequence.map((item) => (
        <Sequence
          key={item.clip.id}
          from={item.startFrame}
          durationInFrames={item.durationInFrames}
        >
          <ClipLayer clip={item.clip} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
