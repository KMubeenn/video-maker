import { useVideoEditor } from "../context/VideoEditorContext";
import { EDITOR_TOOLS } from "../registry";

export function ToolSidebar() {
  const { activeTool, setActiveTool } = useVideoEditor();

  return (
    <div className="flex flex-col w-20 bg-zinc-950 border-r border-zinc-800 shrink-0 py-2">
      {EDITOR_TOOLS.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            className={`flex flex-col items-center justify-center h-20 w-full gap-1.5 border-l-2 transition-all duration-200 ${
              isActive
                ? "border-primary text-zinc-100 bg-zinc-900/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
            }`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
          >
            <span
              className={`text-2xl transition-transform duration-200 ${
                isActive ? "scale-110" : "scale-100"
              }`}
            >
              {tool.icon}
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider opacity-80">
              {tool.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
