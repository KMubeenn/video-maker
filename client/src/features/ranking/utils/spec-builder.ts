import type { TextSegment } from "../../../components/RichTextInput";
import type { EditedClip, RenderSpec } from "../types";

/**
 * Builds a frame-accurate render specification from edited clips.
 *
 * @param clips Array of EditedClip objects
 * @param fps Frames per second (default 30)
 * @returns RenderSpec containing the positioned sequence
 */
export function buildRenderSpec(
  clips: EditedClip[],
  mainTitle: TextSegment[],
  mainTitlePresetId?: string,
  fps: number = 30
): RenderSpec {
  const sequence: RenderSpec["sequence"] = [];
  const slots: RenderSpec["slots"] = clips.map((c) => ({
    slotIndex: c.slotIndex,
    id: c.id,
  }));
  let currentStartFrame = 0;

  // Main Title Config
  const mainTitleConfig =
    mainTitle && mainTitle.length > 0
      ? {
          text: mainTitle,
          presetId: mainTitlePresetId,
        }
      : undefined;

  for (const clip of clips) {
    // Determine duration in seconds
    let durationSec = clip.duration;

    // If trimmed, use trim duration
    if (clip.trim) {
      durationSec = Math.max(0, clip.trim.end - clip.trim.start);
    }

    // Convert to frames
    // Ensure at least 1 frame if duration > 0 to render something
    // If duration is 0 (e.g. empty placeholder), it might be 0 frames
    const durationFrames = Math.max(
      durationSec > 0 ? 1 : 0,
      Math.round(durationSec * fps)
    );

    if (durationFrames > 0) {
      sequence.push({
        clip,
        startFrame: currentStartFrame,
        durationInFrames: durationFrames,
      });

      currentStartFrame += durationFrames;
    }
  }

  return {
    fps,
    mainTitle: mainTitleConfig,
    slots,
    sequence,
  };
}
