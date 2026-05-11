# Multi-Hook

> **The missing public-good primitive for Token-2022 transfer-hook composition.**
> One meta-hook program, N composable child policies, one signed audit
> receipt per transfer. Built for RWA issuers who shouldn't need a
> $500K Securitize-class vendor contract to ship a regulated stablecoin.

🚀 **Live demo (Solana devnet):** [yonkoo11.github.io/multihook](https://yonkoo11.github.io/multihook/)
📜 **Policy interface spec:** [`POLICY_INTERFACE.md`](./POLICY_INTERFACE.md) — fork it, ship your own child policy
🪝 **Submission for:** Solana Frontier 2026 (Public Goods · Standout · Stretch: Grand Champion)

---

## The problem (one line)

Smaller RWA token issuers can't access the proprietary compliance stacks
that power Western Union USDPT, BlackRock BUIDL, or Paxos USDP — and there's
no public-good alternative for composing allowlist + sanctions + jurisdiction
policies onto a single Token-2022 mint.

## The product (one paragraph)

**MetaHook** is a Token-2022 transfer-hook program that delegates to N child
policy programs via CPI, AND-aggregates their verdicts, and emits a single
`MetaHookAuditEvent` with the per-policy outcomes. Each child policy
(`policy-allowlist`, `policy-sanctions-ofac`, …) is a standalone Solana
program implementing a [common interface](./POLICY_INTERFACE.md). Anyone can
write a new policy in ~200 lines of Rust and slot it into the meta-hook
without touching the meta-hook's code. Reentrancy-guarded. CPI depth ≤ 3.
33,346 CU per transfer with 2 policies (16% of Token-2022's 200K budget).

## Demo flow (try it in 60 seconds)

1. Open [the live demo](https://yonkoo11.github.io/multihook/) → click **Connect Phantom** (devnet)
2. Click **Provision** — single signed transaction creates your allowlist + OFAC PDAs, your Token-2022 mint with the TransferHook extension, the ExtraAccountMetaList, two ATAs, and mints 1000 tokens to you
3. Click **Send 100 (expect revert)** — transfer to a freshly-generated wallet rejects with `policy.allowlist.fail` from `policy_allowlist::check_transfer` at CPI depth 3
4. Click **Add to allowlist** — single CPI to `add_allowed`. The MetaHook program code is untouched; only the policy state moves.
5. Click **Retry** — same transfer succeeds; the `MetaHookAuditEvent` is decoded from the transaction's `Program data:` log line and rendered as a stamped receipt with per-policy verdicts.

That's the entire core action. Phase 1 Gate.

## Architecture (in a picture)

```
              Token-2022.transferChecked
                          │
                          ▼ [CPI]
              ┌──────────────────────┐
              │   metahook.execute   │ ← reads MetaHookConfig PDA per mint
              │  (fallback hook)     │ ← reentrancy guard PDA (writable)
              └──────────────────────┘
                          │
                          ▼ [CPI × N, sequential, AND-aggregated]
                          │   N = MetaHookConfig.policy_count (1..=8)
        ┌─────────────────┴─────────────────┐
        ▼                 ▼                 ▼
  config.policies[0]  config.policies[1]  config.policies[N-1]
    check_transfer      check_transfer      check_transfer
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 ▼                 ▼
              Ok(())  ── or ──  Err("policy.<name>.fail: …")
                          │
                          ▼ MetaHookAuditEvent { version, mint, src, dst,
                              amount, policy_count, final_decision,
                              failed_policy_index }
                          emitted on every transfer (revert and success);
                          failed_policy_index = -1 on approval, else the
                          short-circuit position in MetaHookConfig.policies
```

The meta-hook does NOT hardcode child policy program IDs. Each mint's
`MetaHookConfig` PDA stores the active `(program_id, policy_pda)` pairs.
Adding a policy = `metahook::add_policy(entry)` (authority-gated, then
re-init the ExtraAccountMetaList). No fork required.

## What's built (V1.1 — composable per-mint config)

- **4 Anchor programs deployed to devnet:**
  - `metahook` `4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d` — config-driven dispatcher + CPI orchestration + audit event. **No hardcoded child program IDs.**
  - `policy_allowlist` `GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn` — set-membership check on destination owner (V1 cap: 32 entries)
  - `policy_sanctions_ofac` `5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt` — inverted set-membership (V1 cap: 64 entries; OFAC-style stub list)
  - `policy_sns_allowlist` `4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo` — third reference policy: triple-bind check (NameRecord owner + allowlist membership + name_owner==dest_owner replay protection) via Solana Name Service. Worked example of the "compose with an external program" pattern.
- **Per-mint MetaHookConfig PDA** at `seeds = [b"metahook-config", mint]` — stores up to 8 `(program_id, policy_pda)` entries + aggregation mode + authority. The meta-hook reads it on every transfer and rejects any account-list whose program IDs / PDAs don't match the configured set. **This is what makes the composability claim true** — third-party policies slot in via `metahook::add_policy` without a code fork.
- **Reentrancy guard** at `9kfFCZTqLtCRnRwQ4EHWXrZzFSw5Ky3Q68B6BgbA8W5r` — byte at offset 8 flips 0→1→0 across `execute()`; PDA included as writable in `ExtraAccountMetaList` so Solana's account-write exclusivity prevents recursive entry on the same tx.
- **Versioned audit event** — `MetaHookAuditEvent { version: 1, mint, source, destination, amount, policy_count, final_decision, failed_policy_index }`. The `failed_policy_index` is the AND short-circuit position in `MetaHookConfig.policies` (or `-1` on approval). Versioned in-band so future schema bumps don't silently break clients.
- **Anchor v0.32.1** workspace; `anchor-spl::token_2022_extensions`; `spl-transfer-hook-interface` 0.10; `spl-tlv-account-resolution` 0.10. `Cargo.toml` profile.release: `lto="fat"`, `codegen-units=1`, `overflow-checks=true`.
- **Bundled provision** — all 8-12 setup instructions land in a single signTransaction call (1156 bytes serialized for the 2-policy demo, 76 bytes under the 1232-byte legacy limit). Bypasses Phantom's drainer-pattern detector. Phase 2 → V0 transactions with Address Lookup Tables for >2 policies.
- **HTTP-poll confirmation** — `getSignatureStatuses` + `lastValidBlockHeight` + `finalized` blockhash + 1000 microLamports/CU priority fee. Avoids both WebSocket-blocked networks and blockhash-expiry races during Phantom signing latency.
- **End-to-end:** Anchor integration tests pass on local validator (regenerated for V1.1 config flow); live demo verified via puppeteer harness on devnet — provision → expect-fail → add-allowed → retry-success → audit event decoded with `final=true`.

## What makes this a public good

- **MIT licensed** ([LICENSE](./LICENSE))
- **Public policy interface** ([POLICY_INTERFACE.md](./POLICY_INTERFACE.md)) — anyone can ship a child policy in ~200 lines of Rust and have any MetaHook deployment compose it. Two reference implementations included; six suggested-but-unbuilt ideas listed in the spec.
- **No rent extraction** — no fee on the meta-hook itself; issuers run their own deployments
- **Devnet-deployed** so the next builder can fork + redeploy without standing up infra

## Sponsor integration depth (audited honestly)

| Sponsor | Depth | Notes |
|---|---|---|
| **Phantom** | 3/5 | Connect + bundled signTransaction + signMessage on every successful transfer (issuer-signed off-chain receipt binding the on-chain audit event to the issuer's key) |
| **Helius** | 3/5 | Devnet RPC for all reads/writes; key referrer-restricted to `yonkoo11.github.io`; footer surfaces active provider |
| **Squads** | 2/5 | Pattern documented for production policy-authority management (in flight) |
| **GoldRush (Covalent)** | SKIP | Devnet not supported; would be name-drop only. Honesty over inflated track count. |
| **SNS (Bonfida)** | 3/5 | Third reference policy `policy-sns-allowlist` deployed to devnet — gates Token-2022 transfers on `.sol` domain ownership via direct SNS NameRecord reads. Sidetrack submission. |
| **Adevar Labs** | n/a | Submission to the $50K security audit credits sidetrack — we are the audit subject, not the integrator. Three production-ready Anchor programs + reentrancy guard + 7/7 integration tests + CPI-depth analysis. |
| **Dune Analytics** | 3/5 | Public Dune dashboard decoding `MetaHookAuditEvent` from program logs across all MetaHook deployments. Sidetrack submission. |

Full audit + commitments + acceptance tests in [`ai/sponsor-integration.md`](./ai/sponsor-integration.md).

## Technical disclosure (Frontier rules section 4)

This project includes conceptual learning from [Verigate](https://github.com/yonkoo11/verigate) (RWA Demo Day, BSC, BAS attestations, 7 contracts + 75 tests). All Solana / Rust / Token-2022 code is new. Different VM (BSC = EVM; Multi-Hook = Solana SVM), different language (Solidity vs Rust), no code lifted.

## One memorable takeaway

> Token-2022 launched the transfer hook extension in 2024. Until now,
> shipping production compliance with it meant either (a) writing a single
> bespoke hook per mint or (b) buying into Anchorage / Fireblocks /
> Securitize at $500K+ vendor contracts (per BlackRock BUIDL launch March 2024). Multi-Hook is the missing piece: a meta-hook
> that lets you compose existing policy primitives into a custom compliance
> stack the same way you compose middleware in Express. Fork a child policy,
> deploy, append to your `ExtraAccountMetaList`, and you've added a new
> compliance rule to a live mint without touching the hook's code.

## Repo layout

```
programs/
  metahook/                  Anchor program — fallback dispatcher + audit event
  policy-allowlist/          Reference child policy 1
  policy-sanctions-ofac/     Reference child policy 2
tests/
  transfer-hook.ts           7 integration tests (anchor test)
app/                         Vite + TS frontend (live demo)
scripts/
  phantom-e2e.mjs            Real-Phantom puppeteer harness
docs/                        Built site (GitHub Pages source)
POLICY_INTERFACE.md          Public spec for ships-your-own-policy
LICENSE                      MIT
ai/                          Project memory + design + sponsor plan
```

## Build + run locally

```bash
# Anchor programs
anchor build
anchor test                  # 7/7 should pass

# Frontend (live-reload)
cd app
npm install
npm run dev                  # opens http://127.0.0.1:5173

# Production build → ../docs/ for GitHub Pages
npm run build
```

Set `VITE_HELIUS_KEY=<your_devnet_key>` in `app/.env` for the higher-tier
RPC; the dApp falls back to public devnet without it.

## License

MIT. Build with this. Ship your own policies. Open issues with what you
need.
