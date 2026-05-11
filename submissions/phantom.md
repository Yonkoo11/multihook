# Phantom Sidetrack — Frontier 2026

**Track:** Phantom — best wallet integration (if open in Frontier)

---

## Why Multi-Hook fits this track

Multi-Hook uses Phantom across **four distinct surfaces** in a way most submissions don't:

| Surface | Where | Sponsor depth |
|---|---|---|
| `connect()` | every page load | 1/5 — table stakes |
| `signTransaction()` | bundled provision tx (8-12 instructions) | 2/5 — non-trivial because it bypasses Phantom's drainer-pattern detector |
| `signMessage()` | per-transfer issuer-signed audit receipt | 3/5 — actual cryptographic binding to on-chain audit event |
| `signIn()` (SIWS, wallet-standard `solana:signIn`) | dApp session start | **4/5 — full Sign-In With Solana, not a `signMessage` polyfill** |

Four-surface integration. Real depth, not name-drop.

## SIWS — the depth-4 piece

`app/src/wallet.ts:59-80` implements the wallet-standard `solana:signIn` feature. Phantom 24.0+ supports this natively as a structured popup that renders the issuing domain, statement, chain ID, and expiration. Most submissions use `signMessage` instead because it's older — SIWS is the right primitive but adoption is thin. We adopted it because the issuer session payload needs to be portable + replayable by audit tools, and SIWS carries the canonical envelope (domain + statement + chainId + nonce + issuedAt + expirationTime) that auditors can verify offline.

The signed payload is persisted to localStorage and replayed on the dApp's `audit-feed` view as proof of "this issuer was signed in to this dApp at this domain at this time, signed by this Phantom-managed key."

## Bundled signTransaction — the depth-2 piece

The original 4-tx provision flow (init policies + init mint + init meta list + mint to) was being flagged by Phantom's drainer-pattern detector as malicious — verified empirically via `scripts/phantom-e2e.mjs` (puppeteer + real Phantom CRX). Multi-Hook bundles all 8-12 setup instructions into a single signTransaction request. Phantom shows ONE popup with the full instruction list, the user reviews, signs once, and the dApp polls for confirmation. No drainer warning, single user action.

Bundle size: 1156/1232 bytes for the V1.1 2-policy provision (76 byte headroom). Verified via `scripts/diagnose-provision.mjs` — measured per-instruction breakdown.

## signMessage — the depth-3 piece

Every successful transfer through MetaHook results in a `MetaHookAuditEvent` emitted on-chain. The dApp then prompts Phantom to sign a canonical receipt message binding:
```
MetaHookReceipt v2
event_version:1
mint:<base58>
src:<base58>
dst:<base58>
amount:<u64>
policy_count:<u8>
final:approve
failed_policy_index:<i8>
tx:<signature>
event_b64:<base64-encoded-MetaHookAuditEvent>
issuer:<wallet-pubkey>
issued_at:<iso8601>
```

This is the off-chain audit attestation. The on-chain event is the canonical truth; the issuer's Phantom-managed key signs over the event hash + tx sig + timestamp. Auditors can verify the receipt was signed by an issuer-controlled key without needing on-chain access.

Code: `app/src/demo.ts:488-540` (`signAuditReceipt`).

## What Phantom-specific quirks we handled

- **Drainer detection** on multi-tx-after-trust-grant — fixed by bundling.
- **Phantom signing latency** (5-15s between popup-open and dApp-receives-signed-tx) — V1.1 fixes this via `finalized` blockhash for max 60-90s validity window + priority fee (1000 microLamports/CU) so the tx lands in the next block.
- **Phantom rejection error shapes** — we surface both `e.code === 4001` and `/rejected|cancel/i` so the dApp logs accurately tell the user why.
- **`window.solana` vs `window.phantom.solana`** — `getPhantomProvider()` checks both, with `isPhantom` flag verification.

## What we did NOT do
- **Phantom-mediated end-to-end on devnet is not yet empirically proven** for the V1.1 bytecode (we redeployed today; tested directly via test keypair, not via Phantom popup flow).
- We do NOT use Phantom's embedded swap or onramp APIs — out of scope for compliance infrastructure.
- We do NOT use Phantom Labs custom SDK features (private wallet, hidden address, etc.) — Multi-Hook is wallet-agnostic at the protocol level; Phantom is the reference adapter.

## Repo
https://github.com/Yonkoo11/multihook (MIT)
SIWS implementation: `app/src/wallet.ts:59-80`
Bundled provision: `app/src/demo.ts:125-283`
Receipt signing: `app/src/demo.ts:488-540`

## Demo
https://yonkoo11.github.io/multihook/demo/

## Team
Solo. Mustapha (yonkoo11).
