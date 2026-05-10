# Design Research Brief v2 — Multi-Hook (RWA Compliance Infra)

**Why this is v2:** v1 researched generic dashboards (Linear, Vercel, Stripe, Hyperliquid, Resend) and produced the Customs Pipeline (serif + amber-stamp + bureaucratic ink). The product has since grown from a single demo to a full compliance infrastructure platform (4 deployed programs, multi-RPC chain, audit feed, SIWS session, Umbra composition). The user flagged that the editorial-stamp aesthetic doesn't fit the institutional-infra reality. v2 researches products in our actual category.

## Product Category (revised)

**Composable smart-contract infrastructure for institutional-grade compliance.** The "OpenZeppelin for Token-2022 transfer-hook compliance" positioning is literal — we sit at the intersection of:
- **Composable primitive libraries** (OpenZeppelin Contracts) — the closest functional analog
- **Institutional crypto custody/compliance** (Anchorage, Fireblocks) — the trust signal we must project to RWA issuers
- **Solana-native infra** (Helius, Solscan, validator dashboards) — the audience convention

Audience: technical founders + compliance engineers at small-to-mid RWA issuers, plus Frontier hackathon judges (Public Goods + Standout) + sponsor reps from Phantom/Helius/QuickNode/RPC Fast/Umbra/Adevar.

## Comparables Studied (v2)

### OpenZeppelin (openzeppelin.com + wizard)
- **Layout:** marketing site is product-led — Contracts as the headline; the wizard is the killer interactive surface
- **Color:** dark backgrounds + white type + **electric cobalt blue** as the single accent. Cobalt appears on every CTA, every active-state, every primitive icon
- **Typography:** clean sans-serif (looks like Inter or similar), tight hierarchy, generous whitespace
- **Shape language:** **stacked component cards** that visualize "building blocks." This is the load-bearing visual metaphor — the Wizard literally lets you compose contracts from primitives in a 3-pane (picker / preview / output) editor
- **Mood:** "clinical yet approachable — serious about security but not austere"
- **Steal this:** the **stack/compose metaphor as primary visual**. Plus: cobalt as the single trust accent. Plus: the "real working tool replaces the marketing hero" pattern from the wizard.

### Anchorage Digital (anchorage.com)
- **Layout:** marketing site, but the visual treatment is operational: stylized graph visualization in the hero, regulatory badges (federal charter, MAS license, BitLicense) as proof
- **Color:** **dark + white + minimal accents.** Avoids vibrant gradients common in crypto. "Institutional gravitas" through restraint
- **Typography:** clean modernist sans-serif. Heavier weights for headings. **Generous whitespace as a status signal** — rich brands can afford to leave space empty
- **Mood:** "institutional-modernist confidence — boring by design, paradoxically reassuring." Every visual choice says "we are serious infrastructure."
- **Signature:** shield iconography + client logos (BlackRock, Goldman, Visa) + regulatory badges as the trust-stack
- **Steal this:** the **restraint as brand signal**. Don't crowd the hero. Show evidence (audit event, on-chain program IDs, CPI depth measurement) instead of marketing copy.

### Fireblocks (fireblocks.com)
- **Layout:** minimalist enterprise fintech. Headline + use cases + customer logos as authority
- **Color:** white logo on dark. Functional rather than decorative.
- **Mood:** "confidence through restraint — outcome-focused." Doesn't lead with "$7T+" in the hero — leads with specific case studies ("Bridge cut bulk settlement times from 12+ hours to under 90 minutes").
- **Signature:** customer logo carousel + outcome callouts tied to real results
- **Steal this:** the **"specific evidence beats abstract claims"** pattern — show the audit event, the CU measurement, the program ID, not the badge.

### Solscan + Helius (Solana-native data infra)
- Both blocked by Cloudflare bot-check during this session, but priors hold:
- **Solscan:** dark mode, pink-purple gradient logo, dense tx list with status pills (green pass / red fail), monospace addresses truncated `Az...3pq`, mono everywhere data appears
- **Helius:** dark mode, electric-blue accent, geometric line illustrations as backgrounds, dev-tool authority through restraint (similar to Vercel)
- **Steal this:** **mono with truncation as the address pattern.** Status pills as compact identity markers. Dense rows for streaming data.

### Hyperliquid (held over from v1)
- Live order book — page is alive even when you're not interacting. Cells flash on update. Mono everywhere price/size appears.
- **Steal this:** the **live-pulse pattern** for the audit feed. Each new audit event fades in with a brief cobalt flash.

