#!/usr/bin/env zsh
# Path A demo recording orchestrator. Records the FULL flow with real
# Phantom popups visible.
#
# Workflow:
#   1. Build the app locally (so we test against the FIXED demo.ts, not the
#      stale GitHub Pages bundle)
#   2. Start `vite preview` on :4173 (production-mode build, faster than dev)
#   3. Start ffmpeg avfoundation screen capture in background
#   4. Run scripts/phantom-record.mjs — drives the flow with real Phantom
#   5. Stop ffmpeg cleanly + kill the preview server
#   6. Print beat timestamps so we can re-time the audio composite
#
# Usage:
#   zsh scripts/record-path-a.sh                  # auto everything
#   AUDIO_REC_DEVICE=3 zsh scripts/record-path-a.sh   # different screen
#
# Output:
#   video/raw-recording-v4.mp4   — the screen capture
#   scripts/beats.json           — beat timestamps from the puppeteer driver

set -e
setopt local_options no_glob no_nomatch

SCRIPT_DIR="${0:a:h}"
ROOT="${SCRIPT_DIR:h}"
cd "$ROOT"

OUT_VIDEO="$ROOT/video/raw-recording-v4.mp4"
BEAT_LOG="$SCRIPT_DIR/beats.json"
SCREEN_DEVICE="${AUDIO_REC_DEVICE:-3}"  # default Capture screen 0 on most macs
PREVIEW_PORT=4173

# --- Pre-flight ---------------------------------------------------------------

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg not installed. brew install ffmpeg." >&2; exit 1
fi
if [[ ! -d "/tmp/phantom-crx/unpacked" ]]; then
  echo "Phantom CRX not extracted at /tmp/phantom-crx/unpacked." >&2
  echo "Run scripts/phantom-e2e.mjs once first to set up Phantom + onboard." >&2
  exit 1
fi
if [[ ! -f "/tmp/phantom-test-key.b58" ]]; then
  echo "Test wallet missing at /tmp/phantom-test-key.b58." >&2; exit 1
fi

echo ""
echo "===== Path A demo recording ====="
echo "  output:        $OUT_VIDEO"
echo "  beat log:      $BEAT_LOG"
echo "  screen device: $SCREEN_DEVICE"
echo "  preview port:  $PREVIEW_PORT"
echo ""

# Sanity: list ffmpeg avfoundation devices so the user can pick the right one
echo "available avfoundation video devices:"
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -A 20 "AVFoundation video devices" | grep "^\[AVFoundation" | grep -E "screen|Capture screen|Display" || true
echo ""

# --- Build app ---------------------------------------------------------------

echo "[1/5] building app..."
cd app
yarn build > /tmp/multihook-build.log 2>&1 || {
  echo "  build failed:"; tail -20 /tmp/multihook-build.log; exit 1;
}
cd "$ROOT"
echo "      ok"

# --- Start preview server ----------------------------------------------------

echo "[2/5] starting vite preview on :$PREVIEW_PORT..."
cd app
yarn preview --port $PREVIEW_PORT --strictPort > /tmp/multihook-preview.log 2>&1 &
PREVIEW_PID=$!
cd "$ROOT"

# wait for server to be ready
for i in {1..20}; do
  if curl -s -f "http://localhost:$PREVIEW_PORT/" > /dev/null 2>&1; then
    echo "      ready after ${i}s"
    break
  fi
  sleep 1
done

if ! curl -s -f "http://localhost:$PREVIEW_PORT/" > /dev/null 2>&1; then
  echo "      preview server failed to start; tail of log:"
  tail -10 /tmp/multihook-preview.log
  kill $PREVIEW_PID 2>/dev/null || true
  exit 1
fi

# --- Start ffmpeg screen capture --------------------------------------------

echo "[3/5] starting ffmpeg avfoundation capture..."
mkdir -p "$(dirname "$OUT_VIDEO")"
ffmpeg -y \
  -f avfoundation -framerate 30 -video_size 1920x1080 \
  -i "${SCREEN_DEVICE}:none" \
  -capture_cursor 1 -capture_mouse_clicks 1 \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
  "$OUT_VIDEO" 2> /tmp/multihook-ffmpeg.log &
FF_PID=$!

# Give ffmpeg a moment to warm up + grab the screen
sleep 3

# --- Run puppeteer driver ----------------------------------------------------

echo "[4/5] running phantom-record.mjs..."
DEMO_URL="http://localhost:$PREVIEW_PORT" \
BEAT_LOG="$BEAT_LOG" \
node scripts/phantom-record.mjs || {
  echo "  recording driver failed (continuing — partial recording may still be useful)"
}

# Give Chrome window an extra second to settle on the closing card
sleep 1.5

# --- Cleanup -----------------------------------------------------------------

echo "[5/5] stopping ffmpeg + preview server..."
kill -INT $FF_PID 2>/dev/null || true
wait $FF_PID 2>/dev/null || true
kill $PREVIEW_PID 2>/dev/null || true

echo ""
if [[ -f "$OUT_VIDEO" ]]; then
  SIZE=$(stat -f '%z' "$OUT_VIDEO")
  DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUT_VIDEO" 2>/dev/null || echo "?")
  echo "✅ raw recording: $OUT_VIDEO"
  echo "   duration: ${DUR}s   size: $((SIZE / 1024 / 1024)) MB"
else
  echo "❌ no output file produced; check /tmp/multihook-ffmpeg.log"
fi

if [[ -f "$BEAT_LOG" ]]; then
  echo ""
  echo "beats:"
  python3 -c "
import json
with open('$BEAT_LOG') as f: d = json.load(f)
for b in d['beats']:
    print(f'  {b[\"t\"]:7.2f}s  {b[\"name\"]:30s}  {b.get(\"note\",\"\")}')
print(f'  total: {d[\"total_seconds\"]:.2f}s')
"
fi

echo ""
echo "next: review the raw recording, then composite via composite-v4.sh"
echo "(audio offsets will be re-aligned to the beats above)"
