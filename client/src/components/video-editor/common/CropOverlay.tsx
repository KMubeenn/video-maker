import React, { useEffect, useState } from "react";
import { useVideoEditor } from "../context/VideoEditorContext";

const CURSORS = {
  nw: "nw-resize",
  n: "n-resize",
  ne: "ne-resize",
  e: "e-resize",
  se: "se-resize",
  s: "s-resize",
  sw: "sw-resize",
  w: "w-resize",
};

export function CropOverlay({ videoRect }: { videoRect: DOMRect | null }) {
  const { editorState, setCrop } = useVideoEditor();
  const { crop } = editorState;

  // Local drag state
  const [dragging, setDragging] = useState<{
    type: keyof typeof CURSORS | "move";
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
  } | null>(null);

  // Handlers
  const handleMouseDown = (
    e: React.MouseEvent,
    type: keyof typeof CURSORS | "move"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initX: crop.x, // Normalized
      initY: crop.y,
      initW: crop.width,
      initH: crop.height,
    });
  };

  // Global Move/Up
  useEffect(() => {
    if (!dragging || !videoRect) return;

    const onMove = (e: MouseEvent) => {
      // 1. Calculate Delta in Screen Pixels
      const deltaPxX = e.clientX - dragging.startX;
      const deltaPxY = e.clientY - dragging.startY;

      // 2. Convert to Normalized Delta
      // (1.0 = full width/height)
      const deltaNormX = deltaPxX / videoRect.width;
      const deltaNormY = deltaPxY / videoRect.height;

      let nx = dragging.initX;
      let ny = dragging.initY;
      let nw = dragging.initW;
      let nh = dragging.initH;

      const t = dragging.type;

      // 3. Apply Delta
      if (t === "move") {
        nx += deltaNormX;
        ny += deltaNormY;
      } else {
        // Resize logic
        // const aspectRatio = crop.aspectRatio; // TODO: Implement aspect lock

        if (t.includes("w")) {
          nx += deltaNormX;
          nw -= deltaNormX;
        }
        if (t.includes("e")) {
          nw += deltaNormX;
        }
        if (t.includes("n")) {
          ny += deltaNormY;
          nh -= deltaNormY;
        }
        if (t.includes("s")) {
          nh += deltaNormY;
        }

        // TODO: Aspect Ratio Locking Logic will go here
      }

      // 4. Clamp (Ensure we stay within 0-1)
      // Basic clamping - might warp ratio if hitting edge, but fine for freeform
      // For movement: ensure width/height stay same, just clamp position
      if (t === "move") {
        nx = Math.max(0, Math.min(nx, 1 - nw));
        ny = Math.max(0, Math.min(ny, 1 - nh));
      } else {
        // Sort coordinates to avoid negative width/height
        // (Not strictly necessary if interaction is careful, but good for robustness)
        // For now, hard clamp:
        if (nw < 0.05) nw = 0.05; // Min size 5%
        if (nh < 0.05) nh = 0.05;

        // Clamp edges
        if (nx < 0) {
          nw += nx;
          nx = 0;
        }
        if (ny < 0) {
          nh += ny;
          ny = 0;
        }
        if (nx + nw > 1) {
          nw = 1 - nx;
        }
        if (ny + nh > 1) {
          nh = 1 - ny;
        }
      }

      setCrop({
        x: nx,
        y: ny,
        width: nw,
        height: nh,
        // preset: ... // Maybe update preset to 'custom' if changed
      });
    };

    const onUp = () => setDragging(null);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, videoRect, setCrop]);

  if (!videoRect) return null;

  // Convert Normalized -> Components (Pixels on screen)
  const displayX = crop.x * videoRect.width;
  const displayY = crop.y * videoRect.height;
  const displayW = crop.width * videoRect.width;
  const displayH = crop.height * videoRect.height;

  return (
    <div className="absolute pointer-events-auto inset-0 w-full h-full">
      {/* Dimmed Backgrounds (Hole Punch) */}
      <div
        className="absolute bg-black/50 backdrop-blur-[1px]"
        style={{ left: 0, top: 0, width: "100%", height: displayY }}
      />
      <div
        className="absolute bg-black/50 backdrop-blur-[1px]"
        style={{ left: 0, top: displayY + displayH, width: "100%", bottom: 0 }}
      />
      <div
        className="absolute bg-black/50 backdrop-blur-[1px]"
        style={{ left: 0, top: displayY, width: displayX, height: displayH }}
      />
      <div
        className="absolute bg-black/50 backdrop-blur-[1px]"
        style={{
          left: displayX + displayW,
          top: displayY,
          right: 0,
          height: displayH,
        }}
      />

      {/* Active Region */}
      <div
        className="absolute outline outline-2 outline-white cursor-move hover:outline-primary transition-colors z-10"
        style={{
          left: displayX,
          top: displayY,
          width: displayW,
          height: displayH,
        }}
        onMouseDown={(e) => handleMouseDown(e, "move")}
      >
        {/* Thirds Grid */}
        <div className="absolute inset-x-0 top-1/3 bottom-1/3 border-y border-white/20 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/3 right-1/3 border-x border-white/20 pointer-events-none" />

        {/* Resize Handles */}
        {Object.entries(CURSORS).map(([key, cursor]) => (
          <div
            key={key}
            className={`absolute w-3 h-3 bg-white border border-gray-500 rounded-full z-20 hover:scale-125 transition-transform`}
            style={{
              cursor,
              top: key.includes("n")
                ? -5
                : key.includes("s")
                ? "calc(100% - 5px)"
                : "calc(50% - 5px)",
              left: key.includes("w")
                ? -5
                : key.includes("e")
                ? "calc(100% - 5px)"
                : "calc(50% - 5px)",
            }}
            onMouseDown={(e) => handleMouseDown(e, key as keyof typeof CURSORS)}
          />
        ))}

        {/* Helper Badge Size? Optional */}
        <div className="absolute -top-6 left-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
          {Math.round(crop.width * 100)}% x {Math.round(crop.height * 100)}%
        </div>
      </div>
    </div>
  );
}
