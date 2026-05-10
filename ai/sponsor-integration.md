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

### P1 — landed in this session
- ✅ **Phantom signMessage on receipts** (Phantom 2/5 → 3/5) — `signAuditReceipt()` builds a canonical UTF-8 message containing the audit-event base64, tx signature, issuer pubkey, and ISO timestamp; Phantom popup shows the message verbatim; the resulting base58 signature renders below the stamped receipt as "issuer-signed receipt" with an expandable "show signed message + signature" details block. Files: `app/src/wallet.ts:32` (signMessage adapter), `app/src/demo.ts:419` (signAuditReceipt + base58 encoder), `app/src/main.ts:onTransferOk` (post-success signing flow), `app/src/main.ts:renderSignedReceipt`, `app/src/style.css:.audit-signed`. Test provider mock in `app/src/testProvider.ts` returns a deterministic SHA-256-derived 64-byte stub so the puppeteer harness still passes.
- ✅ **Helius RPC live** — `app/.env` populated by user with referrer-restricted devnet key. Production bundle inlines key (verified: `helius-rpc.com` present once in `docs/assets/index-*.js`). Footer shows "Helius RPC".

### P1 — queued, not yet landed
- ⏳ **Helius getEnhancedTransactions audit feed** (Helius 3/5 → 4/5) — render last 5 transfers on the user's mint with verdicts decoded via Helius parsed-tx endpoint, below the receipt. ~3 hours.
- ⏳ **3rd reference policy: policy-balance-cap** (Public Goods proof) — fork policy-allowlist, replace `is_allowed` check with per-recipient amount cap per epoch. ~3 hours.

### P2 — stretch, judge by remaining time
- ⏳ Sign-In With Solana session (Phantom 3/5 → 4/5)
- ⏳ Phantom mobile deeplink button (Phantom 4/5 → 4.5/5)
- ⏳ @solana/wallet-adapter-phantom swap (cosmetic; debatable depth bump for the bundle-size cost)
- ✅ Squads multisig pattern doc (Squads 0/5 → 2/5) — landed in `POLICY_AUTHORITY.md`

### Mainnet activation queue (waiting on user)
- ⏳ Send ~5 SOL to deployer `FV3vJxFDbusRKefLmRaXStzfyi5yzf6JiTVPcZYpiKo9` to deploy 3 core programs to mainnet (~4.5 SOL rent + 0.5 buffer)
- ⏳ Confirm Helius key referrer-locked to `yonkoo11.github.io` so commit `b48334d` (env-inlining fix) can be pushed
- ⏳ Sign up GoldRush + Birdeye, set their respective env vars
- ⏳ Publish `dune/audit_events.sql` as a Dune query, pin to a public dashboard, set `VITE_DUNE_DASHBOARD_URL`
- ⏳ Once all of the above ship, the analytics section's three panels populate with live mainnet data + the live demo footer flips from "public devnet" → "Helius RPC"

### 2026-05-10 STRATEGY PIVOT (devnet-only path, no mainnet SOL spend)

**Mainnet plan dropped after re-verifying GoldRush/Birdeye/Dune all index Solana mainnet only.** No devnet workaround exists. SOL spend cancelled.

**Substituted depth wins on devnet (this session):**
- **Helius 3/5 → 4/5**: shipped `audit-feed.ts` — uses `getSignaturesForAddress(sourceAta) + getTransaction(...) + decodeAuditEvent` to render a "Recent audit events" panel below the receipt with last 10 transfers, status pills, reject reasons, Solscan links. Refreshes after every demo step
- **QuickNode 0/5 → 3/5 (Eitherway $20K angle)**: multi-RPC fallback in `programs.ts`. Priority chain QuickNode → Helius → public devnet. Footer label adapts to active provider. Solves the "demo freezes when public RPC throttles" failure mode
- **Phantom 3/5 → 4/5**: shipped `siws.ts` — Sign-In With Solana (wallet-standard `solana:signIn` feature). "Sign in as issuer" button in topbar; portable session token persisted to localStorage (1 hr TTL); session pill shows "ISSUER · Xm" + sign out. Test provider mock includes deterministic SIWS response

