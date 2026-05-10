# MetaHook — Demo Video Script (v3)

**Target:** ~90-100s technical demo, real Phantom flow visible end-to-end.
**Framework:** PAS (Problem-Agitation-Solution) → live walkthrough → close.
**Judges:** Frontier panel (Public Goods Award primary) + side-track sponsors (Adevar, RPC Fast, SNS, QuickNode, Umbra).
**ElevenLabs voice:** Brian (`nPczCjzI2devNBz1zQrb`), stability 0.82, similarity 0.65, style 0.03.
**Hard rule:** every brand or compound word is rewritten phonetically. Subtitles match the audio verbatim and burn into the frame.

**v3 vs v2:** v3 uses 8 clips (split the demo into 4 distinct action beats — connect+provision, reject, allow, approve+receipt — instead of v2's 2 lumped beats). Each clip's narration matches what the viewer SEES happening on screen at that moment, so the voiceover lands when the action lands. Subtitles burn-in.

---

## Pronunciation map (one source of truth)

| On screen / in code | In script as | Why |
|---|---|---|
| `MetaHook` | `Meta Hook` | TTS reads PascalCase as one mashed word. Spaces force the right beats. |
| `Token-2022` | `Token Twenty Twenty Two` | "Token dash twenty-twenty-two" sounds robotic; spelling out gives natural beats. |
| `OpenZeppelin` | `Open Zeppelin` | Same PascalCase risk as MetaHook. |
| `OFAC` | (avoided in script) | Risk of "oh-fak" pronunciation. Say "sanctions list" instead. |
| `policy.allowlist.fail` | `Policy allow list fail` | Dots become inaudible; spaces give it the cadence of a clean error code. |
| `MetaHookAuditEvent` | `Meta Hook Audit Event` | Same. |
| `CPI` | `C P I` | Acronym; letter-by-letter is correct. |
| `PDA` | `P D A` | Same. |
| `Umbra` | `Umbra` | Single word, TTS handles it. |
| `Squads` | `Squads` | Single word. |
| `Anchorage` | `Anchorage` | Single word. |

---

## Clip 01 — Hero · 9s

**Frame:** Landing fold — the hero composition-stack diagram (3 policy blocks slotting into the orchestrator container, transfer pulse moving across them).
**Why this clip:** Show the product working in the first 5 seconds. No hypothetical, no logo intro.

**Voiceover (22 words):**
> "This is Meta Hook. Open Zeppelin for the new Solana token standard. One hook, three policies, one signed audit receipt per transfer."

**Slop gate:** PASS — names the category, no buzzwords, the audit receipt is a concrete artifact.
**Pronunciation gate:** PASS — "Meta Hook", "Open Zeppelin" both spaced.

---

## Clip 02 — Problem · 14s

**Frame:** Landing page "The Problem" section — the "Smaller RWA token issuers can't access..." H2 + supporting paragraph.
**Why this clip:** Specific dollar amount, named comparable (Securitize, the actual transfer-agent stack BUIDL uses). Verifiable against BlackRock BUIDL's $525K sales commission disclosed at launch.

**Voiceover (37 words):**
> "Token Twenty Twenty Two shipped its transfer hook in early twenty twenty-four. But shipping production compliance with it still means writing a custom hook per mint, or paying Securitize half a million dollars to wrap your fund the way BlackRock did. There is no third option."

**Slop gate:** PASS — no "revolutionary", no "delve". Specific verifiable dollar amount.
**Pronunciation gate:** PASS — "Token Twenty Twenty Two", "Securitize" (TTS reads as "se-CURE-it-ize"), "BlackRock" all single-word safe.
**Fact-check (2026-05-10):** BlackRock BUIDL launched March 2024 with $525K sales commission + up to 0.50% management fees per Securitize disclosures (per launch press releases + RWA.xyz). "Half a million dollars" accurately rounds the $525K commission and is defensible against any judge who looks it up.

---

## Clip 03 — Connect + Provision · 12s

**Frame:** Live demo page → Phantom Connect popup appears → wallet pill flips to address → Provision button enables → click Provision → Phantom Confirm Transactions popup → click Confirm → provision log streams "creating allowlist PDA / OFAC PDA / Token-2022 mint with TransferHook ext / ExtraAccountMetaList".
**Why this clip:** Show the real wallet handshake in the first 30 seconds. Judges need to know this isn't a mockup.

**Voiceover (32 words):**
> "Until now. I connect Phantom on devnet. One click. Click Provision, and a single signed transaction sets up the mint with both policies wired into the transfer hook."

---

## Clip 04 — Reject · 11s

**Frame:** Click "Send 100 (expect revert)" → Phantom Confirm popup → click Confirm → fail-log streams `policy.allowlist.fail: destination not on allowlist` in red.
**Why this clip:** Show the technically interesting path — the policy actually rejecting on-chain. Judges want this.

**Voiceover (28 words):**
> "Now I send a hundred to a wallet that is not on the allowlist. Phantom asks me to confirm. The hook rejects. Policy allow list fail."

---

## Clip 05 — Allow · 8s

**Frame:** Click "Add to allowlist" → Phantom Confirm popup → click Confirm → log streams `added to allowlist · sig …`.
**Why this clip:** Show the policy authority in action — one CPI to mutate state, the meta-hook code is untouched.

**Voiceover (20 words):**
> "I add the wallet to the allowlist with one C P I call. The meta hook code never moves."

---

## Clip 06 — Approve + Audit Event · 14s

**Frame:** Click "Retry (expect approve)" → Phantom Confirm popup → click Confirm → both policies stamp PASS in green → audit-receipt detail block scrolls into view with `final: APPROVED`, `policy_allowlist: PASS`, `policy_sanctions_ofac: PASS`, decoded fields visible.
**Why this clip:** The wow moment. Same transfer fires, both policies AND-aggregate, the audit event decodes in-browser.

**Voiceover (35 words):**
> "Same transfer fires again. Both policies stamp PASS, and the audit event lands in the program logs, base sixty-four encoded, decoded right here in the browser. One signed receipt per transfer."

---

## Clip 07 — Composability · 12s

**Frame:** Navigate to /docs/policies — the public POLICY_INTERFACE spec. Sticky sidebar visible, on-this-page TOC visible (TL;DR, Required instruction, Account context, Returning a verdict, PDA convention).
**Why this clip:** The composability story is the load-bearing claim. Showing the public spec proves anyone can ship a fourth policy.

**Voiceover (30 words):**
> "And it composes. Anyone can fork the spec, ship a new policy in two hundred lines of Rust, and slot it into a live mint without touching the meta hook code."

---

## Clip 08 — Close · 8s

**Frame:** Closing card — large MetaHook logo + tagline + URL + repo link.
**Why this clip:** Single CTA, named product, no thank-yous.

**Voiceover (24 words):**
> "Meta Hook. Compose your compliance stack the same way you compose middleware in Express. Try the live demo. The code is on GitHub."

---

## Adversarial content gate (final pass before audio generation)

For every clip: **"Would a competitor include this in their demo?"**

| # | Clip | Competitor would include? | Verdict |
|---|---|---|---|
| 01 | Hero | Yes — names the category in 9s | KEEP |
| 02 | Problem | Yes — specific dollar amount, real comparable | KEEP |
| 03 | Solution mechanic | Yes — frames the system before the demo | KEEP |
| 04 | Demo · Reject | Yes — shows the policy enforcing | KEEP |
| 05 | Demo · Approve | Yes — the proof moment | KEEP |
| 06 | Composability | Yes — extra credit on Umbra side track + public-goods transparency | KEEP |
| 07 | Close | Yes — single CTA | KEEP |

No failure cases, no caveats, no honest-self-assessments. The depth audit is mentioned as a strength (transparency), not a weakness ("we couldn't hit depth 5 on Squads").

---

## Total budget check

| Clip | Words | ~Spoken (140 wpm) | Per-segment total (audio + 1.0s padding) |
|---|---|---|---|
| 01 | 22 | 9.4s | 10.4s |
| 02 | 35 | 15.0s | 16.0s |
| 03 | 38 | 16.3s | 17.3s |
| 04 | 33 | 14.1s | 15.1s |
| 05 | 38 | 16.3s | 17.3s |
| 06 | 37 | 15.9s | 16.9s |
| 07 | 24 | 10.3s | 11.3s |
| **Total** | **227** | **~97s spoken** | **~104s + 6 × 0.3s gaps = ~106s** |

**Final video length target: ~1:46. Within the 2-3 minute Colosseum cap. Above the 60s social-clip floor.** Comfortable headroom for re-recordings if any clip drifts long.
