import React from "react";
import type { ClipEditorTool } from "./context/VideoEditorContext";
import { TrimControls } from "./tools/TrimTool";
import { CropControls } from "./tools/CropTool";
import { SoundControls } from "./tools/SoundTool";

export interface EditorToolConfig {
  id: ClipEditorTool;
  label: string;
  icon: string;
  component: React.ComponentType;
}

export const EDITOR_TOOLS: EditorToolConfig[] = [
  {
    id: "trim",
    label: "Trim",
    icon: "✂️",
    component: TrimControls,
  },
  {
    id: "crop",
    label: "Crop",
    icon: "🔲",
    component: CropControls,
  },
  {
    id: "sounds",
    label: "Sounds",
    icon: "🎵",
    component: SoundControls,
  },
];

export function getToolConfig(
  id: ClipEditorTool
): EditorToolConfig | undefined {
  return EDITOR_TOOLS.find((t) => t.id === id);
}
