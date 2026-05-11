// Shared design tokens — Mert/Toly aesthetic: dark background, cobalt accent,
// monospace dominant, specific numbers visible, no decoration.

export const theme = {
  bg: "#0a0e16",          // not pure black; OLED-friendly
  surface: "#10151f",     // elevated surface
  surface2: "#161c2a",    // elevated x2
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",

  // text
  text: "#eaeaee",
  textDim: "#a8a8b8",
  textMute: "#6f7283",

  // accents
  accent: "#6366f1",      // cobalt
  accentDim: "#4f46e5",
  pass: "#10b981",        // green
  fail: "#ef4444",        // red
  warn: "#f59e0b",
  highlight1: "#a78bfa",  // purple — for SNS check 3 (replay)
  highlight2: "#22d3ee",  // cyan — for SNS check 2 (membership)

  // fonts
  mono: "'SF Mono', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
  sans: "system-ui, -apple-system, 'SF Pro Display', sans-serif",

  // sizes
  fsHero: 96,
  fsTitle: 56,
  fsSubtitle: 32,
  fsBody: 24,
  fsCode: 22,
  fsCodeSmall: 18,
  fsCaption: 28,
  fsStat: 48,
  fsStatLabel: 16,
} as const;

// Common style helpers
export const styles = {
  page: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily: theme.sans,
    overflow: "hidden",
    padding: 80,
    boxSizing: "border-box" as const,
    position: "relative" as const,
  },
  // subtle gradient overlay for "alive" feel
  ambient: {
    position: "absolute" as const,
    inset: 0,
    background:
      "radial-gradient(ellipse at top right, rgba(99,102,241,0.08), transparent 60%), radial-gradient(ellipse at bottom left, rgba(167,139,250,0.06), transparent 50%)",
    pointerEvents: "none" as const,
  },
};
