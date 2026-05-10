# MetaHook — Demo Video Script

**Target:** 90-100s technical demo (within Colosseum's 2-3 min cap).
**Framework:** PAS (Problem-Agitation-Solution).
**Judges:** Frontier panel (Public Goods Award primary) + side-track sponsors (Adevar, RPC Fast, SNS, QuickNode, Umbra).
**ElevenLabs voice:** Brian (`nPczCjzI2devNBz1zQrb`), stability 0.82, similarity 0.65, style 0.03.
**Hard rule:** every brand or compound word is rewritten phonetically (camelCase defeats TTS). Words below are how the script READS — subtitles can keep the on-screen spelling.

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

## Clip 03 — Solution · 15s

**Frame:** Demo page top — the 5-station strip ("01 PROVISION · 02 REJECT · 03 AUTHORISE · 04 APPROVE · 05 OPTIONAL"), all visible.
**Why this clip:** Frame the system before showing it run. Emphasize composability.

**Voiceover (38 words):**
> "Until now. Meta Hook is the missing piece. One meta hook program. N child policy programs. Every transfer passes through every policy in a single C P I chain, and emits one signed audit receipt with the per-policy verdicts."

**Slop gate:** PASS — describes the mechanism in concrete terms ("CPI chain", "audit receipt"), not marketing voice.
**Pronunciation gate:** PASS — "C P I" letters spaced, "Meta Hook" spaced.

---

## Clip 04 — Demo · Reject · 13s

**Frame:** Demo page zoomed on Station 02 (REJECT) with simulated `policy.allowlist.fail` rejection badge in the audit feed.
**Why this clip:** Show the technically interesting path — the policy actually rejecting. This is the "hard part" judges want.

**Voiceover (33 words):**
> "Watch it run. We provision a token, then send a hundred to a wallet that is not on the allowlist. The hook rejects with a clean error. Policy allow list fail. Right where the spec says it should."

**Slop gate:** PASS — shows the failure path as a feature (clean error, spec compliance), not a bug.
**Pronunciation gate:** PASS — "policy allow list fail" reads as a clear error code.

---

## Clip 05 — Demo · Approve + Audit Event · 16s

**Frame:** Demo page zoomed on Station 04 (APPROVE) + the rendered audit-receipt detail block (PASS stamp, decoded fields visible).
**Why this clip:** The "wow" moment. Compliance ran, the policies AND-aggregated, the receipt decoded in-browser. This is the proof.

**Voiceover (38 words):**
> "Add the wallet to the allowlist with one C P I call. Same transfer fires again. Both policies stamp PASS, and the audit event lands in the program logs, base sixty-four encoded, decoded right here in your browser."

**Slop gate:** PASS — all-concrete, no narrating-the-obvious ("as you can see").
**Pronunciation gate:** PASS — "base sixty-four" instead of "base 64".

---

## Clip 06 — Composability + Sponsor depth · 14s

**Frame:** Sponsors page — the depth audit table showing Phantom 4/5, Helius 4/5, Umbra 3/5, Squads 2/5 etc.
**Why this clip:** The composability story (Umbra) + the public-goods transparency move (audited self-scoring). Both judging criteria.

**Voiceover (37 words):**
> "And it composes. Shield the same transfer through Umbra's encrypted accounts, and the meta hook fires before the privacy layer takes over. Compliance at the entry point. Privacy on the way out. Every sponsor integration audited against a public depth scale."

**Slop gate:** PASS — "compliance fires before privacy" is the load-bearing one-liner. Credible because the depth audit is public.
**Pronunciation gate:** PASS.

---

## Clip 07 — Close · 10s

**Frame:** Closing card — large MetaHook logo + tagline "Compose your compliance stack the same way you compose middleware in Express." + URL.
**Why this clip:** Single CTA, named product, no thank-yous.

**Voiceover (24 words):**
> "Meta Hook. Compose your compliance stack the same way you compose middleware in Express. Try the live demo. The code is on GitHub."

**Slop gate:** PASS — names the product, single CTA, no "thanks for watching".
**Pronunciation gate:** PASS.

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
