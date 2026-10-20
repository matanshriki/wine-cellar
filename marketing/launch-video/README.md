# Sommi launch video (Remotion)

Standalone programmatic video for landing + social. **Not** part of the Vite web app build.

## Quick start

```bash
cd marketing/launch-video
npm install
npm run studio          # preview EN/HE compositions
npm run render:en       # out/sommi-launch-en.mp4
npm run render:he       # out/sommi-launch-he.mp4
```

## What’s included

| Path | Purpose |
|------|---------|
| `SHOT_LIST.md` | Hybrid storyboard (atmosphere + in-app UI) |
| `scripts/en-captions.json` | English VO + on-screen lines |
| `scripts/he-captions.json` | Hebrew VO + on-screen lines (RTL) |
| `src/SommiLaunch.tsx` | 24s 9:16 hybrid composition |
| `src/ui/*` | Phone chrome + cellar / ask / result screens (demo data) |
| `public/*.jpg` | Brand stills (copied from landing assets) |
| `out/sommi-launch-en.mp4` | English render (also deployed as landing demo) |
| `out/sommi-launch-he.mp4` | Hebrew render |

## Hebrew / RTL

- Root direction comes from caption `dir: "rtl"`.
- Use Rubik / Assistant for UI captions; avoid negative letter-spacing.
- Latin wine names stay as written (e.g. Côtes du Rhône).

## After render

1. Drop MP4s into `apps/web/public/videos/` (e.g. replace `sommi-ai-smarter.mp4` or set `VITE_LANDING_DEMO_VIDEO_URL`).
2. Keep poster: `apps/web/public/assets/landing/video-poster.jpg`.
3. Optional: add `public/audio/en-vo.mp3` / `he-vo.mp3` and wire with Remotion `<Audio />`.

## HyperFrames alternative

If you prefer HTML/GSAP → MP4 later, port the same shot list and caption JSON into a HyperFrames `index.html` timeline. Remotion is recommended here because Sommi’s stack is already React.
