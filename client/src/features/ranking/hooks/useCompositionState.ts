/**
 * useCompositionState Hook
 * Manages the RankingVideoComposition JSON state
 */

import { useState, useCallback } from "react";
import type {
  RankingVideoComposition,
  RankingClip,
  TextSegment,
  CropConfig,
  TrimConfig,
  MemeSound,
} from "@/types/ranking-video.schema";
import {
  DEFAULT_COMPOSITION_METADATA,
  DEFAULT_CROP_CONFIG,
} from "@/types/ranking-video.schema";

export function useCompositionState() {
  const [composition, setComposition] = useState<RankingVideoComposition>({
    version: "1.0",
    metadata: DEFAULT_COMPOSITION_METADATA,
    globalSettings: {
      mainTitle: [{ text: "", color: "white", fontSize: 64 }],
    },
    clips: [],
  });

  // Update main title
  const updateMainTitle = useCallback((title: TextSegment[]) => {
    setComposition((prev) => ({
      ...prev,
      globalSettings: { ...prev.globalSettings, mainTitle: title },
    }));
  }, []);

  // Add a new clip
  const addClip = useCallback((url: string, rank: number) => {
    const newClip: RankingClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      rank,
      source: { url },
      trim: { start: 0, end: 0 }, // Will be set when video loads
      crop: DEFAULT_CROP_CONFIG,
      label: [{ text: "", color: "white", fontSize: 52 }],
    };

    setComposition((prev) => ({
      ...prev,
      clips: [...prev.clips, newClip],
    }));

    return newClip.id;
  }, []);

  // Update clip
  const updateClip = useCallback(
    (id: string, updates: Partial<RankingClip>) => {
      setComposition((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) =>
          clip.id === id ? { ...clip, ...updates } : clip
        ),
      }));
    },
    []
  );

  // Update clip label
  const updateClipLabel = useCallback(
    (id: string, label: TextSegment[]) => {
      updateClip(id, { label });
    },
    [updateClip]
  );

  // Update clip trim
  const updateClipTrim = useCallback(
    (id: string, trim: TrimConfig) => {
      updateClip(id, { trim });
    },
    [updateClip]
  );

  // Update clip crop
  const updateClipCrop = useCallback(
    (id: string, crop: CropConfig) => {
      updateClip(id, { crop });
    },
    [updateClip]
  );

  // Update clip meme sounds
  const updateClipMemeSounds = useCallback(
    (id: string, memeSounds: MemeSound[]) => {
      updateClip(id, { memeSounds });
    },
    [updateClip]
  );

  // Remove clip
  const removeClip = useCallback((id: string) => {
    setComposition((prev) => ({
      ...prev,
      clips: prev.clips.filter((clip) => clip.id !== id),
    }));
  }, []);

  // Reorder clips
  const reorderClips = useCallback((fromIndex: number, toIndex: number) => {
    setComposition((prev) => {
      const newClips = [...prev.clips];
      const [removed] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, removed);
      return { ...prev, clips: newClips };
    });
  }, []);

  // Load composition from JSON
  const loadComposition = useCallback((data: RankingVideoComposition) => {
    setComposition(data);
  }, []);

  // Export composition as JSON
  const exportComposition = useCallback(() => {
    return JSON.stringify(composition, null, 2);
  }, [composition]);

  return {
    composition,
    updateMainTitle,
    addClip,
    updateClip,
    updateClipLabel,
    updateClipTrim,
    updateClipCrop,
    updateClipMemeSounds,
    removeClip,
    reorderClips,
    loadComposition,
    exportComposition,
  };
}
