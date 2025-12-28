/**
 * FFmpeg Text Filter Generation
 * Creates drawtext filters for video overlays
 * Now supports emoji parsing and overlay generation
 */

import type { TextSegment } from "../../../types/index.js";
import {
  estimateTextWidth,
  normalizeColor,
  splitIntoLines,
} from "../../../utils/index.js";

// Emoji detection regex (matches all common emoji patterns)
const EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu;

/**
 * Parsed segment - either text or emoji
 */
interface ParsedPart {
  type: "text" | "emoji";
  content: string;
}

/**
 * Emoji position info for FFmpeg overlay
 */
export interface EmojiOverlayInfo {
  codepoint: string;
  x: number;
  y: number;
  size: number;
}

/**
 * Result of text+emoji filter generation
 */
export interface TextFiltersWithEmojis {
  textFilters: string[];
  emojis: EmojiOverlayInfo[];
}

/**
 * Parse text into alternating text and emoji parts
 */
function parseTextForEmojis(text: string): ParsedPart[] {
  const result: ParsedPart[] = [];
  let lastIndex = 0;

  EMOJI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    result.push({ type: "emoji", content: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", content: text.slice(lastIndex) });
  }

  return result;
}

/**
 * Convert emoji to Twemoji codepoint format
 */
function emojiToCodepoint(emoji: string): string {
  const codepoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xfe0f) {
      codepoints.push(cp.toString(16).toLowerCase());
    }
  }
  return codepoints.join("-");
}

/**
 * Check if text contains any emojis
 */
export function containsEmoji(text: string): boolean {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

/**
 * Check if segments contain any emojis
 */
export function segmentsContainEmoji(segments: TextSegment[]): boolean {
  return segments.some((seg) => containsEmoji(seg.text));
}

/**
 * Convert formatted text segments to FFmpeg drawtext filters
 * Supports both centered and left-aligned text with optional borders
 */
export function createFormattedTextFilters(
  segments: TextSegment[] | string,
  baseX: number | string,
  baseY: number,
  fontFile: string,
  defaultColor: string = "white",
  defaultFontSize: number = 52,
  borderColor: string | null = null,
  borderWidth: number = 3,
  letterSpacing: number = 0
): string[] {
  // If it's a plain string, convert to single segment
  const textSegments =
    typeof segments === "string"
      ? [{ text: segments, color: defaultColor, fontSize: defaultFontSize }]
      : segments;

  const filters: string[] = [];
  const isCentered = typeof baseX === "string" && baseX.includes("w-text_w");

  if (isCentered) {
    return createCenteredTextFilters(
      textSegments,
      baseY,
      fontFile,
      defaultColor,
      defaultFontSize,
      borderColor,
      borderWidth,
      letterSpacing
    );
  } else {
    return createLeftAlignedTextFilters(
      textSegments,
      baseX,
      baseY,
      fontFile,
      defaultColor,
      defaultFontSize,
      borderColor,
      borderWidth
    );
  }
}

/**
 * Convert formatted text segments to FFmpeg drawtext filters WITH emoji extraction.
 * Returns both text filters and emoji position info for overlay generation.
 *
 * Emojis are NOT rendered by FFmpeg drawtext - they need separate overlay filters.
 * Text is rendered normally, but emojis are extracted with their positions.
 */
export function createFormattedTextFiltersWithEmojis(
  segments: TextSegment[] | string,
  baseX: number | string,
  baseY: number,
  fontFile: string,
  defaultColor: string = "white",
  defaultFontSize: number = 52,
  borderColor: string | null = null,
  borderWidth: number = 3,
  letterSpacing: number = 0
): TextFiltersWithEmojis {
  const textSegments =
    typeof segments === "string"
      ? [{ text: segments, color: defaultColor, fontSize: defaultFontSize }]
      : segments;

  const isCentered = typeof baseX === "string" && baseX.includes("w-text_w");

  if (isCentered) {
    return createCenteredTextFiltersWithEmojis(
      textSegments,
      baseY,
      fontFile,
      defaultColor,
      defaultFontSize,
      borderColor,
      borderWidth,
      letterSpacing
    );
  } else {
    return createLeftAlignedTextFiltersWithEmojis(
      textSegments,
      baseX,
      baseY,
      fontFile,
      defaultColor,
      defaultFontSize,
      borderColor,
      borderWidth
    );
  }
}

/**
 * Create centered text filters with emoji extraction
 */
function createCenteredTextFiltersWithEmojis(
  textSegments: TextSegment[],
  baseY: number,
  fontFile: string,
  defaultColor: string,
  defaultFontSize: number,
  borderColor: string | null,
  borderWidth: number,
  letterSpacing: number
): TextFiltersWithEmojis {
  const filters: string[] = [];
  const emojis: EmojiOverlayInfo[] = [];
  const maxWidth = letterSpacing > 0 ? 900 : 850;
  const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);
  const lineHeight =
    letterSpacing > 0 ? defaultFontSize + 14 : defaultFontSize + 10;

  let currentY =
    typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

  if (lines.length > 1) {
    currentY -= ((lines.length - 1) * lineHeight) / 2;
  }

  for (const lineSegments of lines) {
    // Calculate total width including emojis
    let totalWidth = 0;
    for (const segment of lineSegments) {
      const fontSize = segment.fontSize || defaultFontSize;
      const parts = parseTextForEmojis(segment.text);
      for (const part of parts) {
        if (part.type === "emoji") {
          totalWidth += fontSize * 1.25; // Emoji width = fontSize * 1.25
        } else {
          totalWidth += estimateTextWidth(part.content, fontSize);
        }
      }
    }

    // Center position calculation
    // Video width is typically 1080, so center is w/2 = 540
    const videoWidth = 1080;
    let currentX = (videoWidth - totalWidth) / 2;

    for (const segment of lineSegments) {
      const color = normalizeColor(segment.color) || defaultColor;
      const fontSize = segment.fontSize || defaultFontSize;
      const borderParams = getBorderParams(
        segment,
        color,
        borderColor,
        borderWidth
      );

      const parts = parseTextForEmojis(segment.text);

      for (const part of parts) {
        if (part.type === "emoji") {
          // Extract emoji info - don't create drawtext filter
          const emojiSize = fontSize * 1.25;
          const yOffset = (emojiSize - fontSize) / 2;

          emojis.push({
            codepoint: emojiToCodepoint(part.content),
            x: Math.round(currentX),
            y: Math.round(currentY - yOffset), // Shift up to center larger emoji
            size: emojiSize,
          });
          currentX += emojiSize;
        } else {
          // Create drawtext filter for text
          const escText = escapeForFFmpeg(part.content);
          if (escText.trim()) {
            filters.push(
              `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${Math.round(
                currentX
              )}:y=${Math.round(currentY)}${borderParams}`
            );
          }
          currentX += estimateTextWidth(part.content, fontSize);
        }
      }
    }

    currentY += lineHeight;
  }

  return { textFilters: filters, emojis };
}

