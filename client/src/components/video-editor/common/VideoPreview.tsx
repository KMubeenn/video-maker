import { useRef, useEffect, useState } from "react";
import { useVideoEditor } from "../context/VideoEditorContext";
import { CropOverlay } from "./CropOverlay";

interface VideoPreviewProps {
  url: string;
}

export function VideoPreview({ url }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // State for video rect
  const [videoRect, setVideoRect] = useState<DOMRect | null>(null);

  const {
    editorState,
    setTrim,
    isPlaying,
    setPlaybackState,
    currentTime,
    setCurrentTime,
    updateState,
    activeTool,
  } = useVideoEditor();

  const { trim, duration, nativeWidth } = editorState;
  const trimStart = trim.start;
  const trimEnd = trim.end;

  // Measure Video Rect on resize or metadata load
  const measureVideo = () => {
    if (videoRef.current) {
      setVideoRect(videoRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    measureVideo();
    window.addEventListener("resize", measureVideo);
    return () => window.removeEventListener("resize", measureVideo);
  }, [editorState.nativeWidth, editorState.nativeHeight, activeTool]);

  // Sync Playback State -> Video Element
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((e) => console.error("Play failed", e));
      }
    } else {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Sync CurrentTime -> Video Element
  useEffect(() => {
    if (!videoRef.current) return;
    // Only set if significant difference to avoid fighting with timeupdate
    if (Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;

    // Loop Logic
    if (trimEnd > 0 && time >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    } else {
      setCurrentTime(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;

      updateState({
        duration: dur,
        nativeWidth: width,
        nativeHeight: height,
      });

      // Initialize trim if empty
      if (trimEnd === 0) {
        setTrim(0, dur);
        // Also update local currentTime if 0
        setCurrentTime(0);
      }
      measureVideo();
    }
  };

  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<{ [key: string]: GainNode }>({});

  // Initialize Web Audio API for each audio element (only once per element)
  useEffect(() => {
    // Use setTimeout to ensure audio elements are mounted before initializing
    const timer = setTimeout(() => {
      editorState.audio.forEach((sound) => {
        const audioEl = audioRefs.current[sound.id];

        if (!audioEl || gainNodesRef.current[sound.id]) {
          return; // Already initialized or element not ready
        }

        // Create AudioContext on first audio element
        if (!audioContextRef.current) {
          const AudioContextClass =
            window.AudioContext ||
            (
              window as typeof window & {
                webkitAudioContext: typeof AudioContext;
              }
            ).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
          console.log(
            "🎹 AudioContext created. State:",
            audioContextRef.current.state
          );
        }

        try {
          // Create MediaElementSource (can only be called ONCE per element)
          const source =
            audioContextRef.current.createMediaElementSource(audioEl);
          const gainNode = audioContextRef.current.createGain();

          // Connect: source -> gainNode -> destination
          source.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);

          // Store the gain node for volume control
          gainNodesRef.current[sound.id] = gainNode;

          console.log(
            "✅ Web Audio initialized for:",
            sound.id,
            "Volume will support 0-2 range"
          );
        } catch (e) {
          console.error("❌ Failed to initialize Web Audio for", sound.id, e);
        }
      });

      // Cleanup removed audio elements
      const currentIds = new Set(editorState.audio.map((s) => s.id));
      Object.keys(gainNodesRef.current).forEach((id) => {
        if (!currentIds.has(id)) {
          console.log("🧹 Cleaning up removed audio:", id);
          delete gainNodesRef.current[id];
        }
      });
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, [editorState.audio]);

  // Sync Audio Playback & Volume
  useEffect(() => {
    editorState.audio.forEach((sound) => {
      const audioEl = audioRefs.current[sound.id];
      if (!audioEl) {
        return;
      }

      // Resume AudioContext on first user interaction (autoplay policy requirement)
      if (audioContextRef.current?.state === "suspended") {
        console.log("⏸️ AudioContext suspended, attempting resume...");
        audioContextRef.current
          .resume()
          .then(() => console.log("▶️ AudioContext resumed successfully"))
          .catch((e) => console.warn("❌ Failed to resume AudioContext:", e));
      }

      const absoluteStartTime = trimStart + sound.startTime;
      const relTime = currentTime - absoluteStartTime;
      const duration = isNaN(audioEl.duration) ? Infinity : audioEl.duration;

      // Playback control
      if (relTime >= 0 && relTime < duration && isPlaying) {
        if (audioEl.paused) {
          audioEl.play().catch((e) => {
            console.error("❌ Audio Play Error:", sound.file, e);
            // Try resuming context again if play failed
            if (audioContextRef.current?.state === "suspended") {
              console.log("⏸️ Retrying AudioContext resume after play error");
              audioContextRef.current.resume();
            }
          });
        }
        // Sync time if drifted
        if (Math.abs(audioEl.currentTime - relTime) > 0.2) {
          audioEl.currentTime = relTime;
        }
      } else {
        if (!audioEl.paused) {
          audioEl.pause();
        }
        // Reset if we rewound before the start
        if (relTime < 0 && audioEl.currentTime !== 0) {
          audioEl.currentTime = 0;
        }
      }

      // Volume control: Use GainNode for full 0-2 range
      const volume = sound.volume ?? 1;
      const gainNode = gainNodesRef.current[sound.id];

      if (gainNode) {
        // GainNode handles the full volume range (0-2)
        gainNode.gain.value = volume;
        // Set HTML element volume to 1.0 (it's now routed through Web Audio API)
        audioEl.volume = 1.0;
      } else {
        // Fallback if Web Audio not initialized yet: clamp to valid range
        audioEl.volume = Math.min(volume, 1);
      }
    });
  }, [currentTime, isPlaying, editorState.audio, trimStart]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const togglePlay = () => {
    setPlaybackState(!isPlaying);
  };

  // --- Crop Interaction Logic ---
  // Handlers for crop dragging would go here (similar to original VideoEditor.tsx),
  // but using internal state + context updates.
  // For brevity in this step, I will implement a simplified version or reuse the logic.

  // NOTE: We need accurate scaling for generic container.
  // Calculate aspect ratio for the wrapper
  const aspectRatio =
    nativeWidth && editorState.nativeHeight
      ? nativeWidth / editorState.nativeHeight
      : 16 / 9;

  // Ensure metadata is captured if already loaded
  useEffect(() => {
    if (videoRef.current && videoRef.current.readyState >= 1) {
      handleLoadedMetadata();
    }
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
      {/* Video Content Wrapper - Uses aspect-ratio to strictly size itself to the video content within the parent constraints */}
      <div
        className="relative max-w-full max-h-full flex flex-col items-center justify-center shadow-2xl"
        style={{ aspectRatio }}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full object-contain block"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            // Fallback if loop logic misses (video ends exactly at duration)
            if (trimEnd >= duration) {
              videoRef.current!.currentTime = trimStart;
              setCurrentTime(trimStart);
              videoRef.current!.play();
            }
          }}
          onClick={togglePlay}
        />

        {/* Audio Indicator */}
        {editorState.audio.length > 0 && (
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10 text-white animate-fade-in shadow-xl z-20 pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
              <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
            </svg>
          </div>
        )}

        {/* Play Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-full shadow-lg border border-white/20">
              <div className="text-4xl ml-1 text-white">▶</div>
            </div>
          </div>
        )}

        {/* Crop Overlay - Only visible when ActiveTool is Crop */}
        {activeTool === "crop" && nativeWidth > 0 && videoRect && (
          <CropOverlay videoRect={videoRect} />
        )}
      </div>

      {/* Trim Visualization Overlay - Mini Timeline on Preview */}
      {duration > 0 && (
        <div className="absolute bottom-4 left-4 right-4 h-1.5 bg-black/40 rounded-full backdrop-blur-md overflow-hidden pointer-events-none z-10">
          {/* Active Range Highlight */}
          <div
            className="absolute top-0 bottom-0 bg-primary/60"
            style={{
              left: `${(trimStart / duration) * 100}%`,
              width: `${((trimEnd - trimStart) / duration) * 100}%`,
            }}
          />
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]"
            style={{
              left: `${(currentTime / duration) * 100}%`,
              transform: "translateX(-50%)",
            }}
          />
        </div>
      )}
      {/* Hidden Audio Elements for Preview */}
      {editorState.audio.map((sound) => (
        <audio
          key={sound.id}
          ref={(el) => {
            if (el) {
              audioRefs.current[sound.id] = el;
              console.log(`📎 Audio element ref set for ${sound.id}`);
            } else {
              delete audioRefs.current[sound.id];
            }
          }}
          src={sound.file}
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={() => {
            console.log(`📊 Audio metadata loaded for ${sound.id}`);
          }}
        />
      ))}
    </div>
  );
}
