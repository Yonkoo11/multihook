# Adevar Labs — $50K Security Audit Credits Sidetrack

**Track:** $50,000 in Security Audit Credits for Frontier Hackathon (Adevar Labs Inc.)

---

## Why Multi-Hook fits this track
Adevar's track awards audit credits to Frontier projects. Multi-Hook is exactly the kind of project that benefits from a professional audit:
- **4 Anchor programs deployed to Solana devnet**, MIT-licensed, designed to be extended by third parties
- Compliance-critical control flow (allowlist + sanctions verdicts gating real value transfers)
- Reentrancy-class attack surface explicitly addressed via a writable-PDA guard
- CPI depth budget consumed at 3/4, with documented headroom analysis
- Designed to be deployed by RWA issuers handling real money

We are the audit subject, not the integrator — this submission is built for the track's actual evaluation criteria.

## What's audit-ready today (V1.1)
1. **4 production-shape Anchor programs** deployed devnet:
   - `metahook` `4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d` — config-driven CPI dispatcher + audit event (V1.1 ships per-mint `MetaHookConfig` PDA — no hardcoded child program IDs)
   - `policy_allowlist` `GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn`
   - `policy_sanctions_ofac` `5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt`
   - `policy_sns_allowlist` `4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo` — third reference policy with triple-bind security check
2. **Reentrancy guard** at `9kfFCZTqLtCRnRwQ4EHWXrZzFSw5Ky3Q68B6BgbA8W5r` — byte-flip 0→1→0 across `execute()`; PDA marked writable in `ExtraAccountMetaList` so Solana's account-write exclusivity prevents recursive entry on the same tx
3. **7/7 anchor integration tests pass** on local validator (`tests/transfer-hook.ts`, V1.1 schema)
4. **End-to-end live verified on devnet** — `scripts/diagnose-transfer-flow.mjs` runs provision → reject → allow → approve → audit event against the deployed bytecode. Solscan-confirmed at `https://solscan.io/tx/3UgjEfRpgvZKeHvkjZtD6SXLv9wR34jgFNsDrP13jgvhZJBQ8naKooT7Tx93xLmUrSAYXmm85Wn6Au3Dbx72wPz6?cluster=devnet` (audit event `final=true failed_policy=-1` visible in tx logs).
5. **Public spec** (`POLICY_INTERFACE.md`) defining the third-party policy contract — audit scope should extend to "what guarantees does an issuer have that a policy following this spec is safely composable into a live MetaHook'd mint?"

## Specific concerns we'd want an audit to address
- **MetaHookConfig integrity**: V1.1 reads child policies from a per-mint config PDA. `process_execute` validates each `accounts[i].key` against `config.policies[i]` via `require_keys_eq!`. Confirm this validation is exhaustive and that no path lets an attacker pass a different program/PDA than configured.
- **`add_policy` / `remove_policy` authority gating**: `MutateConfig` uses Anchor's `has_one = authority` constraint. Confirm this can't be bypassed (e.g. via a forged signer position).
- **`initialize_extra_account_meta_list` signer requirements**: V1.1 still permits any payer to initialize a meta list for a mint that has a config. Confirm no privilege-escalation path through this.
- **Account-meta resolution edge cases**: ExtraAccountMetaList carries 2 + 2N entries (config + guard + N program/PDA pairs). Confirm fail-closed behavior on truncated/duplicate/wrongly-ordered account lists.
- **Reentrancy guard correctness**: byte-flip at offset 8 of a writable PDA. Assumes Solana's account-write exclusivity is total. Audit should confirm across all CPI shapes the meta-hook might encounter (including the new path where a child policy itself CPIs into another program at depth 4).
- **Audit event spoofing**: `MetaHookAuditEvent` is `emit!`'d (Anchor sol_log_data). The event is NOT cryptographically signed. Issuer-signed off-chain attestation happens in `app/src/main.ts:onTransferOk` via `wallet.signMessage` — confirm the signing payload binds the on-chain event uniquely (mint + tx sig + base64).
- **SNS triple-bind**: `policy-sns-allowlist::check_transfer` (lines 88-110) is the most complex single function. Three independent checks: NameRecord owned by Bonfida, NameRecord PDA in allowlist, NameRecord.owner == dest_owner. Verify each check is necessary and the combination is sufficient against historical-control replay attacks.
- **Compute budget**: ~33-40K CU at 2 policies. Confirm the path scales linearly to MAX_POLICIES (8) and reverts (not silently degrades) when the 200K Token-2022 budget is exhausted.
- **Authority migration**: `Allowlist.authority` / `OFACList.authority` / `SnsAllowlist.authority` / `MetaHookConfig.authority` are all single Pubkey fields. Documented production pattern is Squads multisig (`POLICY_AUTHORITY.md`). Audit should confirm no path mutates these fields outside the documented governance flow.

## Repo
https://github.com/Yonkoo11/multihook (MIT)

## Demo
https://yonkoo11.github.io/multihook/

## Disclosure
This project includes conceptual learning from Verigate (RWA Demo Day, BSC, BAS attestations, 7 contracts + 75 tests). All Solana / Rust / Token-2022 code is new.
