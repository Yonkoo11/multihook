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

## What we did NOT do
- We did NOT integrate SNS resolution into the live demo's two-policy provisioning flow — that would require redeploying the `metahook` program to expand its `ExtraAccountMetaList` from 2 policies to 3, which would invalidate existing demo state on devnet. The SNS policy is shipped as a standalone reference + spec entry instead. An issuer wiring SNS into their own MetaHook deployment follows the documented pattern.

## Repo
https://github.com/Yonkoo11/multihook (MIT)
SNS policy: https://github.com/Yonkoo11/multihook/tree/master/programs/policy-sns-allowlist

## Demo
https://yonkoo11.github.io/multihook/ (live demo uses the 2-policy stack; SNS policy is the reference for issuers extending the system)
