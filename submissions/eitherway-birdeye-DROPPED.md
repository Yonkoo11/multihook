> ⛔ **DROPPED** — see Note at the top of this file. Original analysis preserved below for reference / V2 mainnet activation path.

---

# Eitherway — $20K (Birdeye angle)

**Track:** Build Live dApp with Solflare, Kamino, DFlow, Quicknode or Birdeye on... (Eitherway, $20,000 USDC)

---

## Why Multi-Hook chose Birdeye out of the 5 sponsor options
- **Solflare**: alternate wallet adapter — depth 2 swap of the existing Phantom-only flow; doesn't enrich the product
- **Kamino**: lending — Token-2022 with a custom transfer hook doesn't compose cleanly with Kamino without their team's integration support; scope mismatch in 2 days
- **DFlow**: DEX aggregator — same Jupiter problem (transfer hook program must be whitelisted by the aggregator)
- **Quicknode**: alt RPC — we already shipped Helius (depth 3); doubling up looks like prize-chasing
- **Birdeye**: token data API — unique fit for showing that a Token-2022 mint with a custom transfer hook **shows up in mainstream Solana indexers with normal price/volume/holder metrics**. The strongest "this composes with the existing ecosystem" proof we can ship.

## The integration

### Code
Path: `app/src/analytics-birdeye.ts`

Two parallel endpoints called per page load (when a mainnet mint is configured):
1. `GET /defi/token_overview?address={mint}` → price, 24h price change, market cap, liquidity, 24h USD volume, holder count
2. `GET /defi/history_price?address={mint}&address_type=token&type=1H&time_from=...&time_to=...` → 24-hour hourly closes for the inline SVG sparkline

Both calls via `fetch` with `X-API-KEY` and `x-chain: solana` headers. CORS confirmed permissive (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: x-api-key,x-chain`) so client-side calls work directly.

Defensive handling: Birdeye returns HTTP 200 with `success: false` for unrecognised mints (e.g. mint exists but has no liquidity pool). Surfaced as "no market data on Birdeye yet" placeholder rather than a crash.

### UI integration
Path: `app/src/analytics-render.ts` — the Birdeye panel is the middle of three in the analytics grid. 6 stat tiles (price, 24h change with sign-coloured indicator, market cap, liquidity, 24h volume, holders) over an inline SVG sparkline. Tabular nums + Crimson Pro serif headings + the same Customs Pipeline visual system as the rest of the dApp.

### Why this is depth 3-4
- Two non-trivial parallel API calls
- Custom SVG sparkline rendering from price-history points (no chart library dependency)
- Sign-coloured 24h change indicator with positive/negative semantic styling
- Stat-tile grid that adapts to 3-column on desktop, 2-column on tablet, 1-column on mobile
- Defensive `success: false` handling for indexed-but-illiquid mints
- Domain-restricted API key flow (free tier API key, restricted to `yonkoo11.github.io` referrer in the Birdeye dashboard)

## Honesty caveat (devnet vs mainnet)
Birdeye's coverage is mainnet only (devnet token data isn't indexed). The integration code is **shipped in the bundled live demo**, but the panel currently shows the configure-to-activate placeholder because no mainnet mint is configured (`VITE_MAINNET_MINT` unset).

Activation path:
1. Mainnet deploy of the 3 core programs (queued, SOL pending)
2. Create a mainnet Token-2022 mint protected by MetaHook
3. (Optional but ideal) Seed minimal liquidity so Birdeye's market data tiles show real numbers; if no liquidity, holder count + supply still render
4. Set `VITE_MAINNET_MINT` + `VITE_BIRDEYE_KEY` in `app/.env`
5. Rebuild + push → Birdeye panel lights up

## Repo
https://github.com/Yonkoo11/multihook (MIT)
Birdeye wrapper: https://github.com/Yonkoo11/multihook/blob/master/app/src/analytics-birdeye.ts

## Demo
https://yonkoo11.github.io/multihook/ (analytics section visible; Birdeye panel activates upon mainnet configuration)
