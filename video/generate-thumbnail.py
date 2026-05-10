#!/usr/bin/env python3
"""Build the YouTube/Devpost thumbnail.

Composition: cobalt-glow background, large MetaHook wordmark + brand
mark, big bold tagline, WATCH DEMO chip. No overlap with live page
content (we paint our own background instead of using a frame).
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).parent
OUT = SCRIPT_DIR / "thumbnail.png"

W, H = 1920, 1080
COBALT = (59, 102, 255)
COBALT_DEEP = (34, 56, 140)
TEXT = (232, 234, 239)
TEXT_DIM = (154, 161, 179)
BASE = (10, 12, 18)

FONT_BOLD = "/System/Library/Fonts/HelveticaNeue.ttc"
GEIST = "/Library/Fonts/Arial.ttf"  # Geist isn't system-wide; fall back.

def load(size, font_path=FONT_BOLD, idx=8):
    try:
        return ImageFont.truetype(font_path, size, index=idx)
    except Exception:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            return ImageFont.load_default()

def main():
    # Solid cobalt-glow base
    img = Image.new("RGB", (W, H), BASE)

    # Cobalt radial glow at top-right (matches site)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = int(W * 0.78), int(H * -0.05)
    for r in range(900, 0, -40):
        alpha = int(50 * (1 - r / 900))
        gd.ellipse([(cx - r, cy - r), (cx + r, cy + r)],
                   fill=(*COBALT, alpha))
    img.paste(glow, (0, 0), glow)

    # Cobalt radial glow at bottom-left
    glow2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd2 = ImageDraw.Draw(glow2)
    cx2, cy2 = int(W * 0.05), int(H * 0.95)
    for r in range(700, 0, -40):
        alpha = int(35 * (1 - r / 700))
        gd2.ellipse([(cx2 - r, cy2 - r), (cx2 + r, cy2 + r)],
                    fill=(*COBALT, alpha))
    img.paste(glow2, (0, 0), glow2)

    draw = ImageDraw.Draw(img)

    # Brand row — mark + wordmark, top center
    mark_size = 130
    mark_x = 130
    mark_y = 130
    draw.rounded_rectangle(
        [(mark_x, mark_y), (mark_x + mark_size, mark_y + mark_size)],
        radius=18,
        fill=(*COBALT, 30),
        outline=COBALT,
        width=3,
    )
    mark_font = load(82)
    mbox = draw.textbbox((0, 0), "M", font=mark_font)
    mw = mbox[2] - mbox[0]
    mh = mbox[3] - mbox[1]
    draw.text(
        (mark_x + (mark_size - mw) // 2, mark_y + (mark_size - mh) // 2 - 8),
        "M", font=mark_font, fill=COBALT,
    )

    wordmark_font = load(110)
    draw.text((mark_x + mark_size + 32, mark_y + 18), "MetaHook",
              font=wordmark_font, fill=TEXT)

    # Eyebrow chip
    chip_font = load(28)
    chip_text = "TOKEN-2022 · MIT-LICENSED · DEVNET LIVE"
    chip_bbox = draw.textbbox((0, 0), chip_text, font=chip_font)
    chip_w = chip_bbox[2] - chip_bbox[0] + 36
    chip_h = chip_bbox[3] - chip_bbox[1] + 22
    chip_x = 130
    chip_y = 380
    draw.rounded_rectangle(
        [(chip_x, chip_y), (chip_x + chip_w, chip_y + chip_h)],
        radius=8,
        fill=(*COBALT, 40),
        outline=(*COBALT, 130),
        width=1,
    )
    draw.text((chip_x + 18, chip_y + 9), chip_text, font=chip_font, fill=TEXT_DIM)

    # Big headline — 2 lines, generous tracking
    h1 = load(150)
    headline = [
        ("OpenZeppelin", COBALT),
        ("for Token-2022", TEXT),
        ("compliance.", TEXT),
    ]
    y = chip_y + chip_h + 32
    for i, (line, color) in enumerate(headline):
        draw.text((130, y + i * 142), line, font=h1, fill=color)

    # WATCH DEMO chip bottom-right
    play_w = 360
    play_h = 110
    play_x = W - play_w - 130
    play_y = H - play_h - 90
    draw.rounded_rectangle(
        [(play_x, play_y), (play_x + play_w, play_y + play_h)],
        radius=14,
        fill=COBALT,
    )
    play_font = load(42)
    pt = "▸  WATCH DEMO"
    pb = draw.textbbox((0, 0), pt, font=play_font)
    pw = pb[2] - pb[0]
    ph = pb[3] - pb[1]
    draw.text(
        (play_x + (play_w - pw) // 2, play_y + (play_h - ph) // 2 - 6),
        pt, font=play_font, fill=(255, 255, 255),
    )

    # Bottom-right tagline (smaller, dim)
    tag_font = load(26)
    tag = "github.com/Yonkoo11/multihook"
    tb = draw.textbbox((0, 0), tag, font=tag_font)
    tw = tb[2] - tb[0]
    draw.text((W - tw - 130, H - 50), tag, font=tag_font, fill=TEXT_DIM)

    img.save(OUT, "PNG")
    print("wrote " + str(OUT))

if __name__ == "__main__":
    main()
