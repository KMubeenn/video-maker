import { useState, useEffect, useRef, useCallback } from "react";
import { type TextSegment } from "./RichTextInput";
import {
  type TimelineState,
  type TimelineClip,
  type TextOverlay,
} from "../types/timeline";
import "./RealtimePreview.css";

interface RealtimePreviewProps {
  mainTitle: TextSegment[];
  videos: { id: number; url: string; title: TextSegment[] }[];
  width: number;
  height: number;
}

interface LoadedAsset {
  url: string; // The served URL (blob or localhost)
  originalUrl: string; // The source URL (TikTok etc) used for keying
  duration: number;
  audioBuffer?: AudioBuffer;
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function RealtimePreview({
  mainTitle,
  videos,
  width,
  height,
}: RealtimePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineState | null>(null);

  // Debounce the video input to prevent excessive API calls while typing
  const debouncedVideos = useDebounce(videos, 1200);

  // Cache assets to avoid re-downloading on text changes
  const loadedAssetsRef = useRef<Map<string, LoadedAsset>>(new Map());

  // Refs for rendering loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Map<number, AudioBufferSourceNode>>(new Map());
  const timelineRef = useRef<TimelineState | null>(null);

  // Sync ref
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  // Clean up
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Initialize AudioContext singleton
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  // 1. Fetch Assets (Debounced)
  const loadAssets = useCallback(
    async (videosToLoad: typeof videos) => {
      // Only attempt to load URLs that look somewhat valid (length > 10, http)
      // This assumes the user is typing/pasting a full URL.
      const validToLoad = videosToLoad.filter(
        (v) => v.url && v.url.trim().length > 10 && v.url.startsWith("http")
      );

      // Determine which valid videos are missing from cache
      const missing = validToLoad.filter(
        (v) => !loadedAssetsRef.current.has(v.url)
      );

      // If nothing new to load, return true immediately
      if (missing.length === 0) return true;

      setLoading(true);
      setError(null);
      setIsPlaying(false); // Stop playback if assets are being reloaded

      try {
        const response = await fetch(
          "http://localhost:4000/api/ranking/prepare-preview",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videos: missing.map((v) => ({ url: v.url, id: v.id })),
            }),
          }
        );

        if (!response.ok) {
          // Handle 404 or 500
          if (response.status === 404)
            throw new Error("Preview endpoint not found (404)");
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to download videos");
        }

        const ctx = getAudioContext();
        const loaded: any[] = data.videos;

        // Process and cache
        for (const fileData of loaded) {
          const originalInput = missing.find((m) => m.id === fileData.id);
          // Fallback to finding by URL if ID mismatch
          const originalUrl = originalInput?.url || fileData.originalUrl;

          // Decode Audio with fallback
          let audioBuffer: AudioBuffer;
          try {
            // 1. Fetch
            const arrayBuffer = await fetch(fileData.url).then((res) =>
              res.arrayBuffer()
            );
            // 2. Decode
            audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          } catch (e) {
            console.warn(
              `Audio decode failed for ${fileData.url}, using silence.`,
              e
            );
            // Fallback: Create silent buffer
            const duration = fileData.duration || 5; // Default 5s if unknown
            const sampleRate = ctx.sampleRate || 44100;
            const length = Math.ceil(duration * sampleRate);
            audioBuffer = ctx.createBuffer(2, length, sampleRate);
          }

          loadedAssetsRef.current.set(originalUrl, {
            url: fileData.url,
            originalUrl: originalUrl,
            duration: fileData.duration,
            audioBuffer,
          });
        }
        setLoading(false);
        return true;
      } catch (err: unknown) {
        const error = err as Error;
        console.error(error);
        setError(error.message);
        setLoading(false);
        return false;
      }
    },
    [getAudioContext]
  );

  // 2. Build Timeline (Synchronous, fast)
  const buildTimeline = useCallback(() => {
    const clips: TimelineClip[] = [];
    let currentOffset = 0;

    // Logic: Rank 1 goes last, others shuffled (2-N).
    // To keep preview stable while editing, we avoid random().
    // We deterministically sort the 2-N videos for the preview.
    // Rank 1 is always videos[0].

    if (videos.length === 0) {
      setTimeline(null);
      setDuration(0);
      return;
    }

    const rank1Video = videos[0];
    const otherVideos = videos.slice(1);

    // Deterministic "Shuffle" for preview: Reverse them
    const playbackOrder = [...otherVideos.reverse(), rank1Video].filter(
      Boolean
    );

    for (const vid of playbackOrder) {
      if (!vid.url) continue;
      const asset = loadedAssetsRef.current.get(vid.url);

      // If asset not loaded yet (e.g. url just typed, invalid, or loading), skip this clip
      if (!asset) continue;

      clips.push({
        id: vid.id,
        url: asset.url,
        originalUrl: vid.url,
        duration: asset.duration,
        startTime: currentOffset,
        endTime: currentOffset + asset.duration,
        sourceStart: 0,
        volume: 1,
        audioBuffer: asset.audioBuffer,
      });
      currentOffset += asset.duration;
    }

    const totalDuration = currentOffset;

    // Even if duration is 0, we might want to clear the timeline
    if (totalDuration === 0) {
      setTimeline(null);
      setDuration(0);
      return;
    }

    const overlays: TextOverlay[] = [];

    // Main Title
    overlays.push({
      id: "main-title",
      text: mainTitle,
      startTime: 0,
      endTime: totalDuration,
      x: "center",
      y: 90,
      type: "main-title",
      opacity: 1,
      scale: 1,
    });

    playbackOrder.forEach((playingVideo, playbackIndex) => {
      const clip = clips.find((c) => c.id === playingVideo.id);
      if (!clip) return;

      // Revealed Ranks Logic
      const revealedVideos = playbackOrder.slice(0, playbackIndex + 1);
      const revealedRanks = new Set(
        revealedVideos.map(
          (v) => videos.findIndex((Ref) => Ref.id === v.id) + 1
        )
      );

      videos.forEach((v, originalIdx) => {
        const rankNum = originalIdx + 1;
        const isCurrentRank =
          rankNum === videos.findIndex((Ref) => Ref.id === playingVideo.id) + 1;
        const rankingItemHeight = 200;
        const titleHeight = 200;
        const videoHeight = height - titleHeight;
        const totalRankingHeight = videos.length * rankingItemHeight;
        const rankingStartY =
          titleHeight + (videoHeight - totalRankingHeight) / 2;
        const yPos = rankingStartY + originalIdx * rankingItemHeight;

        const color = isCurrentRank ? "#ffff00" : "white";

        // Rank Number (Always Visible)
        overlays.push({
          id: `rank-num-${rankNum}-during-${clip.id}`,
          text: [{ text: `${rankNum}.`, color: color, fontSize: 52 }],
          startTime: clip.startTime,
          endTime: clip.endTime,
          x: 30,
          y: yPos,
          type: "ranking-number",
          opacity: 1,
          scale: 1,
          rank: rankNum,
        });

        // Video Title (Only if revealed)
        if (revealedRanks.has(rankNum)) {
          overlays.push({
            id: `rank-title-${rankNum}-during-${clip.id}`,
            text: v.title.map((t) => ({ ...t, color: t.color || color })),
            startTime: clip.startTime,
            endTime: clip.endTime,
            x: 90,
            y: yPos + 4,
            type: "ranking-title",
            opacity: 1,
            scale: 1,
            rank: rankNum,
          });
        }
      });
    });

    // Update state only if changed meaningfully to avoid loop?
    // React handles object identity checks, but we are creating new objects every time.
    // However, if the functional values are same, it's fine.

    setDuration(totalDuration);
    setTimeline({
      duration: totalDuration,
      currentTime: 0,
      isPlaying: false,
      clips,
      overlays,
      width,
      height,
    });
  }, [mainTitle, videos, width, height]);

  // Effect 1: Handle Asset Loading (Debounced)
  // This watches 'debouncedVideos' and triggers network calls
  useEffect(() => {
    const validVideos = debouncedVideos.filter(
      (v) => v.url && v.url.startsWith("http")
    );
    const needsLoad = validVideos.some(
      (v) => !loadedAssetsRef.current.has(v.url)
    );

    if (needsLoad) {
      loadAssets(validVideos).then((success) => {
        if (success) buildTimeline();
      });
    }
  }, [debouncedVideos, loadAssets, buildTimeline]);

  // Effect 2: Handle Instant Updates (Text/Structure)
  // This watches 'videos', 'mainTitle' etc. directly for instant formatting updates
  useEffect(() => {
    // Check if we are waiting for assets for *current* videos
    const validVideos = videos.filter((v) => v.url && v.url.startsWith("http"));
    const needsLoad = validVideos.some(
      (v) => !loadedAssetsRef.current.has(v.url)
    );

    if (!needsLoad) {
      // If we have everything needed for the current state, build immediately.
      // This ensures text changes (which don't change needsLoad) are reflected instantly.
      buildTimeline();
    }
    // If needsLoad IS true, we do nothing here.
    // We wait for the Debounced effect to fire, load the assets, and THEN build.
    // This prevents flashing or excessive reloading while typing a URL.
  }, [videos, mainTitle, width, height, buildTimeline]);

  // ... Render Loop and Audio Control ...

  // Helper: Normalize colors to match FFmpeg backend
  const normalizeColor = (color: string | undefined): string => {
    if (!color) return "white";
    const map: Record<string, string> = {
      "#FFD700": "#FFC700",
      "#FF6B6B": "#E63946",
      "#4ECDC4": "#06AED5",
      "#95E1D3": "#2D9E6D",
    };
    return map[color] || color;
  };

  // Helper: Measure text segment width
  const measureSegment = (
    ctx: CanvasRenderingContext2D,
    text: string,
    fontSize: number
  ) => {
    ctx.font = `${fontSize}px Impact, Arial, sans-serif`;
    return ctx.measureText(text).width;
  };

  // Helper: Wrap text into lines of segments
  const wrapTextStats = (
    ctx: CanvasRenderingContext2D,
    segments: TextSegment[],
    maxWidth: number,
    defaultFontSize: number
  ) => {
    const lines: TextSegment[][] = [];
    let currentLine: TextSegment[] = [];
    let currentLineWidth = 0;

    for (const seg of segments) {
      const fontSize = seg.fontSize || defaultFontSize;
      const words = seg.text.split(" ");

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Re-add space if not last word, or if original seg ended with space (simplification: assume space between words)
        const wordWithSpace = word + (i < words.length - 1 ? " " : "");

        const wordW = measureSegment(ctx, wordWithSpace, fontSize);

        if (currentLineWidth + wordW > maxWidth && currentLine.length > 0) {
          // If it's just a space causing overflow, ignore? No, standard wrapping.
          lines.push(currentLine);
          currentLine = [{ ...seg, text: wordWithSpace }];
          currentLineWidth = wordW;
        } else {
          currentLine.push({ ...seg, text: wordWithSpace });
          currentLineWidth += wordW;
        }
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
  };

  const drawOverlay = (ctx: CanvasRenderingContext2D, overlay: TextOverlay) => {
    ctx.save();
    const fontBase = "Impact, Arial, sans-serif";
    const getSegColor = (seg: TextSegment) => normalizeColor(seg.color);

    if (overlay.type === "main-title") {
      // Main Title: Centered, Wrapped, Box, No Stroke
      const fontSize = 52;
      const maxWidth = 850;
      const lineHeight = fontSize + 10;
      const lines = wrapTextStats(ctx, overlay.text, maxWidth, fontSize);

      // Center vertically around Y=90
      let startY = 90;
      if (lines.length > 1) {
        startY -= ((lines.length - 1) * lineHeight) / 2;
      }

      lines.forEach((line, lineIdx) => {
        let lineWidth = 0;
        line.forEach(
          (s) =>
            (lineWidth += measureSegment(ctx, s.text, s.fontSize || fontSize))
        );
        let currentX = (width - lineWidth) / 2;
        const currentY = startY + lineIdx * lineHeight;

        // Draw Box (One box per line) - FFmpeg style box padding ~12
        // Currently using simplistic box per line
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(currentX - 12, currentY - 52, lineWidth + 24, 52 + 24);

        line.forEach((seg) => {
          ctx.font = `${seg.fontSize || fontSize}px ${fontBase}`;
          ctx.fillStyle = getSegColor(seg);
          ctx.fillText(seg.text, currentX, currentY);
          currentX += ctx.measureText(seg.text).width;
        });
      });
    } else if (overlay.type === "ranking-title") {
      // Video Title: Left Aligned, Wrapped, Stroke 3px, No Shadow
      const fontSize = 48;
      const maxWidth = 700;
      const lineHeight = fontSize + 8;
      const lines = wrapTextStats(ctx, overlay.text, maxWidth, fontSize);

      let currentY = overlay.y;

      lines.forEach((line) => {
        let currentX = typeof overlay.x === "number" ? overlay.x : 90;
        line.forEach((seg) => {
          ctx.font = `${seg.fontSize || fontSize}px ${fontBase}`;
          ctx.fillStyle = getSegColor(seg);

          // Stroke
          ctx.strokeStyle = "black";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(seg.text, currentX, currentY);
          // Fill
          ctx.fillText(seg.text, currentX, currentY);
          currentX += ctx.measureText(seg.text).width;
        });
        currentY += lineHeight;
      });
    } else if (overlay.type === "ranking-number") {
      // Rank Number: Simple, 52px, Stroke 3px
      const fontSize = 52;
      let currentX = 30;
      const currentY = overlay.y;

      overlay.text.forEach((seg) => {
        ctx.font = `${seg.fontSize || fontSize}px ${fontBase}`;
        ctx.fillStyle = getSegColor(seg);

        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.strokeText(seg.text, currentX, currentY);

        ctx.fillText(seg.text, currentX, currentY);
        currentX += ctx.measureText(seg.text).width;
      });
    }

    ctx.restore();
  };

  // Rendering Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timelineRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (
      currentTime >= timelineRef.current.duration &&
      timelineRef.current.duration > 0
    ) {
      setIsPlaying(false);
      stopAudio();
      return;
    }

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    const tl = timelineRef.current;

    // Draw Active Clip
    const currentClip = tl.clips.find(
      (clip) => currentTime >= clip.startTime && currentTime < clip.endTime
    );

    if (currentClip) {
      const videoEl = videoElementsRef.current.get(currentClip.id);
      if (videoEl) {
        const clipTime =
          currentTime - currentClip.startTime + currentClip.sourceStart;
        if (Math.abs(videoEl.currentTime - clipTime) > 0.1) {
          videoEl.currentTime = clipTime;
        }

        const titleHeight = 200;
        const videoAreaHeight = height - titleHeight;

        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;

        if (vw > 0 && vh > 0) {
          const scale = Math.max(width / vw, videoAreaHeight / vh);
          const scaledW = vw * scale;
          const scaledH = vh * scale;
          const dx = (width - scaledW) / 2;
          const dy = titleHeight + (videoAreaHeight - scaledH) / 2;

          // Clip video to strictly be below titleHeight
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, titleHeight, width, videoAreaHeight);
          ctx.clip();

          ctx.drawImage(videoEl, dx, dy, scaledW, scaledH);
          ctx.restore();
        }
      }
    }

    // Draw Overlays
    const activeOverlays = tl.overlays.filter(
      (o) => currentTime >= o.startTime && currentTime <= o.endTime
    );

    activeOverlays.forEach((overlay) => {
      drawOverlay(ctx, overlay);
    });
  }, [currentTime, width, height]);

  // Audio Control
  const stopAudio = () => {
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    audioSourcesRef.current.clear();
  };

  const animate = useCallback(() => {
    if (isPlaying) {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "running"
      ) {
        const audioTime = audioContextRef.current.currentTime;
        const newTime = audioTime - startTimeRef.current;

        if (newTime > duration) {
          setIsPlaying(false);
          stopAudio();
          setCurrentTime(duration);
          return;
        }
        setCurrentTime(newTime);
      } else {
        setCurrentTime((prev) => {
          const next = prev + 1 / 60;
          if (next > duration) {
            setIsPlaying(false);
            stopAudio();
            return duration;
          }
          return next;
        });
      }
    }
    render();
    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying, duration, render]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const playAudio = () => {
    if (!audioContextRef.current || !timeline) return;
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") ctx.resume();

    stopAudio();

    timeline.clips.forEach((clip) => {
      if (!clip.audioBuffer) return;
      const source = ctx.createBufferSource();
      source.buffer = clip.audioBuffer;
      const gain = ctx.createGain();
      gain.gain.value = clip.volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      const clipStartTimeline = clip.startTime;
      const clipEndTimeline = clip.endTime;

      if (clipStartTimeline >= currentTime) {
        source.start(ctx.currentTime + (clipStartTimeline - currentTime));
      } else if (clipEndTimeline > currentTime) {
        const offset = currentTime - clipStartTimeline;
        source.start(ctx.currentTime, offset);
      }

      audioSourcesRef.current.set(clip.id, source);
    });
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio();
      videoElementsRef.current.forEach((v) => v.pause());
      if (audioContextRef.current) {
        audioContextRef.current.suspend();
      }
    } else {
      setIsPlaying(true);
      if (audioContextRef.current) {
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
        startTimeRef.current =
          audioContextRef.current.currentTime - currentTime;
      }
      playAudio();
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timeline) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * timeline.duration;
    setCurrentTime(newTime);
    if (isPlaying) {
      stopAudio();
      if (audioContextRef.current) {
        startTimeRef.current = audioContextRef.current.currentTime - newTime;
      }
      playAudio();
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="realtime-preview">
      {/* Hidden Video Elements for decoding */}
      <div className="hidden-video-container">
        {timeline?.clips.map((clip) => (
          <video
            key={clip.id}
            ref={(el) => {
              if (el) videoElementsRef.current.set(clip.id, el);
            }}
            src={clip.url}
            crossOrigin="anonymous"
            muted
            preload="auto"
          />
        ))}
      </div>

      <div className="preview-header">
        <div className="preview-title">
          <span className="live-badge">REALTIME</span>
          <span>Instant Preview</span>
          {loading && (
            <span style={{ marginLeft: 10, fontSize: 12, color: "#aaa" }}>
              Syncing Assets...
            </span>
          )}
        </div>
      </div>

      <div
        className="preview-viewport"
        style={{
          width: 360,
          height: (360 / width) * height,
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="preview-canvas"
        />

        {loading && !timeline && (
          <div className="load-overlay">
            <div className="load-spinner"></div>
            <span>Preparing assets...</span>
          </div>
        )}

        {error && (
          <div className="load-overlay">
            <span>Preview Error</span>
            <span style={{ fontSize: 12, marginTop: 8 }}>{error}</span>
            <button
              className="prepare-btn"
              style={{ marginTop: 16 }}
              onClick={() =>
                loadAssets(videos).then((s) => s && buildTimeline())
              }
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !timeline && (
          <div className="load-overlay">
            <button
              className="prepare-btn"
              onClick={() =>
                loadAssets(videos).then((s) => s && buildTimeline())
              }
            >
              Load Realtime Preview
            </button>
          </div>
        )}
      </div>

      <div className="preview-controls">
        <div className="timeline-scrubber">
          <span className="time-display">{formatTime(currentTime)}</span>
          <div className="scrubber-track" onClick={handleScrub}>
            <div
              className="scrubber-progress"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            ></div>
            <div
              className="scrubber-thumb"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            ></div>
          </div>
          <span className="time-display">{formatTime(duration)}</span>
        </div>

        <div className="playback-controls">
          <button
            className="control-btn play-btn"
            onClick={togglePlay}
            disabled={!timeline}
          >
            {isPlaying ? "⏸️" : "▶️"}
          </button>
        </div>
      </div>
    </div>
  );
}
