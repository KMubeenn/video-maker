/**
 * Text Width Estimation Utilities
 * Accurate character width estimation for Impact font
 */

import type { TextSegment } from "../types/index.js";

/**
 * Estimate character width for Impact font with accurate measurements.
 * Based on actual Impact font measurements at 52px baseline.
 *
 * This function is used by both client (for preview) and server (for FFmpeg)
 * to ensure consistent text layout.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;

  for (const char of text) {
    let ratio: number;

    if (char === " ") {
      ratio = 0.45; // Space is about 45% of font size
    } else if (/[A-Z]/.test(char)) {
      // Uppercase varies by letter, using specific measurements
      const wideChars = "MWOQ";
      const narrowChars = "IJ";
      const mediumWideChars = "VCDG";

      if (wideChars.includes(char)) {
        ratio = 0.7; // Impact: M is very wide
      } else if (narrowChars.includes(char)) {
        ratio = 0.35;
      } else if (mediumWideChars.includes(char)) {
        ratio = 0.65;
      } else {
        ratio = 0.58; // Impact: Average uppercase is quite blocky
      }
    } else if (/[a-z]/.test(char)) {
      // Lowercase average
      const wideChars = "mw";
      const narrowChars = "ijlt";
      const mediumChars = "vng";

      if (wideChars.includes(char)) {
        ratio = 0.62;
      } else if (narrowChars.includes(char)) {
        ratio = 0.3;
      } else if (mediumChars.includes(char)) {
        ratio = 0.52;
      } else {
        ratio = 0.49;
      }
    } else if (/[0-9]/.test(char)) {
      ratio = 0.55; // Numbers are slightly wider in Impact
    } else {
      ratio = 0.45; // Punctuation and others
    }

    width += fontSize * ratio;
  }

  return width;
}

/**
 * Estimate the width of an emoji at a given font size.
 * Emojis are typically rendered as square images scaled to match line height.
 */
export function estimateEmojiWidth(
  fontSize: number,
  emojiScale: number = 1.0
): number {
  // Emojis are square, so width = height = fontSize * scale
  return fontSize * emojiScale;
}

/**
 * Normalize colors - convert old light colors to new darker/saturated versions.
 * Ensures consistent color rendering between preview and export.
 */
export function normalizeColor(color: string | undefined): string {
  if (!color) return "white";

  const colorMap: Record<string, string> = {
    "#FFD700": "#FFC700", // Old yellow -> New darker yellow
    "#FF6B6B": "#E63946", // Old red -> New deeper red
    "#4ECDC4": "#06AED5", // Old cyan -> New deeper cyan
    "#95E1D3": "#2D9E6D", // Old green -> New forest green
  };

  return colorMap[color] || color;
}

/**
 * Split text segments into multiple lines based on max width.
 * Now handles emojis as atomic units that cannot be split.
 */
export function splitIntoLines(
  segments: TextSegment[],
  maxWidth: number,
  defaultFontSize: number,
  emojiScale: number = 1.0
): TextSegment[][] {
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  for (const segment of segments) {
    const fontSize = segment.fontSize || defaultFontSize;
    const segmentWidth = estimateSegmentWidth(
      segment.text,
      fontSize,
      emojiScale
    );

    // If this single segment is too wide, split it by words
    if (segmentWidth > maxWidth) {
      const words = segment.text.split(" ");

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;

        const wordWithSpace = i < words.length - 1 ? word + " " : word;
        const wordSegment: TextSegment = {
          text: wordWithSpace,
          color: segment.color,
          fontSize: segment.fontSize,
          hasBorder: segment.hasBorder,
        };

        const wordWidth = estimateSegmentWidth(
          wordWithSpace,
          fontSize,
          emojiScale
        );

        if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [wordSegment];
          currentLineWidth = wordWidth;
        } else {
          currentLine.push(wordSegment);
          currentLineWidth += wordWidth;
        }
      }
    } else {
      // Segment fits - check if adding it would exceed max
      if (
        currentLineWidth + segmentWidth > maxWidth &&
        currentLine.length > 0
      ) {
        // Skip whitespace-only segments at line breaks
        if (segment.text.trim().length === 0) {
          lines.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
          continue;
        }

        lines.push(currentLine);
        currentLine = [segment];
        currentLineWidth = segmentWidth;
      } else {
        currentLine.push(segment);
        currentLineWidth += segmentWidth;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Estimate total width of a segment text, accounting for emojis.
 * Uses inline emoji detection to avoid circular dependency.
 */
function estimateSegmentWidth(
  text: string,
  fontSize: number,
  emojiScale: number
): number {
  // Inline emoji regex to avoid circular import
  const EMOJI_REGEX =
    /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu;

  let totalWidth = 0;
  let lastIndex = 0;

  EMOJI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    // Add width of text before this emoji
    if (match.index > lastIndex) {
      totalWidth += estimateTextWidth(
        text.slice(lastIndex, match.index),
        fontSize
      );
    }
    // Add emoji width
    totalWidth += estimateEmojiWidth(fontSize, emojiScale);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last emoji
  if (lastIndex < text.length) {
    totalWidth += estimateTextWidth(text.slice(lastIndex), fontSize);
  }

  return totalWidth;
}
