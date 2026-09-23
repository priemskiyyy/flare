import type { Tone } from "examples/shared/ui/types/Tone";

export const COLORS = {
  background: "#fafaf9",
  surface: "#ffffff",
  sunken: "#f5f5f4",
  border: "#e7e5e4",
  text: "#1c1917",
  body: "#44403c",
  muted: "#78716c",
  faint: "#a8a29e",
  accent: "#d97706",
  accentSoft: "#fffbeb",
  accentBorder: "#fcd34d",
  accentText: "#92400e",
  onAccent: "#ffffff",
  dangerSoft: "#fff1f2",
  dangerBorder: "#fecdd3",
  dangerText: "#9f1239",
};

export const TONE_COLORS: Record<Tone, string> = {
  neutral: "#a8a29e",
  positive: "#10b981",
  warning: "#eab308",
  danger: "#f43f5e",
  accent: "#f59e0b",
  info: "#0ea5e9",
};
