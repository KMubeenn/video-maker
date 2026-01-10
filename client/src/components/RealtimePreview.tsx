import { useState, useEffect, useRef, useCallback } from "react";
import { type TextSegment } from "./RichTextInput";
import {
  type TimelineState,
  type TimelineClip,
  type TextOverlay,
} from "../types/timeline";
import { useDebounce } from "../hooks/useDebounce";
import "./RealtimePreview.css";
import { Pause, Play } from "lucide-react";
import {
  preloadEmojisFromText,
  extractEmojis,
} from "../services/emoji-image.service";

import type { EditedClip } from "../features/ranking";
import {
  renderVideoFrame,
  renderOverlay,
} from "../features/ranking/utils/canvas-renderer";

interface RealtimePreviewProps {
  mainTitle: TextSegment[];
  videos: EditedClip[];
  width: number;
  height: number;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

interface LoadedAsset {
  url: string; // The served URL (blob or localhost)
  originalUrl: string; // The source URL (TikTok etc) used for keying
  duration: number;
  audioBuffer?: AudioBuffer;
}

// Helper functions moved to canvas-renderer.ts

export function RealtimePreview({
  mainTitle,
  videos,
  width,
  height,
  onTimeUpdate,
  onPlayStateChange,
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
  // Cache for sound effect buffers
  const loadedSoundsRef = useRef<Map<string, AudioBuffer>>(new Map());

  // Refs for rendering loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const startTimeRef = useRef<number>(0);
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map()); // Key is composite ID
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
        window.AudioContext ||
        (
          window as unknown as Window & {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  // 1. Fetch Assets (Debounced)
  const loadAssets = useCallback(
    async (videosToLoad: typeof videos) => {
      // Only attempt to load URLs that look somewhat valid (length > 10, http)
      const validToLoad = videosToLoad.filter(
        (v) => v.src && v.src.trim().length > 10 && v.src.startsWith("http")
      );

      // Determine which valid videos are missing from cache
      const missingVideos = validToLoad.filter(
        (v) => !loadedAssetsRef.current.has(v.src)
      );

      // Identify missing meme sounds
      const allSoundUrls = new Set<string>();
      videosToLoad.forEach((v) => {
        v.audio?.forEach((s) => allSoundUrls.add(s.src));
      });
      const missingSounds = Array.from(allSoundUrls).filter(
        (url) => !loadedSoundsRef.current.has(url)
      );

      // If nothing new to load, return true immediately
      if (missingVideos.length === 0 && missingSounds.length === 0) return true;

      setLoading(true);
      setError(null);
      setIsPlaying(false); // Stop playback if assets are being reloaded

      const ctx = getAudioContext();

      try {
        // Load Meme Sounds
        await Promise.all(
          missingSounds.map(async (url) => {
            try {
              console.log(`[RealtimePreview] Loading sound: ${url}`);
              const response = await fetch(url, {
                mode: "cors",
                credentials: "omit",
              });
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
              loadedSoundsRef.current.set(url, audioBuffer);
              console.log(
                `[RealtimePreview] Sound loaded successfully: ${url}`
              );
            } catch (e) {
              console.warn(`Failed to load sound ${url}`, e);
            }
          })
        );

        if (missingVideos.length > 0) {
          const response = await fetch(
            "http://localhost:4000/api/ranking/prepare-preview",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                videos: missingVideos.map((v) => ({ url: v.src, id: v.id })),
              }),
            }
          );

          if (!response.ok) {
            if (response.status === 404)
              throw new Error("Preview endpoint not found (404)");
            throw new Error(`Server error: ${response.status}`);
          }

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || "Failed to download videos");
          }

          const loaded: {
            url: string;
            id: number;
            originalUrl: string;
            duration: number;
          }[] = data.videos;

          // Process and cache
          for (const fileData of loaded) {
            const originalInput = missingVideos.find(
              (m) => m.id === fileData.id.toString()
            );
            const originalUrl = originalInput?.src || fileData.originalUrl;

            // Decode Audio with fallback
            let audioBuffer: AudioBuffer;
            try {
              const arrayBuffer = await fetch(fileData.url).then((res) =>
                res.arrayBuffer()
              );
              audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            } catch (e) {
              console.warn(
                `Audio decode failed for ${fileData.url}, using silence.`,
                e
              );
              const duration = fileData.duration || 5;
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
    const overlays: TextOverlay[] = [];

    if (videos.length === 0) {
      setTimeline(null);
      setDuration(0);
      return;
    }

    // Use videos in array order (user-defined via drag-and-drop)
    // Filter for valid videos that have loaded assets
    const playbackOrder = videos.filter(
      (vid) => vid.src && loadedAssetsRef.current.has(vid.src)
    );

    if (playbackOrder.length === 0) {
      setTimeline(null);
      setDuration(0);
      return;
    }

    // Layout constants
    const rankingItemHeight = 200;
    const titleHeight = 300;
    const videoHeight = height - titleHeight;
    const totalRankingHeight = videos.length * rankingItemHeight;
    const rankingStartY = titleHeight + (videoHeight - totalRankingHeight) / 2;

    let currentOffset = 0;

    // Main Title (always visible across entire duration, updated at end)
    const mainTitleOverlay: TextOverlay = {
      id: "main-title",
      text: mainTitle,
      startTime: 0,
      endTime: 0, // placeholder, update after loop
      x: "center",
      y: 90,
      type: "main-title",
      opacity: 1,
      scale: 1,
    };
    overlays.push(mainTitleOverlay);

    // Build clips and per-clip overlays
    for (const vid of playbackOrder) {
      if (!vid.src) continue;
      const asset = loadedAssetsRef.current.get(vid.src);
      if (!asset) continue;

      const trimStart = vid.trim?.start || 0;
      const trimEnd =
        vid.trim?.end && vid.trim.end > 0 ? vid.trim.end : asset.duration;
      const clipDuration = Math.max(0, trimEnd - trimStart);

      if (clipDuration <= 0) continue;

      const startTime = currentOffset;
      const endTime = currentOffset + clipDuration;

      // 1. Add Video Clip
      clips.push({
        id: parseInt(vid.id),
        url: asset.url,
        originalUrl: vid.src,
        duration: clipDuration,
        startTime: startTime,
        endTime: endTime,
        sourceStart: trimStart,
        volume: 1,
        audioBuffer: asset.audioBuffer,
        cropX: vid.crop?.x,
        cropY: vid.crop?.y,
        cropWidth: vid.crop?.width,
        cropHeight: vid.crop?.height,
        memeSounds:
          vid.audio?.map((a) => ({
            id: Math.random().toString(), // Regenerate ID if needed or preserve? simple random is fine for preview
            soundId: "custom",
            file: a.src,
            startTime: a.start,
            volume: a.volume ?? 1.0,
          })) || [],
      });

      // 2. Add Overlays for this specific time range
      // For every clip duration, we render the full list of rankings
      videos.forEach((rankingVideo) => {
        const yPos =
          rankingStartY + (rankingVideo.slotIndex - 1) * rankingItemHeight;
        const isCurrentActive = rankingVideo.id === vid.id;
        const color = isCurrentActive ? "#ffff00" : "white";

        // Slot Number
        overlays.push({
          id: `slot-num-${rankingVideo.slotIndex}-during-${vid.id}`,
          text: [{ text: `${rankingVideo.slotIndex}.`, color, fontSize: 52 }],
          startTime: startTime,
          endTime: endTime,
          x: 30,
          y: yPos,
          type: "ranking-number",
          opacity: 1,
          scale: 1,
          rank: rankingVideo.slotIndex,
        });

        // Title (Only if current active)
        if (isCurrentActive && rankingVideo.title) {
          overlays.push({
            id: `slot-title-${rankingVideo.slotIndex}-during-${vid.id}`,
            text: rankingVideo.title.map((t) => ({
              ...t,
              color: t.color || color,
            })),
            startTime: startTime,
            endTime: endTime,
            x: 90,
            y: yPos + 4,
            type: "ranking-title",
            opacity: 1,
            scale: 1,
            rank: rankingVideo.slotIndex,
          });
        }
      });

      currentOffset += clipDuration;
    }

    // Update Main Title duration
    mainTitleOverlay.endTime = currentOffset;

    setDuration(currentOffset);
    setTimeline({
      duration: currentOffset,
      currentTime: 0,
      isPlaying: false,
      clips,
      overlays,
      width,
      height,
    });
  }, [mainTitle, videos, width, height]);

  // Effect 1: Handle Asset Loading (Debounced)
  useEffect(() => {
    const validVideos = debouncedVideos.filter(
      (v) => v.src && v.src.startsWith("http")
    );
    const needsLoad =
      validVideos.some((v) => !loadedAssetsRef.current.has(v.src)) ||
      debouncedVideos.some((v) =>
        v.audio?.some((s) => !loadedSoundsRef.current.has(s.src))
      );

    if (needsLoad) {
      loadAssets(validVideos).then((success) => {
        if (success) buildTimeline();
      });
    }
  }, [debouncedVideos, loadAssets, buildTimeline]);

  // Effect 2: Handle Instant Updates (Text/Structure)
  useEffect(() => {
    const validVideos = videos.filter((v) => v.src && v.src.startsWith("http"));
    const needsLoad =
      validVideos.some((v) => !loadedAssetsRef.current.has(v.src)) ||
      videos.some((v) =>
        v.audio?.some((s) => !loadedSoundsRef.current.has(s.src))
      );

    if (!needsLoad) {
      buildTimeline();
    }
  }, [videos, mainTitle, width, height, buildTimeline]);

  // Effect 3: Preload emoji images when text changes
  useEffect(() => {
    const allText: string[] = [];

    // Collect text from main title
    mainTitle.forEach((seg) => allText.push(seg.text));

    // Collect text from video titles
    videos.forEach((v) => {
      v.title?.forEach((seg) => allText.push(seg.text));
    });

    // Extract all emojis and preload their images
    const allEmojis = allText.flatMap((text) => extractEmojis(text));
    if (allEmojis.length > 0) {
      Promise.all(allEmojis.map((emoji) => preloadEmojisFromText(emoji))).then(
        () => {
          // Force a re-render to show loaded emojis
          if (timelineRef.current) {
            buildTimeline();
          }
        }
      );
    }
  }, [mainTitle, videos, buildTimeline]);

  // ... Render Loop and Audio Control ...

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
      onPlayStateChange?.(false);
      stopAudio();
      return;
    }

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    const tl = timelineRef.current;
    const currentClip = tl.clips.find(
      (clip) => currentTime >= clip.startTime && currentTime < clip.endTime
    );

    if (currentClip) {
      const videoEl = videoElementsRef.current.get(currentClip.id);
      if (videoEl) {
        const clipTime =
          currentTime - currentClip.startTime + currentClip.sourceStart;

        // Sync video element time
        if (Math.abs(videoEl.currentTime - clipTime) > 0.1) {
          videoEl.currentTime = clipTime;
        }

        const hasCrop = currentClip.cropWidth && currentClip.cropHeight;
        renderVideoFrame(
          ctx,
          videoEl,
          {
            crop: hasCrop
              ? {
                  x: currentClip.cropX ?? 0,
                  y: currentClip.cropY ?? 0,
                  width: currentClip.cropWidth!,
                  height: currentClip.cropHeight!,
                }
              : undefined,
          },
          width,
          height
        );
      }
    }

    const activeOverlays = tl.overlays.filter(
      (o) => currentTime >= o.startTime && currentTime <= o.endTime
    );

    activeOverlays.forEach((overlay) => {
      renderOverlay(ctx, overlay, width);
    });
  }, [currentTime, width, height]);

  // Audio Control
  const stopAudio = () => {
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Ignore errors when stopping source
      }
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
          onPlayStateChange?.(false);
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
            onPlayStateChange?.(false);
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

    // Don't try to use a closed context
    if (ctx.state === "closed") {
      console.warn(
        "[RealtimePreview] AudioContext is closed, cannot play audio"
      );
      return;
    }

    if (ctx.state === "suspended") ctx.resume();

    stopAudio();

    console.log(
      `[RealtimePreview] Playing audio for ${timeline.clips.length} clips`
    );

    timeline.clips.forEach((clip) => {
      // 1. Play Video Audio (if buffer exists)
      if (clip.audioBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;
        const gain = ctx.createGain();
        gain.gain.value = clip.volume;

        source.connect(gain);
        gain.connect(ctx.destination);

        const clipStartTimeline = clip.startTime;
        const clipEndTimeline = clip.endTime;

        if (clipStartTimeline >= currentTime) {
          source.start(
            ctx.currentTime + (clipStartTimeline - currentTime),
            clip.sourceStart,
            clip.duration
          );
          audioSourcesRef.current.set(`clip-${clip.id}`, source);
        } else if (clipEndTimeline > currentTime) {
          const offset = currentTime - clipStartTimeline;
          const bufferOffset = clip.sourceStart + offset;
          const durationRemaining = clip.duration - offset;
          source.start(ctx.currentTime, bufferOffset, durationRemaining);
          audioSourcesRef.current.set(`clip-${clip.id}`, source);
        }
      }

      // 2. Play Meme Sounds
      clip.memeSounds?.forEach((sound) => {
        const buffer = loadedSoundsRef.current.get(sound.file);
        if (!buffer) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = sound.volume || 1.0;

        source.connect(gain);
        gain.connect(ctx.destination);

        // Calculate absolute start/end time for this sound instance
        // meme sound startTime is relative to clip.startTime (after trim adjustment is implicit,
        // wait - memeSound.startTime is relative to the TRIMMED video start, so tness=0 of the clip.
        // So in global timeline: clip.startTime + sound.startTime.
        const soundGlobalStart = clip.startTime + sound.startTime;
        const soundDuration = buffer.duration;
        const soundGlobalEnd = soundGlobalStart + soundDuration;

        // But the clip might end before the sound ends?
        // In FFmpeg we used 'amix' with 'shortest' potentially, or the video length dictates.
        // If clip ends, visuals end. Audio might continue if not cut.
        // FFmpeg: we use `-shortest` on the output. So meme sound also gets cut if it exceeds video.
        // Let's enforce that here for accuracy.
        const validInitDuration = Math.min(
          soundDuration,
          clip.endTime - soundGlobalStart
        );
        if (validInitDuration <= 0) return;

        if (soundGlobalStart >= currentTime) {
          source.start(
            ctx.currentTime + (soundGlobalStart - currentTime),
            0,
            validInitDuration
          );
          audioSourcesRef.current.set(`sound-${sound.id}`, source);
        } else if (soundGlobalEnd > currentTime) {
          // Sound is partially played
          const offset = currentTime - soundGlobalStart;
          // if offset < 0, it means sound hasn't started (handled above)
          // if offset >= 0 and < validInitDuration
          if (offset < validInitDuration) {
            source.start(ctx.currentTime, offset, validInitDuration - offset);
            audioSourcesRef.current.set(`sound-${sound.id}`, source);
          }
        }
      });
    });
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio();
      videoElementsRef.current.forEach((v) => v.pause());
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.suspend();
      }
      onPlayStateChange?.(false);
    } else {
      setIsPlaying(true);
      onPlayStateChange?.(true);
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
    onTimeUpdate?.(newTime);
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
            {isPlaying ? <Pause /> : <Play />}
          </button>
        </div>
      </div>
    </div>
  );
}
