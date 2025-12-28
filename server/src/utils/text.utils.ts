/**
 * Text utility functions for video rendering
 * Pure functions that can be tested independently
 */

import type { TextSegment } from "../types/index.js";

/**
 * Estimate character width for Impact font with accurate measurements
 * Based on actual Impact font measurements at 52px baseline
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;

  for (const char of text) {
    let ratio;
    if (char === " ") {
      ratio = 0.45; // Space is about 45% of font size
    } else if (/[A-Z]/.test(char)) {
      // Uppercase varies by letter, using specific measurements
      const wideChars = "MWOQ";
      const narrowChars = "IJ";
      const mediumWideChars = "VCDG"; // V, C, D, G are medium-wide
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
 * Normalize colors - convert old light colors to new darker/saturated versions
 */
export function normalizeColor(color: string | undefined): string {
  if (!color) return "white";

  const colorMap: Record<string, string> = {
    "#FFD700": "#FFC700", // Old yellow -> New darker yellow
    "#FF6B6B": "#E63946", // Old red -> New deeper red
    "#4ECDC4": "#06AED5", // Old cyan -> New deeper cyan
    "#95E1D3": "#2D9E6D", // Old green -> New forest green
  };

  return colorMap[color] || color; // Return mapped color or original if not in map
}

/**
 * Split text segments into multiple lines - splits long segments by words
 */
export function splitIntoLines(
  segments: TextSegment[],
  maxWidth: number,
  defaultFontSize: number
): TextSegment[][] {
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  for (const segment of segments) {
    const segmentWidth = estimateTextWidth(
      segment.text,
      segment.fontSize || defaultFontSize
    );

    // If this single segment is too wide, split it by words
    if (segmentWidth > maxWidth) {
      const words = segment.text.split(" ");

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue; // Skip empty strings

        const wordSegment: TextSegment = {
          text: i < words.length - 1 ? word + " " : word,
        };
        if (segment.color !== undefined) wordSegment.color = segment.color;
        if (segment.fontSize !== undefined)
          wordSegment.fontSize = segment.fontSize;

        const wordWidth = estimateTextWidth(
          wordSegment.text,
          segment.fontSize || defaultFontSize
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
