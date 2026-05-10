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

## What's audit-ready today
1. **3 production-shape Anchor programs** in active live demo:
   - `metahook` `4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d` — fallback dispatcher + CPI orchestration + audit event
   - `policy_allowlist` `GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn`
   - `policy_sanctions_ofac` `5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt`
2. **Reentrancy guard** at `9kfFCZTqLtCRnRwQ4EHWXrZzFSw5Ky3Q68B6BgbA8W5r` — byte-flip 0→1→0 across `execute()`; PDA marked writable in `ExtraAccountMetaList` so Solana's account-write exclusivity prevents recursive entry on the same tx
3. **7/7 anchor integration tests pass** on local validator (`tests/transfer-hook.ts`)
4. **End-to-end live verified** via puppeteer + real Phantom CRX harness (`scripts/phantom-e2e.mjs`) — provision → expect-fail → add-allowed → retry-success → audit event decoded with `final=true`
5. **Public spec** (`POLICY_INTERFACE.md`) defining the third-party policy contract — the audit scope extends to "what guarantees does an issuer have that a policy following this spec is safely composable?"

## Specific concerns we'd want an audit to address
- **Fourth-policy attack surface**: `metahook` hardcodes the two reference policy program IDs in V1 as a safety check. We document this is lifted in V2 to a config account. Audit should confirm V1's hardcoding is sufficient defense and V2's config-account design preserves it
- **Account-meta resolution edge cases**: ExtraAccountMetaList is the load-bearing structure that the Token-2022 program uses to forward accounts. Edge cases around incorrect/missing/duplicate accounts — does the meta-hook fail-closed?
- **Reentrancy guard correctness**: the byte-flip pattern works on the assumption that Solana's account-write exclusivity is total. Confirm this assumption holds across all CPI shapes the meta-hook might encounter
- **Compute budget exhaustion**: 33,346 CU at 2 policies; what happens at 6+ policies if we approach the 200K Token-2022 budget? Does any path silently degrade vs revert?
- **Authority migration risk**: `Allowlist.authority` is a single Pubkey; documented production pattern is Squads multisig (`POLICY_AUTHORITY.md`). Audit should confirm there's no path to mutate the authority field outside of the documented governance flow

## Repo
https://github.com/Yonkoo11/multihook (MIT)

## Demo
https://yonkoo11.github.io/multihook/

## Disclosure
This project includes conceptual learning from Verigate (RWA Demo Day, BSC, BAS attestations, 7 contracts + 75 tests). All Solana / Rust / Token-2022 code is new.
