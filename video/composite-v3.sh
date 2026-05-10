#!/usr/bin/env zsh
# Composite v3 — raw recording + 8-clip voiceover + Pillow-rendered
# subtitle PNGs as overlays + color grade. Single ffmpeg pass.
#
# Avoids libass / drawtext (homebrew ffmpeg here is stripped down).
# Subtitle PNGs are pre-rendered by render-subs-png.py and timed via
# the same offsets as the audio.
#
# Usage: zsh video/composite-v3.sh

set -e
setopt +o nomatch
setopt local_options no_glob

SCRIPT_DIR="${0:a:h}"
RAW="$SCRIPT_DIR/raw-recording.mp4"
AUDIO_DIR="$SCRIPT_DIR/audio"
SUBS_DIR="$SCRIPT_DIR/subs"
OUT="$SCRIPT_DIR/metahook-demo.mp4"

[[ -f "$RAW" ]] || { echo "missing $RAW"; exit 1; }
[[ -f "$SUBS_DIR/timing.txt" ]] || { echo "missing $SUBS_DIR/timing.txt"; exit 1; }

typeset -A START
START=(
  [01-hero]=0.5
  [02-problem]=10.0
  [03-connect]=32.0
  [04-reject]=43.5
  [05-allow]=52.5
  [06-approve]=58.0
  [07-compose]=72.0
  [08-close]=93.0
)
CLIP_ORDER=(01-hero 02-problem 03-connect 04-reject 05-allow 06-approve 07-compose 08-close)

VIDEO_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$RAW")
echo "raw recording: ${VIDEO_DUR}s"

TRIM_LEN=102
echo "target length: ${TRIM_LEN}s"

INPUTS=("-i" "$RAW")
for c in "${CLIP_ORDER[@]}"; do
  INPUTS+=("-i" "$AUDIO_DIR/$c.mp3")
done
for n in 01 02 03 04 05 06 07 08; do
  INPUTS+=("-i" "$SUBS_DIR/cue-${n}.png")
done

# Audio mix
AFC=""
ALABELS=""
i=1
for c in "${CLIP_ORDER[@]}"; do
  off_ms=$(python3 -c "print(int(${START[$c]} * 1000))")
  chain=$(printf '[%d:a]volume=1.6,adelay=%d|%d,afade=t=in:st=%s:d=0.10[a%d];' "$i" "$off_ms" "$off_ms" "${START[$c]}" "$i")
  AFC+="$chain"
  ALABELS+="[a$i]"
  i=$((i+1))
done
N=${#CLIP_ORDER[@]}
AFC+="${ALABELS}amix=inputs=${N}:duration=longest:dropout_transition=0:normalize=0[mix]"

# Video: color grade + vignette, then 8 chained overlays
VFC="[0:v]eq=contrast=1.06:saturation=1.08:brightness=0.012,vignette=PI/5[graded];"

prev="graded"
sub_input_idx=$((1 + N))
i=1
for c in "${CLIP_ORDER[@]}"; do
  start="${START[$c]}"
  # End = start + audio duration
  dur=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$AUDIO_DIR/$c.mp3")
  end=$(python3 -c "print(round($start + $dur, 3))")
  cur="s$i"
  VFC+="[${prev}][${sub_input_idx}:v]overlay=enable='between(t\\,${start}\\,${end})':x=0:y=0[${cur}];"
  prev="$cur"
  sub_input_idx=$((sub_input_idx + 1))
  i=$((i+1))
done

# Strip trailing semicolon, no need for an extra copy filter
VFC="${VFC%;}"
FINAL_LABEL="$prev"

FC="$AFC;$VFC"

echo ""
echo "filter_complex (${#FC} chars; first 200):"
echo "${FC:0:200}..."
echo ""
echo "encoding..."

ffmpeg -y \
  "${INPUTS[@]}" \
  -filter_complex "$FC" \
  -map "[${FINAL_LABEL}]" -map "[mix]" \
  -t "$TRIM_LEN" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k \
  -movflags +faststart \
  "$OUT" 2>&1 | tail -5

FINAL_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT")
FINAL_SIZE=$(stat -f '%z' "$OUT")
FINAL_MB=$(python3 -c "print(round($FINAL_SIZE / 1048576, 2))")

echo ""
echo "Done: $OUT"
echo "  duration: ${FINAL_DUR}s"
echo "  size:     ${FINAL_MB} MB"
