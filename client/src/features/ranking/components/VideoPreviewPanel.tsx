// VideoPreviewPanel - Extracted from RankingVideos.tsx
// Displays the FFmpeg-generated preview video or loading/error states

import { useRef } from "react";
import type { PreviewProps } from "../types";

export function VideoPreviewPanel({
  mainTitle,
  videos,
  width,
  height,
  previewState,
  onGeneratePreview,
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const allVideosReady =
    mainTitle.length > 0 &&
    mainTitle[0].text.trim() !== "" &&
    videos.every(
      (v) =>
        v.src && v.title && v.title.length > 0 && v.title[0].text.trim() !== ""
    );

  return (
    <div className="live-preview-section">
      <label className="section-label">
        <span className="live-indicator"></span>
        Full Preview - Complete FFmpeg Output
        <span className="preview-dimensions">
          ({width}×{height})
        </span>
      </label>

      <div className="preview-container">
        <div className="preview-frame">
          <div className="preview-content">
            {previewState.isGenerating ? (
              <div className="preview-loading">
                <div className="preview-spinner"></div>
                <span>Generating full preview with FFmpeg...</span>
                <span className="preview-note">
                  Downloading all {videos.length} videos and creating
                  concatenated output
                </span>
              </div>
            ) : previewState.error ? (
              <div className="preview-error">
                <span className="error-icon">⚠️</span>
                <span>{previewState.error}</span>
                <button className="retry-btn" onClick={onGeneratePreview}>
                  Retry
                </button>
              </div>
            ) : previewState.videoUrl ? (
              <video
                ref={videoRef}
                src={previewState.videoUrl}
                className="preview-video-player"
                controls
                autoPlay
                muted
                loop
                key={previewState.videoUrl}
              />
            ) : allVideosReady ? (
              <div className="preview-waiting">
                <span className="waiting-icon">🎬</span>
                <span>Ready to generate full preview</span>
                <span className="preview-note">
                  This will download {videos.length} video
                  {videos.length > 1 ? "s" : ""}, add overlays, and concatenate
                  them
                </span>
                <button
                  className="download-preview-btn"
                  onClick={onGeneratePreview}
                >
                  Generate Full Preview
                </button>
              </div>
            ) : (
              <div className="preview-empty">
                <span className="empty-icon">📹</span>
                <span className="empty-text">
                  {mainTitle.length === 0 || mainTitle[0].text.trim() === ""
                    ? "Enter main title first"
                    : videos.some(
                        (v) =>
                          !v.title ||
                          v.title.length === 0 ||
                          v.title[0].text.trim() === ""
                      )
                    ? "Enter all video titles"
                    : "Add all video URLs"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show warnings if any videos failed */}
      {previewState.warnings && (
        <div className="preview-warnings">
          <div className="warning-header">
            <span className="warning-icon">⚠️</span>
            <strong>{previewState.warnings.message}</strong>
          </div>
          <div className="failed-videos-list">
            {previewState.warnings.failedVideos.map((failure, idx) => (
              <div key={idx} className="failed-video-item">
                <span className="failed-video-rank">#{failure.index + 1}</span>
                <div className="failed-video-details">
                  <div className="failed-video-url" title={failure.url}>
                    {failure.url.length > 50
                      ? `${failure.url.substring(0, 50)}...`
                      : failure.url}
                  </div>
                  <div className="failed-video-error">{failure.error}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="preview-hint">
        👆 This shows the complete final video with all clips concatenated.
        Generate to see the exact output!
      </div>
    </div>
  );
}
