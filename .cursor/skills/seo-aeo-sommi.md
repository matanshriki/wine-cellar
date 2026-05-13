---
name: seo-aeo-sommi
description: >-
  Sommi AI SEO, AEO, and LLM-discoverability playbook. Use whenever doing any
  SEO/AEO work on sommi-ai.com — metadata, structured data, sitemap, robots,
  llms.txt, public pages, or content strategy. Read this before touching any
  file that affects search or AI-engine visibility.
---

# Sommi AI — SEO / AEO / GEO Playbook

## Brand Positioning

**Sommi** is a premium AI sommelier and personal wine cellar web app. It is not a wine review site, not a social wine platform, and not a competitor to Vivino's review database. It is a **personal collection management tool** — the AI is scoped to bottles the user *already owns*.

- **Canonical name:** Sommi (never "Sommelier AI", "WineCellarBrain", or other legacy names)
- **Production URL:** `https://www.sommi-ai.com` (with www — always use this)
- **SITE_URL constant:** `https://www.sommi-ai.com` — change in both `MetaHead.tsx` and `seoSchemas.ts`
- **Tone:** Premium, calm, trustworthy, personal — never hype-y or keyword-stuffed

---

## Target Audience

1. **Home wine collectors** — 10–500 bottles, want cellar inventory + drink windows
2. **Dinner hosts** — want AI picks from their actual cellar, not random reviews
3. **Spreadsheet refugees** — migrating from Excel/Notes/Vivino exports
4. **Wine enthusiasts** — want pairing advice grounded in their collection, not generics
5. **PWA users** — install on iPhone/Android/desktop like a native app

---

## Core Search Intents

| Intent Type | Example Queries |
|---|---|
| **Navigational** | sommi ai, sommi wine app, sommi-ai.com |
| **Informational** | what is an AI sommelier, how do drink windows work, when to open wine |
| **Commercial** | best wine cellar app, wine collection tracker app, Vivino alternative for personal cellar |
| **Transactional** | track my wine collection, manage wine cellar online, wine cellar app free |
| **Comparison** | sommi vs vivino, wine cellar app vs spreadsheet |

---

## Priority Keywords & Query Themes

**Primary (highest priority):**
- AI sommelier
- wine cellar app
- wine cellar management app / software
- personal wine cellar assistant
- wine collection tracker
- drink window app / wine readiness

**Secondary:**
- what wine should I open tonight
- wine aging recommendations
- AI wine recommendations
- digital sommelier
- wine pairing assistant / app
- wine inventory app
- wine cellar tracker for collectors
- Vivino alternative / Vivino CSV import

**Long-tail / AEO targets:**
- "what wine should I open tonight with dinner"
- "how do I know when a wine is ready to drink"
- "best app to track wine collection at home"
- "wine cellar app that recommends what to open"
- "AI sommelier for home wine collection"
- "is Sommi AI free"
- "how does Sommi AI work"

---

## Page-Level SEO Rules

### `/` — Homepage / Landing
- Title: `Sommi — AI Sommelier & Wine Cellar App` (no trailing "| Sommi" — this IS the brand page)
- Description: 155-160 chars, must include "AI sommelier", "wine cellar", "drink windows"
- H1: Must include brand name and primary value prop
- JSON-LD: Organization + WebSite + SoftwareApplication + WebPage + FAQPage
- Should link to: /about, /privacy, /terms

### `/about` — About & FAQ
- Title: `About Sommi — AI Sommelier for Your Wine Cellar`
- Description: focus on founder story + FAQ signal
- JSON-LD: Organization + WebSite + FAQPage (all FAQ items)
- Must have: visible FAQ section with questions mirroring AEO targets

### `/privacy`, `/terms`
- Low SEO priority; yearly changefreq; priority 0.4 in sitemap
- No JSON-LD needed

### `/login`
- Always `noIndex: true` in MetaHead — never include in sitemap.xml
- No JSON-LD needed

### `/share/:shareId`
- Public but dynamic — canonical must use the actual shareId, not always `/share`
- Not in sitemap.xml (dynamic, user-generated URLs)

### `/share/evening/:shortCode`
- Public but dynamic — canonical must use actual shortCode path
- Not in sitemap.xml

---

## Metadata Rules

1. **Title format:** `[Page Name] — Sommi` for inner pages; bare `Sommi — AI Sommelier & Wine Cellar App` for homepage
2. **Description:** 140-160 characters. Must contain primary keyword for the page. Never duplicate descriptions across pages.
3. **Canonical:** Always `https://www.sommi-ai.com[path]` — note the www. Dynamic pages must use the actual URL, not a collapsed parent.
4. **noIndex:** Only for auth-gated pages. Set via `MetaHead noIndex={true}`. Never put noIndex pages in sitemap.xml.
5. **OG image:** Should be a proper 1200×630px social preview image — NOT the app icon. Until a real OG image exists, `/icon-512.png` is an acceptable fallback but must resolve to a real file.
6. **Twitter card:** `summary_large_image` always. Include `twitter:site` when a Twitter handle is registered.

