import { useVideoEditor } from "./VideoEditorContext";

// --- Strict Tool Hooks ---

export function useTrimTool() {
  const {
    editorState,
    setTrim,
    currentTime,
    setCurrentTime,
    setPlaybackState,
    isPlaying,
  } = useVideoEditor();

  return {
    trim: editorState.trim,
    sourceDuration: editorState.duration,
    currentTime,
    setCurrentTime,
    setTrim,
    isPlaying,
    setPlaybackState,
  };
}

export function useCropTool() {
  const { editorState, setCrop } = useVideoEditor();

  return {
    crop: editorState.crop,
    nativeWidth: editorState.nativeWidth,
    nativeHeight: editorState.nativeHeight,
    setCrop,
  };
}

export function useSoundTool() {
  const {
    editorState,
    addSound,
    removeSound,
    updateSound,
    clipDuration,
    isPlaying,
    setPlaybackState,
  } = useVideoEditor();

  return {
    audio: editorState.audio,
    addSound,
    removeSound,
    updateSound,
    clipDuration,
    isPlaying,
    setPlaybackState,
  };
}
