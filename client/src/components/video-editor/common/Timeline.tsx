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
    setTrim,
  } = useVideoEditor();

  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<"start" | "end" | null>(null);

  const { trim, duration: metaDuration, audio: sounds } = editorState;
  const start = trim.start;
  const end = trim.end;
  // Fallback duration to slightly larger than end if meta is missing, or 10s default
  const duration = metaDuration || Math.max(end, 10);

  const getPercent = (time: number) => (time / duration) * 100;

  // Global Drag Handlers
  React.useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      // Calculate generic time at pointer
      const rawPos = (e.clientX - rect.left) / rect.width;
      const time = Math.max(0, Math.min(duration, rawPos * duration));

      if (dragging === "start") {
        // Enforce min duration of 0.5s or similar to prevent overlapping/inversion
        const maxStart = Math.max(0, end - 0.5);
        const newStart = Math.min(time, maxStart);
        setTrim(newStart, end);
        // Snap playhead to start when dragging start
        setCurrentTime(newStart);
      } else if (dragging === "end") {
        const minEnd = Math.min(start + 0.5, duration);
        const newEnd = Math.max(time, minEnd);
        setTrim(start, newEnd);
        // Optional: Snap playhead to end or keep it if within range?
        // Usually showing the end frame is helpful.
        setCurrentTime(newEnd);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, duration, end, start, setTrim, setCurrentTime]);

  // Handle Scrub on background (only if not dragging handle)
  const handleTimelineClick = (e: React.MouseEvent) => {
    // If we just released a drag, don't jump (though mouseup happens on window, click might bubble)
    // We can prevent this by checking if we were JUST dragging, but simplicity first.
    // Actually, Click fires after MouseUp. If we want to support click-to-seek,
    // it's benign if it fires after drag, but better to check target.

    // For now, let's allow click-to-seek if the user clicks the track directly.
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, pos * duration));

    setCurrentTime(time);
  };

  const startPercent = getPercent(start);
  const endPercent = getPercent(end);
  const playheadPercent = getPercent(currentTime);

  // --- SOUNDS EDITOR MODE ---
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

  // --- DEFAULT TIMELINE (Trim/Crop) ---
  return (
    <div className="w-full h-full flex flex-col justify-center select-none">
      {/* Labels */}
      <div className="flex justify-between text-xs text-zinc-500 mb-2 font-mono">
        <span>0.0s</span>
        <div className="flex gap-4">
          <span className="uppercase tracking-wider font-semibold text-zinc-600">
            Timeline
          </span>
          <span className="text-zinc-400 font-mono">
            {Math.round(start * 100) / 100}s - {Math.round(end * 100) / 100}s
          </span>
        </div>
        <span>{Math.round(duration * 10) / 10}s</span>
      </div>

      {/* Track */}
      <div
        className="relative h-8 bg-zinc-950 rounded-md border border-zinc-800 cursor-pointer group"
        ref={timelineRef}
        // Use MouseDown for seek to avoid conflicting with Drag MouseUp
        onMouseDown={handleTimelineClick}
      >
        {/* Dimmed Areas (Visualizing what is trimmed OUT) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px] pointer-events-none"
          style={{ width: `${startPercent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/70 backdrop-blur-[1px] pointer-events-none"
          style={{ width: `${100 - endPercent}%` }}
        />

        {/* Active Area (The kept clip) */}
        <div
          className="absolute top-0 bottom-0 bg-primary/10 border-y border-primary/20 pointer-events-none"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
          }}
        />

        {/* Trim Start Handle */}
        <div
          className={`absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize z-20 transition-colors ${
            dragging === "start"
              ? "text-primary scale-110"
              : "text-primary/70 hover:text-primary"
          }`}
          style={{ left: `${startPercent}%` }}
          onMouseDown={(e) => {
            e.stopPropagation(); // Prevent seek
            setDragging("start");
          }}
        >
          <div className="h-full w-0.5 bg-current" />
          <div
            className="absolute w-3 h-3 bg-current rounded-full shadow-sm"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          />
        </div>

        {/* Trim End Handle */}
        <div
          className={`absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize z-20 transition-colors ${
            dragging === "end"
              ? "text-primary scale-110"
              : "text-primary/70 hover:text-primary"
          }`}
          style={{ left: `${endPercent}%` }}
          onMouseDown={(e) => {
            e.stopPropagation(); // Prevent seek
            setDragging("end");
          }}
        >
          <div className="h-full w-0.5 bg-current" />
          <div
            className="absolute w-3 h-3 bg-current rounded-full shadow-sm"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          />
        </div>

        {/* Playhead */}
        <div
          className="absolute -top-1 -bottom-1 w-px bg-white z-10 shadow pointer-events-none transition-all duration-75 ease-out"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute top-0 -left-[3px] w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-white" />
        </div>
      </div>
    </div>
  );
}