---

## Schema / JSON-LD Rules

All schemas are in `apps/web/src/lib/seoSchemas.ts`. Use `MetaHead jsonLd={[...]}` to inject them.

### Organization (homepage + about)
- Required: `@context`, `@type`, `@id` (use `https://www.sommi-ai.com/#organization`), `name`, `url`, `logo`, `description`, `contactPoint`
- Optional: `sameAs` array of authoritative external profiles (LinkedIn, Product Hunt, etc.)
- Do NOT add fake addresses, fake phone numbers, or fake social accounts

### WebSite (homepage + about)
- Required: `@context`, `@type`, `@id` (`https://www.sommi-ai.com/#website`), `name`, `url`, `publisher`
- Add `SearchAction` (SitelinksSearchBox) only if the site has internal search — in-app search is behind auth, so omit for now

### SoftwareApplication (homepage only)
- Required: `name`, `applicationCategory`, `operatingSystem`, `offers`
- `applicationCategory`: `"LifestyleApplication"` (valid Schema.org value)
- `operatingSystem`: `"Web Browser, iOS (PWA), Android (PWA)"`
- Do NOT add `aggregateRating` until you have 3+ real third-party reviews
- `screenshot` should be a real product screenshot URL, not the app icon

### FAQPage (homepage + about)
- Answers must be 40-60 words — long enough to be useful, short enough for AI extraction
- Questions must mirror real search queries (what is Sommi, how does it work, etc.)
- Never include CTAs, prices, or sales language in FAQ answers
- Always validate at: https://search.google.com/test/rich-results

### WebPage (homepage, about)
- `url` must match canonical
- `isPartOf` must reference the WebSite @id

---

## AEO / LLM Answerability Rules

1. **llms.txt at `/llms.txt`** — short index for AI crawlers. Keep current.
2. **llms-full.txt at `/llms-full.txt`** — extended context document. Update whenever product features change.
3. **robots.txt must Allow `/llms.txt` and `/llms-full.txt`** — always.
4. **Answer-style content on public pages:**
   - Add a short (1-3 sentence) direct answer under each FAQ question before the longer explanation
   - Format: bold question as heading → direct 40-60 word answer → optional detail paragraph
5. **Entity clarity:** Use the brand name "Sommi" consistently. Include "sommi-ai.com" in llms.txt/llms-full.txt as a citation anchor.
6. **Comparison content:** Include a short comparison with Vivino (the most common alternative people consider) — what Sommi does differently, not what Vivino does wrong.
7. **Avoid:** keyword stuffing, fake claims, fake user counts, unverified statistics

---

## Content Structure Rules

### For any public marketing page:
- **H1:** Unique, includes primary keyword, max 60 chars
- **H2s:** Each section should address a distinct search intent or question
- **First 200 words:** Must contain the primary value proposition + brand name
- **Lists:** Use `<ul>/<ol>` for feature lists — easier for LLMs to extract
- **Bold leads:** Use `<strong>` on key points (like the landing page "why" section)

### For FAQ sections:
- Use accordion UI is fine (good UX) — but ensure FAQ JSON-LD is still injected (schema is not UI-dependent)
- Each FAQ item must have a visible question + visible answer (even if collapsed by default)

---

## Internal Linking Rules

- Landing page should link to: /about (FAQ), /privacy, /terms
- About page should link back to: / (homepage), /privacy, /terms
- No orphan pages — every public page reachable from at least one other public page
- Share pages are intentionally isolated (user-generated links)
- Add `<link rel="alternate" hreflang="x-default" href="https://www.sommi-ai.com/" />` on all pages via MetaHead

---

## Technical SEO Checklist

