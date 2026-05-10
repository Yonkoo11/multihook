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

## Pre-submission verification (Phase 4.5 self-audit, run 48h before deadline)

| Sponsor | Target | Actual | Evidence (URL or file:line) | Gap |
|---|---|---|---|---|
| Phantom | 4 | _TBD_ | _TBD_ | _TBD_ |
| Helius  | 3 | _TBD_ | _TBD_ | _TBD_ |
| Squads  | 2 | _TBD_ | _TBD_ | _TBD_ |

Hard gate: if Phantom or Helius drops below 3, EITHER ship the missing wins by killing a polish task, OR drop the affected track from the submission. Honest depth > inflated track count.
