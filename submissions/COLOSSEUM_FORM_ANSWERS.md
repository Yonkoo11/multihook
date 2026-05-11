# Colosseum Frontier 2026 — Form Answers

Copy/paste fields verbatim. All under their respective char limits. Hyphens (`-`) not em dashes (`—`). Honest tone, no marketing words, no triadic rhythm. Specific numbers. First person where it fits.

Re-measured char counts (all under limit, verified):
- WHAT ARE YOU BUILDING: 945 / 1000
- WHY BUILD THIS:        889 / 1000
- REPO CONTEXT:          472 / 500
- BRIEF (revision):      462 / 500

---

## STEP 1

### Project Name
```
Multi-Hook
```

### Brief Description (already filled — only update if you want this revised version)
Optional revision (462 chars, verified), more dev-direct:
```
A meta transfer-hook for Token-2022. The hook reads a per-mint config PDA at every transfer, CPIs into the N child policy programs in the config, AND-aggregates the verdicts, and emits a MetaHookAuditEvent. Adding a policy is one authority-gated add_policy call. The hook code never moves. 3 reference policies ship deployed devnet (allowlist, OFAC sanctions, SNS .sol-domain gate). Spec at POLICY_INTERFACE.md so anyone can ship their own in ~200 lines of Rust.
```

### Project Website (Public)
```
https://yonkoo11.github.io/multihook/
```

### What are you building, and who is it for? (945 / 1000 chars, verified)
```
A meta transfer-hook for Token-2022. The hook reads a per-mint MetaHookConfig PDA on every transfer, CPIs into the N child policy programs in the config, AND-aggregates the verdicts, emits a MetaHookAuditEvent. Adding a policy is one authority-gated add_policy call. The hook code never moves. Up to 8 policies per mint.

3 reference policies deployed devnet:
- policy-allowlist (set membership on dest owner)
- policy-sanctions-ofac (inverted allowlist)
- policy-sns-allowlist (gates on .sol domain ownership via Bonfida, triple-bind defeats the historical-control replay)

Plus the spec at POLICY_INTERFACE.md, the public-goods artifact that lets anyone ship a fourth policy in ~200 lines of Rust without touching the meta-hook.

For RWA issuers who cannot justify $525K Securitize-class contracts, for Solana devs shipping Token-2022 mints, and for security engineers who want composable on-chain primitives instead of bespoke per-mint hooks.
```

### Why did you decide to build this, and why build it now? (889 / 1000 chars, verified)
```
Token-2022 shipped its transfer-hook extension in early 2024. 18 months later there is still no public-good infra for composing multiple policies onto one mint. Issuers either write a bespoke hook per mint or pay Securitize / Anchorage / Fireblocks $525K+ vendor contracts (BlackRock paid Securitize that for BUIDL in March 2024). No middle ground.

I hit this gap on a prior RWA project, Verigate (BSC, BAS attestations, 7 Solidity contracts, 75 tests). The attestation layer existed but the on-chain enforcement layer for composing multiple compliance rules did not. I worked around it with a bespoke hook. Annoying. Not reusable. The right shape is composable primitives plus a public spec.

Frontier is the right window because Token-2022 hook adoption is just bending up. Per-mint composability needs to exist before the third issuer asks how to add their custom rule without forking.
```

### What technologies are you using or integrating with?
```
Anchor 0.32.1, Rust, Token-2022 transfer-hook + ExtraAccountMetaList, TypeScript / Vite, @solana/web3.js, @solana/spl-token, Phantom (connect + signTransaction + signMessage + SIWS), Helius RPC, Solana Name Service (Bonfida) for SNS .sol-domain reads, Squads (multisig pattern documented for production policy authority), GitHub Pages. Dev tools: anchor-test, solana-cli, ffmpeg, Remotion for the technical walkthrough video, Claude Code for editor pair-programming, ElevenLabs Brian for voiceover.
```

### Mobile-focused dApp?
**Uncheck.** Web-first.

### Category
**Real World Assets (RWA)** (already selected)

---

## STEP 2

### Project Logo
You don't have one. Reply "render logo" and I generate a 1024x1024 PNG from the Hero scene (cobalt + monospace "Multi-Hook" mark on dark surface).

### GitHub Link
```
https://github.com/Yonkoo11/multihook
```

