# Wine Cellar Brain — App Summary

> This document provides a complete overview of the application's architecture, features, and capabilities. It is designed to give any engineer, LLM tool, or collaborator full context on the system.

---

## What Is This App?

A **personal wine cellar management platform** with an AI-powered sommelier agent. Users photograph wine labels, build a digital cellar, track consumption history, receive personalized recommendations, plan wine evenings, and share their collection — all through a mobile-first progressive web app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend (primary) | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Backend (agent API) | Express + TypeScript (deployed separately, e.g. Railway) |
| AI / LLM | OpenAI GPT-4o (recommendations, analysis, label parsing), Whisper (voice input) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Hosting | Vercel (web), Railway (API), Supabase (DB + Edge Functions) |
| i18n | English + Hebrew (RTL support) via react-i18next |
| PWA | Installable on iOS/Android/desktop; manifest, icons, mobile-first UI |

---

## Monorepo Structure

```
wine/
├── apps/
│   ├── web/          # React SPA (Vite) — the main user-facing app
│   └── api/          # Express API — agent endpoints, Whisper, analysis
├── supabase/
│   ├── migrations/   # All Postgres schema (35+ migration files)
│   └── functions/    # Supabase Edge Functions (AI analysis, label parsing, etc.)
└── packages/         # Shared packages (if any)
```

---

## Core Features

### 1. Wine Cellar Management
- Add bottles via: manual form, label photo scan (AI-parsed), smart scan, receipt scan, multi-bottle photo, CSV import, Vivino export import
- Each bottle tracks: wine name, producer, vintage, region, grape varieties, color, quantity, purchase price, drink window, storage location, image, AI analysis
- Filter, search, and browse the cellar with card-based UI
- Duplicate detection and merge
- Drink window timeline visualization (readiness scoring)

### 2. AI Wine Analysis
- Per-bottle AI analysis via Supabase Edge Functions (calls OpenAI)
- Generates: tasting notes, food pairings, optimal drink window, wine style profile
- Bulk analysis for entire cellar
- Wine profile generation with regional style context

### 3. Cellar Sommelier Agent (`/agent`)
A conversational AI assistant that functions as a personal sommelier with real agent capabilities:

- **Intent routing**: Deterministic regex-based router classifies user messages into actions (open bottle, save note, update memory, give feedback, find similar, recommend) — supports English and Hebrew
- **Candidate selection**: Heuristic scoring ranks bottles by readiness, user constraints (color, region, grape, food), taste profile fit, memory preferences, past ratings, and diversity
- **LLM orchestration**: GPT-4o receives only a curated shortlist (not the full cellar), with strict JSON output constraints and validation
- **Memory system**: Learns user preferences (favorite regions, grapes, body preference, disliked profiles) from explicit statements and implicit signals, persists across sessions
- **Actions**: Executes real side-effects — marks bottles as opened (updates inventory), saves tasting note drafts, persists feedback
- **Recommendation history**: Tracks past recommendations to avoid repetition (diversity penalty)
- **Validation & fallback**: Output validation with retry loop; graceful fallback to legacy full-cellar prompt if orchestrated path fails
- **Voice input**: Whisper transcription for hands-free interaction
- **Conversation persistence**: Chat threads saved in Supabase

### 4. Recommendations (`/recommendation`)
- Guided flow: choose meal type, occasion, vibe/mood
- AI-powered picks from the user's cellar
- Integrates taste profile for personalization
- Rotation tracking (avoids recommending the same wine repeatedly)

### 5. Consumption History (`/history`)
- Records every bottle opened with timestamp, occasion, meal context
- Rating ritual: star rating + tasting notes + meal notes after opening
- History insights feed back into the sommelier agent (past ratings, notes, open count per wine)
- Undo/revert support

### 6. Plan an Evening
- Queue multiple wines for a tasting evening
- Playback flow with timer per wine
- Share evening via link — guests can view the lineup and vote (hearts) without logging in (`/share/evening/:shortCode`)

### 7. Open Bottle Ritual
- Guided opening experience with celebration animation
- Optional timer for decanting/breathing
- Floating timer pill persists across navigation
- Leads into rating ritual after consumption

### 8. Sharing
- Share full cellar via generated link (`/share/:shareId`)
- Legacy base64-encoded share support
- Evening share with guest voting (Supabase Edge Functions)

### 9. Wishlist (Feature-Flagged)
- Track wines you want to buy
- Move wishlist items to cellar when purchased
- Search and manage

### 10. Taste Profile
- Computed from cellar composition and consumption history
- Visualized on profile page (`TasteProfileCard`)
- Feeds into recommendation engine and sommelier agent context
- Tracks affinities: color, region, grape variety, body, price range

### 11. Wine Events / Moments
- Admin-created wine events (e.g., "It's Beaujolais Nouveau day!")
- Banner on cellar page matching user's bottles to the event
- Dismiss/seen tracking

