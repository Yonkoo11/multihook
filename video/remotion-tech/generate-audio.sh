#!/usr/bin/env zsh
# Generate the 8 voiceover clips for the technical walkthrough via
# ElevenLabs. Brian voice. Same settings as the v3 pitch.
#
# Reads ELEVENLABS_API_KEY from the env (export it from ~/.zshenv before
# running). Writes mp3s to public/audio/<id>.mp3.

set -e
setopt local_options no_glob no_nomatch

SCRIPT_DIR="${0:a:h}"
OUT_DIR="$SCRIPT_DIR/public/audio"
mkdir -p "$OUT_DIR"

if [[ -z "$ELEVENLABS_API_KEY" ]]; then
  echo "ELEVENLABS_API_KEY is not set." >&2
  echo "Add 'export ELEVENLABS_API_KEY=<your-key>' to ~/.zshenv and source it." >&2
  exit 1
fi

VOICE_ID="nPczCjzI2devNBz1zQrb"   # Brian
MODEL_ID="eleven_multilingual_v2"

# Pre-flight quota check — warn if we're below the budget for 8 clips
QUOTA_JSON=$(curl -fsS "https://api.elevenlabs.io/v1/user/subscription" -H "xi-api-key: $ELEVENLABS_API_KEY")
USED=$(echo "$QUOTA_JSON" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('character_count', 0))")
LIMIT=$(echo "$QUOTA_JSON" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('character_limit', 0))")
REMAINING=$((LIMIT - USED))
echo "ElevenLabs quota: $USED / $LIMIT used  ($REMAINING chars remaining)"
echo ""

# All 8 clips below. Two-line format: id then text.
typeset -A CLIPS

CLIPS[01-hero]='This is Meta Hook. Composable Token twenty-twenty-two compliance. One meta-hook program, N child policies, AND-aggregated, with a per-mint config P D A. Anyone ships a policy in two hundred lines of Rust and slots it into a live mint without forking the meta-hook.'

CLIPS[02-problem]='Token twenty-twenty-two shipped its transfer hook in early twenty twenty-four. BlackRock paid Securitize five hundred and twenty-five thousand dollars, plus half a percent management, to wrap their B U I D L fund. Smaller issuers cannot justify that. They write a bespoke hook per mint, or they skip compliance entirely. There is no public-good middle ground.'

CLIPS[03-architecture]='Token twenty-twenty-two calls meta-hook dot execute on every transfer. The hook reads a per-mint Meta Hook Config P D A, loops over the configured policies, C P Is into each, and AND-aggregates. The config stores program-ID and P D A pairs. Up to eight policies. Aggregation mode. Authority for governance. Reading the config is the entire dispatcher. One for-loop.'

CLIPS[04-interface]='Every child policy implements one instruction. Check transfer with amount, plus a fixed account context — source, mint, destination, owner, your policy state. Return Ok to approve. Return an error matching policy dot your-name dot fail for clean reject. The meta-hook validates each program ID and P D A against the config before invoking. No fork required.'

CLIPS[05-sns-triple-bind]='The interesting code is policy dash S N S allow-list. Three independent checks. One — the S N S NameRecord account must be owned by the canonical Bonfida program. Verified by hardcoded program ID. This blocks any forged name service. Two — the NameRecord P D A must be on the issuer authorized set. Three — the NameRecord owner field must match the destination token-account owner. This defeats the historical-control replay where someone who used to own a domain accepts transfers on its behalf. All three checks. Two hundred lines of Rust.'

CLIPS[06-on-chain-proof]='Devnet bytecode. Real keypair. The diagnose transfer flow script provisions a fresh mint, attempts a transfer to a non-allow-listed destination, gets rejected with policy dot allow-list dot fail at C P I depth three, adds the destination, retries, and gets approved. The audit event lands with final equals true and failed policy index of negative one. Solscan-confirmed. Not local validator. Not a mock. The deployed program.'

CLIPS[07-composability]='Adding a policy to a live mint. Build a new policy. Deploy. Call meta-hook add policy with the program ID and the P D A. Re-initialize the Extra Account Meta List. Two policies become three. The meta-hook code never moves. Existing policies untouched. The composability claim is made true by the on-chain config, not by a marketing diagram.'

CLIPS[08-numbers-cta]='Four Anchor programs deployed devnet. Seven of seven integration tests pass. Thirty-three thousand compute units per transfer with two policies. C P I depth three of four. Bundled provision — eleven hundred fifty-six bytes of one thousand two hundred thirty-two. M I T licensed. The spec is at github dot com slash yonkoo eleven slash multi-hook. Fork it. Ship a policy. Open a P R.'

CLIP_ORDER=(01-hero 02-problem 03-architecture 04-interface 05-sns-triple-bind 06-on-chain-proof 07-composability 08-numbers-cta)

# Total chars
TOTAL_CHARS=0
for c in "${CLIP_ORDER[@]}"; do
  L=${#CLIPS[$c]}
  TOTAL_CHARS=$((TOTAL_CHARS + L))
done
echo "Total chars across 8 clips: $TOTAL_CHARS"
if (( TOTAL_CHARS > REMAINING )); then
  echo "WARNING: requesting $TOTAL_CHARS chars but only $REMAINING remaining"
  echo "Continue? (Ctrl-C to abort)"
  read -k 1
fi
echo ""

# Generate
for c in "${CLIP_ORDER[@]}"; do
  OUT="$OUT_DIR/$c.mp3"
  if [[ -f "$OUT" ]]; then
    echo "skip $c (already generated)"
    continue
  fi
  echo "→ $c (${#CLIPS[$c]} chars)..."

  # Stable=0.82, similarity=0.65, style=0.03 (matches v3 pitch settings)
  RESPONSE_FILE=$(mktemp)
  HTTP_CODE=$(curl -sS -w "%{http_code}" -o "$OUT" \
    -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'text':'''${CLIPS[$c]}''','model_id':'$MODEL_ID','voice_settings':{'stability':0.82,'similarity_boost':0.65,'style':0.03,'use_speaker_boost':True}}))" )")

  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "  ❌ HTTP $HTTP_CODE"
    cat "$OUT"
    rm "$OUT"
    rm -f "$RESPONSE_FILE"
    exit 1
  fi
  rm -f "$RESPONSE_FILE"

  SIZE=$(stat -f '%z' "$OUT")
  DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null || echo "?")
  echo "  ✓ ${SIZE} bytes, ${DUR}s"
done

echo ""
echo "Done. Audio in $OUT_DIR/"
ls -la "$OUT_DIR/"
