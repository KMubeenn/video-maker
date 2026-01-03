/**
 * Ranking Feature Exports
 * Clean exports for all ranking-related components
 */

// Legacy components
export { VideoPreviewPanel } from "./components/VideoPreviewPanel";

// New Remotion-based components
export { RankingEditor } from "./components/RankingEditor";
export { RemotionPreview } from "./components/RemotionPreview";
export { ClipList } from "./components/ClipList";
export { ClipEditModal } from "./components/ClipEditModal";

// Hooks
export { useCompositionState } from "./hooks/useCompositionState";
export { convertToRemotionComposition } from "./utils/convertToRemotion";

// Export types
export type { VideoInput, PreviewState } from "./types";
export type {
  RankingVideoComposition,
  RankingClip,
  TextSegment,
  CropConfig,
  TrimConfig,
  MemeSound,
} from "@/types/ranking-video.schema";
