/**
 * ClipEditModal Component
 * Simplified modal for editing clip parameters (trim, crop, sounds)
 */

import { useState } from "react";
import type {
  RankingClip,
  CropPreset,
  CropAlign,
  TextSegment,
} from "@/types/ranking-video.schema";

interface ClipEditModalProps {
  clip: RankingClip;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: RankingClip) => void;
}

export function ClipEditModal({
  clip,
  isOpen,
  onClose,
  onSave,
}: ClipEditModalProps) {
  const [trimStart, setTrimStart] = useState(clip.trim.start);
  const [trimEnd, setTrimEnd] = useState(clip.trim.end);
  const [cropPreset, setCropPreset] = useState<CropPreset>(clip.crop.preset);
  const [cropScale, setCropScale] = useState(clip.crop.scale);
  const [cropAlign, setCropAlign] = useState<CropAlign>(clip.crop.align);
  const [label, setLabel] = useState<TextSegment[]>(clip.label);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...clip,
      trim: { start: trimStart, end: trimEnd },
      crop: { preset: cropPreset, scale: cropScale, align: cropAlign },
      label,
    });
    onClose();
  };

  const updateLabelText = (text: string) => {
    setLabel([{ ...label[0], text }]);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Clip #{clip.rank}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Trim Section */}
          <section className="edit-section">
            <h4>✂️ Trim</h4>
            <div className="input-group">
              <label>
                Start (seconds):
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                />
              </label>
              <label>
                End (seconds):
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                />
              </label>
            </div>
          </section>

          {/* C rop Section */}
          <section className="edit-section">
            <h4>🔲 Crop</h4>
            <div className="preset-buttons">
              {(["9:16", "1:1", "16:9", "full"] as CropPreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    className={`preset-btn ${
                      cropPreset === preset ? "active" : ""
                    }`}
                    onClick={() => setCropPreset(preset)}
                  >
                    {preset === "full" ? "Full" : preset}
                  </button>
                )
              )}
            </div>
            <label>
              Scale:
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={cropScale}
                onChange={(e) => setCropScale(parseFloat(e.target.value))}
              />
              <span>{(cropScale * 100).toFixed(0)}%</span>
            </label>
            <div className="align-buttons">
              {(["top", "center", "bottom"] as CropAlign[]).map((align) => (
                <button
                  key={align}
                  className={`align-btn ${cropAlign === align ? "active" : ""}`}
                  onClick={() => setCropAlign(align)}
                >
                  {align}
                </button>
              ))}
            </div>
          </section>

          {/* Label Section */}
          <section className="edit-section">
            <h4>📝 Title</h4>
            <input
              type="text"
              placeholder="Clip title..."
              value={label[0]?.text || ""}
              onChange={(e) => updateLabelText(e.target.value)}
            />
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
