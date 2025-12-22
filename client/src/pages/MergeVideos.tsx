import { useState } from "react";
import { mergeVideos } from "../api/video.api";
import "./MergeVideos.css";

interface MergeResult {
  success: boolean;
  videoUrl: string;
  message: string;
  sources: Array<{
    platform: string;
    url: string;
  }>;
}

export default function MergeVideos() {
  const [videoCount, setVideoCount] = useState<2 | 3 | 4>(2);
  const [urls, setUrls] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MergeResult | null>(null);

  const handleVideoCountChange = (count: 2 | 3 | 4) => {
    setVideoCount(count);
    setUrls(Array(count).fill(""));
    setError("");
    setResult(null);
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
    setError("");
  };

  const handleSubmit = async () => {
    // Validation
    const filledUrls = urls.filter((url) => url.trim());
    if (filledUrls.length !== videoCount) {
      setError(`Please provide all ${videoCount} video URLs`);
      return;
    }

    // Basic URL validation
    const invalidUrls = urls.filter(
      (url) =>
        !url.includes("tiktok.com") &&
        !url.includes("instagram.com") &&
        !url.includes("youtube.com") &&
        !url.includes("youtu.be")
    );

    if (invalidUrls.length > 0) {
      setError("Please provide valid TikTok, Instagram, or YouTube URLs");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await mergeVideos(urls);
      setResult(response);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { details?: string; error?: string } };
      };
      setError(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to merge videos. Please try again."
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
    <div className="merge-container">
      <div className="merge-content">
        {/* Header */}
        <div className="header">
          <h1 className="title">
            <span className="gradient-text">Video Merger</span>
          </h1>
          <p className="subtitle">
            Combine TikTok, Instagram & YouTube shorts into one masterpiece
          </p>
        </div>

        {/* Video Count Selector */}
        <div className="count-selector">
          <label className="section-label">How many videos?</label>
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

        {/* URL Inputs */}
        <div className="url-inputs">
          <label className="section-label">Paste your video URLs</label>
          {urls.map((url, index) => (
            <div key={index} className="input-wrapper">
              <div className="input-icon">
                {getPlatformIcon(url) || `${index + 1}`}
              </div>
              <input
                type="url"
                className="url-input"
                placeholder={`Video ${
                  index + 1
                } URL (TikTok, Instagram, or YouTube)`}
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                disabled={loading}
              />
            </div>
          ))}
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
          className="merge-button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Processing...
            </>
          ) : (
            <>
              <span className="merge-icon">✨</span>
              Merge Videos
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="result-container">
            <div className="result-header">
              <h2 className="result-title">🎉 Your video is ready!</h2>
              <p className="result-subtitle">{result.message}</p>
            </div>

            <div className="video-preview">
              <video src={result.videoUrl} controls className="output-video" />
            </div>

            <div className="source-info">
              <h3 className="sources-title">Sources:</h3>
              <div className="sources-list">
                {result.sources?.map((source, idx: number) => (
                  <div key={idx} className="source-item">
                    <span className="source-platform">{source.platform}</span>
                    <span className="source-url">
                      {source.url.substring(0, 40)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <a
              href={result.videoUrl}
              download="merged-video.mp4"
              className="download-button"
            >
              <span className="download-icon">⬇️</span>
              Download Video
            </a>
          </div>
        )}

        {/* Instructions */}
        <div className="instructions">
          <h3 className="instructions-title">How to use:</h3>
          <ol className="instructions-list">
            <li>Select how many videos you want to merge (2-4)</li>
            <li>Paste the URLs of your TikTok, Instagram, or YouTube shorts</li>
            <li>Click "Merge Videos" and wait for the magic to happen!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
