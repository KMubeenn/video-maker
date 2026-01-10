import { useState, useRef, useCallback, useEffect } from "react";
import {
  type CropPreset,
  calculateCropFromPreset,
  clampCropToBounds,
  detectCropPreset,
} from "../utils/cropUtils";
import { memeSoundsApi } from "../api/meme-sounds.api";
import type { MemeSound, VideoMemeSound } from "../types/timeline";
import "./VideoEditor.css";

const RESIZE_HANDLE_CURSOR = {
  nw: "nw-resize",
  n: "n-resize",
  ne: "ne-resize",
  e: "e-resize",
  se: "se-resize",
  s: "s-resize",
  sw: "sw-resize",
  w: "w-resize",
};

interface VideoEditorProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  // Updated onSave to include optional crop values and meme sounds
  onSave: (
    trimStart: number,
    trimEnd: number,
    cropX?: number,
    cropY?: number,
    cropWidth?: number,
    cropHeight?: number,
    memeSounds?: VideoMemeSound[],
    nativeWidth?: number,
    nativeHeight?: number
  ) => void;
  initialTrimStart?: number;
  initialTrimEnd?: number;
  // Initial crop values (in source video pixels)
  initialCropX?: number;
  initialCropY?: number;
  initialCropWidth?: number;
  initialCropHeight?: number;
  initialMemeSounds?: VideoMemeSound[];
}

// Helper to generate IDs
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

