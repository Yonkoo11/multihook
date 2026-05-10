#!/usr/bin/env zsh
# Composite the live-site recording with the ElevenLabs voiceover track.
# No music (per the no-generic-bg-music memory rule).
#
# Each voice clip is positioned so it lands on the visual beat it narrates,
# with deliberate silence between clips for breathing room.
#
# Usage: zsh video/composite.sh

set -e
setopt +o nomatch

SCRIPT_DIR="${0:a:h}"
RAW="$SCRIPT_DIR/raw-recording.mp4"
AUDIO="$SCRIPT_DIR/audio"
OUT="$SCRIPT_DIR/metahook-demo.mp4"

if [[ ! -f "$RAW" ]]; then
  echo "ERROR: $RAW not found. Run scripts/site-record.mjs first."
  exit 1
fi

# Audio clip start offsets (seconds, relative to t=0 of the final video).
# Calibrated against the recording's per-beat visual cadence:
#   t=0:    recording starts (page already loaded), hero linger
#   t=9:    smooth scroll to problem section starts
#   t=23:   demo page transition + tour begins
#   t=38:   reject station highlight
#   t=50:   approve station highlight + audit receipt scroll-into-view
#   t=64:   sponsors page slow-scroll
#   t=79:   closing card
typeset -A START
# Calibrated against actual recording beats (frames extracted via ffprobe):
#   t=0..7    hero linger
#   t=7..23   smooth scroll + problem section
#   t=23..40  demo page + 5-station tour
#   t=40..52  reject station highlight (with injected fail log)
#   t=52..66  approve station highlight + audit-receipt scroll-into-view
#   t=66..93  sponsors page + slow scroll
#   t=93..103 closing card overlay
START=(
  [01-hero]=0.5
  [02-problem]=9.5
  [03-solution]=24.5
  [04-reject]=40.5
  [05-approve]=53.5
  [06-sponsors]=68.5
  [07-close]=93.0
)
CLIP_ORDER=(01-hero 02-problem 03-solution 04-reject 05-approve 06-sponsors 07-close)

# Verify all audio files exist
for c in "${CLIP_ORDER[@]}"; do
  [[ -f "$AUDIO/$c.mp3" ]] || { echo "missing $AUDIO/$c.mp3"; exit 1; }
done

VIDEO_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$RAW")
echo "raw recording: ${VIDEO_DUR}s"

# Trim to 102s — keeps the closing card visible after the closing voiceover
# wraps at t=100.8 (clip 07 starts t=93, runs 7.8s).
TRIM_LEN=102
echo "trimming to ${TRIM_LEN}s..."

# Build the filter_complex. Disable glob expansion locally so [N:a] stream
# specifiers don't get interpreted as character classes by zsh.
setopt +o nomatch  # no error if a glob doesn't match
setopt local_options no_glob

FC=""
INPUTS=("-i" "$RAW")
i=1
LABELS=""
for c in "${CLIP_ORDER[@]}"; do
  INPUTS+=("-i" "$AUDIO/$c.mp3")
  off_ms=$(python3 -c "print(int(${START[$c]} * 1000))")
  # adelay with channel-list applies to mono and gets fixed up by amix.
  # Use printf to construct each filter chain without zsh string-glob risk.
  chain=$(printf '[%d:a]volume=1.6,adelay=%d|%d,afade=t=in:st=%s:d=0.10[a%d];' "$i" "$off_ms" "$off_ms" "${START[$c]}" "$i")
  FC+="$chain"
  LABELS+="[a$i]"
  i=$((i+1))
done

N=${#CLIP_ORDER[@]}
FC+="${LABELS}amix=inputs=${N}:duration=longest:dropout_transition=0:normalize=0[mix]"

# Sanity-print the filter graph
echo "filter_complex (${#FC} chars):"
echo "$FC" | head -c 400
echo "..."

echo "composing audio onto video..."

ffmpeg -y \
  "${INPUTS[@]}" \
  -filter_complex "$FC" \
  -map 0:v -map "[mix]" \
  -t $TRIM_LEN \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k \
  -movflags +faststart \
  "$OUT.tmp.mp4" 2>&1 | tail -3

# Color-grade pass: +6% contrast, +8% saturation, slight vignette, gentle
# brightness lift
echo "color grading..."
ffmpeg -y -i "$OUT.tmp.mp4" \
  -vf "eq=contrast=1.06:saturation=1.08:brightness=0.012,vignette=PI/5" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a copy \
  -movflags +faststart \
  "$OUT" 2>&1 | tail -3

rm -f "$OUT.tmp.mp4"

FINAL_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT")
FINAL_SIZE=$(stat -f '%z' "$OUT")
FINAL_MB=$(python3 -c "print(round($FINAL_SIZE / 1048576, 2))")

echo ""
echo "Done: $OUT"
echo "  duration: ${FINAL_DUR}s"
echo "  size:     ${FINAL_MB} MB"
