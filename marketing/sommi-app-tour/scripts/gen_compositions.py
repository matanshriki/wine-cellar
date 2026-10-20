#!/usr/bin/env python3
"""Generate HyperFrames compositions (landscape + portrait, EN + HE) from timeline/*.json."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FADE = 0.4

LAYOUTS = {
    "landscape": {
        "w": 1920, "h": 1080,
        "screen_w": 432, "screen_h": 935, "pad": 13,
        "phone_top": 60, "phone_inline_end": 220,
        "text_inline_start": 150, "text_top": 250, "text_w": 860,
        "eyebrow": 26, "headline": 84, "caption": 38, "caption_mode": "line",
        "hook": 104, "end_title": 132,
    },
    "portrait": {
        "w": 1080, "h": 1920,
        "screen_w": 556, "screen_h": 1203, "pad": 14,
        "phone_top": 418, "phone_inline_end": None,
        "text_inline_start": 70, "text_top": 120, "text_w": 940,
        "eyebrow": 28, "headline": 66, "caption": 46, "caption_mode": "chunk",
        "hook": 96, "end_title": 140,
    },
}

FONTS = """
@font-face { font-family: "Assistant"; font-weight: 400; font-display: block; src: url("assets/fonts/Assistant-400.ttf") format("truetype"); }
@font-face { font-family: "Assistant"; font-weight: 600; font-display: block; src: url("assets/fonts/Assistant-600.ttf") format("truetype"); }
@font-face { font-family: "Assistant"; font-weight: 700; font-display: block; src: url("assets/fonts/Assistant-700.ttf") format("truetype"); }
@font-face { font-family: "Rubik"; font-weight: 900; font-display: block; src: url("assets/fonts/Rubik-900.ttf") format("truetype"); }
@font-face { font-family: "Fraunces"; font-weight: 600; font-display: block; src: url("assets/fonts/Fraunces-600.ttf") format("truetype"); }
@font-face { font-family: "Inter"; font-weight: 500; font-display: block; src: url("assets/fonts/Inter-500.ttf") format("truetype"); }
@font-face { font-family: "Inter"; font-weight: 700; font-display: block; src: url("assets/fonts/Inter-700.ttf") format("truetype"); }
"""


def esc(s):
    return html.escape(s, quote=True)


def chunk_words(words, max_words=5):
    """Split a scene's words into caption chunks, breaking after punctuation."""
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= max_words or w["text"][-1:] in ",.?!:":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def build(locale, layout_name):
    tl = json.loads((ROOT / "timeline" / f"{locale}.json").read_text(encoding="utf-8"))
    L = LAYOUTS[layout_name]
    rtl = locale == "he"
    W, H, total = L["w"], L["h"], tl["total"]
    scenes = tl["scenes"]
    hook, end = scenes[0], scenes[-1]
    body_scenes = scenes[1:-1]
    words_by_scene = {}
    for i, w in enumerate(tl["words"]):
        words_by_scene.setdefault(w["scene"], []).append(dict(w, idx=i))

    headline_font = '"Rubik", "Assistant", sans-serif' if rtl else '"Fraunces", Georgia, serif'
    headline_weight = 900 if rtl else 600
    ui_font = '"Assistant", sans-serif' if rtl else '"Inter", "Assistant", sans-serif'
    caption_font = '"Rubik", "Assistant", sans-serif' if rtl else '"Inter", sans-serif'
    caption_weight = 900 if rtl else 700
    tracking = "0" if rtl else "0.14em"

    sw, sh, pad = L["screen_w"], L["screen_h"], L["pad"]
    ow, oh = sw + pad * 2, sh + pad * 2
    if L["phone_inline_end"] is None:
        phone_pos = f"inset-inline-start: {(W - ow) // 2}px;"
    else:
        phone_pos = f"inset-inline-end: {L['phone_inline_end']}px;"

    portrait = layout_name == "portrait"
    text_align = "center" if portrait else "start"

    # ---- scene text blocks ----
    blocks = []
    for i, sc in enumerate(scenes):
        if sc["id"] in ("hook", "end"):
            continue
        ws = words_by_scene.get(i, [])
        if L["caption_mode"] == "line":
            spans = " ".join(f'<span class="w" id="w{w["idx"]}">{esc(w["text"])}</span>' for w in ws)
            caption_html = f'<p class="caption">{spans}</p>'
        else:
            parts = []
            for k, ch in enumerate(chunk_words(ws)):
                spans = " ".join(f'<span class="w" id="w{w["idx"]}">{esc(w["text"])}</span>' for w in ch)
                parts.append(f'<p class="caption chunk" id="c{i}-{k}">{spans}</p>')
            caption_html = "".join(parts)
        heads = " ".join(f'<span class="hw">{esc(t)}</span>' for t in sc["headline"].split())
        blocks.append(f"""
      <div id="text-{sc['id']}" class="clip scene-text" data-start="{sc['start']}" data-duration="{sc['duration']}" data-track-index="{10 + i}">
        <div class="eyebrow">{esc(sc['eyebrow'])}</div>
        <h2 class="headline">{heads}</h2>
        <div class="captions">{caption_html}</div>
      </div>""")

    videos = []
    for i, sc in enumerate(body_scenes):
        videos.append(
            f'<video id="v-{sc["id"]}" class="clip screen-video" src="{sc["video"]}" '
            f'data-start="{sc["videoStart"]}" data-duration="{sc["videoDuration"]}" data-track-index="{2 + i}" '
            f'muted playsinline></video>'
        )

    hook_words = " ".join(
        f'<span class="w" id="w{w["idx"]}">{esc(w["text"])}</span>' for w in words_by_scene.get(0, [])
    )

    # ---- timeline script data ----
    data = {
        "total": total,
        "hook": {"start": hook["start"], "dur": hook["duration"]},
        "end": {"start": end["start"], "dur": end["duration"]},
        "scenes": [
            {"id": s["id"], "start": s["start"], "dur": s["duration"], "videoStart": s.get("videoStart")}
            for s in scenes
        ],
        "words": [{"i": i, "s": w["start"], "e": w["end"], "scene": w["scene"]} for i, w in enumerate(tl["words"])],
        "chunks": {},
        "fade": FADE,
        "portrait": portrait,
    }
    if L["caption_mode"] == "chunk":
        for i in range(1, len(scenes) - 1):
            ch = chunk_words(words_by_scene.get(i, []))
            data["chunks"][i] = [{"id": f"c{i}-{k}", "s": c[0]["start"], "e": c[-1]["end"]} for k, c in enumerate(ch)]

    end_scene = end
    doc = f"""<!doctype html>
<html lang="{locale}" dir="{'rtl' if rtl else 'ltr'}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Sommi app tour · {locale} · {layout_name}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
{FONTS}
      *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #1c0d11; }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: #1c0d11; font-family: {ui_font}; color: #f7f1e8; }}
      .bg {{ position: absolute; inset: -40px; background-size: cover; background-position: center; }}
      .shade {{ position: absolute; inset: 0; background:
        radial-gradient(120% 90% at {'30%' if rtl else '70%'} 50%, rgba(74,23,34,0.35) 0%, rgba(28,13,17,0.82) 60%, rgba(20,9,12,0.94) 100%); }}
      .grain {{ position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.35)); }}

      .phone {{ position: absolute; top: {L['phone_top']}px; {phone_pos} width: {ow}px; height: {oh}px; border-radius: {pad + 52}px; padding: {pad}px;
        background: linear-gradient(160deg, #3a3034 0%, #151112 45%, #0b0909 100%);
        box-shadow: 0 50px 120px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.10) inset, 0 0 0 1px rgba(0,0,0,0.6); z-index: 5; }}
      .screen {{ position: relative; width: {sw}px; height: {sh}px; border-radius: 52px; overflow: hidden; background: #f7f3ee; }}
      .screen-video {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
      .island {{ position: absolute; top: 12px; inset-inline-start: 50%; width: 118px; height: 34px; margin-inline-start: -59px; border-radius: 20px; background: #050404; z-index: 9; }}

      .scene-text {{ position: absolute; inset-block-start: {L['text_top']}px; inset-inline-start: {L['text_inline_start']}px; width: {L['text_w']}px; z-index: 6; text-align: {text_align}; }}
      .eyebrow {{ font-family: {ui_font}; font-weight: 700; font-size: {L['eyebrow']}px; letter-spacing: {tracking}; text-transform: {'none' if rtl else 'uppercase'}; color: #e0bf62; }}
      .headline {{ margin-block-start: 18px; font-family: {headline_font}; font-weight: {headline_weight}; font-size: {L['headline']}px; line-height: 1.06; letter-spacing: {'0' if rtl else '-0.01em'}; color: #fbf6ee; }}
      .hw {{ display: inline-block; }}
      .captions {{ position: relative; margin-block-start: 34px; }}
      .caption {{ font-family: {caption_font}; font-weight: {caption_weight}; font-size: {L['caption']}px; line-height: 1.4; color: rgba(247,241,232,0.42); }}
      .w {{ display: inline-block; }}
      {'.captions { position: absolute; margin: 0; inset-block-start: ' + str(L['phone_top'] + oh + 34 - L['text_top']) + 'px; inset-inline-start: 0; width: 100%; height: 200px; } .chunk { position: absolute; inset-inline-start: 0; inset-block-start: 0; width: 100%; opacity: 0; }' if portrait else ''}

      .hook {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding-inline: 120px; z-index: 7; }}
      .hook .kicker {{ font-family: {ui_font}; font-weight: 700; font-size: 30px; letter-spacing: {tracking}; text-transform: {'none' if rtl else 'uppercase'}; color: #e0bf62; }}
      .hook .big {{ margin-block-start: 28px; font-family: {headline_font}; font-weight: {headline_weight}; font-size: {L['hook']}px; line-height: 1.05; max-width: {W - 240}px; color: rgba(251,246,238,0.28); }}

      .endcard {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 26px; z-index: 7; }}
      .logo {{ width: {180 if portrait else 150}px; height: {180 if portrait else 150}px; border-radius: 36px; box-shadow: 0 30px 70px rgba(0,0,0,0.5); }}
      .end-title {{ font-family: {headline_font}; font-weight: {headline_weight}; font-size: {L['end_title']}px; line-height: 1; color: #fbf6ee; }}
      .end-sub {{ font-family: {ui_font}; font-weight: 600; font-size: {46 if portrait else 40}px; color: rgba(247,241,232,0.86); }}
      .end-cta {{ margin-block-start: 14px; padding-block: 22px; padding-inline: 56px; border-radius: 999px; background: linear-gradient(180deg, #a3304d, #7a1f36); color: #fff; font-family: {ui_font}; font-weight: 700; font-size: {38 if portrait else 32}px; box-shadow: 0 18px 40px rgba(122,31,54,0.5); }}
      .end-url {{ font-family: {ui_font}; font-weight: 700; font-size: {30 if portrait else 26}px; letter-spacing: 0.06em; color: #e0bf62; direction: ltr; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="{W}" data-height="{H}" data-fps="30">
      <audio id="vo" src="audio/{locale}/mix.mp3" data-start="0" data-duration="{total}" data-track-index="0" data-volume="1"></audio>

      <div class="bg" id="bg-main" style="background-image: url('assets/img/cellar-shelf.jpg')"></div>
      <div class="bg" id="bg-end" style="background-image: url('assets/img/hero-table.jpg'); opacity: 0"></div>
      <div class="shade"></div>
      <div class="grain"></div>

      <div class="phone" id="phone">
        <div class="screen">
          {''.join(videos)}
          <div class="island"></div>
        </div>
      </div>

      <div id="hook" class="clip hook" data-start="{hook['start']}" data-duration="{hook['duration']}" data-track-index="9">
        <div class="kicker">{esc(hook['eyebrow'])}</div>
        <div class="big">{hook_words}</div>
      </div>
      {''.join(blocks)}

      <div id="endcard" class="clip endcard" data-start="{end_scene['start']}" data-duration="{end_scene['duration']}" data-track-index="30">
        <img class="logo" src="assets/img/logo.png" alt="" />
        <div class="end-title">{esc(end_scene['headline'])}</div>
        <div class="end-sub">{esc(end_scene['sub'])}</div>
        <div class="end-cta">{esc(end_scene['cta'])}</div>
        <div class="end-url">{esc(end_scene['eyebrow'])}</div>
      </div>
    </div>

    <script>
      const D = {json.dumps(data, ensure_ascii=False)};
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      const ACTIVE = "#e0bf62", SPOKEN = "#fbf6ee";

      tl.fromTo("#bg-main", {{ scale: 1.0 }}, {{ scale: 1.08, duration: D.total, ease: "none" }}, 0);
      tl.to("#bg-end", {{ opacity: 1, duration: 0.8, ease: "power1.inOut" }}, D.end.start - 0.3);

      // Hook: words light up with the voice, then the line lifts away.
      tl.fromTo("#hook .kicker", {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }}, 0.05);
      tl.fromTo("#hook .big", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }}, 0.1);
      tl.to("#hook", {{ opacity: 0, y: -40, duration: 0.45, ease: "power2.in" }}, D.hook.start + D.hook.dur - 0.45);

      // Phone: rises in after the hook, leaves before the end card.
      const firstVideo = D.scenes[1].start;
      tl.fromTo("#phone", {{ y: {H}, rotation: {'-3' if rtl else '3'} }}, {{ y: 0, rotation: 0, duration: 1.0, ease: "power3.out" }}, firstVideo - 0.55);
      tl.to("#phone", {{ y: -10, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: Math.max(0, Math.floor((D.end.start - firstVideo) / 2.4) - 1) }}, firstVideo + 0.6);
      tl.to("#phone", {{ y: {H}, opacity: 0, duration: 0.7, ease: "power2.in" }}, D.end.start - 0.2);

      // Cross-dissolve between app clips.
      D.scenes.forEach((s, i) => {{
        if (i < 2 || s.videoStart == null) return;
        tl.fromTo("#v-" + s.id, {{ opacity: 0 }}, {{ opacity: 1, duration: D.fade, ease: "power1.inOut" }}, s.videoStart);
      }});

      // Scene copy.
      D.scenes.forEach((s, i) => {{
        if (s.id === "hook" || s.id === "end") return;
        const root = "#text-" + s.id;
        tl.fromTo(root + " .eyebrow", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }}, s.start + 0.05);
        tl.fromTo(root + " .hw", {{ opacity: 0, y: 34 }}, {{ opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.06 }}, s.start + 0.12);
        if (!D.portrait) tl.fromTo(root + " .captions", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4 }}, s.start + 0.25);
        tl.to(root, {{ opacity: 0, y: -18, duration: 0.3, ease: "power2.in" }}, s.start + s.dur - 0.3);
      }});

      // Portrait captions: one chunk on screen at a time.
      Object.entries(D.chunks).forEach(([sceneIdx, chunks]) => {{
        const sc = D.scenes[sceneIdx];
        chunks.forEach((c, k) => {{
          const next = chunks[k + 1];
          const show = k === 0 ? sc.start + 0.2 : c.s - 0.05;
          const hide = next ? next.s - 0.05 : sc.start + sc.dur - 0.3;
          tl.fromTo("#" + c.id, {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }}, show);
          tl.to("#" + c.id, {{ opacity: 0, duration: 0.12 }}, Math.max(show + 0.2, hide));
        }});
      }});

      // Karaoke: current word in gold, spoken words in ivory.
      D.words.forEach((w) => {{
        const el = "#w" + w.i;
        tl.to(el, {{ color: ACTIVE, duration: 0.08, ease: "none" }}, Math.max(0, w.s - 0.04));
        tl.to(el, {{ color: SPOKEN, duration: 0.12, ease: "none" }}, w.e);
      }});

      // End card.
      tl.fromTo("#endcard .logo", {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.6)" }}, D.end.start + 0.15);
      tl.fromTo("#endcard .end-title", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }}, D.end.start + 0.35);
      tl.fromTo("#endcard .end-sub", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }}, D.end.start + 0.6);
      tl.fromTo("#endcard .end-cta", {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" }}, D.end.start + 0.9);
      tl.fromTo("#endcard .end-url", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5 }}, D.end.start + 1.1);

      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
    out = ROOT / "variants" / f"{locale}-{layout_name}.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    print("wrote", out.name, total, "s")


if __name__ == "__main__":
    for loc in ("en", "he"):
        for lay in ("landscape", "portrait"):
            build(loc, lay)
