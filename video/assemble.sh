#!/usr/bin/env zsh
# Assemble MetaHook demo video from composites + audio.
# Per the demo-video pipeline:
#   - Audio drives timing (frame duration = audio duration + padding)
#   - Use filter_complex to prepend silence (NEVER -itsoffset, NEVER adelay)
#   - Re-encode during concat (NEVER -c copy with concat demuxer)
#
# Usage: zsh video/assemble.sh

set -e
setopt +o nomatch

SCRIPT_DIR="${0:a:h}"
COMPOSITES_DIR="$SCRIPT_DIR/composites"
AUDIO_DIR="$SCRIPT_DIR/audio"
SEGMENTS_DIR="$SCRIPT_DIR/segments"
OUTPUT="$SCRIPT_DIR/metahook-demo.mp4"

mkdir -p "$SEGMENTS_DIR"
rm -f "$SEGMENTS_DIR"/*.mp4

# Per-segment timing (canonical demo-video pipeline values)
VFADE_IN=0.2     # video fade-in
AUDIO_DELAY=0.5  # audio starts this many seconds in (frame fully visible)
BREATH=0.3       # silence after audio, frame still visible
VFADE_OUT=0.2    # video fade-out
GAP=0.3          # black between segments

CLIP_ORDER=(01-hero 02-problem 03-solution 04-reject 05-approve 06-sponsors 07-close)

echo "Building per-clip segments..."

for clip in "${CLIP_ORDER[@]}"; do
  COMPOSITE="$COMPOSITES_DIR/$clip.png"
  AUDIO="$AUDIO_DIR/$clip.mp3"
  SEG="$SEGMENTS_DIR/$clip.mp4"

  if [[ ! -f "$COMPOSITE" || ! -f "$AUDIO" ]]; then
    echo "  SKIP $clip (missing composite or audio)"
    continue
  fi

  AUDIO_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$AUDIO")
  TOTAL=$(python3 -c "print(round($AUDIO_DELAY + $AUDIO_DUR + $BREATH + $VFADE_OUT, 3))")
  FO_START=$(python3 -c "print(round($TOTAL - $VFADE_OUT, 3))")
  AFO_START=$(python3 -c "print(round($AUDIO_DELAY + $AUDIO_DUR - 0.25, 3))")

  echo "  SEG  $clip (audio=${AUDIO_DUR}s, total=${TOTAL}s)"

  ffmpeg -y \
    -loop 1 -i "$COMPOSITE" \
    -i "$AUDIO" \
    -filter_complex "
      anullsrc=r=44100:cl=stereo,atrim=0:${AUDIO_DELAY}[silence];
      [silence][1:a]concat=n=2:v=0:a=1[joined];
      [joined]afade=t=in:st=${AUDIO_DELAY}:d=0.15,afade=t=out:st=${AFO_START}:d=0.25,apad=whole_dur=${TOTAL}[a];
      [0:v]scale=1920:1080,fade=t=in:st=0:d=${VFADE_IN},fade=t=out:st=${FO_START}:d=${VFADE_OUT}[v]
    " \
    -map "[v]" -map "[a]" \
    -t "$TOTAL" \
    -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p \
    -c:a aac -b:a 128k \
    -r 30 "$SEG" 2>/dev/null

  if [[ ! -f "$SEG" ]]; then
    echo "  ERROR: failed to encode $clip"
    exit 1
  fi
done

# Black gap between segments
GAP_SEG="$SEGMENTS_DIR/gap.mp4"
echo "  GAP  ${GAP}s black"
ffmpeg -y \
  -f lavfi -i "color=c=black:s=1920x1080:d=${GAP}:r=30" \
  -f lavfi -i "anullsrc=r=44100:cl=stereo" \
  -t "$GAP" \
  -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  "$GAP_SEG" 2>/dev/null

# Concat list: clip, gap, clip, gap, ..., clip
CONCAT_LIST="$SEGMENTS_DIR/concat.txt"
> "$CONCAT_LIST"
i=0
for clip in "${CLIP_ORDER[@]}"; do
  i=$((i + 1))
  echo "file '$clip.mp4'" >> "$CONCAT_LIST"
  if (( i < ${#CLIP_ORDER[@]} )); then
    echo "file 'gap.mp4'" >> "$CONCAT_LIST"
  fi
done

echo ""
echo "Assembling final video (re-encode during concat to prevent A/V drift)..."

ffmpeg -y \
  -f concat -safe 0 -i "$CONCAT_LIST" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -r 30 "$OUTPUT" 2>/dev/null

FINAL_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT")
FINAL_SIZE=$(stat -f '%z' "$OUTPUT")
FINAL_MB=$(python3 -c "print(round($FINAL_SIZE / 1048576, 2))")

echo ""
echo "Done: $OUTPUT"
echo "  duration: ${FINAL_DUR}s"
echo "  size:     ${FINAL_MB} MB"
