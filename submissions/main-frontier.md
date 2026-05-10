# Solana Frontier 2026 — Main Submission (arena.colosseum.org)

**Tracks:** Public Goods Award (primary), Standout Team (backup), Grand Champion (stretch)

---

## Project name
Multi-Hook · Composable Token-2022 Compliance

## One-line tagline
OpenZeppelin for Token-2022 transfer-hook compliance — one meta-hook, N composable child policies, one signed audit receipt per transfer.

## Live demo
https://yonkoo11.github.io/multihook/

## GitHub
https://github.com/Yonkoo11/multihook (MIT)

## Short description (≤500 chars)
Smaller RWA token issuers can't access the proprietary compliance stacks that power Western Union USDPT, BlackRock BUIDL, or Paxos USDP. Multi-Hook is a Token-2022 transfer-hook program that delegates to N child policy programs via CPI, AND-aggregates their verdicts, and emits a signed audit event per transfer. Anyone can write a new policy in ~200 lines of Rust and slot it into a live deployment without touching the meta-hook code.

## Long description

### The problem
The Token-2022 transfer-hook extension shipped in 2024 with no public-good infrastructure for composing multiple compliance policies onto a single mint. RWA issuers either (a) write a single bespoke hook per mint or (b) buy into Anchorage / Fireblocks / Securitize at $200K+ MSRP. There is no third option.

### The product
**Four Anchor programs, deployed devnet, MIT-licensed:**
- `metahook` (`4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d`) — fallback dispatcher + CPI orchestration + audit event
- `policy_allowlist` (`GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn`) — set-membership on destination owner
- `policy_sanctions_ofac` (`5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt`) — inverted set-membership (OFAC-style stub list)
- `policy_sns_allowlist` (`4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo`) — third reference policy that gates on `.sol` domain ownership via Solana Name Service (Bonfida)

Plus the **public policy interface spec** at `POLICY_INTERFACE.md` — the load-bearing public-goods artifact. Anyone can ship a fourth policy in ~200 lines of Rust by following the spec; their policy slots into any MetaHook deployment without touching the meta-hook's code.

### What makes this a public good (Public Goods Award alignment)
1. **MIT-licensed** at the repo root
2. **Public spec** (`POLICY_INTERFACE.md`) — `check_transfer` signature, account context order, error format, PDA seed convention, ExtraAccountMetaList contract
3. **Three reference implementations** — two wired into the live demo, one (SNS) standalone showing the "compose with an external program" pattern
4. **Production policy-authority guide** (`POLICY_AUTHORITY.md`) — Squads multisig pattern with 2-of-3 worked example so issuers don't single-key compliance state in production
5. **No rent extraction** — issuers run their own deployments; no fee on the meta-hook itself
6. **Devnet-deployed today, mainnet-deployable tomorrow** — same upgrade-authority keypair so the mainnet program IDs match the devnet ones

### Demo flow (60 seconds)
1. Open the live demo → click **Connect Phantom** (devnet)
2. Click **Provision** — single signed transaction creates allowlist + OFAC PDAs, the Token-2022 mint with TransferHook ext, the ExtraAccountMetaList, two ATAs, and mints 1000 tokens to you
3. Click **Send 100 (expect revert)** — transfer to a freshly-generated wallet rejects with `policy.allowlist.fail` from `policy_allowlist::check_transfer` at CPI depth 3
4. Click **Add to allowlist** — single CPI to `add_allowed`. The MetaHook program code is untouched; only the policy state moves
5. Click **Retry** — same transfer succeeds; the `MetaHookAuditEvent` is decoded from the transaction's `Program data:` log line and rendered as a stamped receipt with per-policy verdicts. Phantom is then prompted to sign a canonical receipt message binding the audit event base64 + tx signature + issuer pubkey — the resulting ed25519 signature renders below the on-chain receipt as an "issuer-signed receipt" expandable detail block

### Hard architecture decisions documented in CLAUDE.md
- **CPI depth ≤ 3** verified: Token-2022(1) → metahook(2) → child policy(3) — leaving 1 level of headroom for child policies that themselves CPI
- **Reentrancy guard** at PDA `9kfFCZTqLtCRnRwQ4EHWXrZzFSw5Ky3Q68B6BgbA8W5r` — byte-flip 0→1→0 across `execute()`; PDA included as writable in `ExtraAccountMetaList` so Solana's account-write exclusivity prevents recursive entry on the same tx
- **Bundled provision** — all 7-10 setup instructions land in one `signTransaction` to bypass Phantom's drainer-pattern detector (the original 4-tx flow was getting flagged as malicious — verified via puppeteer + Phantom CRX harness in `scripts/phantom-e2e.mjs`)
- **HTTP-poll confirmation** instead of WebSocket subscription — works on restrictive networks where wss:// is blocked

### CU budget
33,346 CU per transfer with 2 policies (16% of Token-2022's 200K transfer budget). Headroom for ~6 more policies before bumping into the limit.

## Sponsor depth audit (honest)
| Sponsor | Depth | Evidence |
|---|---|---|
| Phantom | 3/5 | Connect + bundled signTransaction + signMessage on every successful transfer (issuer-signed off-chain receipt). `app/src/wallet.ts:32`, `app/src/demo.ts:419`, `app/src/main.ts:onTransferOk` |
| Helius | 3/5 | Devnet RPC for all reads/writes; key referrer-restricted to `yonkoo11.github.io`; footer surfaces active provider. `app/src/programs.ts:DEMO_RPC` |
| SNS (Bonfida) | 3/5 | Third reference policy `policy-sns-allowlist` deployed devnet — gates Token-2022 transfers on `.sol` domain ownership via direct SNS NameRecord reads with hardcoded program-id ownership check |
| Squads | 2/5 | Pattern documented for production policy-authority management (`POLICY_AUTHORITY.md`) |
| GoldRush | SKIP | Solana coverage is mainnet-only — would have been a name-drop on devnet. Honesty over inflated track count |

(Full audit + commitments + acceptance tests in `ai/sponsor-integration.md`.)

## Technical disclosure (Frontier rules section 4)
This project includes conceptual learning from Verigate (RWA Demo Day, BSC, BAS attestations, 7 contracts + 75 tests). **All Solana / Rust / Token-2022 code is new**. Different VM (BSC = EVM; Multi-Hook = Solana SVM), different language (Solidity vs Rust), no code lifted.

## Memorable takeaway
Token-2022 launched the transfer hook extension in 2024. Until now, shipping production compliance with it meant either (a) writing a bespoke hook per mint or (b) buying Anchorage / Fireblocks / Securitize at $200K+. Multi-Hook is the missing piece: a meta-hook that lets you compose existing policy primitives into a custom compliance stack the same way you compose middleware in Express. Fork a child policy, deploy, append to your `ExtraAccountMetaList`, and you've added a new compliance rule to a live mint **without touching the hook's code**.

## Team
Solo. Mustapha (yonkoo11).
