import { type TextSegment } from "../../../components/RichTextInput";
import { type TextOverlay } from "../../../types/timeline";
import {
  parseTextToSegments,
  getCachedEmojiImage,
} from "../../../services/emoji-image.service";

// Helper: Normalize colors
export const normalizeColor = (color: string | undefined): string => {
  if (!color) return "white";
  const map: Record<string, string> = {
    "#FFD700": "#FFC700",
    "#FF6B6B": "#E63946",
    "#4ECDC4": "#06AED5",
    "#95E1D3": "#2D9E6D",
  };
  return map[color] || color;
};

export const measureSegment = (
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number
) => {
  ctx.font = `${fontSize}px Impact, Arial, sans-serif`;
  return ctx.measureText(text).width;
};

export const wrapTextStats = (
  ctx: CanvasRenderingContext2D,
  segments: TextSegment[],
  maxWidth: number,
  defaultFontSize: number
) => {
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  for (const seg of segments) {
    const fontSize = seg.fontSize || defaultFontSize;
    const words = seg.text.split(" ");

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWithSpace = word + (i < words.length - 1 ? " " : "");
      const wordW = measureSegment(ctx, wordWithSpace, fontSize);

      if (currentLineWidth + wordW > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [{ ...seg, text: wordWithSpace }];
        currentLineWidth = wordW;
      } else {
        currentLine.push({ ...seg, text: wordWithSpace });
        currentLineWidth += wordW;
      }
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
};

// Pure function to render a single video frame with crop
export function renderVideoFrame(
  ctx: CanvasRenderingContext2D,
  videoEl: HTMLVideoElement,
  clip: {
    crop?: { x: number; y: number; width: number; height: number };
  },
  canvasWidth: number,
  canvasHeight: number,
  titleHeight: number = 300
) {
  const videoAreaHeight = canvasHeight - titleHeight;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  if (vw === 0 || vh === 0) return;

  const hasCrop = clip.crop && clip.crop.width > 0 && clip.crop.height > 0;
  const sx = hasCrop ? clip.crop!.x : 0;
  const sy = hasCrop ? clip.crop!.y : 0;
  const sw = hasCrop ? clip.crop!.width : vw;
  const sh = hasCrop ? clip.crop!.height : vh;

  if (sw > 0 && sh > 0) {
    const scale = Math.max(canvasWidth / sw, videoAreaHeight / sh);
    const scaledW = sw * scale;
    const scaledH = sh * scale;
    const dx = (canvasWidth - scaledW) / 2;
    const dy = titleHeight + (videoAreaHeight - scaledH) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, titleHeight, canvasWidth, videoAreaHeight);
    ctx.clip();
    ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, scaledW, scaledH);
    ctx.restore();
  }
}

