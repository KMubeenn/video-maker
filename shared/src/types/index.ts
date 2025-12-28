/**
 * Shared Types for Video Maker
 * Used by both client and server for consistent emoji/text handling
 */

/**
 * A text segment with rich formatting.
 * Emojis are embedded as unicode characters within the text string.
 */
export interface TextSegment {
  text: string; // May contain emoji unicode characters
  color?: string;
  fontSize?: number;
  hasBorder?: boolean; // Enable border around text
}

/**
 * A layout node represents either a text run or an emoji.
 * This is the SINGLE SOURCE OF TRUTH for positioning.
 */
export type LayoutNode = TextLayoutNode | EmojiLayoutNode;

export interface TextLayoutNode {
  type: "text";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontSize: number;
  hasBorder: boolean;
}

export interface EmojiLayoutNode {
  type: "emoji";
  codepoint: string; // Twemoji format: "1f600" or "1f1fa-1f1f8"
  originalChar: string; // Original unicode emoji character(s)
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A single line of layout nodes
 */
export interface LayoutLine {
  y: number;
  height: number;
  nodes: LayoutNode[];
  totalWidth: number;
}

/**
 * Complete layout result for a text overlay
 */
export interface TextLayout {
  nodes: LayoutNode[];
  totalWidth: number;
  totalHeight: number;
  lines: LayoutLine[];
}

/**
 * Options for layout computation
 */
export interface LayoutOptions {
  maxWidth: number;
  defaultFontSize: number;
  defaultColor: string;
  lineHeight?: number; // Defaults to fontSize + 10
  letterSpacing?: number; // Extra space between characters
  alignment: "left" | "center";
  emojiScale?: number; // Scale factor for emoji size relative to text (default 1.0)
}
