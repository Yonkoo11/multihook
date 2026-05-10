# Design Research Brief — Multi-Hook

## Product Category

Developer/infrastructure tool for RWA (real-world asset) token issuers building on Solana. Sits at the intersection of:
- **DevDX dashboards** (Linear, Vercel, Resend) — for the audience
- **Compliance/risk fintech** (Stripe Radar, Sardine, Plaid) — for the trust signal it must project
- **DeFi-native dashboards** (Hyperliquid, dYdX, Drift) — for Solana fluency

Audience: technical founders + compliance engineers at small-to-mid RWA issuers who don't have Anchorage/Fireblocks budget. Hackathon judges (Public Goods + Standout tracks) + Phantom/Helius/Coinbase reps.

## Comparables Studied

### Linear (https://linear.app)
- **Layout:** sidebar nav, command palette (Cmd+K) is the spine of the UX
- **Color:** dark-only. Background `#0e0f12` base with subtle radial accent glows. Single accent (Linear violet `#5e6ad2`).
- **Typography:** Inter Display 400/500/600. 14px body. Tight tracking (-0.02em on headings). All numbers tabular-nums.
- **Motion:** Emil Kowalski authored. 150-200ms cubic-bezier(0.23, 1, 0.32, 1). Modal opens from scale(0.95). Hover lifts on cards (translateY(-2px) + shadow).
- **Density:** medium-high. Lots of metadata visible without feeling crammed because of disciplined whitespace + typography hierarchy.
- **Signature:** keyboard-first, command palette, the "issue" entity has its own visual identity (status icon + ID format).
- **Steal this:** disciplined typographic hierarchy + the "everything is a status" mental model.

### Vercel Dashboard (https://vercel.com/dashboard)
- **Layout:** team/project switcher in top header, deployment list dominates the home view, geist sans throughout.
- **Color:** pure dark base `#000` with very subtle radial gradients (sometimes barely visible). White accents + very rare semantic colors (red/green for status only).
- **Typography:** Geist Sans + Geist Mono. Numbers are mono-tabular. Tracking on labels.
- **Motion:** snappy. Page transitions instant. Hover states use shadow + border-color shift.
- **Signature:** the "Add" button lives in the top-right corner of every view. Branding through restraint — almost no decorative elements; the product IS the deployment list.
- **Steal this:** restraint as a brand signal. The strongest visual is the absence of visual noise.

### Stripe Dashboard (dashboard.stripe.com)
- **Layout:** sidebar with grouped nav, content area is wide, key metrics row at top of each entity view.
- **Color:** light-mode default (Stripe is consciously not dark-by-default). Purple-to-blue gradient as a brand signature on marketing pages but understated inside the product.
- **Typography:** Sohne Sans + Sohne Mono. Numerical precision. Tabular-nums everywhere money appears.
- **Motion:** measured. Modals slide up from bottom with deliberate easing (~250ms).
- **Signature:** transaction rows. Every entity has the same "row with status badge + amount + actor + timestamp" pattern. Predictable.
- **Steal this:** the transaction-row pattern is perfect for our audit log. Status + actor + amount + verdict + timestamp.

### Hyperliquid (app.hyperliquid.xyz)
- **Layout:** trading-terminal layout. Order book + chart + order form. Information dense.
- **Color:** dark-only. Tradingview-style green/red for direction. Single brand accent.
- **Typography:** mono everywhere price/size appears. Updates flash (numbers briefly highlight when they change).
- **Motion:** cells flash on update. No decorative motion. Speed is the brand.
- **Signature:** live order book streaming — the page is alive even when you're not interacting.
- **Steal this:** the "live data" liveness pattern. We can show a streaming audit-log feed that pulses when new events arrive.

### Resend (resend.com/dashboard)
- **Layout:** single-column with strong hero. Recent emails as the dominant element. Generous whitespace.
- **Color:** dark-only. White background option but dark is default. Accent: a single warm blue.
- **Typography:** Inter. Headings tight. Lots of text-foreground/text-muted-foreground hierarchy.
- **Motion:** subtle. The "Send" button has a gentle hover state — nothing more.
- **Signature:** the email-row pattern (subject + status + timestamp + recipient avatar) is the entire UX.
- **Steal this:** the dev-tool warmth — Resend feels human despite being technical. Worth adopting that warmth instead of a sterile compliance look.

