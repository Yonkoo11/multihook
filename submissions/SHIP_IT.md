# Ship-it checklist — Multi-Hook · Frontier 2026

Deadline: **May 11, 11:59 PM PDT** (today). Pacific time, not local.

---

## State of play (as of this commit)

✅ **V1.1 metahook deployed to devnet** (program `4o6h…BLh9d`, slot 461511316)
✅ **Live site serving V1.1 front-end** (demo-fncLVAZm.js)
✅ **End-to-end transfer flow verified** through real Phantom on devnet (Provision → Reject → Allow → Approve + signed receipt)
✅ **Pitch video** rendered (`video/metahook-demo.mp4`, ~102s)
🔄 **Technical walkthrough video** rendering via Remotion (~188s, output to `video/remotion-tech/out/metahook-technical.mp4`)
✅ **Submission texts drafted**: main-frontier, sns-identity, adevar-labs, phantom

---

## T-minus checklist (do these in order)

### 1. Verify the technical walkthrough rendered
```bash
cd video/remotion-tech && ls -la out/metahook-technical.mp4
ffprobe -v quiet -show_entries format=duration,size -of default=nw=1 out/metahook-technical.mp4
```
Expect: 188s, ~80-150 MB.

### 2. Spot-check the technical walkthrough
Open the mp4 in QuickTime. Scrub through the 8 scene boundaries (every ~24s on average). Verify:
- Hero gradient text renders correctly
- Code is readable
- Solscan URL is visible in the on-chain proof scene
- Closing card shows GitHub URL

If anything's off → re-render or iterate via `npx remotion studio src/index.ts`.

### 3. Upload both videos to YouTube as Unlisted
Use the metadata in `submissions/VIDEO_DELIVERY.md`. Get two URLs.

### 4. Write down everything on a single piece of paper
- Pitch video YouTube URL
- Technical walkthrough YouTube URL
- GitHub repo: `https://github.com/Yonkoo11/multihook`
- Live demo: `https://yonkoo11.github.io/multihook/`
- Provision tx (devnet): `5Au7wqS57VJX…` (real, from your run)
- Approve tx (devnet): `WfsUFURrqfT1…` (real, from your run)
- Sample diagnose-flow tx: `3UgjEfRpgvZKeHvk…`

### 5. Open `https://arena.colosseum.org/hackathon` and do page 1
| Field | Value |
|---|---|
| PROJECT NAME | `Multi-Hook` |
| BRIEF DESCRIPTION (≤500) | (see below) |
| CATEGORY | Type "infra" → pick `Infrastructure` (else `RWA`) |
| TEAM MEMBERS | empty |

**Brief description** (487 chars — paste verbatim):
> The missing public-good primitive for Token-2022 transfer-hook composition. One meta-hook program delegates to N child policy programs via CPI, AND-aggregates their verdicts, and emits an on-chain audit event per transfer. Three reference policies deployed devnet (allowlist, OFAC sanctions, SNS .sol-domain gate) plus a public interface spec. Anyone forks a policy template, ships ~200 lines of Rust, and slots their rule into a live mint. MIT-licensed. The on-chain enforcement layer of an RWA compliance stack.

### 6. Page 2+ of the form (will need screenshots)
Likely fields based on Colosseum convention — ship me a screenshot if anything's unclear:

- **Long description** → paste from `submissions/main-frontier.md` "Long description" section
- **Logo** → use the GitHub repo's avatar (or generate a 512×512 cobalt block)
- **Demo URL** → `https://yonkoo11.github.io/multihook/`
- **GitHub URL** → `https://github.com/Yonkoo11/multihook`
- **Video URL** → pitch video YouTube URL (primary)
- **Pitch video** → same as above (some forms have 2 fields: pitch + technical)
- **Technical video** → technical walkthrough YouTube URL
- **Tracks** → check ALL of: Public Goods Award, Standout Team, Grand Champion, Solana Foundation Award (if listed)

### 7. Sidetracks
After the main submission, 3-4 sidetrack submissions on the same site:

| Sidetrack | Source text | Why submit |
|---|---|---|
| SNS / Bonfida | `submissions/sns-identity.md` | `policy-sns-allowlist` deployed devnet, triple-bind security check, real depth-4 |
| Adevar Labs (audit credits) | `submissions/adevar-labs.md` | MetaHook IS the audit subject — frame honestly |
| Phantom | `submissions/phantom.md` | 4-surface depth (connect + bundled signTx + signMessage + SIWS) |
| (Optional) Helius | not drafted | only if Helius has an open Frontier sidetrack and they accept devnet RPC use |

---

## What NOT to do

- Don't submit to RPCFast / QuickNode / GoldRush / Birdeye / Dune / Umbra sidetracks (`*-DROPPED.md` files mark these). Honest scope > inflated track count.
- Don't push more code changes after submission. Lock the GitHub head at the committed hash.
- Don't go public with the YouTube videos until after judging (keep Unlisted).

---

## After submission

1. Take a screenshot of the submission confirmation page.
2. Email yourself the submission ID for reference.
3. Update `~/Projects/IDEAS-SUMMARY.md` Outcome Tracking with: hackathon name, date submitted, submission link.
4. Sleep.

---

## If something breaks during submission

| Symptom | Fix |
|---|---|
| Video URL field rejects YouTube unlisted | switch the video to Public temporarily, submit, switch back to Unlisted |
| Long description has a character cap | paste a shortened version + link to GitHub README for full |
| Category dropdown doesn't have Infrastructure | use RWA, or DeFi (in that order of preference) |
| Form errors on submission | screenshot the error + post in Colosseum Discord; usually a transient backend issue |
| GitHub repo is private and the form requires public | `gh repo edit Yonkoo11/multihook --visibility public` (you've already been keeping it public so unlikely) |
| Submission deadline misses by minutes | DM the Colosseum team on Discord with submission attempt timestamp; they sometimes accept up to 1h late if there's evidence of platform issue |

---

## Final commit

After submission:
```bash
git tag frontier-submission-2026-05-11 -m "Submitted to Solana Frontier 2026"
git push origin frontier-submission-2026-05-11
```

Locks the exact hash judges will see.
