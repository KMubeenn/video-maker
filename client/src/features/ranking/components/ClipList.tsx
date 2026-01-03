/**
 * ClipList Component
 * Reorderable list of ranking clips
 */

import { useState } from "react";
import type { RankingClip } from "@/types/ranking-video.schema";

interface ClipListProps {
  clips: RankingClip[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onEditClip: (clip: RankingClip) => void;
  onRemoveClip: (clipId: string) => void;
}

export function ClipList({
  clips,
  onReorder,
  onEditClip,
  onRemoveClip,
}: ClipListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder on drag over
    onReorder(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (clips.length === 0) {
    return (
      <div className="clip-list-empty">
        <span className="empty-icon">📹</span>
        <p>No clips added yet. Enter video URLs below to get started.</p>
      </div>
    );
  }

  return (
    <div className="clip-list">
      {clips.map((clip, index) => (
        <div
          key={clip.id}
          className={`clip-item ${draggedIndex === index ? "dragging" : ""}`}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
        >
          <div className="clip-drag-handle">
            <span className="drag-icon">⋮⋮</span>
          </div>

          <div className="clip-info">
            <div className="clip-rank">#{clip.rank}</div>
            <div className="clip-details">
              <div className="clip-label">
                {clip.label[0]?.text || (
                  <span className="placeholder">No title</span>
                )}
              </div>
              <div className="clip-url" title={clip.source.url}>
                {clip.source.url.length > 50
                  ? `${clip.source.url.substring(0, 50)}...`
                  : clip.source.url}
              </div>
              <div className="clip-meta">
                <span>
                  Trim: {clip.trim.start.toFixed(1)}s -{" "}
                  {clip.trim.end.toFixed(1)}s
                </span>
                <span className="separator">•</span>
                <span>Crop: {clip.crop.preset}</span>
              </div>
            </div>
          </div>

          <div className="clip-actions">
            <button
              className="btn-edit"
              onClick={() => onEditClip(clip)}
              title="Edit clip"
            >
              ✏️ Edit
            </button>
            <button
              className="btn-remove"
              onClick={() => onRemoveClip(clip.id)}
              title="Remove clip"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
