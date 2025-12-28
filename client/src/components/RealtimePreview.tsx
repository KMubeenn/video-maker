import { useState, useEffect, useRef, useCallback } from "react";
import { type TextSegment } from "./RichTextInput";
import {
  type TimelineState,
  type TimelineClip,
  type TextOverlay,
  type VideoMemeSound,
} from "../types/timeline";
import "./RealtimePreview.css";
import { Pause, Play } from "lucide-react";

interface RealtimePreviewProps {
  mainTitle: TextSegment[];
  videos: {
    id: number;
    url: string;
    title: TextSegment[];
    trimStart?: number;
    trimEnd?: number;
    // Crop values (in source video pixels)
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    memeSounds?: VideoMemeSound[];
  }[];
  width: number;
  height: number;
  firstToPlay?: number | null; // Index of video to play first (not rank #1)
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

export function RealtimePreview({
  mainTitle,
  videos,
  width,
  height,
  firstToPlay,
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
        window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  // 1. Fetch Assets (Debounced)
  const loadAssets = useCallback(
    async (videosToLoad: typeof videos) => {
      // Only attempt to load URLs that look somewhat valid (length > 10, http)
      const validToLoad = videosToLoad.filter(
        (v) => v.url && v.url.trim().length > 10 && v.url.startsWith("http")
      );

      // Determine which valid videos are missing from cache
      const missingVideos = validToLoad.filter(
        (v) => !loadedAssetsRef.current.has(v.url)
      );

      // Identify missing meme sounds
      const allSoundUrls = new Set<string>();
      videosToLoad.forEach((v) => {
        v.memeSounds?.forEach((s) => allSoundUrls.add(s.file));
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
                videos: missingVideos.map((v) => ({ url: v.url, id: v.id })),
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

          const loaded: any[] = data.videos;

          // Process and cache
          for (const fileData of loaded) {
            const originalInput = missingVideos.find(
              (m) => m.id === fileData.id
            );
            const originalUrl = originalInput?.url || fileData.originalUrl;

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
    let currentOffset = 0;

    if (videos.length === 0) {
      setTimeline(null);
      setDuration(0);
      return;
    }

    const rank1Video = videos[0];
    const otherVideos = videos.slice(1);

    // Random shuffle for other videos (Rank 2-N)
    let shuffledOthers = [...otherVideos].sort((a, b) => {
      // Simple deterministic hash based shuffle
      return ((a.id * 13 + 7) % 5) - ((b.id * 13 + 7) % 5);
    });

    if (firstToPlay !== null && firstToPlay !== undefined && firstToPlay >= 1) {
      const selectedVideo = videos[firstToPlay];
      if (selectedVideo) {
        shuffledOthers = shuffledOthers.filter(
          (v) => v.id !== selectedVideo.id
        );
        shuffledOthers.unshift(selectedVideo);
      }
    }

    const rawPlaybackOrder = [...shuffledOthers, rank1Video].filter(Boolean);

    const playbackOrder = rawPlaybackOrder.filter(
      (vid) => vid.url && loadedAssetsRef.current.has(vid.url)
    );

    for (const vid of playbackOrder) {
      if (!vid.url) continue;
      const asset = loadedAssetsRef.current.get(vid.url);

      if (!asset) continue;

      const trimStart = vid.trimStart || 0;
      const trimEnd =
        vid.trimEnd && vid.trimEnd > 0 ? vid.trimEnd : asset.duration;
      const clipDuration = Math.max(0, trimEnd - trimStart);

      if (clipDuration <= 0) continue;

      clips.push({
        id: vid.id,
        url: asset.url,
        originalUrl: vid.url,
        duration: clipDuration,
        startTime: currentOffset,
        endTime: currentOffset + clipDuration,
        sourceStart: trimStart,
        volume: 1,
        audioBuffer: asset.audioBuffer,
        cropX: vid.cropX,
        cropY: vid.cropY,
        cropWidth: vid.cropWidth,
        cropHeight: vid.cropHeight,
        memeSounds: vid.memeSounds || [],
      });
      currentOffset += clipDuration;
    }

    const totalDuration = currentOffset;

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
        const titleHeight = 300; // Increased from 200 for more title space
        const videoHeight = height - titleHeight;
        const totalRankingHeight = videos.length * rankingItemHeight;
        const rankingStartY =
          titleHeight + (videoHeight - totalRankingHeight) / 2;
        const yPos = rankingStartY + originalIdx * rankingItemHeight;

        const color = isCurrentRank ? "#ffff00" : "white";

        // Rank Number
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

        // Video Title
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
  }, [mainTitle, videos, width, height, firstToPlay]);

  // Effect 1: Handle Asset Loading (Debounced)
  useEffect(() => {
    const validVideos = debouncedVideos.filter(
      (v) => v.url && v.url.startsWith("http")
    );
    const needsLoad =
      validVideos.some((v) => !loadedAssetsRef.current.has(v.url)) ||
      debouncedVideos.some((v) =>
        v.memeSounds?.some((s) => !loadedSoundsRef.current.has(s.file))
      );

    if (needsLoad) {
      loadAssets(validVideos).then((success) => {
        if (success) buildTimeline();
      });
    }
  }, [debouncedVideos, loadAssets, buildTimeline]);

  // Effect 2: Handle Instant Updates (Text/Structure)
  useEffect(() => {
    const validVideos = videos.filter((v) => v.url && v.url.startsWith("http"));
    const needsLoad =
      validVideos.some((v) => !loadedAssetsRef.current.has(v.url)) ||
      videos.some((v) =>
        v.memeSounds?.some((s) => !loadedSoundsRef.current.has(s.file))
      );

    if (!needsLoad) {
      buildTimeline();
    }
  }, [videos, mainTitle, width, height, buildTimeline]);

  // ... Render Loop and Audio Control ...

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, overlay: TextOverlay) => {
      ctx.save();
      const fontBase = "Impact, Arial, sans-serif";
      const getSegColor = (seg: TextSegment) => normalizeColor(seg.color);

      if (overlay.type === "main-title") {
        const fontSize = 72; // Increased from 52
        const maxWidth = 900; // Slightly wider to accommodate letter spacing
        const lineHeight = fontSize + 14; // More line spacing
        const letterSpacing = 4; // Extra pixels between each character
        const lines = wrapTextStats(ctx, overlay.text, maxWidth, fontSize);

        let startY = 180; // Centered vertically in 300px title area (accounting for font baseline)
        if (lines.length > 1) {
          startY -= ((lines.length - 1) * lineHeight) / 2;
        }

        lines.forEach((line, lineIdx) => {
          // Calculate total line width including letter spacing
          let lineWidth = 0;
          line.forEach((s) => {
            const segFontSize = s.fontSize || fontSize;
            ctx.font = `${segFontSize}px ${fontBase}`;
            // Add letter spacing for each character
            for (const char of s.text) {
              lineWidth += ctx.measureText(char).width + letterSpacing;
            }
          });
          // Remove the last extra spacing
          lineWidth -= letterSpacing;

          let currentX = (width - lineWidth) / 2;
          const currentY = startY + lineIdx * lineHeight;

          // Draw background box with extra padding for letter spacing
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(
            currentX - 20,
            currentY - fontSize,
            lineWidth + 40,
            fontSize + 32
          );

          // Draw each segment with letter spacing
          line.forEach((seg) => {
            const segFontSize = seg.fontSize || fontSize;
            ctx.font = `${segFontSize}px ${fontBase}`;
            const segColor = getSegColor(seg);

            // Check if border should be shown:
            // 1. hasBorder must be true (or undefined for backward compatibility)
            // 2. Color must NOT be white (borders don't look good on white text)
            const isWhiteColor =
              segColor === "white" ||
              segColor === "#ffffff" ||
              segColor === "#fff" ||
              segColor === "rgb(255, 255, 255)";
            const shouldShowBorder = seg.hasBorder !== false && !isWhiteColor;

            // Ensure all characters align to the same baseline
            ctx.textBaseline = "alphabetic";

            // Draw each character individually with spacing
            for (const char of seg.text) {
              // Only show yellow border if enabled and not white text
              if (shouldShowBorder) {
                ctx.strokeStyle = "#FFD700"; // Yellow border
                ctx.lineWidth = 4;
                ctx.lineJoin = "round";
                ctx.strokeText(char, currentX, currentY);
              }
              // Fill text on top
              ctx.fillStyle = segColor;
              ctx.fillText(char, currentX, currentY);
              currentX += ctx.measureText(char).width + letterSpacing;
            }
          });
        });
      } else if (overlay.type === "ranking-title") {
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
            ctx.strokeStyle = "black";
            ctx.lineWidth = 3;
            ctx.lineJoin = "round";
            ctx.strokeText(seg.text, currentX, currentY);
            ctx.fillText(seg.text, currentX, currentY);
            currentX += ctx.measureText(seg.text).width;
          });
          currentY += lineHeight;
        });
      } else if (overlay.type === "ranking-number") {
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
    },
    [width]
  );

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

        const titleHeight = 300; // Increased from 200 for more title space
        const videoAreaHeight = height - titleHeight;
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const hasCrop = currentClip.cropWidth && currentClip.cropHeight;
        const sx = hasCrop ? currentClip.cropX ?? 0 : 0;
        const sy = hasCrop ? currentClip.cropY ?? 0 : 0;
        const sw = hasCrop ? currentClip.cropWidth! : vw;
        const sh = hasCrop ? currentClip.cropHeight! : vh;

        if (sw > 0 && sh > 0) {
          const scale = Math.max(width / sw, videoAreaHeight / sh);
          const scaledW = sw * scale;
          const scaledH = sh * scale;
          const dx = (width - scaledW) / 2;
          const dy = titleHeight + (videoAreaHeight - scaledH) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, titleHeight, width, videoAreaHeight);
          ctx.clip();
          ctx.drawImage(videoEl, sx, sy, sw, sh, dx, dy, scaledW, scaledH);
          ctx.restore();
        }
      }
    }

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
      } catch {}
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
            {isPlaying ? <Pause /> : <Play />}
          </button>
        </div>
      </div>
    </div>
  );
}
