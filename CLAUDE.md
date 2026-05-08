# Multi-Hook — Claude Build Instructions

**Vibecoder mode active.** Plain English. No dev jargon when reporting to user. Auto-save (`git add .` + commit) after every meaningful change. Describe changes by what works in the demo, not what files moved.

---

## Phase 1 Gate (BLOCKING — read ai/memory.md for full spec)

**Core Action:** Token-2022 mint with MetaHook → 2 child policies (allowlist + sanctions) → AND aggregation → revert on policy fail / success on policy pass / audit log emitted. Devnet. Phantom-signed.

**Success Test (binary):**
- Connect Phantom on devnet
- Mint Token-2022 with MetaHook configured for `[allowlist, sanctions]` AND
- Transfer to non-allowlisted wallet → reverts with `policy.allowlist.fail`
- Add destination to allowlist
- Retry transfer → succeeds, audit-log event emitted

If you can't demo this end-to-end on devnet via Phantom, Phase 1 is NOT passed. No moving on.

---

## Build order (HARD RULE)

1. Core action E2E (this Phase 1 Gate)
2. Real data flows (Helius RPC, persistent allowlist, OFAC integration)
3. Product complete (1 reference recipe, IDLs, TS SDK, all submission deliverables)
4. Visual polish LAST (landing page, demo video, README polish)

**Don't skip phases. Don't do CSS before Phase 1 passes. Don't write the demo video script before the demo actually works.**

---

## Required tech

- **Anchor v0.31** + `anchor-spl::token_2022_extensions`
- **Token-2022 program** (transfer-hook + permanent-delegate)
- **Helius devnet RPC**
- **Phantom Connect**
- **TypeScript SDK** for client side
- **GitHub Pages** for any static hosting (NEVER Netlify/Vercel — see global CLAUDE.md)

---

## Hard architecture constraints (from verifications 2026-05-08)

- **CPI depth ≤ 4 levels.** MetaHook → child-policy = 2 levels. Policy → external (KYC oracle, OFAC API) = 3 levels. **You have 1 level of headroom.** Keep child-policy CPIs FLAT (sibling, not nested). Don't let a child policy itself CPI through more than 1 layer.
- **Reentrancy class bugs documented in Token-2022 transfer hooks.** MUST include reentrancy lock in MetaHook before policy delegation. Block re-entry from child policies into the originating mint's transfer.
- **Compute unit budget.** Each child policy CPI adds ~5K-20K CU. Cap V1 at 2 policies + meta-hook overhead = ~50K CU per transfer. If demo transfer exceeds 200K CU, optimize before adding more policies.
- **Confidential transfers + transfer hooks: incompatible upstream.** V1 does NOT use confidential transfers. Don't try.

---

## Naming conventions

- Program: `metahook` (lowercase, PascalCase struct: `MetaHook`)
- Child policy programs: `policy-<name>` (e.g. `policy-allowlist`, `policy-sanctions-ofac`)
- Aggregation modes: `Aggregation::And` (V1), `Aggregation::Or` (V2), `Aggregation::Weighted` (V2)
- Audit log: `MetaHookAuditEvent` with fields `(mint, source, dest, amount, policy_results, final_decision)`

---

## Disclosure (Frontier rules Section 4)

This project includes conceptual learning from `~/Projects/verigate` (RWA Demo Day, BSC, BAS attestations). NO Solidity code is lifted; all Solana/Rust/Token-2022 code is new. Submission form must declare this.

---

## Submission deliverables

By May 11 11:59pm PT (deadline):
- [ ] GitHub repo (public preferred; private OK if shared with hackathon@colosseum.org)
- [ ] 3-min presentation video
- [ ] Technical overview video
- [ ] Submission via arena.colosseum.org
- [ ] Tracks selected: Public Goods Award (primary), RWA (secondary if available), Infrastructure
- [ ] Logo + project description
- [ ] Team list (solo: just user)

---

## Reference

- Idea source: this session's deliberation; AI-generated as elaboration of IDEAS-SUMMARY #88
- Past Cypherpunk RWA winners (reference): Autonom (RWA 1st), Bore.fi, Legasi, Pencil Finance, Watchtower
- Past Public Goods winners (reference): Samui Wallet, IDL Space, Attest Protocol, Zircon — all SHIPPED USABLE PRODUCTS at demo time, not 150-line primitives
- File: `~/Projects/IDEAS-SUMMARY.md` line 69 (#88) and `~/Projects/real-problems-and-products.md` lines 3071-3079 (Part 31 Solana Token Extensions for RWA)
- Winners DB: `~/Projects/hackathon-winners/` (ARCHETYPES.md A7 + A4)
