/**
 * RankingEditor Component
 * Main container for the Remotion-based ranking video editor
 */

import { useState } from "react";
import { useCompositionState } from "../hooks/useCompositionState";
import { RemotionPreview } from "./RemotionPreview";
import { ClipList } from "./ClipList";
import { ClipEditModal } from "./ClipEditModal";
import type {
  RankingClip,
  TextSegment,
} from "@/types/ranking-video.schema";
import "./RankingEditor.css";

export function RankingEditor() {
  const {
    composition,
    updateMainTitle,
    addClip,
    updateClip,
    removeClip,
    reorderClips,
  } = useCompositionState();

  const [editingClip, setEditingClip] = useState<RankingClip | null>(null);
  const [videoUrls, setVideoUrls] = useState<string[]>(["", "", ""]);

  // Handle main title change
  const handleMainTitleChange = (text: string) => {
    updateMainTitle([{ text, color: "white", fontSize: 64 }]);
  };

  // Handle video URL input
  const handleUrlChange = (index: number, url: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = url;
    setVideoUrls(newUrls);
  };

  // Add clip from URL
  const handleAddClip = (url: string, rank: number) => {
    if (!url || url.trim().length === 0) return;

    const clipId = addClip(url, rank);

    // TODO: Fetch video metadata to set trim.end to actual duration
    // For now, set a default duration
    updateClip(clipId, {
      trim: { start: 0, end: 10 },
    });
  };

  // Handle save from edit modal
  const handleSaveClip = (updated: RankingClip) => {
    updateClip(updated.id, updated);
    setEditingClip(null);
  };

  // Generate video
  const handleGenerateVideo = async () => {
    console.log("Generate video with composition:", composition);
    // TODO: Call API endpoint to render with Remotion
    alert("Remotion rendering not yet implemented on server");
  };

  return (
    <div className="ranking-editor">
      <div className="editor-header">
        <h1>🎬 Remotion Video Editor</h1>
        <p className="editor-subtitle">
          Template-driven ranking video creation
        </p>
      </div>

      <div className="editor-layout">
        {/* Left Panel - Configuration */}
        <div className="editor-panel editor-config">
          <section className="config-section">
            <h3>📝 Global Settings</h3>
            <label className="config-label">
              Main Title:
              <input
                type="text"
                className="main-title-input"
                placeholder="Enter main title..."
                value={composition.globalSettings.mainTitle[0]?.text || ""}
                onChange={(e) => handleMainTitleChange(e.target.value)}
              />
            </label>
          </section>

          <section className="config-section">
            <h3>🎥 Video Clips</h3>

            {/* Video URL Inputs */}
            <div className="url-inputs">
              {[0, 1, 2].map((index) => (
                <div key={index} className="url-input-group">
                  <label>Rank #{index + 1}:</label>
                  <div className="url-input-row">
                    <input
                      type="text"
                      placeholder="https://tiktok.com/@user/video/..."
                      value={videoUrls[index]}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                    />
                    <button
                      className="btn-add"
                      onClick={() => handleAddClip(videoUrls[index], index + 1)}
                      disabled={
                        !videoUrls[index] ||
                        composition.clips.some((c) => c.rank === index + 1)
                      }
                    >
                      {composition.clips.some((c) => c.rank === index + 1)
                        ? "✓"
                        : "+"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Clip List */}
            <ClipList
              clips={composition.clips}
              onReorder={reorderClips}
              onEditClip={setEditingClip}
              onRemoveClip={removeClip}
            />
          </section>

          <section className="config-section">
            <button
              className="btn-generate"
              onClick={handleGenerateVideo}
              disabled={composition.clips.length === 0}
            >
              🎬 Generate Video
            </button>
          </section>
        </div>

        {/* Right Panel - Preview */}
        <div className="editor-panel editor-preview">
          <h3>👁️ Live Preview</h3>
          <RemotionPreview composition={composition} />
        </div>
      </div>

      {/* Edit Modal */}
      {editingClip && (
        <ClipEditModal
          clip={editingClip}
          isOpen={true}
          onClose={() => setEditingClip(null)}
          onSave={handleSaveClip}
        />
      )}
    </div>
  );
}