// Pure function to render overlays
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number
) {
  // height is unused as title area is fixed/derived
  ctx.save();
  const fontBase = "Impact, Arial, sans-serif";
  const getSegColor = (seg: TextSegment) => normalizeColor(seg.color);

  if (overlay.type === "main-title") {
    const defaultFontSize = overlay.text[0]?.fontSize || 64;
    const maxWidth = 900;
    const lineHeight = defaultFontSize + 14;
    const letterSpacing = 4;
    const lines = wrapTextStats(ctx, overlay.text, maxWidth, defaultFontSize);

    let startY = 180;
    if (lines.length > 1) {
      startY -= ((lines.length - 1) * lineHeight) / 2;
    }

    lines.forEach((line, lineIdx) => {
      let lineWidth = 0;
      line.forEach((s) => {
        const segFontSize = s.fontSize || defaultFontSize;
        ctx.font = `${segFontSize}px ${fontBase}`;
        for (const char of s.text) {
          lineWidth += ctx.measureText(char).width + letterSpacing;
        }
      });
      lineWidth -= letterSpacing;

      let currentX = (width - lineWidth) / 2;
      const currentY = startY + lineIdx * lineHeight;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(
        currentX - 20,
        currentY - defaultFontSize,
        lineWidth + 40,
        defaultFontSize + 32
      );

      line.forEach((seg) => {
        const segFontSize = seg.fontSize || defaultFontSize;
        ctx.font = `${segFontSize}px ${fontBase}`;
        const segColor = getSegColor(seg);

        const isWhiteColor =
          segColor === "white" ||
          segColor === "#ffffff" ||
          segColor === "#fff" ||
          segColor === "rgb(255, 255, 255)";
        const shouldShowBorder = seg.hasBorder !== false && !isWhiteColor;

        ctx.textBaseline = "alphabetic";
        const parsed = parseTextToSegments(seg.text);

        for (const part of parsed) {
          if (part.type === "emoji") {
            const emojiImg = getCachedEmojiImage(part.content);
            if (emojiImg) {
              const emojiSize = segFontSize;
              const emojiY = currentY - segFontSize * 0.85;
              ctx.drawImage(emojiImg, currentX, emojiY, emojiSize, emojiSize);
              currentX += emojiSize + letterSpacing;
            } else {
              ctx.fillStyle = segColor;
              ctx.fillText(part.content, currentX, currentY);
              currentX += ctx.measureText(part.content).width + letterSpacing;
            }
          } else {
            for (const char of part.content) {
              if (shouldShowBorder) {
                ctx.strokeStyle = "#FFD700";
                ctx.lineWidth = 4;
                ctx.lineJoin = "round";
                ctx.strokeText(char, currentX, currentY);
              }
              ctx.fillStyle = segColor;
              ctx.fillText(char, currentX, currentY);
              currentX += ctx.measureText(char).width + letterSpacing;
            }
          }
        }
      });
    });
  } else if (overlay.type === "ranking-title") {
    const defaultFontSize = overlay.text[0]?.fontSize || 52;
    const maxWidth = 700;
    const lineHeight = defaultFontSize + 8;
    const lines = wrapTextStats(ctx, overlay.text, maxWidth, defaultFontSize);

    let currentY = overlay.y;

    lines.forEach((line) => {
      let currentX = typeof overlay.x === "number" ? overlay.x : 90;
      line.forEach((seg) => {
        const segFontSize = seg.fontSize || defaultFontSize;
        ctx.font = `${segFontSize}px ${fontBase}`;
        const segColor = getSegColor(seg);

        const parsed = parseTextToSegments(seg.text);
        for (const part of parsed) {
          if (part.type === "emoji") {
            const emojiImg = getCachedEmojiImage(part.content);
            if (emojiImg) {
              const emojiSize = segFontSize;
              const emojiY = currentY - segFontSize * 0.85;
              ctx.drawImage(emojiImg, currentX, emojiY, emojiSize, emojiSize);
              currentX += emojiSize;
            } else {
              ctx.fillStyle = segColor;
              ctx.strokeStyle = "black";
              ctx.lineWidth = 3;
              ctx.lineJoin = "round";
              ctx.strokeText(part.content, currentX, currentY);
              ctx.fillText(part.content, currentX, currentY);
              currentX += ctx.measureText(part.content).width;
            }
          } else {
            ctx.fillStyle = segColor;
            ctx.strokeStyle = "black";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.strokeText(part.content, currentX, currentY);
            ctx.fillText(part.content, currentX, currentY);
            currentX += ctx.measureText(part.content).width;
          }
        }
      });
      currentY += lineHeight;
    });
  } else if (overlay.type === "ranking-number") {
    const fontSize = 52;
    let currentX = 30;
    const currentY = overlay.y;

    overlay.text.forEach((seg) => {
      ctx.font = `${seg.fontSize || fontSize}px ${fontBase}`;
      ctx.fillStyle = getSegColor(seg);
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(seg.text, currentX, currentY);
      ctx.fillText(seg.text, currentX, currentY);
      currentX += ctx.measureText(seg.text).width;
    });
  }

  ctx.restore();
}
