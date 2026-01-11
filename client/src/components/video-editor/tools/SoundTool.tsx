import { useState, useEffect, useRef } from "react";
import { useSoundTool } from "../context/VideoEditorHooks";
import { memeSoundsApi } from "../../../api/meme-sounds.api";
import type { MemeSound, VideoMemeSound } from "../../../types/timeline";

// Helper for ID generation
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

export function SoundControls() {
  const { addSound, audio, updateSound, removeSound, clipDuration } =
    useSoundTool();
  const [availableSounds, setAvailableSounds] = useState<MemeSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"library" | "active">("library");

  // Simple audio preview ref
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    memeSoundsApi.list().then((sounds) => {
      setAvailableSounds(sounds);
      setLoading(false);
    });
  }, []);

  // Switch to active tab if sounds exist and we just opened logic?
  // Maybe just stick to library as default for discovery.

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  const handleAddStart = (sound: MemeSound) => {
    const newSound: VideoMemeSound = {
      id: generateId(),
      soundId: sound.id,
      file: sound.url,
      startTime: 0,
      volume: 1.0,
    };
    addSound(newSound);
    setActiveTab("active"); // Auto switch to edit
  };

  const handlePreview = (url: string, id: string) => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }

    if (previewingId === id) {
      setPreviewingId(null);
      return;
    }

    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch((e) => console.error("Preview failed", e));
    audio.onended = () => setPreviewingId(null);
    audioPreviewRef.current = audio;
    setPreviewingId(id);
  };

  const getSoundName = (soundId: string) => {
    return availableSounds.find((s) => s.id === soundId)?.name || soundId;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
      {/* Header / Tabs */}
      <div className="flex items-center border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("library")}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === "library"
              ? "text-white bg-zinc-800 border-b-2 border-primary"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Library
        </button>
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colorsRelative ${
            activeTab === "active"
              ? "text-white bg-zinc-800 border-b-2 border-primary"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Active ({audio.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === "library" ? (
          loading ? (
            <div className="text-center py-8 text-zinc-500 text-sm animate-pulse">
              Loading sounds...
            </div>
          ) : (
            <div className="space-y-2">
              {availableSounds.map((sound) => (
                <div
                  key={sound.id}
                  className="group flex items-center gap-3 p-3 bg-zinc-950 hover:bg-zinc-800 rounded-md cursor-pointer transition-all border border-zinc-800 hover:border-zinc-700"
                  onClick={() => handleAddStart(sound)}
                >
                  <button
                    className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(sound.url, "lib-" + sound.id);
                    }}
                  >
                    {previewingId === "lib-" + sound.id ? "⏹️" : "▶️"}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200 truncate">
                      {sound.name}
                    </div>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center text-zinc-500 group-hover:text-primary">
                    +
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {audio.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                No sounds added yet. Go to library to add some!
              </div>
            ) : (
              audio.map((sound) => (
                <div
                  key={sound.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-md p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xs font-medium text-zinc-300 truncate">
                        {getSoundName(sound.soundId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreview(sound.file, sound.id)}
                        className="p-1.5 hover:bg-zinc-800 rounded text-xs"
                        title="Preview"
                      >
                        {previewingId === sound.id ? "⏹️" : "▶️"}
                      </button>
                      <button
                        onClick={() => removeSound(sound.id)}
                        className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded text-xs"
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="space-y-2">
                    {/* Offset */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Start Time</span>
                        <span>{sound.startTime.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={clipDuration > 0 ? clipDuration : 10}
                        step={0.1}
                        value={sound.startTime}
                        onChange={(e) =>
                          updateSound(sound.id, {
                            startTime: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Volume */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Volume</span>
                        <span>{Math.round(sound.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={sound.volume}
                        onChange={(e) =>
                          updateSound(sound.id, {
                            volume: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
