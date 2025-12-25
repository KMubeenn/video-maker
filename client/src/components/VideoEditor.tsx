import { useState, useRef, useCallback, useEffect } from "react";
import {
  type CropState,
  type CropPreset,
  calculateCropFromPreset,
  clampCropToBounds,
  detectCropPreset,
} from "../utils/cropUtils";
import "./VideoEditor.css";

interface VideoEditorProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  // Updated onSave to include optional crop values
  onSave: (
    trimStart: number,
    trimEnd: number,
    cropX?: number,
    cropY?: number,
    cropWidth?: number,
    cropHeight?: number
  ) => void;
  initialTrimStart?: number;
  initialTrimEnd?: number;
  // Initial crop values (in source video pixels)
  initialCropX?: number;
  initialCropY?: number;
  initialCropWidth?: number;
  initialCropHeight?: number;
}

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
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState<
    "start" | "end" | "playhead" | null
  >(null);

  // Trim state
  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState(initialTrimEnd);

  // Video native dimensions (from metadata)
  const [videoNativeWidth, setVideoNativeWidth] = useState(0);
  const [videoNativeHeight, setVideoNativeHeight] = useState(0);

  // Crop state (stored in source video pixels)
  // If no initial crop, will be set to full frame on metadata load
  const [cropX, setCropX] = useState(initialCropX ?? 0);
  const [cropY, setCropY] = useState(initialCropY ?? 0);
  const [cropWidth, setCropWidth] = useState(initialCropWidth ?? 0);
  const [cropHeight, setCropHeight] = useState(initialCropHeight ?? 0);
  const [activePreset, setActivePreset] = useState<CropPreset>("freeform");

  // Edit mode: "trim" or "crop" - allows user to focus on one at a time
  const [editMode, setEditMode] = useState<"trim" | "crop">("trim");

  // Crop drag state
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [cropDragType, setCropDragType] = useState<
    "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null
  >(null);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });
  const [cropDragInitial, setCropDragInitial] = useState<CropState>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration;
      const nativeW = videoRef.current.videoWidth;
      const nativeH = videoRef.current.videoHeight;

      setDuration(vidDur);
      setVideoNativeWidth(nativeW);
      setVideoNativeHeight(nativeH);

      if (trimEnd === 0 || trimEnd > vidDur) {
        setTrimEnd(vidDur);
      }
      setCurrentTime(initialTrimStart);
      videoRef.current.currentTime = initialTrimStart;

      // Initialize crop to full frame if not provided
      if (cropWidth === 0 || cropHeight === 0) {
        setCropX(0);
        setCropY(0);
        setCropWidth(nativeW);
        setCropHeight(nativeH);
        setActivePreset("freeform");
      } else {
        // Detect preset from initial crop
        setActivePreset(
          detectCropPreset({
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight,
          })
        );
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      // Loop within trim region
      if (cur >= trimEnd) {
        videoRef.current.currentTime = trimStart;
        if (!isPlaying) {
          videoRef.current.pause();
        }
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (
          videoRef.current.currentTime >= trimEnd ||
          videoRef.current.currentTime < trimStart
        ) {
          videoRef.current.currentTime = trimStart;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipToStart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  };

  const skipToEnd = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(trimEnd - 0.5, trimStart);
      setCurrentTime(Math.max(trimEnd - 0.5, trimStart));
    }
  };

  const handleSave = () => {
    // Include crop values only if they differ from full frame
    const isFullFrame =
      cropX === 0 &&
      cropY === 0 &&
      cropWidth === videoNativeWidth &&
      cropHeight === videoNativeHeight;

    if (isFullFrame) {
      onSave(trimStart, trimEnd);
    } else {
      onSave(trimStart, trimEnd, cropX, cropY, cropWidth, cropHeight);
    }
    onClose();
  };

  // Handle crop preset selection
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

  // Reset crop to full frame
  const handleResetCrop = () => {
    setCropX(0);
    setCropY(0);
    setCropWidth(videoNativeWidth);
    setCropHeight(videoNativeHeight);
    setActivePreset("freeform");
  };

  // Crop drag handlers
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

  // Effect for crop dragging
  useEffect(() => {
    if (!isCropDragging || !cropContainerRef.current) return;

    const handleCropMouseMove = (e: MouseEvent) => {
      const container = cropContainerRef.current;
      if (!container || videoNativeWidth === 0) return;

      const rect = container.getBoundingClientRect();
      // Calculate scale factor: displayed size vs native size
      const scaleX = videoNativeWidth / rect.width;
      const scaleY = videoNativeHeight / rect.height;

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
        // Handle resize based on which handle is being dragged
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

      // Clamp to bounds
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

  // Calculate crop overlay position as percentages of the video display
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

  // Timeline drag handling
  const getTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || duration === 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(duration, pos * duration));
    },
    [duration]
  );

  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    type: "start" | "end" | "playhead"
  ) => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const time = getTimeFromPosition(e.clientX);
    if (videoRef.current) {
      // Clamp to trim region
      const clampedTime = Math.max(trimStart, Math.min(trimEnd, time));
      videoRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const time = getTimeFromPosition(e.clientX);

      if (isDragging === "start") {
        if (time < trimEnd - 0.5) {
          setTrimStart(time);
          if (videoRef.current && currentTime < time) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
          }
        }
      } else if (isDragging === "end") {
        if (time > trimStart + 0.5) {
          setTrimEnd(time);
          if (videoRef.current && currentTime > time) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
          }
        }
      } else if (isDragging === "playhead") {
        const clampedTime = Math.max(trimStart, Math.min(trimEnd, time));
        if (videoRef.current) {
          videoRef.current.currentTime = clampedTime;
          setCurrentTime(clampedTime);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, trimStart, trimEnd, currentTime, getTimeFromPosition]);

  if (!isOpen) return null;

  const clipDuration = trimEnd - trimStart;
  const startPercent = (trimStart / duration) * 100 || 0;
  const endPercent = (trimEnd / duration) * 100 || 100;
  const playheadPercent = (currentTime / duration) * 100 || 0;

  return (
    <div className="video-editor-overlay" onClick={onClose}>
      <div className="video-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <div className="header-title">
            <span className="header-icon">
              {editMode === "trim" ? "✂️" : "🔲"}
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
          {/* Crop Overlay - only show in crop mode */}
          {editMode === "crop" && videoNativeWidth > 0 && (
            <div className="crop-overlay-container">
              {/* Darkened areas outside crop region */}
              <div
                className="crop-mask crop-mask-top"
                style={{
                  height: getCropStyle().top,
                }}
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
              {/* Crop region with handles */}
              <div
                className="crop-region"
                style={getCropStyle()}
                onMouseDown={(e) => handleCropMouseDown(e, "move")}
              >
                {/* Corner handles */}
                <div
                  className="crop-handle crop-handle-nw"
                  onMouseDown={(e) => handleCropMouseDown(e, "nw")}
                />
                <div
                  className="crop-handle crop-handle-ne"
                  onMouseDown={(e) => handleCropMouseDown(e, "ne")}
                />
                <div
                  className="crop-handle crop-handle-sw"
                  onMouseDown={(e) => handleCropMouseDown(e, "sw")}
                />
                <div
                  className="crop-handle crop-handle-se"
                  onMouseDown={(e) => handleCropMouseDown(e, "se")}
                />
                {/* Edge handles */}
                <div
                  className="crop-handle crop-handle-n"
                  onMouseDown={(e) => handleCropMouseDown(e, "n")}
                />
                <div
                  className="crop-handle crop-handle-s"
                  onMouseDown={(e) => handleCropMouseDown(e, "s")}
                />
                <div
                  className="crop-handle crop-handle-w"
                  onMouseDown={(e) => handleCropMouseDown(e, "w")}
                />
                <div
                  className="crop-handle crop-handle-e"
                  onMouseDown={(e) => handleCropMouseDown(e, "e")}
                />
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

        {/* Crop Presets - only show in crop mode */}
        {editMode === "crop" && (
          <div className="crop-presets">
            <span className="crop-presets-label">Crop:</span>
            <button
              className={`crop-preset-btn ${
                activePreset === "9:16" ? "active" : ""
              }`}
              onClick={() => handlePresetSelect("9:16")}
              title="Vertical (TikTok, Reels)"
            >
              9:16
            </button>
            <button
              className={`crop-preset-btn ${
                activePreset === "1:1" ? "active" : ""
              }`}
              onClick={() => handlePresetSelect("1:1")}
              title="Square (Instagram)"
            >
              1:1
            </button>
            <button
              className={`crop-preset-btn ${
                activePreset === "16:9" ? "active" : ""
              }`}
              onClick={() => handlePresetSelect("16:9")}
              title="Horizontal (YouTube)"
            >
              16:9
            </button>
            <button
              className={`crop-preset-btn ${
                activePreset === "freeform" ? "active" : ""
              }`}
              onClick={() => handlePresetSelect("freeform")}
              title="Full Frame"
            >
              Full
            </button>
            <span className="crop-info">
              {cropWidth}×{cropHeight}
            </span>
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
            <div className="time-stat">
              <span className="time-label">Total</span>
              <span className="time-value">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
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

          {/* Timeline - only show in trim mode */}
          {editMode === "trim" && (
            <div className="timeline-container">
              <div className="timeline-labels">
                <span>{formatTime(trimStart)}</span>
                <span className="trim-range-label">Trim Range</span>
                <span>{formatTime(trimEnd)}</span>
              </div>

              <div
                className="timeline"
                ref={timelineRef}
                onClick={handleTimelineClick}
              >
                {/* Full track background */}
                <div className="timeline-track" />

                {/* Dimmed area before trim start */}
                <div
                  className="timeline-dimmed"
                  style={{ left: 0, width: `${startPercent}%` }}
                />

                {/* Selected trim region */}
                <div
                  className="timeline-selected"
                  style={{
                    left: `${startPercent}%`,
                    width: `${endPercent - startPercent}%`,
                  }}
                />

                {/* Dimmed area after trim end */}
                <div
                  className="timeline-dimmed"
                  style={{ left: `${endPercent}%`, right: 0 }}
                />

                {/* Trim handles */}
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

                {/* Playhead */}
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

          {/* Action Buttons */}
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