export function VideoEditor({
  url,
  isOpen,
  onClose,
  onSave,
  initialTrimStart = 0,
  initialTrimEnd = 0,
  initialCropX,
  initialCropY,
  initialCropWidth,
  initialCropHeight,
  initialMemeSounds = [],
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Edit State
  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState(initialTrimEnd || 0);
  const [isDragging, setIsDragging] = useState<
    "start" | "end" | "playhead" | null
  >(null);

  // Mode Switching
  const [editMode, setEditMode] = useState<"trim" | "crop" | "sounds">("trim");

  // Crop State
  const [videoNativeWidth, setVideoNativeWidth] = useState(0);
  const [videoNativeHeight, setVideoNativeHeight] = useState(0);
  const [cropX, setCropX] = useState(initialCropX || 0);
  const [cropY, setCropY] = useState(initialCropY || 0);
  const [cropWidth, setCropWidth] = useState(initialCropWidth || 0);
  const [cropHeight, setCropHeight] = useState(initialCropHeight || 0);
  const [activePreset, setActivePreset] = useState<CropPreset>("freeform");

  const [isCropDragging, setIsCropDragging] = useState(false);
  const [cropDragType, setCropDragType] = useState<string | null>(null);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });
  const [cropDragInitial, setCropDragInitial] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Meme Sounds State
  const [videoMemeSounds, setVideoMemeSounds] =
    useState<VideoMemeSound[]>(initialMemeSounds);
  const [availableSounds, setAvailableSounds] = useState<MemeSound[]>([]);
  const [loadingSounds, setLoadingSounds] = useState(false);
  const [draggedSoundId, setDraggedSoundId] = useState<string | null>(null);

  const lastTimeRef = useRef(0);

  // Load available sounds
  useEffect(() => {
    if (isOpen && editMode === "sounds" && availableSounds.length === 0) {
      setLoadingSounds(true);
      memeSoundsApi.list().then((sounds) => {
        setAvailableSounds(sounds);
        setLoadingSounds(false);
      });
    }
  }, [isOpen, editMode, availableSounds.length]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration;
      setDuration(vidDur);
      setVideoNativeWidth(videoRef.current.videoWidth);
      setVideoNativeHeight(videoRef.current.videoHeight);

      // Initialize inputs if provided
      const start = initialTrimStart;
      const end =
        initialTrimEnd && initialTrimEnd > 0 ? initialTrimEnd : vidDur;

      setTrimStart(start);
      setTrimEnd(end);
      setCurrentTime(start);
      videoRef.current.currentTime = start;

      // Initialize crop defaults if not provided
      if (!initialCropWidth || initialCropWidth === 0) {
        setCropWidth(videoRef.current.videoWidth);
        setCropHeight(videoRef.current.videoHeight);
        setCropX(0);
        setCropY(0);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;

    // Loop logic
    if (time >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    } else {
      setCurrentTime(time);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // Ensure we start from valid range
      if (currentTime >= trimEnd || currentTime < trimStart) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const skipToStart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    setCurrentTime(trimStart);
  };

  const skipToEnd = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimEnd;
    setCurrentTime(trimEnd);
  };

  const handleSave = () => {
    const isFullFrame =
      cropX === 0 &&
      cropY === 0 &&
      cropWidth === videoNativeWidth &&
      cropHeight === videoNativeHeight;

    if (isFullFrame) {
      onSave(
        trimStart,
        trimEnd,
        undefined,
        undefined,
        undefined,
        undefined,
        videoMemeSounds,
        videoNativeWidth,
        videoNativeHeight
      );
    } else {
      onSave(
        trimStart,
        trimEnd,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        videoMemeSounds,
        videoNativeWidth,
        videoNativeHeight
      );
    }
    onClose();
  };

  const handlePresetSelect = (preset: CropPreset) => {
    if (videoNativeWidth === 0 || videoNativeHeight === 0) return;

    const newCrop = calculateCropFromPreset(
      videoNativeWidth,
      videoNativeHeight,
      preset
    );
    setCropX(newCrop.x);
    setCropY(newCrop.y);
    setCropWidth(newCrop.width);
    setCropHeight(newCrop.height);
    setActivePreset(preset);
  };

  const handleResetCrop = () => {
    setCropX(0);
    setCropY(0);
    setCropWidth(videoNativeWidth);
    setCropHeight(videoNativeHeight);
    setActivePreset("freeform");
  };

  const handleCropMouseDown = (
    e: React.MouseEvent,
    type: "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCropDragging(true);
    setCropDragType(type);
    setCropDragStart({ x: e.clientX, y: e.clientY });
    setCropDragInitial({
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    });
  };

  useEffect(() => {
    if (!isCropDragging || !cropContainerRef.current) return;

    const handleCropMouseMove = (e: MouseEvent) => {
      const container = cropContainerRef.current;
      if (!container || videoNativeWidth === 0) return;

      const rect = container.getBoundingClientRect();
      // Calculate scale relative to displayed video size vs actual video size
      // The video element fits within the viewport.
      // We need to know the displayed dimensions of the video element.
      // Assuming video element fills the container or maintains aspect ratio.
      // The container is the viewport, but the video inside has object-fit contain.
      // Wait, we need accurate scaling.
      // Simplified: We assume container *is* the video display area or close to it,
      // but strictly we should use the video element's bounding rect?
      // cropContainerRef wraps the video.

      // Let's rely on ratio between videoNative and container rect?
      // No, if video is letterboxed, this is wrong.
      // However, for this MVP Editor, we assume video fills viewport or we accept slight inaccuracy.
      // Better: Use videoRef to get displayed dimensions.

      const scaleX = videoNativeWidth / rect.width;
      const scaleY = videoNativeHeight / rect.height;
      // If video is letterboxed, rect.width includes black bars?
      // Actually `video-viewport` has `display: flex; justify-content: center`.
      // The video has `max-width: 100%; max-height: 100%`.
      // So the video element itself should be the target.
      // cropContainerRef points to `video-viewport`.

      // For now, let's keep the logic I had before which seemed to work or at least was standard.
      // The previously replaced logic used `videoNativeWidth / rect.width`.

      const deltaX = (e.clientX - cropDragStart.x) * scaleX;
      const deltaY = (e.clientY - cropDragStart.y) * scaleY;

      let newX = cropDragInitial.x;
      let newY = cropDragInitial.y;
      let newWidth = cropDragInitial.width;
      let newHeight = cropDragInitial.height;

      if (cropDragType === "move") {
        newX = cropDragInitial.x + deltaX;
        newY = cropDragInitial.y + deltaY;
      } else {
        if (cropDragType?.includes("w")) {
          newX = cropDragInitial.x + deltaX;
          newWidth = cropDragInitial.width - deltaX;
        }
        if (cropDragType?.includes("e")) {
          newWidth = cropDragInitial.width + deltaX;
        }
        if (cropDragType?.includes("n")) {
          newY = cropDragInitial.y + deltaY;
          newHeight = cropDragInitial.height - deltaY;
        }
        if (cropDragType?.includes("s")) {
          newHeight = cropDragInitial.height + deltaY;
        }
      }

      const clamped = clampCropToBounds(
        { x: newX, y: newY, width: newWidth, height: newHeight },
        videoNativeWidth,
        videoNativeHeight
      );

      setCropX(clamped.x);
      setCropY(clamped.y);
      setCropWidth(clamped.width);
      setCropHeight(clamped.height);
      setActivePreset(detectCropPreset(clamped));
    };

    const handleCropMouseUp = () => {
      setIsCropDragging(false);
      setCropDragType(null);
    };

    document.addEventListener("mousemove", handleCropMouseMove);
    document.addEventListener("mouseup", handleCropMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleCropMouseMove);
      document.removeEventListener("mouseup", handleCropMouseUp);
    };
  }, [
    isCropDragging,
    cropDragStart,
    cropDragInitial,
    cropDragType,
    videoNativeWidth,
    videoNativeHeight,
  ]);

  const getCropStyle = () => {
    if (videoNativeWidth === 0 || videoNativeHeight === 0) {
      return { left: "0%", top: "0%", width: "100%", height: "100%" };
    }
    return {
      left: `${(cropX / videoNativeWidth) * 100}%`,
      top: `${(cropY / videoNativeHeight) * 100}%`,
      width: `${(cropWidth / videoNativeWidth) * 100}%`,
      height: `${(cropHeight / videoNativeHeight) * 100}%`,
    };
  };

  const getTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || duration === 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(duration, pos * duration));
    },
    [duration]
  );

  // Sound helper: Get time from sound timeline position (relative to trim start)
  const getSoundTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = (clientX - rect.left) / rect.width;
      // The sound timeline represents the duration of the TRIMMED clip
      const clipDuration = trimEnd - trimStart;
      if (clipDuration <= 0) return 0;

      return Math.max(0, Math.min(clipDuration, pos * clipDuration));
    },
    [trimStart, trimEnd]
  );

  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    type: "start" | "end" | "playhead"
  ) => {
    e.preventDefault();
    setIsDragging(type);
  };

  // Logic to add valid sound
  const handleAddSound = (sound: MemeSound) => {
    // robust random id
    // robust random id
    const randomId = generateId();
    const newSound: VideoMemeSound = {
      id: randomId,
      soundId: sound.id,
      file: sound.url, // We might need backend path vs URL logic. URL is acceptable for now.
      startTime: 0, // Default to start of clip
      volume: 1.0,
    };
    setVideoMemeSounds([...videoMemeSounds, newSound]);
  };

  const handleRemoveSound = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoMemeSounds(videoMemeSounds.filter((s) => s.id !== id));
  };

  const handleSoundDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedSoundId(id);
  };

  // Unified Global Mouse Move/Up for Timeline & Sound dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const time = getTimeFromPosition(e.clientX);

        if (isDragging === "start") {
          if (time < trimEnd - 0.5) {
            setTrimStart(time);
            if (videoRef.current && currentTime < time) {
              videoRef.current.currentTime = time;
              setCurrentTime(time);
              lastTimeRef.current = time;
            }
          }
        } else if (isDragging === "end") {
          if (time > trimStart + 0.5) {
            setTrimEnd(time);
            if (videoRef.current && currentTime > time) {
              videoRef.current.currentTime = time;
              setCurrentTime(time);
              lastTimeRef.current = time;
            }
          }
        } else if (isDragging === "playhead") {
          const clampedTime = Math.max(trimStart, Math.min(trimEnd, time));
          if (videoRef.current) {
            videoRef.current.currentTime = clampedTime;
            setCurrentTime(clampedTime);
            lastTimeRef.current = clampedTime;
          }
        }
      } else if (draggedSoundId) {
        // Handle sound dragging
        // Calculate new start time relative to clip duration
        const soundTime = getSoundTimeFromPosition(e.clientX);
        setVideoMemeSounds((prev) =>
          prev.map((s) =>
            s.id === draggedSoundId ? { ...s, startTime: soundTime } : s
          )
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setDraggedSoundId(null);
    };

    if (isDragging || draggedSoundId) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    trimStart,
    trimEnd,
    currentTime,
    getTimeFromPosition,
    draggedSoundId,
    getSoundTimeFromPosition,
  ]);

  if (!isOpen) return null;

  const clipDuration = trimEnd - trimStart;
  const startPercent = (trimStart / duration) * 100 || 0;
  const endPercent = (trimEnd / duration) * 100 || 100;
  const playheadPercent = (currentTime / duration) * 100 || 0;

  // For Sound Timeline (relative to trim)
  // Playhead position within the TRIMMED region (0-100% of trim duration)
  const relativeCurrentTime = currentTime - trimStart;
  const relativePlayheadPercent = Math.max(
    0,
    Math.min(100, (relativeCurrentTime / clipDuration) * 100)
  );

  return (
    <div className="video-editor-overlay" onClick={onClose}>
      <div className="video-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <div className="header-title">
            <span className="header-icon">
              {editMode === "trim" ? "✂️" : editMode === "crop" ? "🔲" : "🎵"}
            </span>
            <h3>Video Editor</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="editor-mode-tabs">
          <button
            className={`mode-tab ${editMode === "trim" ? "active" : ""}`}
            onClick={() => setEditMode("trim")}
          >
            ✂️ Trim
          </button>
          <button
            className={`mode-tab ${editMode === "crop" ? "active" : ""}`}
            onClick={() => setEditMode("crop")}
          >
            🔲 Crop
          </button>
          <button
            className={`mode-tab ${editMode === "sounds" ? "active" : ""}`}
            onClick={() => setEditMode("sounds")}
          >
            🎵 Sounds
          </button>
        </div>

        <div className="video-viewport" ref={cropContainerRef}>
          <video
            ref={videoRef}
            src={url}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
          />
          {/* Crop Overlay */}
          {editMode === "crop" && videoNativeWidth > 0 && (
            <div className="crop-overlay-container">
              {/* Use existing crop overlay logic */}
              <div
                className="crop-mask crop-mask-top"
                style={{ height: getCropStyle().top }}
              />
              <div
                className="crop-mask crop-mask-bottom"
                style={{
                  top: `calc(${getCropStyle().top} + ${getCropStyle().height})`,
                  height: `calc(100% - ${getCropStyle().top} - ${
                    getCropStyle().height
                  })`,
                }}
              />
              <div
                className="crop-mask crop-mask-left"
                style={{
                  top: getCropStyle().top,
                  height: getCropStyle().height,
                  width: getCropStyle().left,
                }}
              />
              <div
                className="crop-mask crop-mask-right"
                style={{
                  top: getCropStyle().top,
                  height: getCropStyle().height,
                  left: `calc(${getCropStyle().left} + ${
                    getCropStyle().width
                  })`,
                  width: `calc(100% - ${getCropStyle().left} - ${
                    getCropStyle().width
                  })`,
                }}
              />
              <div
                className="crop-region"
                style={getCropStyle()}
                onMouseDown={(e) => handleCropMouseDown(e, "move")}
              >
                {["nw", "ne", "sw", "se", "n", "s", "e", "w"].map((h) => (
                  <div
                    key={h}
                    className={`crop-handle crop-handle-${h}`}
                    onMouseDown={(e) =>
                      handleCropMouseDown(
                        e,
                        h as keyof typeof RESIZE_HANDLE_CURSOR
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div
            className={`play-overlay ${isPlaying ? "hidden" : ""}`}
            onClick={togglePlay}
          >
            <div className="play-button">▶</div>
          </div>
        </div>

        {/* Lower Panel Content based on Mode */}
        {editMode === "sounds" ? (
          <div className="sounds-panel">
            {/* Sound Library */}
            <div className="sounds-library">
              <h4>Available Sounds</h4>
              <div className="sounds-list">
                {loadingSounds && <div>Loading sounds...</div>}
                {availableSounds.map((sound) => (
                  <div
                    key={sound.id}
                    className="sound-item"
                    onClick={() => handleAddSound(sound)}
                  >
                    <span className="sound-icon">🔊</span>
                    <span className="sound-name">{sound.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sounds Timeline (Relative) */}
            <div className="sounds-timeline-container">
              <div className="timeline-labels">
                <span>0:00</span>
                <span className="trim-range-label">
                  Sound Tracks (Relative to Trim)
                </span>
                <span>{formatTime(clipDuration)}</span>
              </div>

              <div className="timeline sound-timeline" ref={timelineRef}>
                <div className="timeline-track" />

                {/* Playhead (relative) */}
                <div
                  className="playhead"
                  style={{ left: `${relativePlayheadPercent}%` }}
                />

                {/* Placed Sounds */}
                {videoMemeSounds.map((inst) => {
                  const soundDef = availableSounds.find(
                    (s) => s.id === inst.soundId
                  );
                  // Ensure we don't divide by zero
                  const safeDuration = clipDuration > 0 ? clipDuration : 1;
                  const leftPercent = Math.min(
                    100,
                    Math.max(0, (inst.startTime / safeDuration) * 100)
                  );

                  return (
                    <div
                      key={inst.id}
                      className="placed-sound"
                      style={{ left: `${leftPercent}%` }}
                      onMouseDown={(e) => handleSoundDragStart(inst.id, e)}
                      title={`Starts at ${formatTime(inst.startTime)}`}
                    >
                      <span className="sound-time">
                        {formatTime(inst.startTime)}
                      </span>
                      <span className="sound-label">
                        {soundDef?.name || "Sound"}
                      </span>
                      <button
                        className="sound-remove-btn"
                        onClick={(e) => handleRemoveSound(inst.id, e)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : editMode === "crop" ? (
          <div className="crop-presets">
            <span className="crop-presets-label">Crop:</span>
            {["9:16", "1:1", "16:9", "freeform"].map((p) => (
              <button
                key={p}
                className={`crop-preset-btn ${
                  activePreset === p ? "active" : ""
                }`}
                onClick={() => handlePresetSelect(p as CropPreset)}
              >
                {p === "freeform" ? "Full" : p}
              </button>
            ))}
            <span className="crop-info">
              {cropWidth}×{cropHeight}
            </span>
          </div>
        ) : (
          // Trim Controls default
          <div className="timeline-container">
            <div className="timeline-labels">
              <span>{formatTime(trimStart)}</span>
              <span className="trim-range-label">Trim Range</span>
              <span>{formatTime(trimEnd)}</span>
            </div>

            <div
              className="timeline"
              ref={timelineRef}
              onClick={(e) => {
                if (isDragging) return;
                const time = getTimeFromPosition(e.clientX);
                if (videoRef.current) {
                  const clampedTime = Math.max(
                    trimStart,
                    Math.min(trimEnd, time)
                  );
                  videoRef.current.currentTime = clampedTime;
                  setCurrentTime(clampedTime);
                }
              }}
            >
              <div className="timeline-track" />
              <div
                className="timeline-dimmed"
                style={{ left: 0, width: `${startPercent}%` }}
              />
              <div
                className="timeline-selected"
                style={{
                  left: `${startPercent}%`,
                  width: `${endPercent - startPercent}%`,
                }}
              />
              <div
                className="timeline-dimmed"
                style={{ left: `${endPercent}%`, right: 0 }}
              />

              <div
                className="trim-handle start-handle"
                style={{ left: `${startPercent}%` }}
                onMouseDown={(e) => handleTimelineMouseDown(e, "start")}
              >
                <div className="handle-grip">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div
                className="trim-handle end-handle"
                style={{ left: `${endPercent}%` }}
                onMouseDown={(e) => handleTimelineMouseDown(e, "end")}
              >
                <div className="handle-grip">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div
                className="playhead"
                style={{ left: `${playheadPercent}%` }}
                onMouseDown={(e) => handleTimelineMouseDown(e, "playhead")}
              >
                <div className="playhead-head" />
                <div className="playhead-line" />
              </div>
            </div>
          </div>
        )}

        <div className="editor-controls">
          {/* Time Info Bar */}
          <div className="time-info-bar">
            <div className="time-stat">
              <span className="time-label">Current</span>
              <span className="time-value">{formatTime(currentTime)}</span>
            </div>
            <div className="time-stat primary">
              <span className="time-label">Clip Duration</span>
              <span className="time-value">{formatTime(clipDuration)}</span>
            </div>
          </div>

          <div className="playback-controls">
            <button
              className="control-btn"
              onClick={skipToStart}
              title="Go to trim start"
            >
              ⏮
            </button>
            <button className="control-btn play-btn" onClick={togglePlay}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              className="control-btn"
              onClick={skipToEnd}
              title="Go to trim end"
            >
              ⏭
            </button>
          </div>

          <div className="action-buttons">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="reset-btn"
              onClick={() => {
                setTrimStart(0);
                setTrimEnd(duration);
                handleResetCrop();
                setVideoMemeSounds([]);
              }}
            >
              Reset All
            </button>
            <button className="save-btn" onClick={handleSave}>
              ✓ Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
