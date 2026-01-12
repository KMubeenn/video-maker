import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  OffthreadVideo,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import type { RenderSpec, EditedClip } from "../features/ranking/types";
import { type TextSegment } from "../components/RichTextInput";
import { getPresetById } from "../features/ranking/title-presets";

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

// Check if text is primarily emoji
const isEmojiText = (text: string): boolean => {
  // Emoji regex pattern
  const emojiPattern =
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}]/u;
  return emojiPattern.test(text);
};

const isSocialUrl = (url: string) => {
  return (
    url.includes("tiktok.com") ||
    url.includes("instagram.com") ||
    url.includes("youtube.com") ||
    url.includes("youtu.be")
  );
};

// --- Components ---

const ParsedTextToken: React.FC<{
  segment: TextSegment;
  text: string;
  isEmoji: boolean;
  fontSize: number;
  borderColor?: string;
}> = ({ segment, text, isEmoji, fontSize, borderColor = "#FFD700" }) => {
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
        letterSpacing: "2px", // Add spacing between letters
        fontWeight: segment.bold ? "bold" : "normal",
        fontStyle: segment.italic ? "italic" : "normal",
        textDecoration: segment.underline ? "underline" : "none",
        WebkitTextStroke: hasBorder ? `4px ${borderColor}` : "none",
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
  style?: React.CSSProperties;
  borderColor?: string;
}> = ({ segments, style, borderColor }) => {
  const defaultFontSize = segments[0]?.fontSize || 64;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        ...style,
      }}
    >
      {segments.map((seg, i) => (
        <ParsedTextToken
          key={i}
          segment={seg}
          text={seg.text}
          isEmoji={isEmojiText(seg.text)}
          fontSize={seg.fontSize || defaultFontSize}
          borderColor={borderColor}
        />
      ))}
    </div>
  );
};

