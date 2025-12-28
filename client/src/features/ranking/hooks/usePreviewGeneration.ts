/**
 * usePreviewGeneration hook
 *
 * Manages the state and logic for generating FFmpeg video previews.
 * Extracted from RankingVideos.tsx to reduce component complexity.
 */
import { useState, useCallback } from "react";
import { generateFullPreview, type TextSegment } from "../../../api/video.api";
import type { VideoInput, PreviewState } from "../types";

interface UsePreviewGenerationOptions {
  width: number;
  height: number;
}

interface UsePreviewGenerationReturn {
  previewState: PreviewState;
  failedVideoIndices: Set<number>;
  generatePreview: (
    mainTitle: TextSegment[],
    videos: VideoInput[],
    firstToPlay: number | null
  ) => Promise<void>;
  resetPreview: () => void;
  clearFailedIndex: (index: number) => void;
}

const initialPreviewState: PreviewState = {
  isGenerating: false,
  videoUrl: null,
  error: null,
};

/**
 * Hook for managing preview generation state and actions.
 *
 * @param options - Configuration including width and height
 * @returns State and handlers for preview generation
 */
export function usePreviewGeneration(
  options: UsePreviewGenerationOptions
): UsePreviewGenerationReturn {
  const { width, height } = options;

  const [previewState, setPreviewState] =
    useState<PreviewState>(initialPreviewState);
  const [failedVideoIndices, setFailedVideoIndices] = useState<Set<number>>(
    new Set()
  );

  const resetPreview = useCallback(() => {
    setPreviewState(initialPreviewState);
  }, []);

  const clearFailedIndex = useCallback((index: number) => {
    setFailedVideoIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const generatePreview = useCallback(
    async (
      mainTitle: TextSegment[],
      videos: VideoInput[],
      firstToPlay: number | null
    ) => {
      // Validation
      const mainTitleText = mainTitle[0]?.text || "";
      if (!mainTitleText.trim()) {
        setPreviewState({
          isGenerating: false,
          videoUrl: null,
          error: "Please enter a main title first",
        });
        return;
      }

      const emptyTitles = videos.filter((v) => !v.title[0]?.text.trim());
      if (emptyTitles.length > 0) {
        setPreviewState({
          isGenerating: false,
          videoUrl: null,
          error: "Please enter titles for all videos",
        });
        return;
      }

      const emptyUrls = videos.filter((v) => !v.url.trim());
      if (emptyUrls.length > 0) {
        setPreviewState({
          isGenerating: false,
          videoUrl: null,
          error: "Please enter URLs for all videos",
        });
        return;
      }

      // Start generation
      setPreviewState({ isGenerating: true, videoUrl: null, error: null });

      try {
        const response = await generateFullPreview(
          mainTitle,
          videos.map((v) => ({
            url: v.url,
            title: v.title,
            trimStart: v.trimStart,
            trimEnd: v.trimEnd,
            cropX: v.cropX,
            cropY: v.cropY,
            cropWidth: v.cropWidth,
            cropHeight: v.cropHeight,
            memeSounds: v.memeSounds?.map((s) => ({
              file: s.file,
              startTime: s.startTime,
              volume: s.volume,
            })),
          })),
          width,
          height,
          firstToPlay
        );

        // Extract failed video indices from warnings
        const failedIndices = new Set<number>();
        if (response.warnings?.failedVideos) {
          response.warnings.failedVideos.forEach((failure) => {
            failedIndices.add(failure.index);
          });
        }

        setFailedVideoIndices(failedIndices);
        setPreviewState({
          isGenerating: false,
          videoUrl: response.videoUrl,
          error: null,
          warnings: response.warnings,
        });
      } catch (err: unknown) {
        const error = err as {
          response?: { data?: { details?: string; error?: string } };
        };
        const errorMessage =
          error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to generate preview";
        setPreviewState({
          isGenerating: false,
          videoUrl: null,
          error: errorMessage,
          warnings: undefined,
        });
      }
    },
    [width, height]
  );

  return {
    previewState,
    failedVideoIndices,
    generatePreview,
    resetPreview,
    clearFailedIndex,
  };
}
