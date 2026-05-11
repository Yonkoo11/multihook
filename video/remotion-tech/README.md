# Multi-Hook · Technical Walkthrough Video

Programmatic 188-second technical demo built with [Remotion](https://www.remotion.dev). Eight code-dominant scenes targeting Mert/Toly-tier reviewers — code on screen, terminal output, real on-chain proof, specific numbers as overlays.

Companion to the consumer-format pitch video (`video/metahook-demo.mp4`).

---

## Scenes

| # | Scene | Duration | Content |
|---|---|---|---|
| 1 | Hero | 12s | Composition stack diagram + thesis |
| 2 | Problem | 18s | $525K BlackRock BUIDL gap (Securitize, March 2024) |
| 3 | Architecture | 25s | `process_execute` loop excerpt + stats grid |
| 4 | Interface | 25s | `check_transfer` signature + 3 reference policies |
| 5 | SNS triple-bind | 35s | `policy-sns-allowlist` lines 77-113 + 3 numbered defenses |
| 6 | On-chain proof | 28s | Real `diagnose-transfer-flow.mjs` terminal + Solscan tx |
| 7 | Composability | 25s | `add_policy` TypeScript + Rust side-by-side |
| 8 | Numbers + CTA | 20s | Six stat cards + `github.com/Yonkoo11/multihook` |

**Total:** 188s · 1920×1080 · 30fps · h264 · MIT.

## Render

```bash
# One-time setup (uses the existing puppeteer Chrome to avoid a fresh
# headless-shell download)
cd video/remotion-tech
npm install

# Render full video
CHROME="$HOME/.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
npx remotion render src/index.ts MetaHookTech out/metahook-technical.mp4 \
  --browser-executable="$CHROME" \
  --concurrency=2 \
  --crf=18 \
  --pixel-format=yuv420p
```

Render time: ~30-60 minutes on M-series Mac at concurrency=2. Single-frame stills via `npx remotion still ...` (~5s each) — useful for iterating on a specific scene.

## Studio (interactive editor)

```bash
npx remotion studio src/index.ts
```

Opens a local browser preview at http://localhost:3000. Hot-reloads on edit.

## Why silent + captions instead of voiceover

Two reasons:
1. **Audience.** Mert/Toly-tier reviewers watch on mute, especially at conferences and in crowded coffee shops. Captions over code is the format they reward (Vercel, Stripe, and Linear ship engineering content this way).
2. **Pragmatic.** ElevenLabs free tier was blocked mid-session ("detected_unusual_activity"); macOS only has basic robotic voices installed. A bad TTS voice would undermine the technical credibility more than its absence.

If a paid TTS becomes available, the audio script lives at `VOICEOVER_TECH.md` with all 8 sections + a pronunciation map locked in the same Brian-voice settings as the v3 pitch.

## File structure

```
video/remotion-tech/
├── package.json              # Remotion 4.0.300 + React 19 + Shiki (unused fallback)
├── tsconfig.json             # ES2018 + jsx: react + strict
├── README.md                 # this file
├── VOICEOVER_TECH.md         # 8-section script + pronunciation map (for future TTS)
├── generate-audio.sh         # ElevenLabs API caller (blocked on free tier 2026-05-11)
├── src/
│   ├── index.ts              # registerRoot
│   ├── Root.tsx              # Composition definition (1920x1080, 30fps)
│   ├── MetaHookTech.tsx      # Scene composition + total frame math
│   ├── theme.ts              # Design tokens (cobalt accent, monospace, dark surface)
│   ├── components/
│   │   ├── CodeBlock.tsx     # Inline syntax highlighting (Rust/TS/shell)
│   │   └── Caption.tsx       # Bottom-of-frame caption overlay
│   └── scenes/
│       ├── Hero.tsx
│       ├── Problem.tsx
│       ├── Architecture.tsx
│       ├── Interface.tsx
│       ├── SnsTriple.tsx
│       ├── OnChainProof.tsx
│       ├── Composability.tsx
│       └── Numbers.tsx
└── out/
    └── metahook-technical.mp4   # rendered output
```

## Iterating on a single scene

Each scene is a self-contained component reading the global `frame` via `useCurrentFrame()`. Scene durations are declared in `MetaHookTech.tsx`'s `SCENES` array — change `durationS` there + the component's internal animation timings to adjust pacing.

For visual changes, the Studio (`npx remotion studio src/index.ts`) gives a frame-by-frame scrub bar so you can see exactly what changes at each frame.