const AnimatedTitle: React.FC<{
  children: React.ReactNode;
  animation?:
    | "none"
    | "fade"
    | "fade-left"
    | "fade-right"
    | "fade-up"
    | "fade-down"
    | "slide-left"
    | "slide-right"
    | "slide-up"
    | "slide-down"
    | "pop"
    | "scale-in";
  fps: number;
}> = ({ children, animation = "fade" }) => {
  const frame = useCurrentFrame();

  if (animation === "none") {
    return <>{children}</>;
  }

  // --- Animation Primitives ---

  // Basic Opacity (0 -> 1 over 15 frames)
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scale (0.8 -> 1 with elastic bounce)
  const scale = interpolate(frame, [0, 20], [0.5, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.elastic(1.2)),
  });

  // Slide Offset (Generic)
  const slideOffset = interpolate(frame, [0, 20], [100, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // Fade Offset (Subtle)
  const fadeOffset = interpolate(frame, [0, 20], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // --- Logic Mapping ---

  // 1. FADE VARIANTS
  if (animation === "fade") {
    return <div style={{ opacity }}>{children}</div>;
  }
  if (animation === "fade-up") {
    return (
      <div style={{ opacity, transform: `translateY(${fadeOffset}px)` }}>
        {children}
      </div>
    );
  }
  if (animation === "fade-down") {
    return (
      <div style={{ opacity, transform: `translateY(-${fadeOffset}px)` }}>
        {children}
      </div>
    );
  }
  if (animation === "fade-left") {
    return (
      <div style={{ opacity, transform: `translateX(${fadeOffset}px)` }}>
        {children}
      </div>
    );
  }
  if (animation === "fade-right") {
    return (
      <div style={{ opacity, transform: `translateX(-${fadeOffset}px)` }}>
        {children}
      </div>
    );
  }

  // 2. SLIDE VARIANTS (More movement, full opacity faster)
  // For slides, we might want full opacity sooner to see the movement
  const slideOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  if (animation === "slide-up") {
    return (
      <div
        style={{
          opacity: slideOpacity,
          transform: `translateY(${slideOffset}px)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (animation === "slide-down") {
    return (
      <div
        style={{
          opacity: slideOpacity,
          transform: `translateY(-${slideOffset}px)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (animation === "slide-left") {
    return (
      <div
        style={{
          opacity: slideOpacity,
          transform: `translateX(${slideOffset}px)`,
        }}
      >
        {children}
      </div>
    );
  }
  if (animation === "slide-right") {
    return (
      <div
        style={{
          opacity: slideOpacity,
          transform: `translateX(-${slideOffset}px)`,
        }}
      >
        {children}
      </div>
    );
  }

  // 3. SCALE / POP VARIANTS
  if (animation === "scale-in") {
    const cleanScale = interpolate(frame, [0, 20], [0.8, 1], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return (
      <div style={{ opacity, transform: `scale(${cleanScale})` }}>
        {children}
      </div>
    );
  }

  if (animation === "pop") {
    // Pop starts small, overshoots slightly
    return (
      <div style={{ opacity, transform: `scale(${scale})` }}>{children}</div>
    );
  }

  // Fallback
  return <div style={{ opacity }}>{children}</div>;
};

const TitleOverlay: React.FC<{
  text: TextSegment[];
  presetId?: string;
  style?: React.CSSProperties;
  borderColor?: string;
  fps: number;
}> = ({ text, presetId, style, borderColor, fps }) => {
  const preset = getPresetById(presetId);
  const animation = preset?.animation || "fade";

  return (
    <AnimatedTitle animation={animation} fps={fps}>
      <RenderRichText
        segments={text}
        borderColor={borderColor}
        style={{
          ...style,
          ...preset?.style,
        }}
      />
    </AnimatedTitle>
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
          position: "absolute" as const,
          top: titleHeight, // Position video below the title
          left: 0,
          width: "100%",
          height: videoAreaHeight, // Use remaining height
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
        {clip.src && !isSocialUrl(clip.src) ? (
          <OffthreadVideo
            src={clip.src}
            startFrom={(clip.trim?.start || 0) * 30}
            endAt={(clip.trim?.end || 1000) * 30}
            style={videoStyle}
            crossOrigin="anonymous"
          />
        ) : (
          <div
            style={{
              ...videoStyle,
              backgroundColor: "#1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#333",
              fontSize: 40,
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
            }}
          >
            {clip.src && isSocialUrl(clip.src)
              ? "RESOLVING..."
              : `VIDEO ${clip.videoNumber}`}
          </div>
        )}
      </div>

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
  const { height: canvasHeight } = useVideoConfig();

  // Layout Constants
  const rankingItemHeight = 200;
  const titleHeight = 300;
  const videoHeight = canvasHeight - titleHeight;
  const totalRankingHeight = (spec.slots?.length || 0) * rankingItemHeight;
  const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

  // Calculate total composition duration for persistent titles
  const totalDuration = Math.max(
    1,
    spec.sequence.reduce((sum, item) => sum + item.durationInFrames, 0)
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Layer 0: Video Sequence */}
      {spec.sequence.map((item) => (
        <Sequence
          key={`clip-${item.clip.id}`}
          from={item.startFrame}
          durationInFrames={item.durationInFrames}
        >
          <ClipLayer clip={item.clip} />
        </Sequence>
      ))}

      {/* Layer 1: Main Title (Persistent) */}
      {spec.mainTitle && (
        <Sequence from={0} durationInFrames={totalDuration}>
          <AbsoluteFill>
            <TitleOverlay
              text={spec.mainTitle.text}
              presetId={spec.mainTitle.presetId}
              fps={spec.fps}
              style={{
                position: "absolute",
                width: 900,
                left: "50%",
                top: 180,
                transform: "translateX(-50%)",
                justifyContent: "center",
                textAlign: "center",
              }}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* Layer 2: Static Slot Numbers (White, Always Visible) */}
      <AbsoluteFill>
        {spec.slots?.map((slot) => {
          const yPos =
            rankingStartY + (slot.videoNumber - 1) * rankingItemHeight;
          return (
            <div
              key={`static-slot-${slot.id}`}
              style={{
                position: "absolute",
                top: yPos,
                left: 30,
                fontFamily: "Impact, Arial, sans-serif",
                fontSize: 52,
                color: "white",
              }}
            >
              {slot.videoNumber}.
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Layer 2.5: Persistent Titles (User Color, appear when playing, stay forever) */}
      {spec.sequence.map((item) => {
        const yPos =
          rankingStartY + (item.clip.videoNumber - 1) * rankingItemHeight;

        // Only show if title exists
        if (!item.clip.title) return null;

        return (
          <Sequence
            key={`persistent-title-${item.clip.id}`}
            from={item.startFrame}
            // Duration is until the end of the video
            durationInFrames={totalDuration - item.startFrame}
          >
            <TitleOverlay
              text={item.clip.title}
              presetId={item.clip.titlePresetId}
              fps={spec.fps}
              borderColor="black"
              style={{
                position: "absolute",
                top: yPos + 2,
                left: 90,
                width: 700,
                justifyContent: "flex-start",
                textAlign: "left",
              }}
            />
          </Sequence>
        );
      })}

      {/* Layer 3: Active Slot Highlighting (Yellow Number + Title) */}
      {spec.sequence.map((item) => {
        const yPos =
          rankingStartY + (item.clip.videoNumber - 1) * rankingItemHeight;

        // Only show if title exists
        if (!item.clip.title) return null;

        return (
          <Sequence
            key={`highlight-${item.clip.id}`}
            from={item.startFrame}
            durationInFrames={item.durationInFrames}
          >
            {/* Highlight Number */}
            <AnimatedTitle animation="fade" fps={spec.fps}>
              <div
                style={{
                  position: "absolute",
                  top: yPos,
                  left: 30,
                  fontFamily: "Impact, Arial, sans-serif",
                  fontSize: 52,
                  color: "#ffff00", // Yellow highlight
                  WebkitTextStroke: "3px black",
                }}
              >
                {item.clip.videoNumber}.
              </div>
            </AnimatedTitle>

            {/* Ranking Title */}
            <TitleOverlay
              text={item.clip.title.map((t) => ({
                ...t,
                color: t.color === "white" ? "#ffff00" : t.color,
              }))}
              presetId={item.clip.titlePresetId}
              fps={spec.fps}
              borderColor="black"
              style={{
                position: "absolute",
                top: yPos + 2,
                left: 90,
                width: 700,
                justifyContent: "flex-start",
                textAlign: "left",
              }}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