## Common Patterns (table stakes — all proposals must include)

- **Dark base** with at least one cobalt accent glow behind the focal interaction
- **Sans-serif (Geist or Inter)** — institutional-infra convention; serif feels boutique vs platform
- **Mono with first4…last4 truncation** for every pubkey, signature, base64 preview
- **Single accent + a single semantic color** (cobalt for compose-state + amber ONLY for approval verdicts; never both as decoration)
- **Live element** — at minimum the audit feed pulses as new events land
- **Layered backgrounds** — never a single flat dark color (gradients ≥0.08 opacity per design-lessons Rule 13)

## Differentiation Opportunities (where we stand out)

- **The compose stack as the hero.** OpenZeppelin's wizard works because it shows the composition act. None of Anchorage/Fireblocks/Solscan visualize composition — they show monolithic dashboards. We can own this.
- **Live policy verdicts streaming** — Hyperliquid's order-book pulse pattern applied to compliance verdicts. No competitor does this.
- **Audit event as hero output** — most compliance tools hide their decisions in logs. Surface them as the headline output, decoded from on-chain bytes in real time.
- **Live integration metric strip** — "4 programs deployed · 33,346 CU per transfer · CPI depth 3/4 · 1 layer headroom." Real numbers vs marketing claims.

## Design Constraints

- **Audience reads code.** Don't dumb down. Show program IDs, discriminators, base64 — but treat them as first-class UI with mono + truncation, not error styling.
- **Phantom-first.** The connect button + wallet identity follow Phantom's visual conventions.
- **Hackathon judging in 5 minutes.** A judge lands, scrolls once, must understand: what it is, what it does, why it matters. The hero must do that work.
- **Demo flow IS the product surface.** The 5 sequential stations ARE the product. Don't bury them under marketing.
- **Now serving 7+ sponsor integrations.** Phantom (signMessage, SIWS), Helius (RPC + audit feed), QuickNode + RPC Fast (multi-RPC), SNS (3rd policy), Umbra (privacy compose), Squads (governance doc), Adevar (audit subject). Design must scale to surface all of these.

## Anti-patterns (kill on sight)

- **Generic feature-card grid of 3 boxes** — "Secure", "Composable", "Open-source" — kill on sight
- **Self-certifying badges.** Show evidence (audit event, CPI measurement), not the claim
- **Crypto-purple gradient slop** — no purple-to-pink hero; institutional infra doesn't do that
- **Identical card treatment for every section** — dead-page tell
- **A single flat dark background** — also dead-page tell
- **Editorial-stamp serif treatment** — what v1 had; doesn't fit institutional infra category
- **The "OpenZeppelin for X" tagline as the hero** — too generic; the visual must DO the comparison, not write it

## Stolen Elements (adopt and adapt)

- From **OpenZeppelin**: the **stack/compose metaphor** as the load-bearing hero visual. Plus cobalt blue as the trust accent.
- From **Anchorage**: **restraint** in the hero. Don't crowd. Let the on-chain evidence (program IDs, audit event) speak.
- From **Hyperliquid**: **live pulse** on the audit feed entries — flash cobalt as each new entry lands.
- From **Solscan**: **mono + truncation + status pills** for every address/signature/verdict.
- From **Fireblocks**: **specific evidence over abstract claims** — show the CU number, not "fast"; show the audit event, not "auditable."

## Brand Direction (v2)

**Metaphor:** **composition stack.** The MetaHook is a translucent container. Each child policy is a block that slots into it. The transfer is a pulse that passes through every block — each one stamps PASS or REJECT — and emerges with a verdict block.

**Mood words:** measured, technical, evidence-based, **infra-grade**, alive (the page pulses with live data).

**Voice:** dev-tool authority. Closer to Vercel than to Anchorage (we're not selling to GS desks, we're shipping infra to RWA founders).

**Color promise:** **cobalt** for compose-state and policy identity (every policy in our stack is cobalt). **Amber** ONLY for approved verdicts — the warm color earns its place by appearing only when compliance has fired and approved. **Reject red** for revert reasons. The dark surface is institutional paper, not literal paper.

**The transplant test:** swap the project name, would this design work for any other product? **NO.** The compose-stack hero is specific to "N policies slot into a meta-orchestrator" — it would not make sense for a generic dashboard, an explorer, or a wallet.
