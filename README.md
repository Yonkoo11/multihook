# Multi-Hook

> **OpenZeppelin for Token-2022 compliance.** One transfer hook, N composable
> child policies. Built for RWA issuers who shouldn't need a $200K vendor stack
> to ship a regulated stablecoin.

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
              │   metahook.execute   │ ← reentrancy guard PDA (writable)
              │  (fallback hook)     │
              └──────────────────────┘
                          │
                          ▼ [CPI x N, sequential, AND-aggregated]
        ┌─────────────────┴─────────────────┐
        ▼                 ▼                 ▼
  policy_allowlist  policy_sanctions  policy_<your_rule>
   check_transfer    check_transfer    check_transfer
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 ▼                 ▼
              Ok(())  ── or ──  Err("policy.<name>.fail: ...")
                          │
                          ▼ MetaHookAuditEvent { mint, src, dst, amount, allowlist_pass, sanctions_pass, final_decision }
                              emitted on success path; reverts roll back the event but
                              the policy reason still appears in tx logs for client display
```

## What's built (Phase 1 — submitted)

- **4 Anchor programs deployed to devnet:**
  - `metahook` `4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d` — fallback dispatcher + CPI orchestration + audit event
  - `policy_allowlist` `GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn` — set-membership check on destination owner
  - `policy_sanctions_ofac` `5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt` — inverted set-membership (OFAC-style stub list)
  - `policy_sns_allowlist` `4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo` — third reference policy: gates on whether the recipient owns an authorised `.sol` domain via Solana Name Service (Bonfida). Worked example of the "compose with an external program" pattern in [POLICY_INTERFACE.md](./POLICY_INTERFACE.md)
- **Reentrancy guard** at `9kfFCZTqLtCRnRwQ4EHWXrZzFSw5Ky3Q68B6BgbA8W5r` — byte at offset 8 flips 0→1→0 across `execute()`; PDA included as writable in `ExtraAccountMetaList` so Solana's account-write exclusivity prevents recursive entry on the same tx.
- **Anchor v0.32.1** workspace; `anchor-spl::token_2022_extensions`; `spl-transfer-hook-interface` 0.10; `spl-tlv-account-resolution` 0.10
- **Bundled provision** — all 7-10 setup instructions land in a single signTransaction call. Bypasses Phantom's drainer-pattern detector (rapid-fire multi-tx-after-trust-grant flagged the dApp as malicious in the original 4-tx flow — verified via puppeteer + Phantom CRX harness in `scripts/phantom-e2e.mjs`).
- **HTTP-poll confirmation** — `getSignatureStatuses` + `lastValidBlockHeight` instead of WebSocket subscription. Works on restrictive networks where wss:// is blocked.
- **End-to-end:** 7/7 anchor integration tests pass on local validator; live demo verified via puppeteer harness — provision → expect-fail → add-allowed → retry-success → audit event decoded with `final=true`.

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
> Securitize at $200K+ MSRP. Multi-Hook is the missing piece: a meta-hook
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
