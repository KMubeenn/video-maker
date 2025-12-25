import { useState, useRef, useCallback, useEffect } from "react";
import "./VideoEditor.css";

interface VideoEditorProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (trimStart: number, trimEnd: number) => void;
  initialTrimStart?: number;
  initialTrimEnd?: number;
}

export function VideoEditor({
  url,
  isOpen,
  onClose,
  onSave,
  initialTrimStart = 0,
  initialTrimEnd = 0,
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState<
    "start" | "end" | "playhead" | null
  >(null);

  // Trim state
  const [trimStart, setTrimStart] = useState(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState(initialTrimEnd);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDur = videoRef.current.duration;
      setDuration(vidDur);
      if (trimEnd === 0 || trimEnd > vidDur) {
        setTrimEnd(vidDur);
      }
      setCurrentTime(initialTrimStart);
      videoRef.current.currentTime = initialTrimStart;
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
    onSave(trimStart, trimEnd);
    onClose();
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
            <span className="header-icon">✂️</span>
            <h3>Trim Video</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="video-viewport">
          <video
            ref={videoRef}
            src={url}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
          />
          <div
            className={`play-overlay ${isPlaying ? "hidden" : ""}`}
            onClick={togglePlay}
          >
            <div className="play-button">▶</div>
          </div>
        </div>

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

          {/* Timeline */}
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
              }}
            >
              Reset
            </button>
            <button className="save-btn" onClick={handleSave}>
              ✓ Apply Trim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
