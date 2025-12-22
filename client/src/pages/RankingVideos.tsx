import { useState } from "react";
import { createRankingVideo, type RankingVideoInput } from "../api/video.api";
import "./RankingVideos.css";

interface VideoInput extends RankingVideoInput {
  id: number;
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

export default function RankingVideos() {
  const [mainTitle, setMainTitle] = useState("");
  const [videoCount, setVideoCount] = useState<2 | 3 | 4>(2);
  const [videos, setVideos] = useState<VideoInput[]>([
    { id: 1, url: "", title: "" },
    { id: 2, url: "", title: "" },
  ]);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RankingResult | null>(null);

  const handleVideoCountChange = (count: 2 | 3 | 4) => {
    setVideoCount(count);
    const newVideos: VideoInput[] = [];
    for (let i = 0; i < count; i++) {
      newVideos.push(videos[i] || { id: i + 1, url: "", title: "" });
    }
    setVideos(newVideos);
    setError("");
    setResult(null);
  };

  const handleVideoChange = (
    index: number,
    field: "url" | "title",
    value: string
  ) => {
    const newVideos = [...videos];
    newVideos[index] = { ...newVideos[index], [field]: value };
    setVideos(newVideos);
    setError("");
  };

  const handleSubmit = async () => {
    // Validation
    if (!mainTitle.trim()) {
      setError("Please provide a main title for your ranking video");
      return;
    }

    const emptyTitles = videos.filter((v) => !v.title.trim());
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
        {/* Header */}
        <div className="header">
          <h1 className="title">
            <span className="gradient-text">🏆 Video Ranking Creator</span>
          </h1>
          <p className="subtitle">
            Create stunning ranking videos with custom titles and overlays
          </p>
        </div>

        {/* Main Title Input */}
        <div className="main-title-section">
          <label className="section-label">Main Video Title</label>
          <input
            type="text"
            className="main-title-input"
            placeholder="e.g., Top 3 Most Viral TikToks of 2024"
            value={mainTitle}
            onChange={(e) => setMainTitle(e.target.value)}
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
                className={`count-btn ${videoCount === count ? "active" : ""}`}
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
                <input
                  type="text"
                  className="title-input"
                  placeholder={`Video ${index + 1} Title`}
                  value={video.title}
                  onChange={(e) =>
                    handleVideoChange(index, "title", e.target.value)
                  }
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
              <span>Vertical (9:16)</span>
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
              <span>Horizontal (16:9)</span>
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
              <span>Square (1:1)</span>
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
        <button
          className="create-button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Creating Ranking Video...
            </>
          ) : (
            <>
              <span className="create-icon">🎬</span>
              Create Ranking Video
            </>
          )}
        </button>

        {/* Result */}
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

        {/* Instructions */}
        <div className="instructions">
          <h3 className="instructions-title">💡 How it works:</h3>
          <ol className="instructions-list">
            <li>Enter a main title that will appear at the top of the video</li>
            <li>Choose how many videos to rank (2-4)</li>
            <li>Paste URLs and give each video a descriptive title</li>
            <li>Select your preferred video dimensions</li>
            <li>Click "Create" and watch your ranking video come to life!</li>
          </ol>
          <div className="instructions-note">
            ℹ️ Each video will display: <strong>Main Title</strong> (top) and{" "}
            <strong>#Rank: Video Title</strong> (bottom) throughout its duration
          </div>
        </div>
      </div>
    </div>
  );
}