**Sidetrack submissions (revised):**
- ✅ Public Goods Award (main Frontier)
- ✅ Adevar Labs $50K (submission only)
- ✅ SNS Identity $5K (devnet deploy of `policy-sns-allowlist`)
- ✅ Eitherway $20K (QuickNode multi-RPC angle, replaces Birdeye)
- ⛔ DROPPED: Dune $6K, GoldRush $3K, Eitherway-Birdeye angle (all mainnet-only)

**Submission docs reflect the pivot**: `submissions/eitherway-quicknode.md` is the new Eitherway target; the three mainnet-only submissions renamed `*-DROPPED.md` with a header note. Code stays in the bundle as documented "ready for mainnet" reference.

## Pre-submission verification (Phase 4.5 self-audit, run 48h before deadline)

| Sponsor | Target | Actual | Evidence (URL or file:line) | Gap |
|---|---|---|---|---|
| Phantom | 4 | 3 | `app/src/wallet.ts:35` signMessage adapter + `app/src/demo.ts:419` signAuditReceipt + `app/src/main.ts:442` onTransferOk signs after every successful transfer; receipt rendering in `app/src/main.ts:renderSignedReceipt` | -1: SIWS session + mobile deeplink still queued |
| Helius  | 3 | 3 | `app/src/programs.ts:DEMO_RPC` literal env access (Vite static-substitutes the key at build); built bundle `docs/assets/index-*.js` contains `helius-rpc.com` (1 match); footer surfaces active provider; PUSH PENDING referrer-restriction confirmation | 0 — depth target met |
| Squads  | 2 | 2 | `POLICY_AUTHORITY.md` — single-key threat model + 2-of-3 worked example with multisigCreateV2/vaultTransactionCreate/proposalApprove/vaultTransactionExecute code stubs + Phase 2 governance instruction suggestions | 0 — depth target met |
| SNS (Bonfida) | 3 | 3 | `programs/policy-sns-allowlist/src/lib.rs` deployed devnet at `4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo` (verified executable via `solana program show`); 3-guard check_transfer (account owner, allowlist membership, NameRecord owner equality) | 0 — depth target met (UNTESTED end-to-end against a real .sol domain — confidence MEDIUM) |
| Adevar Labs | n/a | n/a | Submission-only track ($50K audit credits); audit subject = our 3 deployed programs + reentrancy guard + 7/7 integration tests; submission text in `submissions/adevar-labs.md` | 0 — submission ready |
| Dune | 4 | 3 | `dune/audit_events.sql` decodes MetaHookAuditEvent base64 from `Program data:` log lines via byte-level borsh decode + pinned discriminator; 3 starter dashboard tile queries inline | -1: dashboard not yet published (requires mainnet deploy + first audit event) |
| GoldRush | 3 | 3 | `app/src/analytics-goldrush.ts` parallel calls to token_holders_v2 + transactions_v3 with defensive error handling; `app/src/analytics-render.ts` UI rendering; CORS `*` confirmed via OPTIONS probe | 0 — code shipped; activates on mainnet mint config |
| Birdeye (Eitherway angle) | 3 | 3 | `app/src/analytics-birdeye.ts` parallel calls to /defi/token_overview + /defi/history_price; SVG sparkline; 6-tile stat grid; CORS `*` + `x-api-key,x-chain` confirmed via OPTIONS probe | 0 — code shipped; activates on mainnet mint config |

Hard gate: if Phantom or Helius drops below 3, EITHER ship the missing wins by killing a polish task, OR drop the affected track from the submission. Honest depth > inflated track count.

For the 48h-before-deadline check: re-grep the live site for evidence of each sponsor surface, run the demo end-to-end via real Phantom (not just the mock), and update this table with file:line citations.
