/**
 * Emoji Utilities
 * Parse and handle emoji characters for consistent rendering
 */

/**
 * Regex for detecting emoji characters.
 * Handles:
 * - Basic emojis (single codepoint)
 * - ZWJ sequences (family emojis, etc.)
 * - Skin tone modifiers
 * - Flag emojis (regional indicators)
 * - Keycap sequences
 */
const EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu;

/**
 * Parsed segment from text - either text or emoji
 */
export interface ParsedSegment {
  type: "text" | "emoji";
  content: string;
}

/**
 * Parse text into alternating text and emoji segments.
 * Preserves order and handles all emoji types.
 *
 * @example
 * parseTextToSegments("Hello 👋 World 🌍!")
 * // Returns:
 * // [
 * //   { type: 'text', content: 'Hello ' },
 * //   { type: 'emoji', content: '👋' },
 * //   { type: 'text', content: ' World ' },
 * //   { type: 'emoji', content: '🌍' },
 * //   { type: 'text', content: '!' }
 * // ]
 */
export function parseTextToSegments(text: string): ParsedSegment[] {
  if (!text) return [];

  const result: ParsedSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  EMOJI_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    // Add any text before this emoji
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the emoji
    result.push({
      type: "emoji",
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last emoji
  if (lastIndex < text.length) {
    result.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return result;
}

/**
 * Convert an emoji character to Twemoji codepoint format.
 * Removes variation selectors (FE0F) for cleaner codepoints.
 *
 * @example
 * emojiToCodepoint('😀') // Returns: '1f600'
 * emojiToCodepoint('👍🏽') // Returns: '1f44d-1f3fd'
 * emojiToCodepoint('🇺🇸') // Returns: '1f1fa-1f1f8'
 * emojiToCodepoint('👨‍👩‍👧') // Returns: '1f468-200d-1f469-200d-1f467'
 */
export function emojiToCodepoint(emoji: string): string {
  const codepoints: string[] = [];

  for (const char of emoji) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined) {
      // Skip variation selector-16 (FE0F) as Twemoji doesn't include it in filenames
      if (codepoint !== 0xfe0f) {
        codepoints.push(codepoint.toString(16).toLowerCase());
      }
    }
  }

  return codepoints.join("-");
}

/**
 * Get the Twemoji CDN URL for an emoji.
 * Uses the official Twemoji CDN.
 *
 * @param emoji - The emoji character(s)
 * @param size - Image size (72 is the standard high-res size)
 */
export function getTwemojiUrl(emoji: string, size: 72 | 36 = 72): string {
  const codepoint = emojiToCodepoint(emoji);
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/${size}x${size}/${codepoint}.png`;
}

/**
 * Check if a string contains any emoji characters.
 */
export function containsEmoji(text: string): boolean {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

/**
 * Count the number of emojis in a string.
 */
export function countEmojis(text: string): number {
  EMOJI_REGEX.lastIndex = 0;
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Extract all unique emojis from text.
 */
export function extractEmojis(text: string): string[] {
  EMOJI_REGEX.lastIndex = 0;
  const matches = text.match(EMOJI_REGEX);
  return matches ? [...new Set(matches)] : [];
}
