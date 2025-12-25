import { useState, useRef } from "react";
import {
  generateFullPreview,
  uploadVideoFile,
  preparePreview,
  type RankingVideoInput,
  type TextSegment,
} from "../api/video.api";
import { RichTextInput } from "../components/RichTextInput";
import { RealtimePreview } from "../components/RealtimePreview";
import { VideoEditor } from "../components/VideoEditor";
import "./RankingVideos.css";

interface VideoInput extends Omit<RankingVideoInput, "title"> {
  id: number;
  title: TextSegment[]; // Using TextSegment[] for formatted titles
}

// Single Preview State
interface PreviewState {
  isGenerating: boolean;
  videoUrl: string | null;
  error: string | null;
  warnings?: {
    message: string;
    failedVideos: Array<{
      url: string;
      index: number;
      error: string;
      platform: string;
    }>;
  };
}

interface PreviewProps {
  mainTitle: TextSegment[];
  videos: VideoInput[];
  width: number;
  height: number;
  previewState: PreviewState;
  onGeneratePreview: () => void;
}

function VideoPreviewPanel({
  mainTitle,
  videos,
  width,
  height,
  previewState,
  onGeneratePreview,
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Calculate aspect ratio for container
  const aspectRatio = width / height;
  const getPreviewStyle = () => {
    if (aspectRatio > 1) {
      return { width: "100%", paddingTop: `${(1 / aspectRatio) * 100}%` };
    } else if (aspectRatio < 1) {
      return { width: "50%", paddingTop: `${(1 / aspectRatio) * 50}%` };
    } else {
      return { width: "70%", paddingTop: "70%" };
    }
  };

  const allVideosReady =
    mainTitle.length > 0 &&
    mainTitle[0].text.trim() !== "" &&
    videos.every(
      (v) => v.url && v.title.length > 0 && v.title[0].text.trim() !== ""
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
        <div className="preview-frame" style={getPreviewStyle()}>
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
                          v.title.length === 0 || v.title[0].text.trim() === ""
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

export default function RankingVideos() {
  const [mainTitle, setMainTitle] = useState<TextSegment[]>([
    { text: "", color: "white", fontSize: 52 },
  ]);
  const [videoCount, setVideoCount] = useState<3 | 4 | 5 | 6>(3);
  const [videos, setVideos] = useState<VideoInput[]>([
    { id: 1, url: "", title: [{ text: "", color: "white", fontSize: 48 }] },
    { id: 2, url: "", title: [{ text: "", color: "white", fontSize: 48 }] },
    { id: 3, url: "", title: [{ text: "", color: "white", fontSize: 48 }] },
  ]);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [error, setError] = useState("");
  const [failedVideoIndices, setFailedVideoIndices] = useState<Set<number>>(
    new Set()
  );

  // First to play selection (index of video to play first, null = default shuffle)
  // Can only be videos with index >= 1 (not rank #1)
  const [firstToPlay, setFirstToPlay] = useState<number | null>(null);

  // Single preview state
  const [previewState, setPreviewState] = useState<PreviewState>({
    isGenerating: false,
    videoUrl: null,
    error: null,
  });

  // Toggle View State
  const [previewMode, setPreviewMode] = useState<"realtime" | "export">(
    "realtime"
  );

  const handleVideoCountChange = (count: 3 | 4 | 5 | 6) => {
    setVideoCount(count);
    const newVideos: VideoInput[] = [];
    for (let i = 0; i < count; i++) {
      newVideos.push(
        videos[i] || {
          id: i + 1,
          url: "",
          title: [{ text: "", color: "white", fontSize: 48 }],
        }
      );
    }
    setVideos(newVideos);
    setError("");
    setFailedVideoIndices(new Set());
    // Reset firstToPlay if it's beyond the new count
    if (firstToPlay !== null && firstToPlay >= count) {
      setFirstToPlay(null);
    }
    // Clear preview when changing video count
    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
  };

  const handleVideoChange = (
    index: number,
    field: "url" | "title",
    value: string | TextSegment[]
  ) => {
    const newVideos = [...videos];
    if (field === "url") {
      newVideos[index] = { ...newVideos[index], url: value as string };
    } else {
      newVideos[index] = { ...newVideos[index], title: value as TextSegment[] };
    }
    setVideos(newVideos);
    setError("");

    // Clear failed state for this specific video when it's changed
    setFailedVideoIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });

    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
  };

  // Editor State
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(
    null
  );

  const [loadingEditorIndex, setLoadingEditorIndex] = useState<number | null>(
    null
  );
  const [editorUrl, setEditorUrl] = useState<string | null>(null);

  const handleEditClick = async (index: number) => {
    const video = videos[index];
    if (!video.url) return;

    // Check if it's a local file (playable directly)
    const isLocal =
      video.url.includes("localhost") || video.url.startsWith("blob:");

    if (isLocal) {
      setEditorUrl(video.url);
      setEditingVideoIndex(index);
    } else {
      // It's an external URL (YouTube/Instagram) - we need to download/cache it first
      setLoadingEditorIndex(index);
      try {
        // Use preparePreview logic to get a playable local URL
        const response = await preparePreview([
          {
            url: video.url,
            id: video.id,
          },
        ]);

        if (response.success && response.videos.length > 0) {
          setEditorUrl(response.videos[0].url);
          setEditingVideoIndex(index);
        } else {
          setError(
            `Could not load video for editing: ${
              response.warnings?.message || "Unknown error"
            }`
          );
        }
      } catch (err: unknown) {
        console.error("Failed to prepare video for editing:", err);
        setError("Failed to load video for editing. Please try again.");
      } finally {
        setLoadingEditorIndex(null);
      }
    }
  };

  const handleSaveEdit = (start: number, end: number) => {
    if (editingVideoIndex === null) return;

    const newVideos = [...videos];
    newVideos[editingVideoIndex] = {
      ...newVideos[editingVideoIndex],
      trimStart: start,
      trimEnd: end,
    };
    setVideos(newVideos);
    // Clear preview because trimming changed
    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
  };

  // Upload Logic
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = (index: number) => {
    setUploadingIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = uploadingIndex;
    if (index === null || !e.target.files || e.target.files.length === 0) {
      setUploadingIndex(null);
      return;
    }

    const file = e.target.files[0];
    try {
      // Optimistic logic: In a real app we might want to show a progress bar
      const result = await uploadVideoFile(file);
      if (result.success) {
        handleVideoChange(index, "url", result.url);
      } else {
        setError("Upload failed on server");
      }
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload video");
    } finally {
      setUploadingIndex(null);
    }
  };

  // Generate full preview
  const handleGeneratePreview = async () => {
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

    setPreviewState({ isGenerating: true, videoUrl: null, error: null });

    try {
      const response = await generateFullPreview(
        mainTitle,
        videos.map((v) => ({
          url: v.url,
          title: v.title,
          trimStart: v.trimStart,
          trimEnd: v.trimEnd,
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
  };

  const getPlatformIcon = (url: string) => {
    if (url.includes("tiktok")) return "🎵";
    if (url.includes("instagram")) return "📸";
    if (url.includes("youtube") || url.includes("youtu.be")) return "▶️";
    return "🎬";
  };

  return (
    <div className="ranking-container">
      <div className="ranking-content">
        {/* Header spans both columns */}
        <div className="header">
          <h1 className="title">
            <span className="gradient-text">🏆 Video Ranking Creator</span>
          </h1>
          <p className="subtitle">
            Create stunning ranking videos with custom titles and overlays
          </p>
        </div>

        {/* Left Column - Controls */}
        <div className="controls-column">
          {/* Main Title Input */}
          <div className="main-title-section">
            <RichTextInput
              label="Main Video Title"
              value={mainTitle}
              onChange={setMainTitle}
              placeholder="e.g., Top 3 Most Viral TikToks of 2024"
              disabled={false}
            />
          </div>

          {/* Video Count Selector */}
          <div className="count-selector">
            <label className="section-label">Number of Videos</label>
            <div className="count-buttons">
              {([3, 4, 5, 6] as const).map((count) => (
                <button
                  key={count}
                  className={`count-btn ${
                    videoCount === count ? "active" : ""
                  }`}
                  onClick={() => handleVideoCountChange(count)}
                  disabled={false}
                >
                  <span className="count-number">{count}</span>
                  <span className="count-label">Videos</span>
                </button>
              ))}
            </div>
          </div>

          {/* Video Inputs */}
          <div className="videos-section">
            <label className="section-label">Ranking Videos</label>
            <div className="first-to-play-hint">
              💡 Select which video plays first (Rank #1 always plays last)
            </div>
            {videos.map((video, index) => {
              const hasFailed = failedVideoIndices.has(index);
              const failureInfo = previewState.warnings?.failedVideos.find(
                (f) => f.index === index
              );
              const isRankOne = index === 0;
              const isSelectedFirst = firstToPlay === index;

              return (
                <div
                  key={video.id}
                  className={`video-input-group ${
                    hasFailed ? "has-error" : ""
                  } ${isSelectedFirst ? "first-to-play" : ""}`}
                >
                  {/* First to Play Radio Button - only for non-rank-1 videos */}
                  <div className="first-play-selector">
                    {!isRankOne ? (
                      <label
                        className={`first-play-radio ${
                          isSelectedFirst ? "selected" : ""
                        }`}
                        title="Play this video first"
                      >
                        <input
                          type="radio"
                          name="firstToPlay"
                          checked={isSelectedFirst}
                          onChange={() => setFirstToPlay(index)}
                        />
                        <span className="radio-custom"></span>
                        <span className="radio-label">1st</span>
                      </label>
                    ) : (
                      <div
                        className="rank-one-indicator"
                        title="Rank #1 always plays last"
                      >
                        🏆
                      </div>
                    )}
                  </div>
                  <div className={`rank-badge ${hasFailed ? "error" : ""}`}>
                    #{index + 1}
                  </div>
                  <div className="video-inputs">
                    <div className="input-wrapper">
                      <div className={`input-icon ${hasFailed ? "error" : ""}`}>
                        {hasFailed
                          ? "⚠️"
                          : getPlatformIcon(video.url) || `${index + 1}`}
                      </div>
                      <input
                        type="url"
                        className={`url-input ${hasFailed ? "error" : ""}`}
                        placeholder={`Video ${
                          index + 1
                        } URL (TikTok, Instagram, YouTube)`}
                        value={video.url}
                        onChange={(e) =>
                          handleVideoChange(index, "url", e.target.value)
                        }
                        disabled={false}
                      />
                      <button
                        className="upload-icon-btn"
                        onClick={() => handleUploadClick(index)}
                        disabled={uploadingIndex !== null}
                        title="Upload local video"
                      >
                        {uploadingIndex === index ? (
                          <span className="mini-spinner"></span>
                        ) : (
                          "📂"
                        )}
                      </button>
                      <button
                        className="upload-icon-btn"
                        onClick={() => handleEditClick(index)}
                        disabled={!video.url || loadingEditorIndex === index}
                        title="Trim/Edit Video"
                      >
                        {loadingEditorIndex === index ? (
                          <span className="mini-spinner"></span>
                        ) : (
                          "✂️"
                        )}
                      </button>
                    </div>
                    {hasFailed && failureInfo && (
                      <div className="inline-error-message">
                        <span className="inline-error-icon">⚠️</span>
                        <span className="inline-error-text">
                          {failureInfo.error}
                        </span>
                      </div>
                    )}
                    <RichTextInput
                      value={video.title}
                      onChange={(segments) =>
                        handleVideoChange(index, "title", segments)
                      }
                      placeholder={`Video ${index + 1} Title`}
                      disabled={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="video/*"
            onChange={handleFileChange}
          />

          {/* Video Dimensions */}
          <div className="dimensions-section">
            <label className="section-label">Video Dimensions</label>
            <div className="dimension-controls">
              <button
                className={`dimension-btn ${
                  width === 1080 && height === 1920 ? "active" : ""
                }`}
                onClick={() => {
                  setWidth(1080);
                  setHeight(1920);
                }}
                disabled={false}
              >
                <span className="dimension-icon">📱</span>
                <span>Vertical</span>
                <span className="dimension-size">1080×1920</span>
              </button>
              <button
                className={`dimension-btn ${
                  width === 1920 && height === 1080 ? "active" : ""
                }`}
                onClick={() => {
                  setWidth(1920);
                  setHeight(1080);
                }}
                disabled={false}
              >
                <span className="dimension-icon">🖥️</span>
                <span>Horizontal</span>
                <span className="dimension-size">1920×1080</span>
              </button>
              <button
                className={`dimension-btn ${
                  width === 1080 && height === 1080 ? "active" : ""
                }`}
                onClick={() => {
                  setWidth(1080);
                  setHeight(1080);
                }}
                disabled={false}
              >
                <span className="dimension-icon">⬜</span>
                <span>Square</span>
                <span className="dimension-size">1080×1080</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Regenerate Preview Button */}
          <div className="create-button-container">
            <button
              className="create-button"
              onClick={handleGeneratePreview}
              disabled={previewState.isGenerating}
            >
              {previewState.isGenerating ? (
                <>
                  <span className="spinner"></span>
                  Generating...
                </>
              ) : (
                <>
                  <span className="create-icon">🔄</span>
                  Regenerate Preview
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="instructions">
            <h3 className="instructions-title">💡 How it works:</h3>
            <ol className="instructions-list">
              <li>
                Enter a main title that will appear at the top of the video
              </li>
              <li>Choose how many videos to rank (3-6)</li>
              <li>Paste URLs and give each video a descriptive title</li>
              <li>Select your preferred video dimensions</li>
              <li>Click "Regenerate Preview" to see the final video!</li>
              <li>Download directly from the preview when ready</li>
            </ol>
            <div className="instructions-note">
              ℹ️ Each video will display: <strong>Main Title</strong> (top) and{" "}
              <strong>#Rank: Video Title</strong> (bottom) throughout its
              duration
            </div>
          </div>
        </div>

        {/* Right Column - Preview (sticky) */}
        <div className="preview-column">
          <div
            className="preview-mode-toggle"
            style={{ display: "flex", gap: 10, marginBottom: 15 }}
          >
            <button
              style={{
                flex: 1,
                padding: 10,
                border: "none",
                borderRadius: 8,
                backgroundColor:
                  previewMode === "realtime" ? "#06AED5" : "#333",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
              onClick={() => setPreviewMode("realtime")}
            >
              ⚡ Realtime Preview
            </button>
            <button
              style={{
                flex: 1,
                padding: 10,
                border: "none",
                borderRadius: 8,
                backgroundColor: previewMode === "export" ? "#06AED5" : "#333",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
              onClick={() => setPreviewMode("export")}
            >
              🎬 Final Export
            </button>
          </div>

          {previewMode === "realtime" ? (
            <RealtimePreview
              mainTitle={mainTitle}
              videos={videos}
              width={width}
              height={height}
              firstToPlay={firstToPlay}
            />
          ) : (
            <VideoPreviewPanel
              mainTitle={mainTitle}
              videos={videos}
              width={width}
              height={height}
              previewState={previewState}
              onGeneratePreview={handleGeneratePreview}
            />
          )}
        </div>
      </div>

      {editingVideoIndex !== null && (
        <VideoEditor
          url={editorUrl || videos[editingVideoIndex].url}
          isOpen={true}
          onClose={() => {
            setEditingVideoIndex(null);
            setEditorUrl(null);
          }}
          onSave={handleSaveEdit}
          initialTrimStart={videos[editingVideoIndex].trimStart}
          initialTrimEnd={videos[editingVideoIndex].trimEnd}
        />
      )}
    </div>
  );
}
