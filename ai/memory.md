# Multi-Hook — Project Memory

**Locked:** 2026-05-08
**Hackathon:** Solana Frontier (Colosseum) — submissions close May 11, 2026 11:59pm PT
**User:** registered (pre-deadline May 4)

---

## Phase 1 Gate (MUST PASS BEFORE ANY OTHER WORK)

**Core Action:** A Token-2022 mint configured with the MetaHook program as its transfer hook successfully delegates a single transfer through 2 child policies (allowlist + sanctions OFAC), aggregates results (AND), and either succeeds or reverts based on policy outcome. Demonstrated on devnet with Phantom-signed transactions.

**Success Test (binary):**
1. Devnet: mint a Token-2022 token with `transfer-hook = MetaHookProgramID`, transfer-hook config account specifying child policies `[allowlist_program, sanctions_program]` with `aggregation = AND`
2. Connect Phantom; attempt `transfer(to=non-allowlisted-wallet)` → reverts with reason `policy.allowlist.fail`
3. Update allowlist to include destination
4. Retry same transfer → succeeds; on-chain audit-log event emitted with policy results

**Min Tech:**
- Anchor v0.31
- Token-2022 program (`anchor-spl::token_2022_extensions`)
- Helius devnet RPC
- Phantom Connect

**NOT Phase 1:**
- Confidential transfers integration (file line 3077: incompatible with transfer hooks "yet")
- Mainnet deployment
- 5 reference recipes (V1 ships 1: regulated stablecoin)
- Web UI design (V1 ships minimal demo UI)
- Time-window / jurisdiction / balance-cap / fee policies (defer to V2)
- Multi-aggregation modes (V1: AND only; OR/weighted later)
- Cross-issuer attestation reuse (V2)

**Status:** [x] PHASE 1 GATE PASSED end-to-end on Solana devnet (2026-05-09).
- Logic: 7/7 integration tests pass on local validator (2026-05-08).
- Phantom demo: live at https://yonkoo11.github.io/multihook/
- Verified end-to-end via puppeteer on real devnet (FV3v…iKo9): provision tx, expect-fail tx (`policy.allowlist.fail` at depth 3), add-allowed tx, retry-success tx with MetaHookAuditEvent decoded (allowlist=pass, sanctions=pass, final=APPROVE), dest ATA balance = 100.
- All on-chain state owned by the connecting Phantom wallet (each user provisions their own allowlist + OFAC + mint), so the demo works for arbitrary visitors with no shared admin state.

**Verified 2026-05-08 via `anchor test`:**
- Token-2022 invokes metahook.execute via the SPL transfer-hook fallback discriminator
- metahook CPIs allowlist::check_transfer (depth 3), then sanctions::check_transfer (depth 3) — within the documented CPI ≤ 4 budget
- `MetaHookAuditEvent` emitted with discriminator [212,7,92,54,249,97,146,65]; appears as a `Program data:` line in tx logs after both children resolve
- Reentrancy guard byte at offset 8 of guard PDA flips 0→1→0 across execute(); also embedded in ExtraAccountMetaList as writable so any recursive entry would fail Solana's account-write exclusivity check

**Program IDs (devnet + localnet):**
- metahook: `4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d`
- policy_allowlist: `GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn`
- policy_sanctions_ofac: `5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt`

**Build artifacts:** `target/deploy/{metahook,policy_allowlist,policy_sanctions_ofac}.so` + IDL JSON in `target/idl/`. Already deployed to devnet during early debug runs (program upgrades are authority-gated; same wallet redeploys).

**Compute budget observed:** entire transfer-with-hook consumed 33,346 / 200,000 CU on Token-2022, of which metahook used 17,370 CU and each child ~2,100 CU. Plenty of headroom for V2 policies.

---

## Hackathon context

**Frontier:** Apr 6 – May 11, 2026. 17,134+ builders. $250K+ prizes ($30K Grand + $10K Public Goods + $10K University + 20×$10K Standout).

**Target award:** Public Goods Award ($10K) primary; Standout Team ($10K) backup; Grand Champion ($30K) stretch.

**Judging criteria (from official rules Section 8):**
1. Functionality — does it work? Code quality?
2. Potential Impact — TAM / ecosystem impact?
3. Novelty — unique concept?
4. UX — leverages Solana's performance?
5. Open-source — composes with other primitives?
6. Business plan — viable scalable business?

**Sponsor partners:** Phantom, Altitude, World, Arcium, Reflect, Pentagon, MoonPay, Coinbase, Metaplex, Swig, LI.FI, Vanish, Privy, Condor.

**Required deliverables:**
- 3-min presentation video
- Technical overview video
- GitHub repo (private OK if shared with hackathon@colosseum.org)
- Submission via arena.colosseum.org

---

## Chosen idea

**Project name:** Multi-Hook (working name; rename if desired)
**Tagline:** OpenZeppelin for Token-2022 compliance
**Idea source:** AI-generated (this session) as elaboration of IDEAS-SUMMARY #88 Solana Token Extensions for RWA (Tier 1, promoted 2026-05-07)

