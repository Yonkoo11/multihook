# Multi-Hook · Sponsor Integration Plan

**Hackathon:** Solana Frontier (Colosseum) — submissions close May 11 2026 11:59pm PT
**Submitting tracks:** Public Goods Award ($10K primary), Standout Team ($10K backup), Grand Champion ($30K stretch)

Audited against the Phase 3.5 Depth Scale:
- 0 = not used
- 1 = name-drop only
- 2 = wallet/auth-level use (signTransaction)
- 3 = 1 non-trivial SDK/API call
- 4 = 2+ surface areas integrated, demoable
- 5 = load-bearing — remove it and the demo breaks

---

## Audit (current state, 2026-05-10)

| Sponsor | Current | Target V1 | Track relevance | Honest verdict |
|---|---|---|---|---|
| **Phantom** | 2/5 | 4/5 | Direct (Phantom funds Solana ecosystem; Adam Gutierrez = judge) | We use `window.solana` raw — works but signals shallow. Phantom track wants Wallet Adapter + SIWS + signMessage. |
| **Helius** | 0/5 | 3/5 | Helius funds infra track + judges DX category | Currently using public devnet RPC. Embarrassing zero. |
| **Squads** | 0/5 | 2/5 | RWA + infra adjacent | Strong narrative fit (issuers shouldn't single-key the policy authority). Stretch. |
| **Privy** | 0/5 | 0/5 | Wallet/onboarding | Skip — Phantom is the primary path; embedded would be V2. |
| **Coinbase** | 0/5 | 0/5 | Wallet | Skip — adds breadth but not depth. |
| **Metaplex** | 0/5 | 0/5 | Token/NFT | Skip — Token-2022 doesn't compose cleanly with mpl-token-metadata. |
| **Arcium** | 0/5 | 0/5 | FHE / confidential | Skip V1 (per memory.md fatal flaw 4: confidential transfers + transfer hooks incompatible upstream). |
| **LI.FI / MoonPay / others** | 0/5 | 0/5 | Cross-chain / on-ramp | Skip — tangential. |
| **GoldRush (Covalent)** | 0/5 | **SKIP** | Side bounty, $5K | Triaged 2026-05-10: 1/4 yes on Phase 3.5f checklist. **Devnet not supported** (their Solana coverage is mainnet-only); Solana support is "balances endpoint exclusively" per docs (not custom Anchor event decoding). Achievable depth = 1/5 (name-drop) which the framework explicitly bans. Skipping the bounty is +EV vs forcing a shallow integration that signals prize-chasing to Public Goods judges. |

---

## Committed depth wins (V1)

### Phantom: 2/5 → 4/5
- **P0.1 — Replace raw `window.solana` with `@solana/wallet-adapter-phantom`** (file: `app/src/wallet.ts`)
  - Acceptance: imports `PhantomWalletAdapter` from the official package; rest of app unchanged
- **P0.2 — Sign-In With Solana session** (file: new `app/src/siws.ts`, button in topbar)
  - Acceptance: clicking "Sign in as issuer" produces a signed message the dApp displays + persists to localStorage; signature verifies with `@solana/wallet-standard-features` `solana:signIn`
- **P1.3 — Phantom mobile deeplink** (file: `app/index.html` topbar)
  - Acceptance: a "Open in Phantom mobile" button generates a `https://phantom.app/ul/v1/...` deeplink for the current dApp URL
- **P1.4 — Use `signMessage` to bind audit events to issuer identity** (file: `app/src/demo.ts`)
  - Acceptance: after each successful transfer, dApp signs a message containing the audit-event base64 + tx signature, displayed below the receipt as "issuer-signed receipt"

### Helius: 0/5 → 3/5
- **P0.5 — Switch dApp RPC to Helius devnet** (file: `app/src/programs.ts:DEMO_RPC`)
  - Acceptance: `DEMO_RPC = "https://devnet.helius-rpc.com/?api-key=<KEY>"`; live demo uses Helius for all reads/writes
  - Key handling: free Helius hackathon-tier key, gated to `yonkoo11.github.io` referrer (Helius dashboard supports per-domain restriction)
- **P1.6 — Helius `getEnhancedTransactions` for the audit log feed** (file: new `app/src/audit-feed.ts`)
  - Acceptance: below the receipt, render the last 5 transfers on this mint with verdicts decoded from program logs via Helius's parsed-tx endpoint
- **P2.7 — Helius webhook → live audit-event pulse** (V2; documented in roadmap)

### Squads: 0/5 → 2/5
- **P1.8 — Documentation: "policy authority should be a Squads multisig in production"** (file: `docs/POLICY_AUTHORITY.md`)
  - Acceptance: 1-page guide showing the 2-of-3 Squads pattern, with code stub demonstrating how `add_allowed` would be called via Squads `proposal_create`
  - This is depth 2 (mention + code stub) not 3 (live demo). To get to 3, we'd need to actually deploy a Squads multisig as the policy authority for the demo wallet — possible if time allows.

---

## Public Goods Award alignment (separate from sponsor depth)

Public Goods judges weight: open-source license, broad applicability, no rent extraction, ecosystem contribution.

- [ ] **LICENSE** (MIT) at repo root — currently MISSING. Trivial to add. Own-goal if shipped without.
- [ ] **`docs/POLICY_INTERFACE.md`** — public spec defining how to ship a third policy program (the `check_transfer` instruction shape, PDA seed convention, error format, ExtraAccountMetaList contract). This is what makes us a public good vs a one-off demo.
- [ ] **3rd reference policy** — implement `policy_balance_cap` (per-recipient max per epoch) as a worked example consumers can fork. Demonstrates the interface concretely.

---

## Shipped status (rolling, last update 2026-05-10)

### P0 — landed in commit fe317e0
- ✅ **LICENSE (MIT)** at repo root — Public Goods own-goal fixed
- ✅ **README.md** judge-ready — one-line problem, product paragraph, 60-sec demo flow, architecture diagram, sponsor depth table, technical disclosure, memorable takeaway
- ✅ **POLICY_INTERFACE.md** — public spec for third-party child policies, with reference table + 6 suggested-but-unbuilt policy ideas for contributors
- ✅ **Helius RPC integration (depth 0 → 3)** — DEMO_RPC resolves to Helius devnet when VITE_HELIUS_KEY env-var is set at build time, falls back to public devnet otherwise; active provider surfaced in footer
- ✅ **GoldRush triage logged** — explicit SKIP decision recorded

### Helius — final action needed by user
The integration code ships with a fallback to public devnet, so the build is
green even without a key. To activate Helius (target depth 3):
1. Sign up at helius.dev (free tier)
2. Generate a devnet key
3. In Helius dashboard, gate the key to `yonkoo11.github.io` referrer
4. Add `VITE_HELIUS_KEY=<key>` to `app/.env` (already gitignored)
5. `cd app && npm run build` — footer will show "Helius RPC"
6. Commit + push docs/

The key MUST be domain-restricted in Helius's dashboard before going public — any client-side key is a billing-attack surface otherwise.

### P1 — queued, not yet landed
- ⏳ **Phantom signMessage on receipts** (Phantom 2/5 → 3/5) — sign the audit-event base64 with the issuer wallet, display "issuer-signed receipt" below the stamped receipt. ~2 hours.
- ⏳ **Helius getEnhancedTransactions audit feed** (Helius 3/5 → 4/5) — render last 5 transfers on the user's mint with verdicts decoded via Helius parsed-tx endpoint, below the receipt. ~3 hours.
- ⏳ **3rd reference policy: policy-balance-cap** (Public Goods proof) — fork policy-allowlist, replace `is_allowed` check with per-recipient amount cap per epoch. ~3 hours.

### P2 — stretch, judge by remaining time
- ⏳ Sign-In With Solana session (Phantom 3/5 → 4/5)
- ⏳ Phantom mobile deeplink button (Phantom 4/5 → 4.5/5)
- ⏳ @solana/wallet-adapter-phantom swap (cosmetic; debatable depth bump for the bundle-size cost)
- ⏳ Squads multisig pattern doc (Squads 0/5 → 2/5)

## Pre-submission verification (Phase 4.5 self-audit, run 48h before deadline)

| Sponsor | Target | Actual | Evidence (URL or file:line) | Gap |
|---|---|---|---|---|
| Phantom | 4 | 2 | `app/src/wallet.ts` raw `window.solana` | -2: signMessage receipts + SIWS still queued |
| Helius  | 3 | 3* | `app/src/programs.ts:DEMO_RPC` env-gated | *Conditional: requires user to set VITE_HELIUS_KEY before submission build |
| Squads  | 2 | 0 | none | -2: pattern doc not written |

Hard gate: if Phantom or Helius drops below 3, EITHER ship the missing wins by killing a polish task, OR drop the affected track from the submission. Honest depth > inflated track count.

For the 48h-before-deadline check: re-grep the live site for evidence of each sponsor surface, run the demo end-to-end via real Phantom (not just the mock), and update this table with file:line citations.
