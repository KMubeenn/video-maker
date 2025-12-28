/**
 * Shared Layout Engine
 *
 * This is the SINGLE SOURCE OF TRUTH for text + emoji layout.
 * Used by both client preview and server FFmpeg export to ensure
 * pixel-perfect consistency between preview and final output.
 */

import type {
  TextSegment,
  LayoutNode,
  TextLayoutNode,
  EmojiLayoutNode,
  LayoutLine,
  TextLayout,
  LayoutOptions,
} from "../types/index.js";

import {
  parseTextToSegments,
  type ParsedSegment,
} from "../utils/emoji.utils.js";
import {
  estimateTextWidth,
  estimateEmojiWidth,
  normalizeColor,
} from "../utils/text.utils.js";

/**
 * Default layout options
 */
const DEFAULT_OPTIONS: Partial<LayoutOptions> = {
  defaultFontSize: 52,
  defaultColor: "white",
  alignment: "center",
  emojiScale: 1.0,
};

/**
 * Compute the complete layout for text segments.
 * Returns LayoutNode[] with x, y, width, height for each text run and emoji.
 *
 * @param segments - Array of TextSegment with formatted text (may contain emojis)
 * @param options - Layout options (maxWidth, fontSize, alignment, etc.)
 * @returns TextLayout with all nodes positioned
 */
export function computeTextLayout(
  segments: TextSegment[],
  options: LayoutOptions
): TextLayout {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lineHeight = opts.lineHeight ?? opts.defaultFontSize + 10;
  const emojiScale = opts.emojiScale ?? 1.0;

  // Step 1: Parse all segments into atomic units (text runs + emojis)
  const atomicUnits: AtomicUnit[] = [];

  for (const segment of segments) {
    const parsed = parseTextToSegments(segment.text);

    for (const p of parsed) {
      const fontSize = segment.fontSize ?? opts.defaultFontSize;

      if (p.type === "emoji") {
        atomicUnits.push({
          type: "emoji",
          content: p.content,
          fontSize,
          color: normalizeColor(segment.color) || opts.defaultColor,
          hasBorder: segment.hasBorder ?? false,
          width: estimateEmojiWidth(fontSize, emojiScale),
        });
      } else {
        // Text can be further split by words for line wrapping
        atomicUnits.push({
          type: "text",
          content: p.content,
          fontSize,
          color: normalizeColor(segment.color) || opts.defaultColor,
          hasBorder: segment.hasBorder ?? false,
          width: estimateTextWidth(p.content, fontSize),
        });
      }
    }
  }

  // Step 2: Wrap into lines
  const lines: AtomicUnit[][] = wrapIntoLines(
    atomicUnits,
    opts.maxWidth,
    opts.defaultFontSize
  );

  // Step 3: Position each unit
  const layoutLines: LayoutLine[] = [];
  const allNodes: LayoutNode[] = [];
  let currentY = 0;

  for (const lineUnits of lines) {
    const lineWidth = lineUnits.reduce((sum, u) => sum + u.width, 0);
    const lineNodes: LayoutNode[] = [];

    // Calculate starting X based on alignment
    let currentX = 0;
    if (opts.alignment === "center") {
      currentX = (opts.maxWidth - lineWidth) / 2;
    }

    for (const unit of lineUnits) {
      const height = unit.fontSize;

      if (unit.type === "emoji") {
        const node: EmojiLayoutNode = {
          type: "emoji",
          codepoint: emojiToCodepointInternal(unit.content),
          originalChar: unit.content,
          x: currentX,
          y: currentY,
          width: unit.width,
          height: height * (opts.emojiScale ?? 1.0),
        };
        lineNodes.push(node);
        allNodes.push(node);
      } else {
        const node: TextLayoutNode = {
          type: "text",
          content: unit.content,
          x: currentX,
          y: currentY,
          width: unit.width,
          height,
          color: unit.color,
          fontSize: unit.fontSize,
          hasBorder: unit.hasBorder,
        };
        lineNodes.push(node);
        allNodes.push(node);
      }

      currentX += unit.width;
    }

    const maxHeight = lineUnits.reduce(
      (max, u) =>
        Math.max(
          max,
          u.type === "emoji"
            ? u.fontSize * (opts.emojiScale ?? 1.0)
            : u.fontSize
        ),
      0
    );

    layoutLines.push({
      y: currentY,
      height: maxHeight,
      nodes: lineNodes,
      totalWidth: lineWidth,
    });

    currentY += lineHeight;
  }

  // Calculate total dimensions
  const totalWidth = Math.max(...layoutLines.map((l) => l.totalWidth), 0);
  const totalHeight =
    currentY > 0
      ? currentY -
        lineHeight +
        (layoutLines[layoutLines.length - 1]?.height ?? 0)
      : 0;

  return {
    nodes: allNodes,
    totalWidth,
    totalHeight,
    lines: layoutLines,
  };
}

