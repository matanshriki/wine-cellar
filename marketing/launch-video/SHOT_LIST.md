# Sommi launch video — shot list (hybrid)

**Master length:** 24s @ 30fps  
**Canvas:** 1080×1920 (9:16)  
**Approach:** illustrated atmosphere + **in-app UI reconstructions** (fictional demo data) in phone chrome + brand CTA

| # | Timecode | Visual | Notes |
|---|----------|--------|-------|
| 1 | 0:00–0:03.5 | Dinner table still + hook captions | `hero-table.jpg` |
| 2 | 0:03.5–0:09 | Phone → Cellar list UI | Real Sommi-style cards, sample bottles only |
| 3 | 0:09–0:14 | Phone → Ask Sommi chat | Sample dinner question |
| 4 | 0:14–0:20 | Phone → Recommendation card | Pick + drink-window **guidance** disclaimer |
| 5 | 0:20–0:24 | Brand lockup + Start free | End card |

## Why not raw screen recordings (yet)

Remotion UI mocks match brand tokens and stay deterministic for EN/HE. Optional upgrade: drop Playwright captures of a demo account into `public/captures/` and swap `<App*Screen />` for `<Img src={staticFile('captures/...')} />`.

## Render

```bash
cd marketing/launch-video
npm run render:en
npm run render:he
```

Copy preferred file to `apps/web/public/videos/sommi-ai-smarter.mp4` (or set `VITE_LANDING_DEMO_VIDEO_URL`).
