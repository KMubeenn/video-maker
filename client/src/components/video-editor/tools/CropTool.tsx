import { useCropTool } from "../context/VideoEditorHooks";
import { CROP_PRESETS, type CropPreset } from "../../../utils/cropUtils";

export function CropControls() {
  const { crop, nativeWidth, nativeHeight, setCrop } = useCropTool();

  const handlePresetClick = (preset: CropPreset) => {
    // Basic preset logic - simplified for normalized
    // If we have a helper 'calculateCropFromPreset' it expects pixel logic usually.
    // Let's implement simple normalized presets here or adapting the utils later.
    // For freeform, just unlock.
    // For 16:9, etc, we need to set aspectRatio.

    // For now, simple implementation:
    let newAr: number | null = null;
    let w = 1;
    let h = 1;

    switch (preset) {
      case "16:9":
        newAr = 16 / 9;
        break;
      case "9:16":
        newAr = 9 / 16;
        break;
      case "1:1":
        newAr = 1;
        break;
      case "4:5":
        newAr = 4 / 5;
        break;
      case "freeform":
        newAr = null;
        break;
    }

    if (newAr && nativeWidth && nativeHeight) {
      // Calculate max fit for AR
      const videoAr = nativeWidth / nativeHeight;
      if (newAr > videoAr) {
        // Wider than video -> full width, limited height
        w = 1;
        h = videoAr / newAr;
      } else {
        // Taller than video -> full height, limited width
        h = 1;
        w = newAr / videoAr;
      }
      // Center it
      const x = (1 - w) / 2;
      const y = (1 - h) / 2;

      setCrop({ x, y, width: w, height: h, aspectRatio: newAr, preset });
    } else {
      // Freeform or Reset
      setCrop({ aspectRatio: null, preset });
    }
  };

  const handleReset = () => {
    setCrop({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      aspectRatio: null,
      preset: "freeform",
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Crop</h3>
        <button
          onClick={handleReset}
          className="text-xs text-zinc-400 hover:text-white underline"
        >
          Reset
        </button>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-3 gap-2">
        {CROP_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePresetClick(p.id)}
            className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${
              crop.preset === p.id
                ? "bg-primary/20 border-primary text-primary"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            <span className="text-xl mb-1">{p.icon}</span>
            <span className="text-[10px] font-medium">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Info / Manual adjustments */}
      <div className="bg-zinc-900 rounded p-3 space-y-2 border border-zinc-800">
        <div className="text-xs font-medium text-zinc-400 mb-2">
          Manual Transform
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-zinc-500 block mb-1">X (%)</label>
            <div className="bg-zinc-950 px-2 py-1 rounded text-zinc-300 font-mono">
              {(crop.x * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <label className="text-zinc-500 block mb-1">Y (%)</label>
            <div className="bg-zinc-950 px-2 py-1 rounded text-zinc-300 font-mono">
              {(crop.y * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <label className="text-zinc-500 block mb-1">W (%)</label>
            <div className="bg-zinc-950 px-2 py-1 rounded text-zinc-300 font-mono">
              {(crop.width * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <label className="text-zinc-500 block mb-1">H (%)</label>
            <div className="bg-zinc-950 px-2 py-1 rounded text-zinc-300 font-mono">
              {(crop.height * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
      <div className="pt-6 border-t border-zinc-800">
        <button
          onClick={handleReset}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Reset to Original
        </button>
      </div>
    </div>
  );
}