Before shipping any SEO change:
- [ ] SITE_URL is `https://www.sommi-ai.com` in MetaHead.tsx and seoSchemas.ts
- [ ] sitemap.xml uses `https://www.sommi-ai.com` (www) for all URLs
- [ ] robots.txt Sitemap directive uses `https://www.sommi-ai.com/sitemap.xml`
- [ ] No noIndex pages appear in sitemap.xml
- [ ] Every public page has a unique `<title>` and unique `<meta name="description">`
- [ ] Every public page has a `<link rel="canonical">` matching the actual URL
- [ ] Dynamic pages (share/:id, share/evening/:code) use the actual URL as canonical, not a collapsed parent
- [ ] JSON-LD is valid (test at https://search.google.com/test/rich-results)
- [ ] OG image URL resolves to a real file (check in browser)
- [ ] No JS errors in console on landing page load
- [ ] TypeScript compiles without errors (`npm run typecheck` from apps/web)
- [ ] ESLint passes (`npm run lint` from apps/web)

---

## Launch Checklist (for new pages or major SEO changes)

1. Add the page to `sitemap.xml` (if indexable)
2. Add the path to `robots.txt` Allow list (if it needs explicit allow)
3. Update `llms.txt` and `llms-full.txt` if new features/pages were added
4. Add `MetaHead` with unique title + description + url + jsonLd
5. Test canonical in production (right-click → View Page Source, search for `canonical`)
6. Test JSON-LD at https://search.google.com/test/rich-results
7. Request indexing in Google Search Console for the new URL
8. Submit updated sitemap in Google Search Console and Bing Webmaster Tools

---

## "Do Not Do" Rules

- **Do not** keyword-stuff titles, descriptions, or heading text
- **Do not** add `aggregateRating` schema without real third-party reviews (can trigger manual penalty)
- **Do not** put auth-gated pages (/cellar, /recommendation, /history, etc.) in sitemap.xml
- **Do not** put `/login` in sitemap.xml — it has noIndex
- **Do not** collapse dynamic canonical URLs to a parent path (/share/:id → /share is wrong)
- **Do not** use the non-www domain (`sommi-ai.com`) in any SEO file — always `www.sommi-ai.com`
- **Do not** create thin pages with no real content just to have more URLs
- **Do not** remove the existing `llms.txt` / `llms-full.txt` files or their Allow rules in robots.txt
- **Do not** set `noIndex` on the landing page (/) or about page (/about)
- **Do not** use `<meta name="robots" content="noindex">` on any public marketing page
- **Do not** add fake testimonials, fake ratings, or fabricated user statistics
- **Do not** add fake addresses or phone numbers to Organization schema

---

## How to Validate Changes Before Shipping

### Metadata validation
```bash
# After build, check the generated HTML for meta tags:
curl -s https://www.sommi-ai.com/ | grep -E '<title|<meta name="description|canonical|og:'
```

### JSON-LD validation
1. https://search.google.com/test/rich-results — paste the production URL
2. https://validator.schema.org — paste the raw JSON-LD

### Sitemap validation
```bash
# Check sitemap is valid XML and all URLs return 200:
curl -s https://www.sommi-ai.com/sitemap.xml
```

### Robots validation
```bash
curl -s https://www.sommi-ai.com/robots.txt
```

### TypeScript + Lint + Build
```bash
# From apps/web:
npm run typecheck
npm run lint
npm run build
```

### LLM discoverability check
- Ask ChatGPT: "What is Sommi AI?" and check if it describes the product correctly
- Ask Perplexity: "What is sommi-ai.com?" and verify it cites the site
- Check https://www.sommi-ai.com/llms.txt is accessible

---

## Key File Locations

| File | Purpose |
|---|---|
| `apps/web/src/lib/seoSchemas.ts` | All Schema.org JSON-LD definitions |
| `apps/web/src/components/MetaHead.tsx` | Per-route Helmet wrapper |
| `apps/web/index.html` | Static fallback meta + noscript content |
| `apps/web/public/robots.txt` | Crawler access rules |
| `apps/web/public/sitemap.xml` | Public page index |
| `apps/web/public/llms.txt` | Short AI discovery index |
| `apps/web/public/llms-full.txt` | Extended AI context document |
| `apps/web/src/pages/LandingPage.tsx` | Homepage (primary SEO target) |
| `apps/web/src/pages/AboutPage.tsx` | About + FAQ (secondary SEO target) |

---

## Architecture Note: SPA Limitation

Sommi is a client-side React SPA. All per-route metadata and page content is injected by JavaScript via `react-helmet-async`. This means:

- **AI bots** (GPTBot, ClaudeBot, PerplexityBot) will NOT see page content or injected metadata
- **Bingbot** has limited, unreliable JS rendering
- **Googlebot** will eventually render the JS but this is delayed (hours to weeks)

**Short-term mitigations implemented:**
- Rich `<noscript>` block in index.html with key marketing copy
- `llms.txt` + `llms-full.txt` for direct AI indexing
- Strong fallback OG/title/description in index.html

**Long-term recommendation:**
Consider `vite-plugin-prerender` (or a similar approach) to pre-render `/` and `/about` at build time into static HTML. This would make the content immediately available to all crawlers without JavaScript execution. Alternatively, migrate public marketing pages to Astro or Next.js while keeping the authenticated app as a React SPA.