/**
 * Internal atomic unit for layout calculation
 */
interface AtomicUnit {
  type: "text" | "emoji";
  content: string;
  fontSize: number;
  color: string;
  hasBorder: boolean;
  width: number;
}

/**
 * Wrap atomic units into lines based on max width.
 * Text units can be split by words; emojis are atomic.
 */
function wrapIntoLines(
  units: AtomicUnit[],
  maxWidth: number,
  defaultFontSize: number
): AtomicUnit[][] {
  const lines: AtomicUnit[][] = [];
  let currentLine: AtomicUnit[] = [];
  let currentLineWidth = 0;

  for (const unit of units) {
    if (unit.type === "emoji") {
      // Emojis are atomic - can't be split
      if (currentLineWidth + unit.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [unit];
        currentLineWidth = unit.width;
      } else {
        currentLine.push(unit);
        currentLineWidth += unit.width;
      }
    } else {
      // Text can be split by words
      const words = unit.content.split(/(\s+)/);

      for (const word of words) {
        if (!word) continue;

        const wordWidth = estimateTextWidth(word, unit.fontSize);
        const wordUnit: AtomicUnit = {
          ...unit,
          content: word,
          width: wordWidth,
        };

        if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
          // Check if it's just whitespace - don't start new line with whitespace
          if (word.trim().length === 0) {
            continue;
          }
          lines.push(currentLine);
          currentLine = [wordUnit];
          currentLineWidth = wordWidth;
        } else {
          currentLine.push(wordUnit);
          currentLineWidth += wordWidth;
        }
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Merge consecutive text units on each line for cleaner output
  return lines.map((line) => mergeConsecutiveTextUnits(line));
}

/**
 * Merge consecutive text units into single units.
 * This reduces the number of drawtext calls in FFmpeg.
 */
function mergeConsecutiveTextUnits(units: AtomicUnit[]): AtomicUnit[] {
  const merged: AtomicUnit[] = [];

  for (const unit of units) {
    const last = merged[merged.length - 1];

    if (
      last &&
      unit.type === "text" &&
      last.type === "text" &&
      last.fontSize === unit.fontSize &&
      last.color === unit.color &&
      last.hasBorder === unit.hasBorder
    ) {
      // Merge with previous text unit
      last.content += unit.content;
      last.width += unit.width;
    } else {
      merged.push({ ...unit });
    }
  }

  return merged;
}

/**
 * Convert emoji to Twemoji codepoint format (internal helper to avoid circular import)
 */
function emojiToCodepointInternal(emoji: string): string {
  const codepoints: string[] = [];

  for (const char of emoji) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined && codepoint !== 0xfe0f) {
      codepoints.push(codepoint.toString(16).toLowerCase());
    }
  }

  return codepoints.join("-");
}

/**
 * Re-export types for convenience
 */
export type {
  TextSegment,
  LayoutNode,
  TextLayoutNode,
  EmojiLayoutNode,
  LayoutLine,
  TextLayout,
  LayoutOptions,
};
