# Dune Analytics — $6K Frontier Data Sidetrack

**Track:** Dune Analytics | Frontier Data Sidetrack — Win $6K Plan

---

## Why Multi-Hook fits this track
The Dune track wants Frontier projects that surface **on-chain compliance signal that no other indexer captures**. Multi-Hook emits a custom Anchor event `MetaHookAuditEvent` on every successful Token-2022 transfer that includes per-policy verdicts (allowlist pass, sanctions pass, final decision). **Every other Solana indexer drops these `Program data:` log lines on the floor.** Dune's flexibility for custom SQL on raw program logs makes it the only indexer where this signal can live.

## The integration

### SQL source (load-bearing artifact)
Path: `dune/audit_events.sql` (in the repo)

This query:
1. Filters `solana.transactions` to txs that involve the metahook program ID (`4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d`)
2. Unpacks the `log_messages` array, isolating lines starting with `Program data: `
3. Base64-decodes the payload (TrinoSQL `from_base64`)
4. Filters on the 8-byte Anchor event discriminator for `MetaHookAuditEvent` (drops other emitted events that might collide)
5. Decodes the borsh-serialized payload byte-by-byte:
   - `bytes 0..8` discriminator
   - `bytes 8..40` mint Pubkey
   - `bytes 40..72` source Pubkey
   - `bytes 72..104` destination Pubkey
   - `bytes 104..112` amount u64 little-endian
   - `bytes 112` allowlist_pass bool
   - `bytes 113` sanctions_pass bool
   - `bytes 114` final_decision bool
6. Emits a materialised verdicts row per successful transfer

Comments in the SQL file include 3 starter dashboard tile queries:
- Verdict pass-rate trend per day
- Top mints by transfer volume
- Recent rejects (compliance flags)

### Dashboard
Once mainnet deployment lands and the dashboard is published on Dune, the embed URL goes into `VITE_DUNE_DASHBOARD_URL` and the live demo's "Live mint analytics" section iframes it directly under the GoldRush + Birdeye panels.

### Why this is depth 4
- Custom byte-level decoding of an Anchor event from raw `log_messages`
- Pinned discriminator to defeat event-collision attacks
- Materialised-view shape designed for downstream dashboard composition
- Public, readable, zero rent-extraction — anyone running a MetaHook deployment gets free transparency analytics

## Honesty caveat (devnet vs mainnet)
Dune's Solana data tables index mainnet only. As of submission, the SQL is **written and reviewed but the dashboard is not yet populated** — populating it requires the mainnet deploy of the 3 core programs (`metahook` + the 2 wired policies) plus a real successful transfer to generate the first audit event. The mainnet deploy is queued; SOL allocation pending; dashboard URL will be filled in `app/.env` (`VITE_DUNE_DASHBOARD_URL`) and pushed to GitHub Pages once the first event lands.

The SQL itself is independent of mainnet readiness — it is published in the repo today, public, MIT-licensed, and would activate the moment any party deploys MetaHook to Solana mainnet.

## Repo
https://github.com/Yonkoo11/multihook (MIT)
SQL: https://github.com/Yonkoo11/multihook/blob/master/dune/audit_events.sql

## Demo
https://yonkoo11.github.io/multihook/ (the analytics section's Dune panel currently shows the configure-to-activate placeholder; activates upon mainnet deploy)
