# Policy Interface — Ship Your Own Child Policy

Multi-Hook is a meta-hook. The MetaHook program doesn't decide whether a
transfer is allowed — it delegates to N child policy programs and aggregates
their verdicts. **Anyone can ship a child policy.** This document is the
public spec for that interface.

This is what makes Multi-Hook a public good vs a one-off demo: you can fork
a child policy template, swap the rule, deploy, and have an existing meta-
hook compose it without touching the hook code.

---

## TL;DR

Your child policy is a Solana program with a single `check_transfer`
instruction. MetaHook calls it via CPI for every transfer. Returning `Ok`
means "approve from my perspective"; returning `Err(YourError)` with the
revert string `"policy.<your_name>.fail: <human_reason>"` means "block".

The MetaHook AND-aggregates verdicts in V1. V2 adds OR / weighted modes.

---

## Required instruction: `check_transfer`

### Signature

```rust
pub fn check_transfer(
    ctx: Context<CheckTransfer>,
    amount: u64,
) -> Result<()> {
    // Your rule here. Read source/dest/amount, decide, return Ok or Err.
}
```

### Account context

The MetaHook hands your program these accounts in this order via CPI:

| Index | Account | Meaning | Mut/Sign |
|-------|---------|---------|----------|
| 0 | `source` | Source ATA (TokenAccount, Token-2022 program) | read |
| 1 | `mint` | The Token-2022 mint being transferred | read |
| 2 | `destination` | Destination ATA (TokenAccount, Token-2022 program) | read |
| 3 | `owner` | Source ATA's owner (who initiated the transfer) | read |
| 4 | `your_pda` | YOUR policy state PDA (whatever you defined) | read or read-write per your needs |

You are free to add MORE accounts after index 4 — but you must register them
in your policy's published "extra accounts" list so MetaHook integrators
know to forward them when they wire your policy into their meta-hook config.

### Returning a verdict

**Approve:** `Ok(())`. The MetaHook proceeds to the next policy in the chain.

**Block:** Return an `AnchorError` whose `msg` follows the format:

```
policy.<your_policy_name>.fail: <human-readable reason>
```

Examples used by the V1 reference policies:
- `policy.allowlist.fail: destination not on allowlist`
- `policy.sanctions.fail: destination is sanctioned`

The `policy.<name>.fail:` prefix is the load-bearing part. MetaHook clients
parse this to surface the failure reason in UI without needing to decode
your program's error enum. Pick a stable `<name>` and never change it.

```rust
#[error_code]
pub enum YourPolicyError {
    #[msg("policy.your_name.fail: <reason>")]
    BlockedReason,
}
```

---

## PDA convention

Every child policy's state PDA SHOULD use this seed pattern so MetaHook UIs
can derive it without per-policy config:

```rust
seeds = [b"<your-policy-name>", authority.key().as_ref()],
```

Examples:
- `[b"allowlist", authority.key().as_ref()]`
- `[b"ofac-list", authority.key().as_ref()]`
- `[b"balance-cap", authority.key().as_ref()]`

The `<your-policy-name>` should match the prefix in your error message
(`policy.<name>.fail`) for grep-ability.

---

## Authority instructions (recommended)

Most policies need admin instructions to mutate state (add/remove allowed
addresses, etc.). Convention:

```rust
pub fn initialize(ctx: Context<Init>) -> Result<()> { ... }
pub fn add_<thing>(ctx: Context<Authed>, item: Pubkey) -> Result<()> { ... }
pub fn remove_<thing>(ctx: Context<Authed>, item: Pubkey) -> Result<()> { ... }
```

Gate them with Anchor's `has_one = authority` constraint so only the policy
authority can mutate state.

---

## Wiring into a MetaHook deployment

Once your policy is deployed, an issuer wires it into their meta-hook by:

1. Including your **program ID** in the MetaHook's `ExtraAccountMetaList`
   for their mint
2. Including the **derived PDA** for their authority+your-program in the
   same list
