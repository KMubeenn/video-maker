import { useState } from "react";
import { mergeVideos } from "../api/video.api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Sparkles, Music, Image, Play } from "lucide-react";
import { cn } from "@/lib/utils";
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
    if (url.includes("tiktok")) return <Music className="h-5 w-5" />;
    if (url.includes("instagram")) return <Image className="h-5 w-5" />;
    if (url.includes("youtube") || url.includes("youtu.be")) return <Play className="h-5 w-5" />;
    return null;
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
          <Label className="section-label">How many videos?</Label>
          <div className="count-buttons">
            {([2, 3, 4] as const).map((count) => (
              <Button
                key={count}
                variant={videoCount === count ? "default" : "outline"}
                className={cn(
                  "count-btn flex flex-col h-auto py-6",
                  videoCount === count && "active"
                )}
                onClick={() => handleVideoCountChange(count)}
                disabled={loading}
              >
                <span className="count-number text-2xl font-bold">{count}</span>
                <span className="count-label text-sm">Videos</span>
              </Button>
            ))}
          </div>
        </div>

        {/* URL Inputs */}
        <div className="url-inputs">
          <Label className="section-label">Paste your video URLs</Label>
          {urls.map((url, index) => (
            <div key={index} className="input-wrapper">
              <div className="input-icon flex items-center justify-center">
                {getPlatformIcon(url) || (
                  <span className="font-bold">{index + 1}</span>
                )}
              </div>
              <Input
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
          <Alert variant="destructive" className="error-message">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button
          className="merge-button w-full"
          onClick={handleSubmit}
          disabled={loading}
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Merge Videos
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <Card className="result-container">
            <CardHeader className="result-header">
              <CardTitle className="result-title text-2xl">
                🎉 Your video is ready!
              </CardTitle>
              <CardDescription className="result-subtitle">
                {result.message}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="video-preview rounded-lg overflow-hidden">
                <video
                  src={result.videoUrl}
                  controls
                  className="output-video w-full"
                />
              </div>

              <Card className="source-info">
                <CardHeader>
                  <CardTitle className="sources-title text-base">
                    Sources:
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="sources-list space-y-2">
                    {result.sources?.map((source, idx: number) => (
                      <div
                        key={idx}
                        className="source-item flex items-center gap-4 p-3 bg-muted rounded-lg"
                      >
                        <Badge variant="default" className="source-platform">
                          {source.platform}
                        </Badge>
                        <span className="source-url text-sm text-muted-foreground font-mono">
                          {source.url.substring(0, 40)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button
                asChild
                className="download-button w-full"
                size="lg"
              >
                <a href={result.videoUrl} download="merged-video.mp4">
                  <Download className="mr-2 h-5 w-5" />
                  Download Video
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="instructions">
          <CardHeader>
            <CardTitle className="instructions-title">How to use:</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="instructions-list list-decimal list-inside space-y-2">
              <li>Select how many videos you want to merge (2-4)</li>
              <li>Paste the URLs of your TikTok, Instagram, or YouTube shorts</li>
              <li>Click "Merge Videos" and wait for the magic to happen!</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
