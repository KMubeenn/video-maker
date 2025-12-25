/**
 * Centralized theme configuration for ShortMaker
 * This file exports theme tokens used throughout the application
 */

export const theme = {
  colors: {
    primary: {
      DEFAULT: "hsl(142, 76%, 36%)", // Green primary
      foreground: "hsl(0, 0%, 100%)",
    },
    secondary: {
      DEFAULT: "hsl(210, 40%, 96%)",
      foreground: "hsl(222, 47%, 11%)",
    },
    accent: {
      DEFAULT: "hsl(142, 76%, 36%)",
      foreground: "hsl(0, 0%, 100%)",
    },
    destructive: {
      DEFAULT: "hsl(0, 84%, 60%)",
      foreground: "hsl(0, 0%, 100%)",
    },
    muted: {
      DEFAULT: "hsl(210, 40%, 96%)",
      foreground: "hsl(215, 16%, 47%)",
    },
    border: "hsl(214, 32%, 91%)",
    input: "hsl(214, 32%, 91%)",
    ring: "hsl(142, 76%, 36%)",
    background: "hsl(0, 0%, 100%)",
    foreground: "hsl(222, 47%, 11%)",
    card: {
      DEFAULT: "hsl(0, 0%, 100%)",
      foreground: "hsl(222, 47%, 11%)",
    },
    popover: {
      DEFAULT: "hsl(0, 0%, 100%)",
      foreground: "hsl(222, 47%, 11%)",
    },
  },
  dark: {
    colors: {
      primary: {
        DEFAULT: "hsl(142, 76%, 36%)",
        foreground: "hsl(0, 0%, 100%)",
      },
      secondary: {
        DEFAULT: "hsl(217, 33%, 17%)",
        foreground: "hsl(210, 40%, 98%)",
      },
      accent: {
        DEFAULT: "hsl(217, 33%, 17%)",
        foreground: "hsl(210, 40%, 98%)",
      },
      destructive: {
        DEFAULT: "hsl(0, 63%, 31%)",
        foreground: "hsl(0, 0%, 100%)",
      },
      muted: {
        DEFAULT: "hsl(217, 33%, 17%)",
        foreground: "hsl(215, 20%, 65%)",
      },
      border: "hsl(217, 33%, 17%)",
      input: "hsl(217, 33%, 17%)",
      ring: "hsl(142, 76%, 36%)",
      background: "hsl(222, 47%, 11%)",
      foreground: "hsl(210, 40%, 98%)",
      card: {
        DEFAULT: "hsl(222, 47%, 11%)",
        foreground: "hsl(210, 40%, 98%)",
      },
      popover: {
        DEFAULT: "hsl(222, 47%, 11%)",
        foreground: "hsl(210, 40%, 98%)",
      },
    },
  },
  typography: {
    fontFamily: {
      sans: ["system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
} as const;

export type Theme = typeof theme;
