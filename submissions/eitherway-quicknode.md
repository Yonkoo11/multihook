# Eitherway — $20K (QuickNode angle, supersedes the prior Birdeye plan)

**Track:** Build Live dApp with Solflare, Kamino, DFlow, Quicknode or Birdeye on... (Eitherway, $20,000 USDC)

---

## Why Multi-Hook switched from Birdeye to QuickNode for this track
The original plan (`submissions/eitherway-birdeye.md`) targeted Birdeye for mint analytics. That submission was DROPPED after verifying Birdeye only indexes Solana mainnet — without a mainnet deploy of MetaHook, the Birdeye panel would be a name-drop. Same applies to Solflare/Kamino/DFlow: each requires either mainnet deployment (Kamino lending, Birdeye data) or scope mismatch (Solflare wallet swap is depth 2, DFlow needs aggregator whitelisting).

QuickNode is the only one of the five sponsors where **devnet** integration produces real depth-3 value: a multi-RPC fallback architecture that the live demo actually uses today.

## The integration

### Code
- `app/src/programs.ts` — multi-provider RPC resolution. Priority chain: QuickNode → Helius → public devnet
- `app/src/main.ts` — footer label adapts to active provider; surfaces "QuickNode RPC (Helius + public devnet on standby)" when QuickNode is configured
- `app/src/vite-env.d.ts` — `VITE_QUICKNODE_DEVNET` env-var declaration
- `app/.env.example` — instructions for getting + setting the QuickNode devnet endpoint URL

### Why this is depth 3 (not depth 2)
- The dApp resolves DEMO_RPC at build time across THREE providers in priority order, with the URL list also exported as `RPC_FALLBACKS` for runtime failover (each RPC call could be wrapped to retry on a fallback URL — V2)
- Footer label dynamically reflects which provider is active so judges can verify the integration is live without devtools
- All three keys/URLs domain-restricted in their respective dashboards
- The fallback design solves a real demo-day failure mode: when public devnet RPC throttles tx simulation, Phantom's Confirm button never enables. With multi-provider config, single-RPC outages no longer freeze the demo

### Why we don't fail-over at runtime in V1
Adding runtime failover (catch RPC errors, retry against the next provider) requires wrapping every RPC call site (~12 across `demo.ts`, `wallet.ts`, `audit-feed.ts`). That's invasive enough to risk regressions in the 7/7 anchor integration test pass. V1 ships build-time priority; V2 wraps the connection in a multi-provider pool. Documented as such — not hidden.

### How an issuer activates QuickNode for their MetaHook deployment
1. Sign up at quicknode.com (free tier sufficient for a dApp panel)
2. Create a Solana / Devnet endpoint
3. Copy the HTTP Provider URL (looks like `https://...quiknode.pro/HASH/`)
4. Paste into `app/.env` as `VITE_QUICKNODE_DEVNET=<full-url>`
5. Rebuild — footer flips to "QuickNode RPC (Helius + public devnet on standby)"

## Repo
https://github.com/Yonkoo11/multihook (MIT)
Multi-RPC config: https://github.com/Yonkoo11/multihook/blob/master/app/src/programs.ts

## Demo
https://yonkoo11.github.io/multihook/ (footer surfaces active RPC; activates the moment any provider's env var is set)