**What it is:** A meta-hook program that lets RWA issuers compose multiple transfer-hook policies (KYC + sanctions + fees + jurisdiction + balance caps) onto a single Token-2022 mint. Single hook target → CPIs into N child policy programs → aggregates results → emits audit log.

**V1 deliverable:**
- `metahook` program (single-on-mint, delegates to children, aggregates AND)
- `policy-allowlist` child program
- `policy-sanctions-ofac` child program with stub OFAC list
- 1 reference recipe (regulated-stablecoin scaffold)
- Anchor IDL bindings
- TypeScript SDK (basic)
- Reentrancy guard
- Audit-log event schema

---

## Competitive landscape (verified 2026-05-08)

- **Civic** ([github.com/civicteam/token-extensions-transfer-hook](https://github.com/civicteam/token-extensions-transfer-hook)): Civic Pass single-policy hook. Production. NOT a composability framework.
- **Paxos USDP**: own permanent-delegate + transfer-hook stack. Proprietary.
- **Anchorage Digital + Fireblocks** (powering WU USDPT): proprietary integrated compliance stack.
- **Securitize** (powering BlackRock BUIDL): proprietary compliance framework.

**Gap:** no public open-source multi-hook composability layer. Each issuer ships a single bespoke hook. Smaller issuers without vendor relationships have no path.

---

## Fatal flaws (KNOWN — read before building)

1. **Adoption thin today.** Institutional issuers (WU, BlackRock, Paxos) have proprietary stacks. Real users = smaller Solana RWA issuers (sparse on Solana per file line 3077) + future agent-commerce. Bet on Solana RWA growing past institutional vendor stacks.
2. **CPI depth = 4 limit.** Token-2022 → MetaHook = 1 → child policy = 2 → policy's external CPI = 3 → 1 level of headroom. Architecture must keep child-policy CPIs FLAT (sibling, not nested). SIMD-0268 will raise to 8 but not yet active.
3. **Reentrancy bug class documented.** [DEV.to article](https://dev.to/ohmygod/solanas-token-2022-transfer-hooks-how-a-safe-feature-imported-ethereums-deadliest-bug-class-16p6) flags transfer hooks as "imported Ethereum's deadliest bug class." MetaHook MUST include reentrancy guards because it MULTIPLIES the attack surface.
4. **Confidential transfers incompatibility.** Per file line 3077, Token-2022 transfer hooks + confidential transfers are incompatible "yet." V1 cannot demo confidential. Stretch only if upstream fix lands.
5. **Compute unit budget.** Each child policy adds CU cost. Need cap per mint + skip-non-applicable optimization. V1 demo with 2 policies is tractable; V2 with 7 may need careful budgeting.

---

## Required tech

- **Anchor v0.31** (production-ready Token-2022 support; `anchor-spl::token_2022_extensions`)
- **Token-2022 program** (transfer-hook + permanent-delegate extensions)
- **Helius RPC** (devnet endpoint)
- **Phantom Connect** (wallet onboarding for demo)
- **Solana CLI** + **solana-test-validator** for local devnet
- **TypeScript SDK** for client integration
- **GitHub Pages** for landing page (per user CLAUDE.md hosting rule)

---

## Sponsor tools (signal Solana fluency)

- Phantom Connect (Adam Gutierrez = judge)
- Helius (RPC partner; potential webhook for audit-log events V2)
- Squads (stretch — issuer authority multisig demo)

---

## Build order (per CLAUDE.md global rule)

1. **Phase 1 (core action):** wallet → mint → 2-policy meta-hook → policy-driven transfer revert/success → audit log emit
2. **Phase 2 (data flows):** real Helius RPC, persistent allowlist account, OFAC list integration
3. **Phase 3 (product complete):** 1 reference recipe (regulated stablecoin), Anchor IDLs, TypeScript SDK, demo UI, all submission deliverables
4. **Phase 4 (polish):** landing page, demo video (3 min), README polish, technical overview video

---

## Pre-existing code disclosure (Frontier rules Section 4)

User has prior RWA work at `~/Projects/verigate` (BSC, BAS attestations, 7 contracts + 75 tests). Conceptually informs compliance patterns BUT:
- Different VM (BSC = EVM; Multi-Hook = Solana)
- Different language (Solidity vs Rust)
- No code lifted directly
- Verigate uses BAS (BSC Attestation Service); Multi-Hook uses pluggable attestor pattern

**Disclose in submission form: "Conceptual learning from Verigate (RWA Demo Day, BSC). All Solana/Rust/Token-2022 code is new."**

---

## Outcome tracking placeholder

Update both files post-hackathon (Phase 5 of `/hackathon` skill):
- `~/Projects/IDEAS-SUMMARY.md` Outcome Tracking table
- `~/Projects/hackathon-winners/DATABASE.csv` (add WIN-164+ row)
