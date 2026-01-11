import React from "react";
import {
  VideoEditorProvider,
  useVideoEditor,
} from "./context/VideoEditorContext";
import { VideoEditorLayout } from "./layout/VideoEditorLayout";
import { VideoPreview } from "./common/VideoPreview";
import { Timeline } from "./common/Timeline";
import { getToolConfig } from "./registry";
import type { VideoMemeSound } from "../../types/timeline";
import type { ClipEditorState } from "../../types/editor";

// --- Root Wrapper (Handles Props -> Provider) ---

interface VideoEditorRootProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
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
  initialCropX?: number;
  initialCropY?: number;
  initialCropWidth?: number;
  initialCropHeight?: number;
  initialMemeSounds?: VideoMemeSound[];
}

function EditorContent({
  onClose,
  onSave,
  url,
}: {
  onClose: () => void;
  onSave: () => void;
  url: string;
}) {
  const { activeTool } = useVideoEditor();

  const renderRightPanel = () => {
    const toolConfig = getToolConfig(activeTool);

    if (toolConfig) {
      const ToolComponent = toolConfig.component;
      return <ToolComponent />;
    }

    return <div className="p-4 text-zinc-500">Unknown Tool</div>;
  };

  return (
    <VideoEditorLayout
      rightPanel={renderRightPanel()}
      onClose={onClose}
      onSave={onSave}
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex-1 relative min-h-0 bg-zinc-950 flex items-center justify-center">
          <VideoPreview url={url} />
        </div>
        <div className="shrink-0 h-32 bg-zinc-900 border-t border-zinc-800 p-4">
          <Timeline />
        </div>
      </div>
    </VideoEditorLayout>
  );
}

export function VideoEditorRoot(props: VideoEditorRootProps) {
  console.log("[VideoEditorRoot] Rendered with props:", {
    isOpen: props.isOpen,
    url: props.url,
  });
  if (!props.isOpen) return null;

  const initialState: ClipEditorState = {
    source: props.url,
    duration: 0, // Will be updated by preview loading
    nativeWidth: 0,
    nativeHeight: 0,
    trim: {
      start: props.initialTrimStart || 0,
      end: props.initialTrimEnd || 0,
    },
    crop: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      aspectRatio: null,
      preset: "freeform",
    },
    audio: props.initialMemeSounds || [],
  };

  return (
    <VideoEditorProvider initialState={initialState}>
      <EditorConsumer {...props} />
    </VideoEditorProvider>
  );
}

function EditorConsumer(props: VideoEditorRootProps) {
  const { editorState } = useVideoEditor();
  const { trim, crop, audio, nativeWidth, nativeHeight } = editorState;

  const handleSave = () => {
    // Check if full frame (normalized values are 0,0,1,1)
    const isFullFrame =
      crop.width >= 0.99 &&
      crop.height >= 0.99 &&
      crop.x <= 0.01 &&
      crop.y <= 0.01;

    // Convert normalized -> pixels
    const pxX = Math.round(crop.x * nativeWidth);
    const pxY = Math.round(crop.y * nativeHeight);
    const pxW = Math.round(crop.width * nativeWidth);
    const pxH = Math.round(crop.height * nativeHeight);

    props.onSave(
      trim.start,
      trim.end,
      isFullFrame ? undefined : pxX,
      isFullFrame ? undefined : pxY,
      isFullFrame ? undefined : pxW,
      isFullFrame ? undefined : pxH,
      audio,
      nativeWidth,
      nativeHeight
    );
    props.onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-[1600px] h-[90vh] shadow-2xl ring-1 ring-white/10 rounded-lg overflow-hidden">
        <EditorContent
          url={props.url}
          onClose={props.onClose}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
