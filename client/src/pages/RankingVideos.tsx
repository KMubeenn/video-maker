import { useState, useRef } from "react";
import {
  createRankingVideo,
  generateFullPreview,
  type RankingVideoInput,
  type TextSegment,
} from "../api/video.api";
import { RichTextInput } from "../components/RichTextInput";
import "./RankingVideos.css";

interface VideoInput extends Omit<RankingVideoInput, "title"> {
  id: number;
  title: TextSegment[]; // Using TextSegment[] for formatted titles
}

interface RankingResult {
  success: boolean;
  videoUrl: string;
  message: string;
  rankings: Array<{
    rank: number;
    title: string;
    url: string;
  }>;
}

// Single Preview State
interface PreviewState {
  isGenerating: boolean;
  videoUrl: string | null;
  error: string | null;
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
  const [videoCount, setVideoCount] = useState<2 | 3 | 4>(2);
  const [videos, setVideos] = useState<VideoInput[]>([
    { id: 1, url: "", title: [{ text: "", color: "white", fontSize: 48 }] },
    { id: 2, url: "", title: [{ text: "", color: "white", fontSize: 48 }] },
  ]);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RankingResult | null>(null);

  // Single preview state
  const [previewState, setPreviewState] = useState<PreviewState>({
    isGenerating: false,
    videoUrl: null,
    error: null,
  });

  const handleVideoCountChange = (count: 2 | 3 | 4) => {
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
    setResult(null);
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
    // Clear preview when video data changes
    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
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
        videos.map((v) => ({ url: v.url, title: v.title })),
        width,
        height
      );
      setPreviewState({
        isGenerating: false,
        videoUrl: response.videoUrl,
        error: null,
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
      });
    }
  };

  const handleSubmit = async () => {
    // Validation
    const mainTitleText = mainTitle[0]?.text || "";
    if (!mainTitleText.trim()) {
      setError("Please provide a main title for your ranking video");
      return;
    }

    const emptyTitles = videos.filter((v) => !v.title[0]?.text.trim());
    if (emptyTitles.length > 0) {
      setError("Please provide titles for all videos");
      return;
    }

    const emptyUrls = videos.filter((v) => !v.url.trim());
    if (emptyUrls.length > 0) {
      setError("Please provide URLs for all videos");
      return;
    }

    // Basic URL validation
    const invalidUrls = videos.filter(
      (v) =>
        !v.url.includes("tiktok.com") &&
        !v.url.includes("instagram.com") &&
        !v.url.includes("youtube.com") &&
        !v.url.includes("youtu.be")
    );

    if (invalidUrls.length > 0) {
      setError("Please provide valid TikTok, Instagram, or YouTube URLs");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await createRankingVideo(
        mainTitle,
        videos.map((v) => ({ url: v.url, title: v.title })),
        width,
        height
      );
      setResult(response);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { details?: string; error?: string } };
      };
      setError(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to create ranking video. Please try again."
      );
    } finally {
      setLoading(false);
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
              disabled={loading}
            />
          </div>

          {/* Video Count Selector */}
          <div className="count-selector">
            <label className="section-label">Number of Videos</label>
            <div className="count-buttons">
              {([2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  className={`count-btn ${
                    videoCount === count ? "active" : ""
                  }`}
                  onClick={() => handleVideoCountChange(count)}
                  disabled={loading}
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
            {videos.map((video, index) => (
              <div key={video.id} className="video-input-group">
                <div className="rank-badge">#{index + 1}</div>
                <div className="video-inputs">
                  <div className="input-wrapper">
                    <div className="input-icon">
                      {getPlatformIcon(video.url) || `${index + 1}`}
                    </div>
                    <input
                      type="url"
                      className="url-input"
                      placeholder={`Video ${
                        index + 1
                      } URL (TikTok, Instagram, YouTube)`}
                      value={video.url}
                      onChange={(e) =>
                        handleVideoChange(index, "url", e.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                  <RichTextInput
                    value={video.title}
                    onChange={(segments) =>
                      handleVideoChange(index, "title", segments)
                    }
                    placeholder={`Video ${index + 1} Title`}
                    disabled={loading}
                  />
                </div>
              </div>
            ))}
          </div>

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
                disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
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

          {/* Submit Button */}
          <div className="create-button-container">
            <button
              className="create-button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="create-icon">🎬</span>
                  Create Ranking Video
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
              <li>Choose how many videos to rank (2-4)</li>
              <li>Paste URLs and give each video a descriptive title</li>
              <li>Select your preferred video dimensions</li>
              <li>Click "Create" and watch your ranking video come to life!</li>
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
          <VideoPreviewPanel
            mainTitle={mainTitle}
            videos={videos}
            width={width}
            height={height}
            previewState={previewState}
            onGeneratePreview={handleGeneratePreview}
          />
        </div>

        {/* Result spans both columns */}
        {result && (
          <div className="result-container">
            <div className="result-header">
              <h2 className="result-title">🎉 Your Ranking Video is Ready!</h2>
              <p className="result-subtitle">{result.message}</p>
            </div>

            <div className="video-preview">
              <video src={result.videoUrl} controls className="output-video" />
            </div>

            <div className="rankings-info">
              <h3 className="rankings-title">Ranking List:</h3>
              <div className="rankings-list">
                {result.rankings?.map((ranking) => (
                  <div key={ranking.rank} className="ranking-item">
                    <div className="ranking-badge">#{ranking.rank}</div>
                    <div className="ranking-details">
                      <div className="ranking-title">{ranking.title}</div>
                      <div className="ranking-url">
                        {ranking.url.substring(0, 50)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <a
              href={result.videoUrl}
              download="ranking-video.mp4"
              className="download-button"
            >
              <span className="download-icon">⬇️</span>
              Download Ranking Video
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