### 12. Label Art Generation
- AI-generated artistic interpretations of wine labels
- Feature-flagged
- Uses dedicated Supabase Edge Function

### 13. Admin Tools
- Batch Vivino enrichment (ratings, images)
- Batch image backfill
- Readiness score backfill
- Wine profile backfill
- Available on profile page for admin users

---

## Database Schema (Supabase Postgres)

### Core Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles, avatar, preferred language, taste_profile JSON |
| `wines` | Wine catalog (name, producer, vintage, region, grapes, color, Vivino data) |
| `bottles` | User's cellar inventory (links to wines, quantity, purchase info, storage, drink window, analysis) |
| `consumption_history` | Every bottle opening (rating, notes, meal, occasion) |

### Sommelier Agent Tables
| Table | Purpose |
|-------|---------|
| `sommelier_agent_memory` | Per-user learned preferences (regions, grapes, body, dislikes) |
| `sommelier_recommendation_events` | Every recommendation with intent, shortlist, chosen bottles, explanation |
| `sommelier_feedback_events` | User feedback on recommendations (sentiment, tags, preference deltas) |
| `sommelier_tasting_drafts` | Tasting note drafts created via agent |
| `sommelier_conversations` | Persisted chat threads |

### Feature Tables
| Table | Purpose |
|-------|---------|
| `recommendation_runs` | Legacy recommendation tracking |
| `wine_events` / `user_event_states` | Wine moments system |
| `evening_plans` | Planned evening queues |
| `evening_plan_shares` / `evening_guest_votes` | Evening sharing and guest voting |
| `wine_profiles` | AI-generated wine style profiles |
| `wishlist_items` | Wishlist entries |
| `user_ai_features` | Feature flags per user |
| `admins` | Admin role tracking |
| `wine_translations` | Multilingual wine data |

All tables use Row-Level Security (RLS) with user-scoped policies.

---

## Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| `analyze-wine` | AI analysis of a single wine |
| `analyze-cellar` | Batch cellar analysis |
| `parse-label-image` | Extract wine info from label/receipt photos |
| `extract-wine-label` | Label text extraction pipeline |
| `generate-label-art` | AI-generated label artwork |
| `generate-wine-profile` | Wine style profile generation |
| `evening-share-get` | Fetch shared evening data for guests |
| `evening-vote` | Guest voting on evening wines |
| `batch-enrich-vivino` | Batch Vivino data enrichment |
| `fetch-vivino-data` | Single wine Vivino lookup |
| `batch-enrich-images` | Batch wine image enrichment |
| Various `backfill-*` | Admin data backfill operations |

---

## API Endpoints (Express — `apps/api`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/recommend` | POST | Cellar Sommelier — main chat endpoint |
| `/api/agent/feedback` | POST | Submit feedback on a recommendation |
| `/api/agent/outcome` | POST | Update recommendation outcome |
| `/api/agent/transcribe` | POST | Voice-to-text via Whisper |
| `/api/events/active` | GET | Active wine events for user |
| `/api/events/:id/dismiss` | POST | Dismiss a wine event |
| `/api/events/:id/seen` | POST | Mark event as seen |
| `/health` | GET | Health check |

---

## Key User Journeys

1. **Onboarding**: Sign up → add first bottle (scan label or manual) → celebration → PWA install prompt
2. **Daily use**: Browse cellar → ask sommelier "what should I open tonight?" → get personalized pick → open bottle ritual → rate and take notes
3. **Dinner party**: Plan evening → queue wines → share with guests → guests vote → open wines in order with timer
4. **Learning**: Sommelier learns preferences over time from explicit statements ("I prefer lighter reds"), implicit signals ("I loved that Rioja"), ratings, and feedback
5. **Discovery**: Wishlist wines you want to try → move to cellar when purchased → track across the full lifecycle

---

## Environment Variables

### Web (`apps/web`)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase connection
- `VITE_API_URL` — Express API base URL
- `VITE_GA4_MEASUREMENT_ID` / `VITE_ANALYTICS_ENABLED` — Google Analytics

### API (`apps/api`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin access
- `OPENAI_API_KEY` — GPT-4o and Whisper
- `JWT_SECRET` / `DATABASE_URL` — For Prisma/SQLite legacy stack
- `PORT` — Server port

---

## Architecture Notes

- The **web app talks directly to Supabase** for most data operations (bottles, history, profiles, etc.) using the Supabase JS client with user JWT
- The **Express API** is primarily used for the **sommelier agent** (which needs server-side OpenAI calls and orchestration logic) and wine events
- **Supabase Edge Functions** handle AI-intensive operations (wine analysis, label parsing, image generation)
- **RLS (Row-Level Security)** enforces data isolation at the database level — every query is scoped to the authenticated user
- The app is a **monorepo** with npm workspaces; web deploys to Vercel, API deploys to Railway
