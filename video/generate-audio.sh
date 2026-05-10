#!/usr/bin/env zsh
# MetaHook demo voiceover — ElevenLabs Brian voice.
# Usage: zsh video/generate-audio.sh
#
# Reads ELEVENLABS_API_KEY from ~/.zshenv (loaded by interactive zsh sessions).
# stability 0.82 / similarity 0.65 / style 0.03 — slow + deliberate per
# YC pacing research.

set -e
setopt +o nomatch

SCRIPT_DIR="${0:a:h}"
AUDIO_DIR="$SCRIPT_DIR/audio"
mkdir -p "$AUDIO_DIR"

# Source .zshenv only if the key isn't already present in the env.
if [[ -z "$ELEVENLABS_API_KEY" ]] && [[ -f ~/.zshenv ]]; then
  source ~/.zshenv 2>/dev/null
fi

if [[ -z "$ELEVENLABS_API_KEY" ]]; then
  echo "ERROR: ELEVENLABS_API_KEY not set. Add it to ~/.zshenv or export it before running."
  exit 1
fi

VOICE_ID="nPczCjzI2devNBz1zQrb"   # Brian
MODEL="eleven_multilingual_v2"

# Clip texts — read from the canonical script in VOICEOVER_CLIPS.md.
# Keep these in sync with that file. Subtitles use these strings verbatim.
typeset -A CLIPS
CLIPS=(
  [01-hero]="This is Meta Hook. Open Zeppelin for the new Solana token standard. One hook, three policies, one signed audit receipt per transfer."
  [02-problem]="Token Twenty Twenty Two shipped its transfer hook in early twenty twenty-four. But shipping production compliance with it still means writing a custom hook per mint, or paying Securitize half a million dollars to wrap your fund the way BlackRock did. There is no third option."
  [03-connect]="Until now. I connect Phantom on devnet. One click. Click Provision, and a single signed transaction sets up the mint with both policies wired into the transfer hook."
  [04-reject]="Now I send a hundred to a wallet that is not on the allowlist. Phantom asks me to confirm. The hook rejects. Policy allow list fail."
  [05-allow]="I add the wallet to the allowlist with one C P I call. The meta hook code never moves."
  [06-approve]="Same transfer fires again. Both policies stamp PASS, and the audit event lands in the program logs, base sixty-four encoded, decoded right here in the browser. One signed receipt per transfer."
  [07-compose]="And it composes. Anyone can fork the spec, ship a new policy in two hundred lines of Rust, and slot it into a live mint without touching the meta hook code."
  [08-close]="Meta Hook. Compose your compliance stack the same way you compose middleware in Express. Try the live demo. The code is on GitHub."
)

CLIP_ORDER=(01-hero 02-problem 03-connect 04-reject 05-allow 06-approve 07-compose 08-close)

# Pre-flight quota check
QUOTA=$(curl -s https://api.elevenlabs.io/v1/user -H "xi-api-key: $ELEVENLABS_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); s=d['subscription']; print(s['character_limit']-s['character_count'])")
TOTAL_CHARS=0
for clip in "${CLIP_ORDER[@]}"; do
  TOTAL_CHARS=$(( TOTAL_CHARS + ${#CLIPS[$clip]} ))
done
echo "Quota: $QUOTA characters remaining; this run needs ~$TOTAL_CHARS."
if (( QUOTA < TOTAL_CHARS )); then
  echo "ERROR: Not enough quota."
  exit 1
fi

for clip in "${CLIP_ORDER[@]}"; do
  OUT="$AUDIO_DIR/$clip.mp3"
  if [[ -f "$OUT" ]]; then
    echo "  SKIP $clip (exists, ${$(stat -f '%z' "$OUT")} bytes)"
    continue
  fi

  TEXT="${CLIPS[$clip]}"
  echo "  GEN  $clip (${#TEXT} chars)..."

  curl -s -o "$OUT" \
    -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"$TEXT\",
      \"model_id\": \"$MODEL\",
      \"voice_settings\": {
        \"stability\": 0.82,
        \"similarity_boost\": 0.65,
        \"style\": 0.03
      }
    }"

  if file "$OUT" | grep -qE 'JSON|ASCII|text|empty'; then
    echo "  ERROR: $clip returned non-audio response:"
    head -c 300 "$OUT"; echo ""
    rm -f "$OUT"
    exit 1
  fi

  DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null)
  echo "  OK   $clip (${DUR}s)"
done

echo ""
echo "Done. Audio clips in $AUDIO_DIR"
ls -la "$AUDIO_DIR"