/**
 * Create left-aligned text filters with emoji extraction
 */
function createLeftAlignedTextFiltersWithEmojis(
  textSegments: TextSegment[],
  baseX: number | string,
  baseY: number,
  fontFile: string,
  defaultColor: string,
  defaultFontSize: number,
  borderColor: string | null,
  borderWidth: number
): TextFiltersWithEmojis {
  const filters: string[] = [];
  const emojis: EmojiOverlayInfo[] = [];
  const startX =
    typeof baseX === "number" ? baseX : parseInt(baseX as string, 10);
  const maxWidth = 700;
  const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);
  const lineHeight = defaultFontSize + 8;

  let currentY =
    typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

  for (const lineSegments of lines) {
    let currentX = startX;

    for (const segment of lineSegments) {
      const color = normalizeColor(segment.color) || defaultColor;
      const fontSize = segment.fontSize || defaultFontSize;
      const borderParams = getBorderParams(
        segment,
        color,
        borderColor,
        borderWidth
      );

      const parts = parseTextForEmojis(segment.text);

      for (const part of parts) {
        if (part.type === "emoji") {
          const emojiSize = fontSize * 1.25;
          const yOffset = (emojiSize - fontSize) / 2;

          emojis.push({
            codepoint: emojiToCodepoint(part.content),
            x: Math.round(currentX),
            y: Math.round(currentY - yOffset),
            size: emojiSize,
          });
          currentX += emojiSize;
        } else {
          const escText = escapeForFFmpeg(part.content);
          if (escText.trim()) {
            filters.push(
              `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${currentX}:y=${currentY}${borderParams}`
            );
          }
          currentX += estimateTextWidth(part.content, fontSize);
        }
      }
    }
    currentY += lineHeight;
  }

  return { textFilters: filters, emojis };
}

