# Fix Plan — Multi-Hook V1

Phase 1 Gate tasks first. Don't move past one until binary success test passes.

## Phase 1 (core action — this is the BLOCKING gate)

- [ ] **Task 1.1:** Set up Anchor v0.31 workspace at `~/Projects/multihook/programs/`
  - `anchor init metahook --javascript`
  - Add `anchor-spl = { version = "0.31", features = ["token_2022_extensions"] }` to Cargo.toml
  - Acceptance: `anchor build` succeeds

- [ ] **Task 1.2:** Implement minimal `metahook` transfer-hook program
  - Single instruction: `execute(amount: u64)` matching Token-2022 transfer-hook interface
  - Reads ExtraAccountMetaList account for child policy list
  - Hardcoded V1: assume `[allowlist_program, sanctions_program]` with AND aggregation
  - Acceptance: program compiles + Anchor IDL generates

- [ ] **Task 1.3:** Implement `policy-allowlist` child program
  - Maintains a PDA account `Allowlist { authority, allowed_addresses: Vec<Pubkey> }`
  - Single instruction: `check_transfer(source, dest, amount)` → returns `Ok` or `Err(NotAllowed)`
  - Admin instructions: `add_allowed(addr)`, `remove_allowed(addr)`
  - Acceptance: unit tests pass for add/remove/check

- [ ] **Task 1.4:** Implement `policy-sanctions-ofac` stub child program
  - Maintains a PDA account `OFACList { authority, sanctioned_addresses: Vec<Pubkey> }`
  - Same instruction shape as allowlist but inverted (revert if dest IS in sanctioned list)
  - Hardcoded V1: a few stub addresses
  - Acceptance: unit tests pass

- [ ] **Task 1.5:** Wire MetaHook to delegate to both child policies via CPI
  - In `execute(amount)`: parse account list → CPI to allowlist `check_transfer` → if Ok, CPI to sanctions `check_transfer` → if Ok, return Ok; else revert with policy name
  - Add reentrancy guard PDA on MetaHook (claim mutex on entry; release on exit)
  - Acceptance: integration test in tests/transfer-hook.ts validates both pass and fail paths

- [ ] **Task 1.6:** Mint Token-2022 with MetaHook configured + extra account meta list
  - TypeScript script at `tests/setup-mint.ts`: create Token-2022 mint with `TransferHook` extension pointing to MetaHook program
  - Initialize ExtraAccountMetaList with `[allowlist_program_id, sanctions_program_id]`
  - Acceptance: `solana account <mint>` shows mint with TransferHook extension

- [ ] **Task 1.7:** Phantom-signed devnet demo
  - Minimal HTML/TS page that connects Phantom, signs a transfer of the Token-2022 token
  - Two scenarios: dest IS allowlisted (succeeds) / dest NOT allowlisted (reverts with allowlist policy error)
  - Acceptance: open browser, click, see transfer succeed or fail with policy name in error

- [ ] **Task 1.8:** Audit log event schema + emission
  - In MetaHook execute, emit `MetaHookAuditEvent` after each policy delegation
  - Verify event visible in Solscan / `getTransaction`
  - Acceptance: transaction logs show `MetaHookAuditEvent` with policy results

**Phase 1 PASS criterion:** Tasks 1.1-1.8 all green. Demoable end-to-end on devnet via Phantom. Stop here and tag `v0.1-phase1-pass` before continuing.

---

## Phase 2 (data flows)

- [ ] **Task 2.1:** Helius RPC integration (replace public devnet endpoint)
- [ ] **Task 2.2:** Persistent allowlist storage (vs hardcoded V1)
- [ ] **Task 2.3:** OFAC list integration — pull from Treasury OFAC API on a schedule, hash + store on-chain
- [ ] **Task 2.4:** Test 5 known-malicious transfer scenarios end-to-end

---

## Phase 3 (product complete)

- [ ] **Task 3.1:** Reference recipe: regulated-stablecoin example (full deployable scaffold + README)
- [ ] **Task 3.2:** TypeScript SDK (`@multihook/sdk`) with `MetaHook.compose([allowlist, sanctions])` API
- [ ] **Task 3.3:** Anchor IDL bindings + npm package
- [ ] **Task 3.4:** Demo UI (clean, minimal — Phantom connect + 3-step demo flow)
- [ ] **Task 3.5:** README + architecture diagram + threat model section

---

## Phase 4 (polish + submission)

- [ ] **Task 4.1:** Landing page on GitHub Pages
- [ ] **Task 4.2:** Demo video (3 min) — historical replay of WU USDPT-style compliance scenario
- [ ] **Task 4.3:** Technical overview video
- [ ] **Task 4.4:** Submit via arena.colosseum.org with Public Goods Award track
- [ ] **Task 4.5:** Section 4 disclosure (Verigate conceptual learning, no code lifted)
- [ ] **Task 4.6:** Update `~/Projects/IDEAS-SUMMARY.md` outcome tracking + `~/Projects/hackathon-winners/DATABASE.csv` row

---

## Completed
(builder fills this in)
