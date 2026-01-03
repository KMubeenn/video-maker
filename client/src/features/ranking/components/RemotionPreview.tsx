/**
 * RemotionPreview Component
 * Wrapper for Remotion Player
 */

import { Player } from "@remotion/player";
import { RankingVideoTemplate } from "../../../remotion/RankingVideoTemplate";
import type { RankingVideoComposition } from "@/types/ranking-video.schema";
import { calculateTotalDuration } from "../../../remotion/utils/calculateDuration";

interface RemotionPreviewProps {
  composition: RankingVideoComposition;
}

export function RemotionPreview({ composition }: RemotionPreviewProps) {
  const { width, height, fps } = composition.metadata;
  const totalDurationFrames = calculateTotalDuration(composition.clips, fps);

  // Don't show player if no clips
  if (composition.clips.length === 0 || totalDurationFrames === 0) {
    return (
      <div className="preview-empty">
        <span className="empty-icon">📹</span>
        <span className="empty-text">Add video clips to see preview</span>
      </div>
    );
  }

  return (
    <div
      className="remotion-preview-container"
      style={{ width: "100%", height: "auto" }}
    >
      <Player
        component={RankingVideoTemplate}
        inputProps={{ data: composition }}
        durationInFrames={totalDurationFrames}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        style={{
          width: "100%",
          height: "auto",
          maxHeight: "80vh",
        }}
        controls
        loop
      />
    </div>
  );
}
