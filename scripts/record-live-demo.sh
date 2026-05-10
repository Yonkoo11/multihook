#!/usr/bin/env zsh
# Record the live MetaHook demo end-to-end with REAL Phantom popups.
#
# Starts ffmpeg avfoundation screen capture in the background, runs the
# proven phantom-e2e.mjs flow (which drives Chrome + Phantom CRX through
# the full provision -> reject -> allow -> retry sequence on devnet),
# then sends SIGINT to ffmpeg so it writes the moov atom cleanly.
#
# Output: video/screen-capture.mp4 — full-screen capture at 30fps,
#         duration matches the live flow (typically 3-5 min on devnet).
#
# Hard requirements before running:
#   - macOS Terminal/iTerm has Screen Recording permission
#   - Other apps minimized / desktop clear (recording captures everything)
#   - Phantom CRX unpacked at /tmp/phantom-crx/unpacked
#   - Persistent profile at /tmp/multihook-phantom-profile (already onboarded)
#   - Test wallet funded on devnet (CDi6...knMX has 4.4 SOL last check)

set -e
setopt +o nomatch

PROJECT_ROOT="${0:a:h}/.."
OUT="$PROJECT_ROOT/video/screen-capture.mp4"
LOG="/tmp/record-live-demo.log"
FFMPEG_PID_FILE="/tmp/record-ffmpeg.pid"

mkdir -p "$PROJECT_ROOT/video"
rm -f "$OUT"

# Sanity: avfoundation device 3 = "Capture screen 0" on this Mac.
# Double-check the index by running:
#   ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep "Capture screen"
SCREEN_DEV="3:none"

echo "▶ starting ffmpeg screen capture -> $OUT"
echo "▶ press Ctrl-C in puppeteer to stop early"

# Background ffmpeg. -capture_cursor 1 includes the OS cursor so judges
# see where actions happen. -framerate 30 keeps file size sane while
# matching the 30fps target. Output 2880x1800 native; we scale down
# in the composite step.
ffmpeg -y \
  -f avfoundation \
  -framerate 30 \
  -capture_cursor 1 \
  -i "$SCREEN_DEV" \
  -c:v libx264 -preset ultrafast -crf 22 -pix_fmt yuv420p \
  -threads 4 \
  "$OUT" \
  > /tmp/ffmpeg-screen.log 2>&1 &

FFMPEG_PID=$!
echo $FFMPEG_PID > "$FFMPEG_PID_FILE"
echo "  ffmpeg PID: $FFMPEG_PID (logging to /tmp/ffmpeg-screen.log)"

# Give ffmpeg a moment to spin up and start writing
sleep 2

# Verify ffmpeg is actually running
if ! kill -0 $FFMPEG_PID 2>/dev/null; then
  echo "❌ ffmpeg failed to start. Last log lines:"
  tail -20 /tmp/ffmpeg-screen.log
  exit 1
fi

echo "▶ running phantom-e2e flow..."
echo "  (this takes 3-5 min on devnet)"
echo ""

# Run the proven E2E flow. exit_status captures success/fail.
node "$PROJECT_ROOT/scripts/phantom-e2e.mjs" 2>&1 | tee "$LOG"
PUPPETEER_EXIT=${pipestatus[1]}

echo ""
echo "▶ stopping ffmpeg (sending SIGINT for clean stop)"

# SIGINT (q) is the cleanest stop for ffmpeg — it writes the moov atom.
# kill -INT vs kill -TERM: ffmpeg handles INT specially as "wrap up".
kill -INT $FFMPEG_PID 2>/dev/null || echo "  (ffmpeg already exited)"

# Wait up to 10s for ffmpeg to finish flushing
for i in {1..20}; do
  if ! kill -0 $FFMPEG_PID 2>/dev/null; then break; fi
  sleep 0.5
done
# Force kill if still alive
kill -9 $FFMPEG_PID 2>/dev/null
wait $FFMPEG_PID 2>/dev/null

rm -f "$FFMPEG_PID_FILE"

if [[ ! -f "$OUT" ]]; then
  echo "❌ no output produced"
  exit 1
fi

DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT" 2>/dev/null)
SIZE=$(stat -f '%z' "$OUT")
SIZE_MB=$(python3 -c "print(round($SIZE / 1048576, 2))")

echo ""
echo "🎬 RECORDING DONE"
echo "  output:    $OUT"
echo "  duration:  ${DUR}s"
echo "  size:      ${SIZE_MB} MB"
echo "  puppeteer: exit $PUPPETEER_EXIT"
