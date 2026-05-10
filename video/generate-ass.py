#!/usr/bin/env python3
"""Generate the ASS subtitle file directly (avoids ffmpeg force_style
escape hell). All styles baked into the file's [V4+ Styles] section.

Output: video/subs.ass — sans-serif white text on a semi-transparent
black box, bottom center, margin 70px from bottom edge. Designed for
1920x1080 video.
"""

import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
AUDIO_DIR = SCRIPT_DIR / "audio"
OUT = SCRIPT_DIR / "subs.ass"

CLIPS = [
    ("01-hero",     0.5,  [
        "This is Meta Hook. OpenZeppelin for the new Solana token standard.",
        "One hook, three policies, one signed audit receipt per transfer.",
    ]),
    ("02-problem",  10.0, [
        "Token-2022 shipped its transfer hook in early 2024.",
        "But shipping production compliance still means writing a custom",
        "hook per mint, or paying Securitize half a million dollars to wrap",
        "your fund the way BlackRock did. There is no third option.",
    ]),
    ("03-connect",  26.0, [
        "Until now. I connect Phantom on devnet. One click.",
        "Click Provision, and a single signed transaction sets up the mint",
        "with both policies wired into the transfer hook.",
    ]),
    ("04-reject",   37.5, [
        "Now I send a hundred to a wallet that is not on the allowlist.",
        "Phantom asks me to confirm. The hook rejects. policy.allowlist.fail.",
    ]),
    ("05-allow",    47.0, [
        "I add the wallet to the allowlist with one CPI call.",
        "The meta-hook code never moves.",
    ]),
    ("06-approve",  53.0, [
        "Same transfer fires again. Both policies stamp PASS,",
        "and the audit event lands in the program logs, base64-encoded,",
        "decoded right here in the browser. One signed receipt per transfer.",
    ]),
    ("07-compose",  68.0, [
        "And it composes. Anyone can fork the spec,",
        "ship a new policy in 200 lines of Rust,",
        "and slot it into a live mint without touching the meta-hook code.",
    ]),
    ("08-close",    80.0, [
        "MetaHook. Compose your compliance stack the same way you",
        "compose middleware in Express.",
        "Try the live demo. The code is on GitHub.",
    ]),
]

def fmt_time(t):
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h:01d}:{m:02d}:{int(s):02d}.{int((s - int(s)) * 100):02d}"

def audio_dur(name):
    out = subprocess.check_output(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(AUDIO_DIR / f"{name}.mp3")]
    )
    return float(out.strip())

# ASS color format: &HAABBGGRR (alpha in HEX, 00=opaque, FF=transparent)
HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Helvetica Neue,38,&H00EAEAE8,&H00FFFFFF,&H00000000,&HBA000000,0,0,0,0,100,100,0.4,0,4,0,0,2,160,160,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def main():
    body = HEADER
    for name, start, lines in CLIPS:
        end = start + audio_dur(name)
        text = "\\N".join(lines)  # ASS line break
        body += f"Dialogue: 0,{fmt_time(start)},{fmt_time(end)},Default,,0,0,0,,{text}\n"
    OUT.write_text(body)
    print(f"wrote {OUT}")

if __name__ == "__main__":
    main()
