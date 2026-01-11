import { useTrimTool } from "../context/VideoEditorHooks";

export function TrimControls() {
  const { trim, sourceDuration, setTrim, setCurrentTime } = useTrimTool();

  const { start, end } = trim;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Helper to nudge time
  const nudge = (type: "start" | "end", delta: number) => {
    if (type === "start") {
      const newStart = Math.min(Math.max(0, start + delta), end - 0.1);
      setTrim(newStart, end);
      setCurrentTime(newStart);
    } else {
      const newEnd = Math.max(
        start + 0.1,
        Math.min(sourceDuration, end + delta)
      );
      setTrim(start, newEnd);
      setCurrentTime(newEnd); // Preview the end point? Optional.
    }
  };

  return (
    <div className="space-y-6">
      {/* Duration Info */}
      <div className="bg-zinc-950/50 rounded-md p-4 border border-zinc-800 text-center">
        <div className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">
          Total Duration
        </div>
        <div className="text-2xl font-mono text-zinc-100">
          {formatTime(end - start)}
        </div>
      </div>

      {/* Start Time Control */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Start Time
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nudge("start", -0.1)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition-colors"
          >
            -0.1s
          </button>
          <div className="flex-1 text-center font-mono text-zinc-200 bg-black/40 py-2 rounded-md border border-zinc-800">
            {formatTime(start)}
          </div>
          <button
            onClick={() => nudge("start", 0.1)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition-colors"
          >
            +0.1s
          </button>
        </div>
      </div>

      {/* End Time Control */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          End Time
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nudge("end", -0.1)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition-colors"
          >
            -0.1s
          </button>
          <div className="flex-1 text-center font-mono text-zinc-200 bg-black/40 py-2 rounded-md border border-zinc-800">
            {formatTime(end)}
          </div>
          <button
            onClick={() => nudge("end", 0.1)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition-colors"
          >
            +0.1s
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800">
        <div className="text-xs text-zinc-600 leading-relaxed">
          Use the timeline below the video for coarse adjustments. Use these
          controls for frame-perfect cuts.
        </div>
      </div>
    </div>
  );
}
