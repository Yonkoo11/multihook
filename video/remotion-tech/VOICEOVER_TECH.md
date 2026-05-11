# Technical Walkthrough — Voiceover Script

**Tone:** Mert/Toly-tier senior Solana developer. Specific, concrete, no marketing. Numbers on screen. Code visible. No "delve", "vibrant", "comprehensive", "production-ready". Honest framing always.

**Voice:** ElevenLabs Brian (`nPczCjzI2devNBz1zQrb`), stability 0.82, similarity 0.65, style 0.03 — same settings as the v3 pitch video.

**Pronunciation map** (rewrite phonetically for ElevenLabs):
- `MetaHook` → "Meta Hook" (two words)
- `OpenZeppelin` → "Open Zeppelin"
- `Token-2022` → "Token twenty-twenty-two"
- `Solana` → "So lah na" (already correct)
- `Anchor` → already correct
- `CPI` → "C P I" (spell out)
- `PDA` → "P D A" (spell out)
- `IDL` → "I D L"
- `SNS` → "S N S"
- `OFAC` → "Oh fack"  (per FinCEN convention)
- `policy.allowlist.fail` → "policy dot allow-list dot fail"
- `policy.sns_allowlist` → "policy dot S N S allow-list"
- `add_policy` → "add policy" (no underscore)
- `check_transfer` → "check transfer"
- `process_execute` → "process execute"
- `MetaHookConfig` → "Meta Hook Config"
- `MetaHookAuditEvent` → "Meta Hook Audit Event"
- `2024` → "twenty twenty four"
- `BUIDL` → "B U I D L"
- `BlackRock` → already correct
- `Securitize` → "Securitize" (Suh-cure-it-eyes)
- `Bonfida` → "Bon-fee-dah"

---

## 01-hero (12s, 130 words/min target)

This is Meta Hook. Composable Token twenty-twenty-two compliance. One meta-hook program, N child policies, AND-aggregated, with a per-mint config P D A. Anyone ships a policy in two hundred lines of Rust and slots it into a live mint without forking the meta-hook.

---

## 02-problem (18s)

Token twenty-twenty-two shipped its transfer hook in early twenty twenty-four. BlackRock paid Securitize five hundred and twenty-five thousand dollars, plus half a percent management, to wrap their B U I D L fund. Smaller issuers can't justify that. They write a bespoke hook per mint, or they skip compliance entirely. There is no public-good middle ground.

---

## 03-architecture (25s)

Token twenty-twenty-two calls meta-hook dot execute on every transfer. The hook reads a per-mint Meta Hook Config P D A, loops over the configured policies, C P Is into each, and AND-aggregates. The config stores program-ID and P D A pairs. Up to eight policies. Aggregation mode. Authority for governance. Reading the config is the entire dispatcher. One for-loop.

---

## 04-interface (25s)

Every child policy implements one instruction. Check transfer with amount, plus a fixed account context — source, mint, destination, owner, your policy state. Return Ok to approve. Return an error matching policy dot your-name dot fail for clean reject. The meta-hook validates each program ID and P D A against the config before invoking. No fork required.

---

## 05-sns-triple-bind (35s)

The interesting code is policy dash S N S allow-list. Three independent checks. One — the S N S NameRecord account must be owned by the canonical Bonfida program. Verified by hardcoded program ID. This blocks any forged name service. Two — the NameRecord P D A must be on the issuer's authorized set. Three — the NameRecord owner field must match the destination token-account owner. This defeats the historical-control replay where someone who used to own a domain accepts transfers on its behalf. All three checks. Two hundred lines of Rust.

---

## 06-on-chain-proof (28s)

Devnet bytecode. Real keypair. The diagnose transfer flow script provisions a fresh mint, attempts a transfer to a non-allow-listed destination, gets rejected with policy dot allow-list dot fail at C P I depth three, adds the destination, retries, and gets approved. The audit event lands with final equals true and failed policy index of negative one. Solscan-confirmed. Not local validator. Not a mock. The deployed program.

---

## 07-composability (25s)

Adding a policy to a live mint. Build a new policy. Deploy. Call meta-hook add policy with the program ID and the P D A. Re-initialize the Extra Account Meta List. Two policies become three. The meta-hook code never moves. Existing policies untouched. The composability claim is made true by the on-chain config, not by a marketing diagram.

---

## 08-numbers-cta (20s)

Four Anchor programs deployed devnet. Seven of seven integration tests pass. Thirty-three thousand compute units per transfer with two policies. C P I depth three of four. Bundled provision — eleven hundred fifty-six bytes of one thousand two hundred thirty-two. M I T licensed. The spec is at github dot com slash yonkoo eleven slash multi-hook. Fork it. Ship a policy. Open a P R.

---

**Total runtime target:** ~188s (3:08)

**Beat layout for the composite:**
| Clip | Start (s) | End (s) | Length (s) |
|---|---|---|---|
| 01-hero | 0.0 | 12.0 | 12 |
| 02-problem | 13.0 | 31.0 | 18 |
| 03-architecture | 32.0 | 57.0 | 25 |
| 04-interface | 58.0 | 83.0 | 25 |
| 05-sns-triple-bind | 84.0 | 119.0 | 35 |
| 06-on-chain-proof | 120.0 | 148.0 | 28 |
| 07-composability | 149.0 | 174.0 | 25 |
| 08-numbers-cta | 175.0 | 195.0 | 20 |

Total: 195s with 1s pauses between sections. Hard cap target: <240s (Frontier accepts up to 5 min for technical walkthroughs).

---

**Banned phrases (anti-slop hard gate):**
- "delve" / "vibrant" / "landscape" / "tapestry"
- "comprehensive" / "exhaustive" / "thorough"
- "battle-tested" / "production-ready" / "rock-solid"
- "revolutionary" / "game-changing" / "cutting-edge"
- "It's important to note" / "In today's world" / "in the realm of"
- "seamless" / "robust" / "powerful" (use specific verbs instead)

If any slip in, regenerate.
