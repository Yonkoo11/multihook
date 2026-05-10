# Umbra — $10K Frontier Sidetrack

**Track:** Build with Umbra Side Track for $10,000 USDC

---

## Why Multi-Hook fits this track
Umbra and Multi-Hook are **orthogonal compliance/privacy primitives that compose into a single product story** that neither can tell alone:

- **Multi-Hook** controls **WHO** can receive a token (allowlist + sanctions + SNS-domain ownership + any third-party policy that follows `POLICY_INTERFACE.md`)
- **Umbra** controls **who can SEE the balance** (Arcium MPC-encrypted token accounts; balance hidden from any block explorer)

Combined: every shield-out is a Token-2022 transfer, so the MetaHook fires, the policy verdicts run, and the audit event lands — but the post-shield balance is private. **You get private + compliant RWA transfers on the same Token-2022 mint.**

This is the answer to the regulator-vs-privacy false dichotomy. Compliance fires *before* the privacy layer; the audit event proves the transfer was vetted; the balance is hidden from competitors and front-runners.

## The integration

### Code
- `app/src/umbra-shield.ts` — wraps `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` from `@umbra-privacy/sdk` with a thin Phantom-via-wallet-standard adapter; exports `shieldViaUmbra({ mintBase58, recipientBase58, amountTokens, rpcUrl })`
- `app/src/main.ts` — Step 05 click handler dynamically imports the Umbra SDK chunk (~2 MB lazy-loaded — initial page load stays at 500 KB) and invokes the shield against the user's MetaHook-protected mint
- `app/index.html` — Step 05 station with optional dashed-border treatment
- `app/.env.example` — declares Umbra devnet program ID + indexer endpoint constants

### Demo flow with Umbra
1. User completes Steps 01-04 (provision + add destination to allowlist + successful transfer)
2. Source ATA still holds 900 tokens (started with 1000, transferred 100)
3. User clicks **Shield 100 via Umbra** (Step 05)
4. Umbra SDK loads on-demand (~2 MB chunk, ~1 sec on broadband)
5. SDK builds the shield tx; the underlying Token-2022 transfer fires our metahook
6. **First time through**: MetaHook rejects with `policy.allowlist.fail` because Umbra's program PDA isn't allowlisted. The audit feed below the receipt shows the rejection. **This IS the demo** — the composition story made visible: compliance fired before privacy
7. **After issuer adds Umbra's program PDA to the allowlist**: shield succeeds; tokens move into the Umbra encrypted account; balance hidden but compliance was preserved at the entry point

### Why this is depth 3-4
- Real Umbra SDK call (not a stub) — `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` with bigint amounts, address parameters, deferred master-seed signature
- Wallet-standard discovery for the Phantom signer (no re-prompt of the user's wallet — uses the same connection as the rest of the demo)
- Code-split into its own bundle so the heavy MPC + Arcium dependencies don't tax the initial page load
- Composes on-chain with our metahook: every shield transfer triggers the same allowlist + sanctions verdicts as a regular transfer; same audit event lands in the program logs
- The reject-then-allow flow is itself the **product story** — judges see compliance rejecting a privacy operation, then accepting it after the issuer authorises Umbra

### Devnet status
- Umbra program: `DSuKkyqGVGgo4QtPABfxKJKygUDACbUhirnuv63mEpAJ` on Solana devnet
- Indexer endpoint: `https://utxo-indexer-devnet.api.umbraprivacy.com`
- Umbra confirmed live on devnet for SPL + Token-2022 mints (per docs.umbraprivacy.com / Colosseum Codex Umbra SDK announcement)

### Honest caveats
- The first shield attempt **will revert** for any user running the live demo because Umbra's program PDA isn't allowlisted by default. This is intentional — surfacing the composition story takes the user from "shield failed?" to "oh, compliance fired BEFORE privacy" to "I need to allowlist Umbra to enable shielded compliant transfers."
- V1.1 will add a one-click "Allowlist Umbra's program PDA" button to make the success-path demo single-click. V1 ships the integration code + the rejection flow.

## Repo
https://github.com/Yonkoo11/multihook (MIT)
Umbra wrapper: https://github.com/Yonkoo11/multihook/blob/master/app/src/umbra-shield.ts

## Demo
https://yonkoo11.github.io/multihook/ (Step 05 visible; click triggers the dynamic Umbra SDK load)
