/**
 * Emoji Image Service
 * Loads and caches Twemoji images for canvas rendering
 */

// Emoji regex for detection
const EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu;

// Image cache
const emojiImageCache: Map<string, HTMLImageElement> = new Map();
const pendingLoads: Map<string, Promise<HTMLImageElement>> = new Map();

/**
 * Convert emoji to Twemoji codepoint format
 */
export function emojiToCodepoint(emoji: string): string {
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
 * Get Twemoji CDN URL for an emoji
 */
export function getTwemojiUrl(emoji: string): string {
  const codepoint = emojiToCodepoint(emoji);
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codepoint}.png`;
}

/**
 * Load an emoji image, returning from cache if available
 */
export async function loadEmojiImage(emoji: string): Promise<HTMLImageElement> {
  const cached = emojiImageCache.get(emoji);
  if (cached) return cached;

  const pending = pendingLoads.get(emoji);
  if (pending) return pending;

  const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      emojiImageCache.set(emoji, img);
      pendingLoads.delete(emoji);
      resolve(img);
    };

    img.onerror = () => {
      pendingLoads.delete(emoji);
      console.warn(`Failed to load emoji: ${emoji}`);
      reject(new Error(`Failed to load emoji: ${emoji}`));
    };

    img.src = getTwemojiUrl(emoji);
  });

  pendingLoads.set(emoji, loadPromise);
  return loadPromise;
}

/**
 * Preload emojis found in text segments
 */
export async function preloadEmojisFromText(text: string): Promise<void> {
  const emojis = extractEmojis(text);
  await Promise.allSettled(emojis.map(loadEmojiImage));
}

/**
 * Get cached emoji image (synchronous - returns undefined if not cached)
 */
export function getCachedEmojiImage(
  emoji: string
): HTMLImageElement | undefined {
  return emojiImageCache.get(emoji);
}

/**
 * Check if text contains emojis
 */
export function containsEmoji(text: string): boolean {
  EMOJI_REGEX.lastIndex = 0;
  return EMOJI_REGEX.test(text);
}

/**
 * Extract all emojis from text
 */
export function extractEmojis(text: string): string[] {
  EMOJI_REGEX.lastIndex = 0;
  const matches = text.match(EMOJI_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Parsed segment from text
 */
export interface ParsedSegment {
  type: "text" | "emoji";
  content: string;
}

/**
 * Parse text into text and emoji segments
 */
export function parseTextToSegments(text: string): ParsedSegment[] {
  if (!text) return [];

  const result: ParsedSegment[] = [];
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
    result.push({
      type: "emoji",
      content: match[0],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return result;
}

/**
 * Draw text with emojis on canvas
 * This handles mixed text/emoji content
 */
export function drawTextWithEmojis(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  options?: {
    fillStyle?: string;
    strokeStyle?: string;
    strokeWidth?: number;
    letterSpacing?: number;
  }
): number {
  const segments = parseTextToSegments(text);
  let currentX = x;
  const letterSpacing = options?.letterSpacing ?? 0;

  for (const segment of segments) {
    if (segment.type === "emoji") {
      const emojiImg = getCachedEmojiImage(segment.content);
      if (emojiImg) {
        // Draw emoji as image, scaled to match font size
        const emojiSize = fontSize;
        // Adjust Y to align emoji baseline with text (emoji is drawn from top-left)
        const emojiY = y - fontSize * 0.85; // Approximate baseline adjustment
        ctx.drawImage(emojiImg, currentX, emojiY, emojiSize, emojiSize);
        currentX += emojiSize + letterSpacing;
      } else {
        // Emoji not cached, draw as text fallback
        if (options?.strokeStyle && options?.strokeWidth) {
          ctx.strokeStyle = options.strokeStyle;
          ctx.lineWidth = options.strokeWidth;
          ctx.strokeText(segment.content, currentX, y);
        }
        ctx.fillStyle = options?.fillStyle || "white";
        ctx.fillText(segment.content, currentX, y);
        currentX += ctx.measureText(segment.content).width + letterSpacing;
      }
    } else {
      // Regular text
      for (const char of segment.content) {
        if (options?.strokeStyle && options?.strokeWidth) {
          ctx.strokeStyle = options.strokeStyle;
          ctx.lineWidth = options.strokeWidth;
          ctx.lineJoin = "round";
          ctx.strokeText(char, currentX, y);
        }
        ctx.fillStyle = options?.fillStyle || "white";
        ctx.fillText(char, currentX, y);
        currentX += ctx.measureText(char).width + letterSpacing;
      }
    }
  }

  return currentX - x; // Return total width drawn
}

/**
 * Measure text with emojis
 */
export function measureTextWithEmojis(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  letterSpacing: number = 0
): number {
  const segments = parseTextToSegments(text);
  let totalWidth = 0;

  for (const segment of segments) {
    if (segment.type === "emoji") {
      totalWidth += fontSize + letterSpacing;
    } else {
      for (const char of segment.content) {
        totalWidth += ctx.measureText(char).width + letterSpacing;
      }
    }
  }

  // Remove last letter spacing
  if (text.length > 0) {
    totalWidth -= letterSpacing;
  }

  return totalWidth;
}

/**
 * Clear the emoji image cache
 */
export function clearEmojiCache(): void {
  emojiImageCache.clear();
  pendingLoads.clear();
}