function createCenteredTextFilters(
  textSegments: TextSegment[],
  baseY: number,
  fontFile: string,
  defaultColor: string,
  defaultFontSize: number,
  borderColor: string | null,
  borderWidth: number,
  letterSpacing: number
): string[] {
  const filters: string[] = [];
  const maxWidth = letterSpacing > 0 ? 900 : 850;
  const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);
  const lineHeight =
    letterSpacing > 0 ? defaultFontSize + 14 : defaultFontSize + 10;

  let currentY =
    typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

  // Adjust starting Y to center multiple lines
  if (lines.length > 1) {
    currentY -= ((lines.length - 1) * lineHeight) / 2;
  }

  for (const lineSegments of lines) {
    // Calculate total width of this line
    let totalWidth = 0;
    for (const segment of lineSegments) {
      totalWidth += estimateTextWidth(
        segment.text,
        segment.fontSize || defaultFontSize
      );
    }

    let currentXOffset = -totalWidth / 2;

    for (const segment of lineSegments) {
      const color = normalizeColor(segment.color) || defaultColor;
      const fontSize = segment.fontSize || defaultFontSize;
      const borderParams = getBorderParams(
        segment,
        color,
        borderColor,
        borderWidth
      );

      if (letterSpacing > 0) {
        // Draw each character individually
        for (const char of segment.text) {
          const escChar = escapeForFFmpeg(char);
          let xOffset = Math.max(currentXOffset, -530);
          const xPos = `(w/2)${xOffset >= 0 ? "+" : ""}${Math.round(xOffset)}`;

          filters.push(
            `drawtext=fontfile='${fontFile}':text='${escChar}':fontsize=${fontSize}:fontcolor=${color}:x=${xPos}:y=${currentY}${borderParams}`
          );

          currentXOffset += estimateTextWidth(char, fontSize) + letterSpacing;
        }
      } else {
        // Draw entire segment at once
        const escText = escapeForFFmpeg(segment.text);
        let xOffset = Math.max(currentXOffset, -530);
        const xPos = `(w/2)${xOffset >= 0 ? "+" : ""}${Math.round(xOffset)}`;

        filters.push(
          `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${xPos}:y=${currentY}${borderParams}`
        );

        currentXOffset += estimateTextWidth(segment.text, fontSize);
      }
    }

    currentY += lineHeight;
  }

  return filters;
}

/**
 * Create left-aligned text filters (for ranking titles)
 */
function createLeftAlignedTextFilters(
  textSegments: TextSegment[],
  baseX: number | string,
  baseY: number,
  fontFile: string,
  defaultColor: string,
  defaultFontSize: number,
  borderColor: string | null,
  borderWidth: number
): string[] {
  const filters: string[] = [];
  const startX =
    typeof baseX === "number" ? baseX : parseInt(baseX as string, 10);
  const maxWidth = 700;
  const lines = splitIntoLines(textSegments, maxWidth, defaultFontSize);
  const lineHeight = defaultFontSize + 8;

  let currentY =
    typeof baseY === "number" ? baseY : parseInt(String(baseY), 10);

  for (const lineSegments of lines) {
    let currentXOffset = startX;

    for (const segment of lineSegments) {
      const escText = escapeForFFmpeg(segment.text);
      const color = normalizeColor(segment.color) || defaultColor;
      const fontSize = segment.fontSize || defaultFontSize;
      const borderParams = getBorderParams(
        segment,
        color,
        borderColor,
        borderWidth
      );

      filters.push(
        `drawtext=fontfile='${fontFile}':text='${escText}':fontsize=${fontSize}:fontcolor=${color}:x=${currentXOffset}:y=${currentY}${borderParams}`
      );

      currentXOffset += estimateTextWidth(segment.text, fontSize);
    }
    currentY += lineHeight;
  }

  return filters;
}

/**
 * Get border parameters based on segment settings and color
 */
function getBorderParams(
  segment: TextSegment,
  color: string,
  borderColor: string | null,
  borderWidth: number
): string {
  if (!borderColor) return "";

  // Black borders (ranking titles): always show
  // Yellow borders (main title): skip on white text, respect hasBorder
  const isBlackBorder = borderColor === "black";
  const isWhiteColor =
    color === "white" || color === "#ffffff" || color === "#fff";
  const segmentHasBorder = segment.hasBorder !== false;
  const shouldShowBorder = isBlackBorder || (segmentHasBorder && !isWhiteColor);

  return shouldShowBorder
    ? `:borderw=${borderWidth}:bordercolor=${borderColor}`
    : "";
}

/**
 * Escape special FFmpeg drawtext characters
 */
function escapeForFFmpeg(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}
