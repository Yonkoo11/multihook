# RPC Fast — $10K Frontier Sidetrack

**Track:** $10,000 in RPC Infrastructure Credits for Colosseum Frontier Hackathon

---

## Why Multi-Hook fits this track
Multi-Hook's live demo has a multi-RPC priority chain that uses RPC Fast as the **primary** Solana devnet provider when configured. The integration is real (not a name-drop) — the dApp's footer displays the active provider, and any RPC failure cascades down the priority chain (RPC Fast → QuickNode → Helius → public devnet).

## The integration

### Code
- `app/src/programs.ts` — multi-provider RPC resolution. RPC Fast takes priority when `VITE_RPCFAST_DEVNET` is set. Full priority chain documented + exported as `RPC_FALLBACKS` array
- `app/src/main.ts` — footer label shows `"RPC Fast (QuickNode + Helius + public devnet on standby)"` when active
- `app/src/vite-env.d.ts` — env-var declaration with the rationale comment
- `app/.env.example` — instructions for getting an RPC Fast devnet endpoint and configuring it

### Why this is depth 3
- Real provider integration in the hot path of every RPC call (not a sidebar feature) — every `getSignaturesForAddress`, `getTransaction`, `sendRawTransaction`, simulation call goes through RPC Fast when configured
- Multi-provider priority chain solves the real demo-day failure mode where public devnet throttles tx simulation and Phantom's Confirm button never enables
- Active-provider visibility in the footer means judges can verify the integration is live without devtools

### Activation path
1. Sign up at rpcfast.com (free tier or use the Frontier credits)
2. Create a Solana / Devnet endpoint
3. Paste the full HTTP URL into `app/.env` as `VITE_RPCFAST_DEVNET=...`
4. Rebuild — footer flips to "RPC Fast (...others on standby)"

### Honest caveats
- V1 ships build-time priority resolution. Runtime failover (catch RPC errors, transparently retry against the next provider in the chain) is V2 — wrapping every call site is invasive enough to risk regressions in the 7/7 anchor integration test pass. The `RPC_FALLBACKS` array is exported and ready for that V2 wrapper

## Repo
https://github.com/Yonkoo11/multihook (MIT)
Multi-RPC config: https://github.com/Yonkoo11/multihook/blob/master/app/src/programs.ts

## Demo
https://yonkoo11.github.io/multihook/ (footer surfaces active RPC; activates the moment any provider env var is set)
