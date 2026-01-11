import type { TitlePreset } from "./types";

export const TITLE_PRESETS: TitlePreset[] = [
  // --- Global Presets (Calmer, slower, distinct) ---
  {
    id: "global-fade",
    label: "Simple Fade",
    context: "global",
    animation: "fade",
    style: { fontFamily: "Inter, sans-serif", fontWeight: "600" },
  },
  {
    id: "clean-impact",
    label: "Impact Fade Up",
    context: "global",
    animation: "fade-up",
    style: {
      fontFamily: "Impact, sans-serif",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
    },
  },
  {
    id: "modern-bold",
    label: "Bold Scale In",
    context: "global",
    animation: "scale-in",
    style: {
      fontFamily: "Inter, sans-serif",
      fontWeight: "900",
      letterSpacing: "-0.05em",
    },
  },
  {
    id: "cinema-slide",
    label: "Cinematic Slide Down",
    context: "global",
    animation: "slide-down",
    style: {
      fontFamily: "Georgia, serif",
      fontWeight: "bold",
      fontStyle: "italic",
    },
  },

  // --- Clip Presets (Punchier, faster, expressive) ---
  {
    id: "simple-highlight",
    label: "Basic Fade",
    context: "clip",
    animation: "fade",
    style: {
      fontFamily: "Inter, sans-serif",
      fontWeight: "600",
    },
  },
  {
    id: "clip-pop",
    label: "Pop Highlight",
    context: "clip",
    animation: "pop",
    style: {
      fontFamily: "Inter, sans-serif",
      fontWeight: "800",
      textShadow: "2px 2px 0px rgba(0,0,0,0.5)",
    },
  },
  {
    id: "slide-entry",
    label: "Slide From Left",
    context: "clip",
    animation: "slide-left",
    style: {
      fontFamily: "Arial Black, sans-serif",
    },
  },
  {
    id: "neon-badge",
    label: "Neon Rise",
    context: "clip",
    animation: "fade-up",
    style: {
      fontFamily: "Arial Black, sans-serif",
      textShadow: "0 0 10px rgba(0,255,0,0.8)",
    },
  },
  {
    id: "tiktok-snap",
    label: "Snap Up",
    context: "clip",
    animation: "slide-up",
    style: {
      fontFamily: "Inter, sans-serif",
      fontWeight: "bold",
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: "0 10px",
      borderRadius: "4px",
    },
  },
];

export function getPresetsByContext(context: "global" | "clip") {
  return TITLE_PRESETS.filter((p) => p.context === context);
}

export function getPresetById(id: string | undefined) {
  return TITLE_PRESETS.find((p) => p.id === id);
}
