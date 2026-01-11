import React, { ReactNode } from "react";
import { ToolSidebar } from "./Sidebar";
import { useVideoEditor } from "../context/VideoEditorContext";

interface VideoEditorLayoutProps {
  children: ReactNode;
  rightPanel: ReactNode;
  onClose: () => void;
  onSave: () => void;
}

export function VideoEditorLayout({
  children,
  rightPanel,
  onClose,
  onSave,
}: VideoEditorLayoutProps) {
  const { activeTool } = useVideoEditor();

  return (
    <div className="flex relative w-full h-full bg-zinc-950 text-zinc-200 overflow-hidden font-sans selection:bg-primary/30">
      {/* Left Sidebar */}
      <ToolSidebar />

      {/* Center Preview Area */}
      <div className="flex-1 flex flex-col relative bg-zinc-950 relative">
        {/* Header Overlay */}
        <div className="h-14 border-b border-zinc-800 flex justify-between items-center px-6 bg-zinc-950">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-zinc-100">Video Editor</h3>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              {activeTool}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
            >
              Export
            </button>
          </div>
        </div>

        {/* Main Content (Preview + Timeline) */}
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </div>

      {/* Right Panel - Tool Properties */}
      <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
        <div className="h-14 border-b border-zinc-800 flex items-center px-6 font-medium text-xs uppercase tracking-wider text-zinc-500">
          {activeTool} Properties
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
          {rightPanel}
        </div>
      </div>
    </div>
  );
}
