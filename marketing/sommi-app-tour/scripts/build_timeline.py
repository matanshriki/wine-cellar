#!/usr/bin/env python3
"""TTS each scene line, fit scene lengths to narration, retime app clips, write timeline JSON."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDGE_TTS = str(Path.home() / "Library/Python/3.9/bin/edge-tts")
FFMPEG = "/opt/homebrew/bin/ffmpeg"
FFPROBE = "/opt/homebrew/bin/ffprobe"

VO_LEAD = 0.3
VO_TAIL = 0.7
MAX_SPEED = 1.8
FADE = 0.4


def run(*args, retries=1):
    for attempt in range(retries):
        res = subprocess.run(args, capture_output=True, text=True)
        if res.returncode == 0:
            return
        if attempt == retries - 1:
            raise RuntimeError(f"{args[0]} failed: {res.stderr[-600:]}")


def duration(path):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def ts(s):
    h, m, rest = s.replace(".", ",").split(":")
    sec, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000


def words_from_vtt(vtt_path, offset):
    """Edge-TTS gives sentence cues; spread words across each cue by character length."""
    words = []
    blocks = re.split(r"\n\s*\n", Path(vtt_path).read_text(encoding="utf-8").strip())
    for block in blocks:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        timing = next((l for l in lines if "-->" in l), None)
        if not timing:
            continue
        a, b = [p.strip() for p in timing.split("-->")]
        start, end = ts(a), ts(b)
        text = " ".join(l for l in lines if "-->" not in l and not l.isdigit())
        toks = [t for t in text.split() if t not in {"-", "—", "–"}]
        weights = [len(t) + 2 for t in toks]
        total = sum(weights) or 1
        t = start
        for tok, w in zip(toks, weights):
            d = (end - start) * w / total
            words.append({"text": tok, "start": round(offset + t, 3), "end": round(offset + t + d, 3)})
            t += d
    return words


def retime_clip(src, dst, target):
    src_len = duration(src)
    speed = max(1.0, src_len / target)
    speed = min(speed, MAX_SPEED)
    played = src_len / speed
    pad = max(0.0, target - played)
    vf = f"setpts=PTS/{speed:.4f},scale=780:1688:flags=lanczos"
    if pad > 0.01:
        vf += f",tpad=stop_mode=clone:stop_duration={pad:.3f}"
    run(FFMPEG, "-y", "-loglevel", "error", "-i", str(src), "-vf", vf, "-t", f"{target:.3f}",
        "-an", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(dst))
    return speed


def build(locale):
    spec = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
    voice, rate = spec["voices"][locale], spec["rates"][locale]
    audio_dir = ROOT / "audio" / locale
    scene_dir = ROOT / "assets" / "scenes" / locale
    audio_dir.mkdir(parents=True, exist_ok=True)
    scene_dir.mkdir(parents=True, exist_ok=True)

    t = 0.0
    scenes, words, inputs, delays = [], [], [], []
    for i, sc in enumerate(spec["scenes"]):
        copy = sc[locale]
        mp3, vtt = audio_dir / f"line{i}.mp3", audio_dir / f"line{i}.vtt"
        run(EDGE_TTS, "-v", voice, f"--rate={rate}", "-t", copy["vo"],
            "--write-media", str(mp3), "--write-subtitles", str(vtt), retries=4)
        vo_len = duration(mp3)
        need = vo_len + VO_LEAD + VO_TAIL
        clip_len = duration(ROOT / "assets" / "clips" / locale / f"{sc['clip']}.mp4") if sc["clip"] else 0
        dur = max(need, sc.get("minDur", 0), clip_len / MAX_SPEED if clip_len else 0)
        dur = round(dur, 2)

        entry = {"id": sc["id"], "start": round(t, 3), "duration": dur, **copy}
        if sc["clip"]:
            lead_in = FADE if scenes else 0
            dst = scene_dir / f"{sc['id']}.mp4"
            speed = retime_clip(ROOT / "assets" / "clips" / locale / f"{sc['clip']}.mp4", dst, dur + lead_in + FADE)
            entry.update({"video": f"assets/scenes/{locale}/{sc['id']}.mp4", "videoStart": round(t - lead_in, 3),
                          "videoDuration": round(dur + lead_in + FADE, 3), "speed": round(speed, 3)})
        vo_start = t + VO_LEAD
        entry["voStart"] = round(vo_start, 3)
        words += [dict(w, scene=i) for w in words_from_vtt(vtt, vo_start)]
        inputs += ["-i", str(mp3)]
        delays.append(int(vo_start * 1000))
        scenes.append(entry)
        t += dur

    total = round(t, 2)
    chains = "".join(f"[{k}:a]adelay={d}|{d}[a{k}];" for k, d in enumerate(delays))
    mix = "".join(f"[a{k}]" for k in range(len(delays)))
    run(FFMPEG, "-y", "-loglevel", "error", *inputs, "-filter_complex",
        f"{chains}{mix}amix=inputs={len(delays)}:normalize=0,apad,atrim=0:{total},loudnorm=I=-16:TP=-1.5:LRA=11[out]",
        "-map", "[out]", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", str(audio_dir / "vo.mp3"))

    timeline = {"locale": locale, "total": total, "scenes": scenes, "words": words}
    (ROOT / "timeline").mkdir(exist_ok=True)
    (ROOT / "timeline" / f"{locale}.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
    print(locale, "total", total, [(s["id"], s["duration"], s.get("speed")) for s in scenes])


if __name__ == "__main__":
    for loc in sys.argv[1:] or ["en", "he"]:
        build(loc)