### Repo context (472 / 500 chars, verified)
```
Full project. 4 Anchor programs in programs/ (metahook + 3 child policies). dApp in app/ (Vite/TS, served via GitHub Pages from docs/). 7/7 anchor integration tests in tests/transfer-hook.ts on V1.1 schema. Spec at POLICY_INTERFACE.md, the public-goods artifact. Production policy-authority pattern at POLICY_AUTHORITY.md. submissions/ holds the sidetrack drafts. video/ has the v3 pitch + Remotion source for the technical walkthrough. MIT. No unrelated code in the tree.
```

### Demo Video
Upload `video/metahook-demo.mp4` (102 seconds, the live dApp flow on real Phantom devnet) to YouTube Unlisted, paste URL here.

### Make demo video public?
**Check the box.** Yes - judges and future users should see it.

### Live Product Link
```
https://yonkoo11.github.io/multihook/
```

### Access Instructions
```
Live demo: yonkoo11.github.io/multihook/demo/

1. Switch Phantom to devnet (Settings -> Developer Settings -> Change Network -> Devnet). Wallet needs ~0.5 SOL devnet. Faucet at faucet.solana.com.
2. Connect Phantom.
3. Click Provision. One signed tx (~1156 bytes) creates the allowlist PDA, OFAC PDA, Token-2022 mint with TransferHook extension, MetaHookConfig PDA, ExtraAccountMetaList, both ATAs, and mints 1000 tokens.
4. Click Send 100 (expect revert). Hook rejects with policy.allowlist.fail at CPI depth 3.
5. Click Add to Allowlist. Single CPI to add_allowed.
6. Click Retry. Approves. Audit event renders below with per-policy verdicts. Phantom prompts for an off-chain signMessage that produces the signed issuer receipt.

To reset for a fresh run: clear localStorage keys starting with multihook:demo:* in browser devtools (Application -> Local Storage).

If anything fails on first try, refresh and retry - devnet RPC sometimes has transient blockhash issues. Fallback RPC providers are wired in app/src/programs.ts.
```

### Pitch Video
NEEDS TO BE RECORDED BY YOU. Form requires a personal intro video, separate from the demo. Loom is easiest (loom.com, free, 1-2 min, face-cam optional). Suggested rough script below — say it in your own words, hesitate where you naturally would, do not read it like a teleprompter:

```
Hi, I'm Mustapha. I'm a medical intern. I code Solana smart contracts on the side.

I'm building Multi-Hook because I hit the Token-2022 transfer-hook composability gap on a prior RWA project. I needed to compose multiple compliance policies onto one mint and there was no public-good way to do it. So I built one.

Multi-Hook is a meta transfer-hook with a per-mint config PDA. The dispatcher reads the config and AND-aggregates verdicts from N child policies. Adding a policy to a live mint is one authority-gated call. No fork. The hook code never moves.

Three reference policies are deployed devnet, including SNS .sol-domain gating with a triple-bind security check. The spec is published so anyone can ship a fourth policy in 200 lines of Rust.

Why I'm the right person to build it: I've sat in front of the Token-2022 docs at 2 a.m. trying to figure out the ExtraAccountMetaList layout. The composability primitive I shipped is the one I wished existed when I started.

Live demo, code, and the technical walkthrough are at github.com/Yonkoo11/multihook.

Fork it. Ship a policy. Open a PR.
```

Things that make a pitch video sound human and not AI:
- Pause naturally (don't fight against ums and pauses, just let them happen)
- Don't smile through the whole thing
- Say a word, get it wrong, correct yourself, keep going (don't re-record for that)
- Look slightly off-camera at notes, that's fine
- Voice should drop on the periods, not stay flat
- If you stumble for 2 seconds, leave it in. Judges have seen 200 over-polished AI-narrated pitches. A real human stumbling reads as "this person actually built it"

---

## STEP 3 (when you reach it)
Send the screenshot. I draft answers same shape.

---

## After both videos uploaded

Replace the YouTube placeholder URLs above with the real ones. Save the form. Click REVIEW. Verify everything renders correctly. Submit.

If the form has additional supplementary-material fields, paste the technical walkthrough YouTube URL there with a one-liner like:
```
3:39 code-dominant technical walkthrough: https://youtu.be/...
Covers the per-mint MetaHookConfig PDA, the SNS triple-bind, and live add_policy against deployed devnet bytecode.
```
