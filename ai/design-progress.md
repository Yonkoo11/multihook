# Design Progress: multihook (v2)

started_v1: 2026-05-10 (Customs Pipeline DNA-INK-PIPELINE-SERIF-STAMP-AMBER — archived as design-progress.v1.md)
started_v2: 2026-05-10 (post-integration-buildout)
style_config: ~/.claude/style.config.md (loaded)
color_mode: dark-only
reason: institutional-infra category convention; Anchorage/OpenZeppelin/Helius all dark-only
flags: --skip-state

## v2 motivation
The v1 Customs Pipeline (Crimson Pro serif + amber-stamp + bureaucratic ink) fit the original single-policy demo. After this session's integration buildout (Phantom signMessage + SIWS, Helius audit feed, multi-RPC chain, SNS reference policy, Squads governance doc, Umbra privacy compose, Adevar/RPC Fast/QuickNode sidetracks), the product is now compliance INFRASTRUCTURE, not a boutique compliance studio. Editorial-stamp aesthetic doesn't communicate "OpenZeppelin for Token-2022 transfer-hook compliance" — institutional dark + composable-stack metaphor + cobalt accent does.

## Phase 0: completed (v2)
v1 already had: design-lessons.md (loaded), DESIGN_MASTERY_RESEARCH.md (loaded), style.config.md (loaded).

## Phase 1: skipped
state architecture is fixed by smart contracts (allowlist + OFAC + audit event schemas); on-chain shape doesn't change between design versions.

## Phase 1.5: completed (v2)
comparables: [OpenZeppelin (incl. Wizard), Anchorage Digital, Fireblocks, Solscan, Helius, Hyperliquid (held over from v1)]
research_output: ai/design-research.md (rewritten v2)

## Phase 2: completed (v2 — synthesised, not 3 separate HTML files)

Three sketches generated in design-research.md, evaluated against Krug trunk / Norman gulfs / Schoger hierarchy / transplant test / liveness / effort+risk:

**Sketch P1: "Composition Stack"** (DNA-OZSTACK-GEIST-COBALT-LATTICE)
  Inspired by: OpenZeppelin Wizard + Linear compose model + Hyperliquid live pulse
  Hero: animated SVG of MetaHook outer container with N policy blocks slotting in
  Type: Geist Sans + Geist Mono. Color: institutional dark + electric cobalt + amber-only-for-verdicts
  Layout: top nav, demo flow stations as compact cards, audit feed as full-width streaming list
  Krug ✅ strong (instant composition read). Transplant ✅ specific. Liveness ✅. Effort: medium. Risk: medium-low.

**Sketch P2: "Custodian Console"** (DNA-ANCHOR-INTER-MONO-STEEL)
  Inspired by: Anchorage Digital + Bloomberg Terminal density
  Hero: operational status panel "Active mint / N policies / Last verdict X sec ago"
  Type: Inter Tight + IBM Plex Mono. Color: near-black + steel-blue + warm-only-for-status
  Layout: 12-col multi-pane (left rail + centre audit feed + right action)
  Krug ⚠️ medium (status reads but compose story unclear). Transplant ⚠️ could work for any monitor. Liveness ✅. Effort: high. Risk: medium.

**Sketch P3: "Wizard Editor"** (DNA-COMPOSE-PICKER-PREVIEW-RUN)
  Inspired by: OpenZeppelin Contracts Wizard literally
  Hero: 3-pane editor — policy picker | composed config | run/test
  Type: Inter + JetBrains Mono. Color: dark + cobalt
  Layout: 3-pane editor with drag-handle dividers
  Krug ✅✅ strongest (explicit). Transplant ✅✅ most specific. Liveness ✅. Effort: very high. Risk: high (full rebuild).

## Phase 3: completed
selected: HYBRID (P1 base + P2 operational metric strip + P3 live-CU surfacing as state advances)
DNA: DNA-OZSTACK-GEIST-COBALT-LATTICE+CONSOLE-METRICS
rationale:
  - P1 strongest Krug trunk test for the compose-story product
  - P1 specific transplant answer (would NOT work for any other product)
  - P1 lowest implementation risk on shipped working code
  - P2 metric strip adds Anchorage-style restraint-with-evidence
  - P3 live-CU updating as state advances applies the wizard energy without rebuilding the page as an editor
  - P2 full + P3 full both rejected for build-time reasons in remaining session window

## Phase 4: completed (2026-05-10)
audit_result: pass
issues_fixed: 4 (button underlines, depth-strip 4-col, stations 5-col, devnet-analytics hide), then second-pass: typography hard gate (37 sub-12px sizes bumped), AI slop (subtitle rewrite + asymmetric solution-cards), liveness (amber accent opacities bumped above 0.10 floor)

## Phase 5: completed (2026-05-10) — APPROVED
qa_result: APPROVED

Hard gate results:
- GATE 1 (min font size): PASS — 0 sub-12px violations
- GATE 2 (AI slop checklist): PASS — 0 strong hits / 2 borderline (color-coded H1 word, 4-stat grid; both intentional + product-specific)
- GATE 3 (most-used font size): PASS — 0.78rem (12.5px) on tracked uppercase labels, allowed minimum
- GATE 4 (micro-interactions): PASS — 4 hover states, 20 cubic-bezier(0.23,1,0.32,1) usages, 0 ease-in transitions, :active scale + :focus-visible present
- GATE 5 (liveness): PASS — 10 radial-gradient layers, noise opacity 0.04, 11 CSS animations, 6 cobalt box-shadow glows, prefers-reduced-motion respected

Design ready to ship. Live: https://yonkoo11.github.io/multihook/