## Common Patterns (table stakes — all proposals must include)

- **Dark-only background** with at least one visible radial accent glow behind the focal element
- **Sidebar OR top nav** with workspace/wallet identity in a fixed position
- **Tabular-nums on all on-chain quantities** (amounts, addresses, signatures, timestamps)
- **Status as a first-class visual primitive** (color + icon + label triad)
- **Code/transaction signatures rendered in mono** with truncation pattern (first4…last4)
- **Ambient depth** — at minimum, accent glow behind primary CTA + layered background gradients ≥0.08 opacity

## Differentiation Opportunities (where we stand out)

- **Pipeline metaphor.** No comparable shows a literal "transaction passes through N policies and gets stamped at each one" visualization. This is the product story made visual. Hyperliquid is closest with its order-flow representation.
- **Audit event as hero.** The MetaHookAuditEvent is the most novel artifact our system produces — most compliance tools hide their decisions in logs. We surface them as the headline output.
- **Two-tone accent encoding.** Use one accent for "approved/passed" (warm, e.g. amber) and one for "policy" (cool, e.g. cyan). The metaphor is bureaucratic stamp ink — the warm color lives only in approved verdicts.
- **Live policy verdicts.** Show the verdicts streaming in as the transaction progresses — like the Hyperliquid order book but for compliance.

## Design Constraints

- **Audience reads code.** Don't dumb down the technical details. Show program IDs, discriminators, raw base64 — but treat them as first-class UI elements with monospace + truncation, not error-style text.
- **Phantom-first.** The connect button + wallet identity must follow Phantom's visual conventions (purple "Connect" CTA looks at home).
- **Hackathon judging in 5 minutes.** A judge lands on the page, scrolls once, must understand: what it is, what it does, why it matters. Hero must do that work.
- **Demo flow is the product surface.** The 4 sequential steps ARE the product. Don't bury them under marketing.

## Anti-patterns (avoid)

- **Generic "feature card grid" of 3 boxes** describing the protocol. Stripe/Vercel/Linear don't do this. The PRODUCT is the demo.
- **Self-certifying badges** ("Reentrancy-safe", "Audited" — even though true). Show the evidence (audit event, CPI depth measurement), not the badge.
- **Crypto-purple gradient slop.** No purple-to-pink hero gradient. No "metaverse" aesthetic.
- **Identical card treatment** for every step. Each step in the demo flow has different content density and different emotional weight (step 2 = expectation of failure, step 4 = success + audit event reveal). Their visual treatment must differ.
- **A single flat dark background.** Linear/Vercel/Resend all have layered backgrounds with visible tonal variation. Required.

## Stolen Elements (adopt and adapt)

- From **Linear**: the typographic hierarchy + sidebar with workspace identity at top; the "command palette" idea repurposed as a "policy palette" for V2 (showing what policies are available to compose).
- From **Stripe Dashboard**: the transaction-row pattern for the audit log feed (status badge + actor + amount + timestamp + verdict).
- From **Hyperliquid**: the live-data pulse — verdicts flash in as the transaction passes through each policy.
- From **Vercel**: restraint. The hero is the demo, not a marketing page.
- From **Resend**: warmth in copy. The product helps issuers AVOID compliance pain — not a sterile gatekeeper.

## Brand Direction

**Metaphor:** customs clearance / inspection pipeline. Each policy is a customs officer. They stamp the transfer (or reject it). The MetaHook is the conveyor belt. The audit event is the receipt.

**Mood words:** measured, technical, precise, transparent, evidence-based.

**Voice:** dev-tool warmth. Not "OpenZeppelin for Token-2022" (too generic) — closer to "compose your customs checkpoint."

**Color promise:** ink — both bureaucratic-stamp ink (warm amber for approval, deep red for rejection) and ledger-ink (cool blue/cyan for policy state). The dark surface is paper.
