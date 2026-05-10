#!/usr/bin/env python3
"""Generate the SRT subtitle file matching the audio mix.

Each cue starts at the same offset where the corresponding audio clip
is overlaid (see composite-v3.sh) and lasts for the full audio duration.
Text matches the audio verbatim — line-broken for legibility on a
mobile-sized rendering.
"""

import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
AUDIO_DIR = SCRIPT_DIR / "audio"
OUT = SCRIPT_DIR / "subs.srt"

# Same offsets as composite-v3.sh START map
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
    s = int(t % 60)
    ms = int((t - int(t)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def audio_dur(name):
    out = subprocess.check_output(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(AUDIO_DIR / f"{name}.mp3")]
    )
    return float(out.strip())

def main():
    cues = []
    for i, (name, start, lines) in enumerate(CLIPS, 1):
        end = start + audio_dur(name)
        text = "\n".join(lines)
        cues.append(f"{i}\n{fmt_time(start)} --> {fmt_time(end)}\n{text}\n")

    OUT.write_text("\n".join(cues))
    print(f"wrote {OUT}")
    print(OUT.read_text())

if __name__ == "__main__":
    main()
