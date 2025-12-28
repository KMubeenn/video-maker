/**
 * FFmpeg Text Filter Generation
 * Creates drawtext filters for video overlays
 */

import type { TextSegment } from "../../../types/index.js";
import {
  estimateTextWidth,
  normalizeColor,
  splitIntoLines,
} from "../../../utils/index.js";

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
 * Create centered text filters (for main titles)
 */
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
