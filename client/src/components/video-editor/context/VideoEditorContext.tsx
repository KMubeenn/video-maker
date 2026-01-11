import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { VideoMemeSound } from "../../../types/timeline";
import type { ClipEditorState } from "../../../types/editor";

// --- Types ---

export type ClipEditorTool = "trim" | "crop" | "sounds";

interface VideoEditorContextType {
  // The Single Source of Truth
  editorState: ClipEditorState;

  // UI State
  activeTool: ClipEditorTool;
  isPlaying: boolean;
  currentTime: number; // Absolute time within source duration

  // Actions
  setActiveTool: (tool: ClipEditorTool) => void;
  updateState: (updates: Partial<ClipEditorState>) => void;

  // Specific convenient updaters (proxies to updateState)
  setTrim: (start: number, end: number) => void;
  setCrop: (crop: Partial<ClipEditorState["crop"]>) => void;
  setSounds: (sounds: VideoMemeSound[]) => void;
  addSound: (sound: VideoMemeSound) => void;
  removeSound: (id: string) => void;
  updateSound: (id: string, updates: Partial<VideoMemeSound>) => void;

  setPlaybackState: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;

  // Computed
  clipDuration: number;
  relativeCurrentTime: number; // Time relative to trim.start
}

const VideoEditorContext = createContext<VideoEditorContextType | null>(null);

// --- Provider ---

interface VideoEditorProviderProps {
  children: ReactNode;
  initialState: ClipEditorState;
  // We can treat onSave as just a way to get the final state,
  // but usually consumers might just read state from context or we pass it back.
  // The Root will likely handle the save logic by reading context.
}

export function VideoEditorProvider({
  children,
  initialState,
}: VideoEditorProviderProps) {
  // --- State ---
  // Core State
  const [editorState, setEditorState] = useState<ClipEditorState>(initialState);

  // UI / Session State
  const [activeTool, setActiveTool] = useState<ClipEditorTool>("trim");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialState.trim.start);

  // --- Actions ---

  const updateState = useCallback((updates: Partial<ClipEditorState>) => {
    setEditorState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setTrim = useCallback(
    (start: number, end: number) => {
      updateState({ trim: { start, end } });
    },
    [updateState]
  );

  const setCrop = useCallback(
    (cropUpdates: Partial<ClipEditorState["crop"]>) => {
      setEditorState((prev) => ({
        ...prev,
        crop: { ...prev.crop, ...cropUpdates },
      }));
    },
    []
  );

  const setSounds = useCallback(
    (sounds: VideoMemeSound[]) => {
      updateState({ audio: sounds });
    },
    [updateState]
  );

  const addSound = useCallback((sound: VideoMemeSound) => {
    setEditorState((prev) => ({
      ...prev,
      audio: [...prev.audio, sound],
    }));
  }, []);

  const removeSound = useCallback((id: string) => {
    setEditorState((prev) => ({
      ...prev,
      audio: prev.audio.filter((s) => s.id !== id),
    }));
  }, []);

  const updateSound = useCallback(
    (id: string, updates: Partial<VideoMemeSound>) => {
      setEditorState((prev) => ({
        ...prev,
        audio: prev.audio.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }));
    },
    []
  );

  const setPlaybackState = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleSetCurrentTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // --- Computed ---
  const clipDuration = Math.max(
    0,
    editorState.trim.end - editorState.trim.start
  );
  const relativeCurrentTime = Math.max(0, currentTime - editorState.trim.start);

  const value: VideoEditorContextType = {
    editorState,
    activeTool,
    isPlaying,
    currentTime,

    setActiveTool,
    updateState,

    setTrim,
    setCrop,
    setSounds,
    addSound,
    removeSound,
    updateSound,

    setPlaybackState,
    setCurrentTime: handleSetCurrentTime,

    clipDuration,
    relativeCurrentTime,
  };

  return (
    <VideoEditorContext.Provider value={value}>
      {children}
    </VideoEditorContext.Provider>
  );
}

// --- Hook ---
export function useVideoEditor() {
  const context = useContext(VideoEditorContext);
  if (!context) {
    throw new Error("useVideoEditor must be used within a VideoEditorProvider");
  }
  return context;
}