3. Marking accounts as writable if your policy needs to mutate state
   per-transfer (most don't — only the reentrancy guard is writable in V1)

The MetaHook program reads the ExtraAccountMetaList during transfer-hook
dispatch and forwards each account in order. As long as your `check_transfer`
account context matches the order above (positions 0-4 fixed, 5+ flexible),
your policy slots in.

### Hardcoded program IDs (V1 limitation)

Note: V1 of MetaHook hardcodes the two reference policy program IDs in its
`process_execute` function as a safety check. Phase 2 lifts this to a config
account so arbitrary policies can be wired without redeploying MetaHook.
For now, third-party policies need to fork MetaHook and change these
constants. Phase 2 is a fast follow.

---

## Reference policy implementations

Three child policies live in this repo as worked examples — two wired into
the live demo metahook, plus a third that demonstrates the compose-with-an-
external-program pattern (SNS / Bonfida lookup):

| Path | Program ID (devnet) | What it does | External CPI? |
|------|---------------------|--------------|---|
| `programs/policy-allowlist/` | `GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn` | Approve only if destination owner is in allowlist set | No |
| `programs/policy-sanctions-ofac/` | `5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt` | Reject if destination owner is in sanctioned set (inverted allowlist) | No |
| `programs/policy-sns-allowlist/` | `4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo` | Approve only if destination owner controls one of the authorised `.sol` domains. Reads the SNS NameRecord account, checks ownership matches the destination, and verifies the NameRecord is owned by the canonical Bonfida program. | Reads SNS account directly (no CPI) — keeps depth budget intact |

Use `policy-allowlist` as the simplest scaffold to fork. Replace the
`is_allowed` check with your rule. Total surface area to ship a new
policy: ~200 lines of Rust. `policy-sns-allowlist` shows the slightly
larger pattern when your rule needs to consult an external account
(no CPI, just a direct read + an `account.owner == EXPECTED_PROGRAM_ID`
spoof check).

---

## Compute budget

Each child policy CPI costs ~5-20K CU. The current 2-policy V1 demo lands at
33,346 CU (16% of the 200K Token-2022 transfer budget). You have headroom
for ~6 more policies before bumping into limits. Beyond that, the right
move is per-policy gating (skip non-applicable policies) rather than
optimizing the policies themselves.

---

## Composability gotchas

1. **CPI depth ≤ 4.** Token-2022 invokes MetaHook (depth 2) which CPIs into
   your policy (depth 3). If your policy itself CPIs to an external program
   (oracle, attestation service), you have **1 level of headroom**.
   SIMD-0268 will raise the limit but isn't yet active. Keep child-policy
   external CPIs flat (sibling, not nested).

2. **Reentrancy.** MetaHook holds a reentrancy-guard PDA that's marked
   writable in the transfer's account list. Solana's account-write
   exclusivity prevents the same transfer from re-entering MetaHook. You
   don't need your own reentrancy guard — but you also can't bypass
   MetaHook's by initiating a fresh top-level transfer from inside your
   policy.

3. **Confidential transfers.** Token-2022's confidential-transfer extension
   is incompatible with transfer hooks upstream. You can't compose a
   confidential-aware policy until that lands.

---

## Submission checklist (before publishing your policy)

- [ ] Program ID is stable (don't redeploy after issuers depend on it)
- [ ] Error string follows `policy.<name>.fail: <reason>` format
- [ ] PDA seeds documented and follow `[b"<name>", authority]` convention
- [ ] Anchor IDL JSON published (so MetaHook UIs can decode + display)
- [ ] Compute budget measured (reported in your README)
- [ ] CPI depth disclosed if your policy itself makes CPIs
- [ ] Test against a MetaHook fork wiring your policy as the third position

---

## Policy ideas worth shipping

These are real RWA compliance needs that don't yet have child policies:

- **policy-balance-cap** — cap per-recipient amount in a rolling time window
- **policy-jurisdiction** — allow/deny based on attestation of geo + KYC
  level (requires off-chain attestor program at depth 4 budget)
- **policy-time-window** — only allow transfers during issuer-defined hours
- **policy-velocity** — block if total transferred-out in last N minutes
  exceeds threshold (rate-limit shape)
- **policy-fee-skim** — require a separate fee transfer to a recipient as
  part of the same tx
- **policy-attestation-vrfd** — require a Verigate / EAS / Sismo
  attestation be presented in the transaction

If you ship one, open a PR adding it to this doc's reference table.
