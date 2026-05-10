> ⛔ **DROPPED** — see Note at the top of this file. Original analysis preserved below for reference / V2 mainnet activation path.

---

# GoldRush (Covalent) — $3K Sidetrack

**Track:** Build with GoldRush Track (Powered by Covalent)

---

## Why Multi-Hook fits this track
Multi-Hook's live demo includes a **Live Mint Analytics** section that pulls token-holder + transaction-history data from the GoldRush API for any deployed mainnet mint protected by MetaHook. This is the canonical "show me everyone holding my compliance-gated token" view that RWA issuers actually want — and it's built on GoldRush's `solana-mainnet` endpoints.

## The integration

### Code
Path: `app/src/analytics-goldrush.ts`

Two parallel endpoints called per page load (when a mainnet mint is configured):
1. `GET /v1/solana-mainnet/tokens/address/{mint}/token_holders_v2/?page-size=50`
   → renders total holder count + top 5 by balance (with Solscan address links)
2. `GET /v1/solana-mainnet/address/{mint}/transactions_v3/?page-size=10`
   → renders recent 5 transactions with timestamp + verdict tag (ok/fail) + Solscan signature links

Both endpoints called via `fetch` with `Authorization: Bearer ${VITE_GOLDRUSH_KEY}`. CORS confirmed permissive (`Access-Control-Allow-Origin: *`) so the dApp calls the GoldRush API directly client-side without a proxy.

### UI integration
Path: `app/src/analytics-render.ts` — the GoldRush panel is the leftmost of three in the analytics grid. Loading state, error state, and empty state all handled defensively so a single API outage doesn't blank the section.

### Why this is depth 3
- Two non-trivial parallel API calls per load
- Custom rendering logic mapping GoldRush's response envelopes to the dApp's visual system (Customs Pipeline aesthetic — Crimson Pro serif headings, JetBrains Mono numerics, accent-tagged verdict pills)
- Defensive error/empty/loading states
- Domain-restricted API key flow (free tier API key, restricted to `yonkoo11.github.io` referrer in the GoldRush dashboard)

## Honesty caveat (devnet vs mainnet)
GoldRush's Solana coverage is mainnet only. The integration code is **written, type-checked, and shipped in the bundled live demo**, but the analytics section currently shows the configure-to-activate placeholder because no mainnet mint is configured yet (`VITE_MAINNET_MINT` unset).

Activation path:
1. Mainnet deploy of the 3 core programs (queued, SOL pending)
2. Create a mainnet Token-2022 mint protected by MetaHook
3. Run one successful transfer so the mint shows up in GoldRush's index
4. Set `VITE_MAINNET_MINT` + `VITE_GOLDRUSH_KEY` in `app/.env`
5. Rebuild + push → GoldRush panel lights up

The integration is depth 3 by code shipped, not by name-drop.

## Repo
https://github.com/Yonkoo11/multihook (MIT)
GoldRush wrapper: https://github.com/Yonkoo11/multihook/blob/master/app/src/analytics-goldrush.ts

## Demo
https://yonkoo11.github.io/multihook/ (analytics section visible; GoldRush panel activates upon mainnet configuration)
