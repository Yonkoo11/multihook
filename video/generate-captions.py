#!/usr/bin/env python3
"""Composite subtitle captions onto MetaHook demo frames.

Reads frames from video/frames/, renders verbatim subtitle text in a
semi-transparent box at bottom center, outputs to video/composites/.

Subtitles are line-broken for legibility but TEXT MATCHES THE AUDIO
verbatim. ElevenLabs-friendly spellings (e.g. "Meta Hook", "C P I")
are kept the same in subtitles so a viewer reading muted gets the same
words they would hear.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).parent
FRAMES_DIR = SCRIPT_DIR / "frames"
COMPOSITES_DIR = SCRIPT_DIR / "composites"
COMPOSITES_DIR.mkdir(exist_ok=True)

TARGET_W, TARGET_H = 1920, 1080

# Subtitle text — matches generate-audio.sh verbatim. Hand-broken for
# legibility (line breaks land at natural phrase boundaries).
CLIPS = {
    "01-hero": (
        "This is Meta Hook. Open Zeppelin for the new Solana token standard.\n"
        "One hook, three policies, one signed audit receipt per transfer."
    ),
    "02-problem": (
        "Token Twenty Twenty Two shipped its transfer hook two years ago.\n"
        "But shipping production compliance with it still means writing a custom hook per mint,\n"
        "or paying Anchorage two hundred thousand a year for theirs.\n"
        "There is no third option."
    ),
    "03-solution": (
        "Until now. Meta Hook is the missing piece.\n"
        "One meta hook program. N child policy programs.\n"
        "Every transfer passes through every policy in a single C P I chain,\n"
        "and emits one signed audit receipt with the per-policy verdicts."
    ),
    "04-reject": (
        "Watch it run. We provision a token,\n"
        "then send a hundred to a wallet that is not on the allowlist.\n"
        "The hook rejects with a clean error. Policy allow list fail.\n"
        "Right where the spec says it should."
    ),
    "05-approve": (
        "Add the wallet to the allowlist with one C P I call.\n"
        "Same transfer fires again. Both policies stamp PASS,\n"
        "and the audit event lands in the program logs,\n"
        "base sixty-four encoded, decoded right here in your browser."
    ),
    "06-sponsors": (
        "And it composes. Shield the same transfer through Umbra's encrypted accounts,\n"
        "and the meta hook fires before the privacy layer takes over.\n"
        "Compliance at the entry point. Privacy on the way out.\n"
        "Every sponsor integration audited against a public depth scale."
    ),
    "07-close": (
        "Meta Hook. Compose your compliance stack the same way you\n"
        "compose middleware in Express.\n"
        "Try the live demo. The code is on GitHub."
    ),
}

# Sans-serif fallback chain. Never monospace per the demo-video skill rules.
FONT_CANDIDATES = [
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
    "/Library/Fonts/Arial.ttf",
]

def get_font(size=32):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

def composite_caption(frame_path, text, out_path):
    img = Image.open(frame_path).convert("RGBA")

    # Frames are already 1920x1080 (capture-frames.js sets viewport),
    # but defend against drift by re-canvassing if needed.
    if img.size != (TARGET_W, TARGET_H):
        canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (10, 12, 18, 255))
        ratio = min(TARGET_W / img.width, TARGET_H / img.height)
        new_w = int(img.width * ratio)
        new_h = int(img.height * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        x = (TARGET_W - new_w) // 2
        y = (TARGET_H - new_h) // 2
        canvas.paste(img, (x, y))
        img = canvas

    font = get_font(32)
    lines = text.split("\n")
    line_height = 42
    padding = 20

    draw = ImageDraw.Draw(img)
    max_line_w = 0
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        if line_w > max_line_w:
            max_line_w = line_w

    block_h = len(lines) * line_height
    box_w = max_line_w + padding * 2
    box_h = block_h + padding * 2

    box_x = (TARGET_W - box_w) // 2
    box_y = TARGET_H - box_h - 60  # 60px from bottom edge

    # Semi-transparent black box (alpha 120 = let frame show through)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rounded_rectangle(
        [(box_x, box_y), (box_x + box_w, box_y + box_h)],
        radius=12,
        fill=(0, 0, 0, 130),
    )
    img = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(img)
    text_y = box_y + padding
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        lx = box_x + (box_w - line_w) // 2
        draw.text((lx, text_y + i * line_height), line, font=font, fill=(232, 234, 239, 245))

    img.convert("RGB").save(out_path, "PNG")
    print("  " + out_path.name)

def main():
    for clip_name, text in CLIPS.items():
        frame = FRAMES_DIR / (clip_name + ".png")
        out = COMPOSITES_DIR / (clip_name + ".png")
        if not frame.exists():
            print("  SKIP " + clip_name + " (no frame)")
            continue
        composite_caption(frame, text, out)
    print("Done. Composites in " + str(COMPOSITES_DIR))

if __name__ == "__main__":
    main()
