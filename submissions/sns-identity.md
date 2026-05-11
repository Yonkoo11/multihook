# SNS Identity Track — $5K Sidetrack

**Track:** SNS Identity Track Colosseum Hackathon (powered by SNS, STMY...)

---

## Why Multi-Hook fits this track
The SNS Identity Track wants projects that use Solana Name Service as a first-class identity primitive. Multi-Hook ships a **third reference policy program** that gates Token-2022 transfers on whether the recipient owns an authorised `.sol` domain — meaning RWA issuers can express compliance rules in terms of human-readable domain ownership instead of raw pubkey allowlists.

## The integration

### Program: `policy-sns-allowlist`
Deployed on Solana devnet at `4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo` (verifiable via `solana program show ... --url devnet`).

Source: `programs/policy-sns-allowlist/src/lib.rs` (~150 lines of Rust).

### What `check_transfer` does
Three independent guards:
1. **Account-ownership check**: the passed SNS NameRecord account must be owned by the canonical Bonfida program (`namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX`). The program ID is hardcoded as a 32-byte literal so an attacker cannot substitute a malicious "name service" that always returns the right owner.
2. **Allowlist membership**: the NameRecord PDA must be on the issuer's authorised-domains set (stored in the `SnsAllowlist.domains` Vec). The issuer authorises `.sol` domains by their derived NameRecord PDA — opaque on-chain, mapped to human-readable names by the issuer's UI.
3. **Owner equality**: the NameRecord's `owner` field (offset 32..64 of the SNS account layout) must equal the destination token-account's owner. **This defeats historical-control replays** — someone who used to own `alice.sol` cannot accept transfers on its behalf after losing the domain.

### Why no CPI to Bonfida
We **read the SNS account directly** rather than CPI'ing into the SNS program. This preserves the meta-hook's CPI depth budget (already at 3/4 levels: Token-2022 → metahook → child policy). The hardcoded ownership check is the spoof defense.

### What this unlocks for issuers
- "Allow transfers to anyone who owns a `.sol` domain in our authorised set"
- "Allow transfers to anyone whose `.sol` domain is registered to a verified institutional address"
- "Compose with `policy-allowlist`: require BOTH a raw-pubkey allowlist match AND a domain-ownership match"

### Spec referenceable by other policies
`policy-sns-allowlist` is documented in `POLICY_INTERFACE.md` as the worked example of the "compose with an external program" pattern — the second pattern after the standalone `policy-allowlist`. Anyone reading the spec to ship their own policy now has a Bonfida-integrated reference to crib from.

## V1.1 update — slotting SNS into a live mint takes ONE call
As of V1.1 (commit `a6485dc`), the meta-hook reads its policy set from a per-mint `MetaHookConfig` PDA at every transfer. Adding SNS as a third policy on a live MetaHook'd mint is now a single `metahook::add_policy({ programId: <SNS_POLICY_ID>, policyPda: <SNS_PDA> })` call (authority-gated) followed by re-init of the ExtraAccountMetaList. **No fork of the meta-hook required.** The hardcoded V1 limitation is gone.

The on-chain demo at `https://yonkoo11.github.io/multihook/demo/` still ships the 2-policy stack [allowlist, sanctions] for the standard demo flow because the bundled provision tx is at 1156/1232 bytes — adding SNS as a third pre-provisioned policy needs Versioned Transactions + ALT to fit (Phase 2 fast follow). Issuers wiring SNS into their own deployments are not size-constrained because they can provision in two txs.

## What's NOT yet shipped
- SNS-integrated UI flow on the demo page (the SNS allowlist mutation surface is documented but not exposed in the demo's HTML — issuers using the policy programmatically follow the spec).
- Production-grade SNS NameRecord verification at `add_allowed_domain` time (V1 stores opaque PDA bytes; ideally we'd require the NameRecord account at add time and verify owner + ownership in the same tx).
- The live demo flow does not visually demonstrate the SNS policy in action. The proof is in `programs/policy-sns-allowlist/src/lib.rs:88-110` (the triple-bind security check) + the deployed program ID being verifiable on Solscan.

## Repo
https://github.com/Yonkoo11/multihook (MIT)
SNS policy: https://github.com/Yonkoo11/multihook/tree/master/programs/policy-sns-allowlist

## Demo
https://yonkoo11.github.io/multihook/ (live demo uses the 2-policy stack; SNS policy is the reference for issuers extending the system)
