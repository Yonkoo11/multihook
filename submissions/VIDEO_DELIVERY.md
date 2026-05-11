# How to deliver the two videos in the Frontier submission

## Inventory

| File | Format | Length | Audience | Status |
|---|---|---|---|---|
| `video/metahook-demo.mp4` | live dApp + voiceover | ~102s | judges, general audience | ✅ shipped (v3) |
| `video/remotion-tech/out/metahook-technical.mp4` | code + terminal + Solscan, silent | ~188s | Mert/Toly tier, technical judges | rendered locally (NOT in git) |

Total combined runtime: ~4:50. Most hackathon judging panels watch the pitch first, technical second.

---

## Where to host

Frontier's submission form takes ONE primary video URL (typically YouTube or Loom). The technical walkthrough goes in the long description as a secondary link.

**Recommended:**
1. **Pitch video** → upload to YouTube as **Unlisted** (so it's only accessible via the link). Title: `Multi-Hook · Composable Token-2022 Compliance — 90 sec demo`
2. **Technical walkthrough** → upload to YouTube as **Unlisted**. Title: `Multi-Hook · Technical Walkthrough — 3 minutes of code, no fluff`

Why YouTube over Loom:
- Frontier judges expect YouTube/Vimeo (the form usually validates the URL pattern).
- YouTube has CC + chapters + speed control. Mert/Toly will watch at 1.5x — let them.
- Loom adds account-creation friction for judges.
- Loom links can expire if you change plans.

If you don't have a YouTube account: Vimeo works equally well. Don't use Twitter/X video — the 2:20 cap kills the technical walkthrough.

---

## YouTube upload checklist

For each video:
- **Visibility:** Unlisted (NOT Public — you don't want it indexed during judging)
- **Title:** as above
- **Description:**
  - One sentence summary
  - Link to GitHub repo
  - Link to live demo
  - Link to the OTHER video
  - Solscan link to a sample tx (the approve sig from devnet)
- **Tags:** `solana`, `token-2022`, `transfer-hook`, `rwa`, `compliance`, `colosseum-frontier`
- **Category:** Science & Technology
- **Comments:** Off (no need during judging)
- **Made for kids:** No (this affects metadata visibility)
- **End screen:** None (the closing card is in the video itself)

---

## Submission form — primary video URL field

Use the **PITCH** video URL (90s, consumer-format). It's what judges will play first.

In the long description, add a section like:

> **For technical judges:** the [technical walkthrough](https://youtu.be/XXX) (~3 min, code-dominant, no voiceover) covers the per-mint MetaHookConfig PDA, the SNS triple-bind security check, and the live `add_policy` flow against deployed devnet bytecode. It's silent on purpose — designed to be watched on mute with subtitles, the way engineering content lands at conferences.

---

## What if I can only ship ONE

The pitch video is the safer single submit (judges who want depth click through to GitHub). But if you're targeting technical sidetracks specifically (Adevar audit credits, possibly Phantom or SNS), submit the **technical walkthrough** as the primary. The judging weight on those tracks is technical correctness, not consumer storytelling.

---

## Pre-upload final checks

For the **pitch video** (`video/metahook-demo.mp4`):
- [ ] Plays end-to-end without glitch
- [ ] Audio is in sync
- [ ] No drainer warning visible anywhere
- [ ] Last frame is the closing card (not a black flash)

For the **technical walkthrough** (`video/remotion-tech/out/metahook-technical.mp4`):
- [ ] All 8 scenes visible (scrub through scene boundaries at frames 360, 900, 1650, 2400, 3450, 4290, 5040)
- [ ] Code is readable at native resolution
- [ ] Solscan tx hash on screen matches a real on-chain devnet tx (`3UgjEfRpgvZKeHvk…`)
- [ ] Numbers in the closing scene are accurate (33,346 CU, 1156 bytes, 7/7 tests, 4 programs)

---

## After judging

If you go public with this project (post-judging):
- Flip both videos from Unlisted to Public
- Add to the GitHub README as embedded thumbnails
- Tweet a 60s clip from the technical walkthrough (the SNS triple-bind scene plays well as a standalone Solana-dev tweet)
