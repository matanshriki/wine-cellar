#!/usr/bin/env python3
"""Parse Edge-TTS VTT into approximate word timings (proportional within cues)."""
import json
import re
import sys
from pathlib import Path

def parse_ts(s: str) -> float:
    h, m, rest = s.split(":")
    sec, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000.0

def main(vtt_path: str) -> None:
    text = Path(vtt_path).read_text(encoding="utf-8")
    blocks = re.split(r"\n\n+", text.strip())
    words = []
    for block in blocks:
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines or lines[0].isdigit() is False and "-->" not in lines[0]:
            # skip WEBVTT header lines
            if "-->" not in "\n".join(lines):
                continue
        # find timing line
        timing = next((ln for ln in lines if "-->" in ln), None)
        if not timing:
            continue
        start_s, end_s = [p.strip() for p in timing.split("-->")]
        start = parse_ts(start_s)
        end = parse_ts(end_s)
        cue = " ".join(ln for ln in lines if "-->" not in ln and not ln.isdigit())
        toks = [t for t in cue.split() if t]
        if not toks:
            continue
        dur = max(0.01, end - start)
        step = dur / len(toks)
        for i, tok in enumerate(toks):
            words.append({
                "text": tok,
                "start": round(start + i * step, 3),
                "end": round(start + (i + 1) * step, 3),
            })
    print(json.dumps(words, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "audio/vo-he.vtt")
