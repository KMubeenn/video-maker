import React, { useRef } from "react";
import { useVideoEditor } from "../context/VideoEditorContext";

export function Timeline() {
  const {
    editorState,
    currentTime,
    setCurrentTime,
    activeTool,
    clipDuration,
    relativeCurrentTime,
  } = useVideoEditor();

  const timelineRef = useRef<HTMLDivElement>(null);

  const { trim, duration: metaDuration, audio: sounds } = editorState;
  const start = trim.start;
  const end = trim.end;
  const duration = metaDuration || 1;

  const getPercent = (time: number) => (time / duration) * 100;

  // Handle Scrubs
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;

    // Clamp
    const newTime = Math.min(Math.max(0, time), duration);
    // If outside trim, maybe clamp to trim? For now free scrub.
    setCurrentTime(newTime);
  };

  const startPercent = getPercent(start);
  const endPercent = getPercent(end);
  const playheadPercent = getPercent(currentTime);

  // Separate rendering for "Sounds" vs "Trim/Crop"
  // If activeTool is 'sounds', maybe we show the TIMELINE relative to the TRIMMED CLIP?
  // The original design had two different visualization modes.

  if (activeTool === "sounds") {
    // Show timeline relative to TRIMMED clip
    return (
      <div className="w-full h-full flex flex-col justify-center select-none">
        <div className="flex justify-between text-xs text-zinc-500 mb-2 font-mono">
          <span>0.0s</span>
          <span className="uppercase tracking-wider font-semibold text-primary/80">
            Sound Editor
          </span>
          <span>{Math.round(clipDuration * 10) / 10}s</span>
        </div>

        <div
          className="relative h-12 bg-zinc-950 rounded-md border border-zinc-800 overflow-hidden cursor-crosshair group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const relTime = pos * clipDuration;
            setCurrentTime(start + relTime);
          }}
        >
          {/* Tracks */}
          {sounds.map((s) => {
            const left = (s.startTime / clipDuration) * 100;
            return (
              <div
                key={s.id}
                className="absolute top-1 bottom-1 bg-blue-500/20 border border-blue-500/50 rounded px-2 flex items-center text-[10px] text-blue-200 truncate cursor-ew-resize hover:bg-blue-500/30 transition-colors"
                style={{ left: `${left}%`, maxWidth: "120px" }}
              >
                <span className="mr-1">🎵</span>
                {s.soundId}
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.3)] pointer-events-none group-hover:bg-white"
            style={{ left: `${(relativeCurrentTime / clipDuration) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  // DEFAULT TIMELINE (Trim/Crop)
  return (
    <div className="w-full h-full flex flex-col justify-center select-none">
      {/* Labels */}
      <div className="flex justify-between text-xs text-zinc-500 mb-2 font-mono">
        <span>{Math.round(start * 10) / 10}s</span>
        <span className="uppercase tracking-wider font-semibold text-zinc-600">
          Timeline
        </span>
        <span>{Math.round(end * 10) / 10}s</span>
      </div>

      {/* Track */}
      <div
        className="relative h-8 bg-zinc-950 rounded-md border border-zinc-800 cursor-pointer group overflow-hidden"
        ref={timelineRef}
        onClick={handleTimelineClick}
      >
        {/* Dimmed Areas */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px]"
          style={{ width: `${startPercent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/70 backdrop-blur-[1px]"
          style={{ width: `${100 - endPercent}%` }}
        />

        {/* Active Area */}
        <div
          className="absolute top-0 bottom-0 bg-primary/10 border-y border-primary/20"
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
          }}
        />

        {/* Trim Handles */}
        <div
          className="absolute top-0 bottom-0 w-2 bg-primary hover:bg-primary/90 cursor-ew-resize z-10 -ml-1 flex items-center justify-center transition-colors"
          style={{ left: `${startPercent}%` }}
        >
          <div className="h-4 w-0.5 bg-black/20" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-2 bg-primary hover:bg-primary/90 cursor-ew-resize z-10 -ml-1 flex items-center justify-center transition-colors"
          style={{ left: `${endPercent}%` }}
        >
          <div className="h-4 w-0.5 bg-black/20" />
        </div>

        {/* Playhead */}
        <div
          className="absolute -top-1 -bottom-1 w-px bg-white z-20 shadow pointer-events-none transition-all"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute top-0 -left-[3px] w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-white" />
        </div>
      </div>
    </div>
  );
}
