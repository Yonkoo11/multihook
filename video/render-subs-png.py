#!/usr/bin/env python3
"""Render each subtitle cue as a transparent 1920x1080 PNG with the
text in a semi-transparent box at the bottom-center. ffmpeg overlays
these on the video at the right timestamps (composite-v3.sh).

Output: video/subs/cue-{NN}.png (8 files)
        video/subs/timing.txt   (start/end seconds per cue, for the overlay
                                 filter enable= clauses)
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).parent
OUT_DIR = SCRIPT_DIR / "subs"
OUT_DIR.mkdir(exist_ok=True)

W, H = 1920, 1080
FONT_CANDIDATES = [
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
    "/Library/Fonts/Arial.ttf",
]

# Match generate-srt.py / generate-ass.py
import subprocess
def audio_dur(name):
    out = subprocess.check_output(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(SCRIPT_DIR / "audio" / f"{name}.mp3")]
    )
    return float(out.strip())

CLIPS = [
    ("01-hero",     0.5,  [
        "This is Meta Hook. OpenZeppelin for the new Solana token standard.",
        "One hook, three policies, one signed audit receipt per transfer.",
    ]),
    ("02-problem",  10.0, [
        "Token-2022 shipped its transfer hook in early 2024.",
        "But shipping production compliance still means writing a custom hook per mint,",
        "or paying Securitize half a million dollars to wrap your fund the way BlackRock did.",
        "There is no third option.",
    ]),
    ("03-connect",  32.0, [
        "Until now. I connect Phantom on devnet. One click.",
        "Click Provision, and a single signed transaction sets up the mint",
        "with both policies wired into the transfer hook.",
    ]),
    ("04-reject",   43.5, [
        "Now I send a hundred to a wallet that is not on the allowlist.",
        "Phantom asks me to confirm. The hook rejects. policy.allowlist.fail.",
    ]),
    ("05-allow",    52.5, [
        "I add the wallet to the allowlist with one CPI call.",
        "The meta-hook code never moves.",
    ]),
    ("06-approve",  58.0, [
        "Same transfer fires again. Both policies stamp PASS,",
        "and the audit event lands in the program logs, base64-encoded,",
        "decoded right here in the browser. One signed receipt per transfer.",
    ]),
    ("07-compose",  72.0, [
        "And it composes. Anyone can fork the spec,",
        "ship a new policy in 200 lines of Rust,",
        "and slot it into a live mint without touching the meta-hook code.",
    ]),
    ("08-close",    93.0, [
        "MetaHook. Compose your compliance stack the same way you",
        "compose middleware in Express.",
        "Try the live demo. The code is on GitHub.",
    ]),
]

def get_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def render_cue(lines, out_path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = get_font(38)
    line_h = 50
    pad_x, pad_y = 30, 22

    # Measure widest line
    max_w = 0
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=font)
        max_w = max(max_w, bb[2] - bb[0])

    box_w = max_w + pad_x * 2
    box_h = len(lines) * line_h + pad_y * 2
    box_x = (W - box_w) // 2
    box_y = H - box_h - 80  # 80px from bottom edge

    # Semi-transparent black box (alpha 195 ~ 76% opaque)
    box = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(box)
    bd.rounded_rectangle(
        [(box_x, box_y), (box_x + box_w, box_y + box_h)],
        radius=14,
        fill=(0, 0, 0, 195),
    )
    img = Image.alpha_composite(img, box)

    # Text (white, slight off-white)
    draw = ImageDraw.Draw(img)
    text_y = box_y + pad_y
    for i, line in enumerate(lines):
        bb = draw.textbbox((0, 0), line, font=font)
        line_w = bb[2] - bb[0]
        lx = box_x + (box_w - line_w) // 2
        draw.text((lx, text_y + i * line_h), line, font=font, fill=(234, 234, 232, 255))

    img.save(out_path, "PNG")

def main():
    timing_lines = []
    for i, (name, start, lines) in enumerate(CLIPS, 1):
        end = start + audio_dur(name)
        out = OUT_DIR / f"cue-{i:02d}.png"
        render_cue(lines, out)
        print(f"  {out.name}  [{start:.2f}-{end:.2f}]s")
        timing_lines.append(f"{i:02d} {start:.3f} {end:.3f}")
    (OUT_DIR / "timing.txt").write_text("\n".join(timing_lines) + "\n")
    print(f"wrote {len(CLIPS)} cues + timing.txt")

if __name__ == "__main__":
    main()
