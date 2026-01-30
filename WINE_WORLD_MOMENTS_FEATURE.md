# Wine World Moments Feature

## Overview

Wine World Moments is a subtle, luxury "moment marketing" feature that shows users relevant wine/grape celebration days and helps them discover bottles in their cellar that match those events.

## Vision

- **Unobtrusive**: Occasional, elegant banners (not spammy ads)
- **Relevant**: Only shows events when user has matching wines
- **Curated**: Uses hand-picked WSET calendar data (no live scraping)
- **Premium UX**: Mobile-first, luxury design matching the app's aesthetic

## Implementation

### Database Models

**Supabase Tables:**

1. **`wine_events`** - Curated wine/grape celebration days
   - `id` (UUID)
   - `name` (TEXT) - e.g., "International Syrah Day"
   - `date` (DATE) - Event date (YYYY-MM-DD)
   - `tags` (TEXT[]) - Grape/wine tags for matching: `['syrah', 'shiraz', 'red']`
   - `type` (TEXT) - 'grape' | 'wine' | 'occasion'
   - `description_short` (TEXT) - 1-2 sentence description
   - `source_name` (TEXT) - Attribution (e.g., "WSET")
   - `source_url` (TEXT) - Link to source

2. **`user_event_states`** - Tracks user interaction with events
   - `id` (UUID)
   - `user_id` (UUID) - Foreign key to auth.users
   - `event_id` (UUID) - Foreign key to wine_events
   - `dismissed_at` (TIMESTAMPTZ) - User clicked "Don't show again"
   - `seen_at` (TIMESTAMPTZ) - First time shown to user
   - `last_shown_at` (TIMESTAMPTZ) - Most recent display time

### Data Source

Events are seeded from the **WSET Wine and Grape Days 2026** calendar:
- Source: https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/
- 15 curated events for 2026
- Includes attribution in every banner

**Seed file:** `supabase/seed-events-2026.json`

**Seed script:** `supabase/seed.sql` (auto-runs on Supabase setup)

### Business Logic

**Event Selection:**
- Display window: ±3 days from event date (configurable)
- Only one event per day per user
- Events are never shown if:
  - User dismissed it
  - Already shown today
  - No matching bottles in cellar
- Closest event to today is prioritized

**Bottle Matching:**
- Tags are matched case-insensitively against:
  - Bottle's `grapes` field (e.g., "Syrah" matches tag "syrah")
  - Bottle's `style` field (e.g., "sparkling" matches tag "champagne")
- Supports synonyms via tags: `['syrah', 'shiraz']`
- Only in-stock bottles are matched (`quantity > 0`)

### API Endpoints

**Base URL:** `/api/events`

1. **GET `/api/events/active`**
   - Returns the best event to show for the current user
   - Automatically updates `seen_at` and `last_shown_at`
   - Returns `null` if no event should be shown
   - **Auth:** Required (Supabase JWT)

2. **POST `/api/events/:id/dismiss`**
   - Marks event as dismissed (won't show again)
   - **Auth:** Required

3. **POST `/api/events/:id/seen`**
   - Marks event as seen (internal tracking)
   - **Auth:** Required

### Frontend Components

**`WineEventBanner.tsx`**
- Luxury banner with gradient background
- Shows event icon (🍇 grape, 🍷 wine, 🎉 occasion)
- Displays match count: "You have 3 matching bottles"
- Actions:
  - Primary CTA: "Show My Bottles" (filters cellar)
  - Dismiss button (top-right X)
  - "Learn More" (opens source URL)
- Animations: Smooth fade-in/out with Framer Motion
- RTL/LTR support

**`wineEventsService.ts`**
- `getActiveEvent()` - Fetch active event
- `dismissEvent(eventId)` - Dismiss event
- `markEventSeen(eventId)` - Track seen (auto-called by API)

### Integration

**CellarPage.tsx:**
- Banner appears after Demo Recommendation Card
- Only shown if:
  - Not in demo mode
  - User has bottles in cellar
  - Active event exists
- Clicking "Show My Bottles" filters cellar by event tag (e.g., `?q=syrah`)
- Dismissing removes banner and persists state

### Translations

**English (`en.json`):**
```json
{
  "wineEvents": {
    "youHaveMatches": "You have {{count}} matching bottle",
    "youHaveMatches_plural": "You have {{count}} matching bottles",
    "viewMatches": "Show My Bottles",
    "learnMore": "Learn More",
    "source": "Source",
    "dismiss": "Dismiss"
  }
}
```

**Hebrew (`he.json`):**
```json
{
  "wineEvents": {
    "youHaveMatches": "יש לך בקבוק {{count}} תואם",
    "youHaveMatches_plural": "יש לך {{count}} בקבוקים תואמים",
    "viewMatches": "הצג את הבקבוקים שלי",
    "learnMore": "למד עוד",
    "source": "מקור",
    "dismiss": "סגור"
  }
}
```

## Deployment Checklist

### Supabase (Database)

1. **Run migration:**
   ```bash
   psql $DATABASE_URL < supabase/migrations/20260130_add_wine_events.sql
   ```

2. **Seed events:**
   ```bash
   psql $DATABASE_URL < supabase/seed.sql
   ```

3. **Verify tables:**
   ```sql
   SELECT COUNT(*) FROM wine_events; -- Should return 15
   SELECT * FROM wine_events WHERE date >= CURRENT_DATE ORDER BY date LIMIT 5;
   ```

### Railway (API)

1. **Install dependencies:**
   ```bash
   cd apps/api
   npm install @supabase/supabase-js
   ```

2. **Environment variables:**
   - `SUPABASE_URL` - Already set
   - `SUPABASE_ANON_KEY` - Already set

3. **Deploy:**
   - Railway auto-deploys on git push
   - Verify logs show no errors on startup

### Vercel (Frontend)

1. **Install dependencies:**
   ```bash
   cd apps/web
   npm install
   ```

2. **Deploy:**
   - Vercel auto-deploys on git push
   - No new environment variables needed

## Testing

### Manual QA

**Prerequisites:**
- Database has events seeded
- User has bottles with grapes: Syrah, Malbec, Chardonnay, etc.
- Test during an event window (e.g., Feb 13-19 for Syrah Day)

**Test Cases:**

1. **Event appears when relevant**
   - Navigate to /cellar
   - Verify Wine Event Banner appears below Demo Recommendation Card
   - Verify event name, description, and date are correct

2. **Match count is accurate**
   - Banner should say "You have N matching bottles"
   - N should match number of bottles with relevant grape

3. **"Show My Bottles" filters cellar**
   - Click "Show My Bottles"
   - Verify search query is set to event tag (e.g., "syrah")
   - Verify only matching bottles appear

4. **Dismiss works**
   - Click X button
   - Banner should disappear with smooth animation
   - Refresh page - banner should NOT reappear
   - Check database: `dismissed_at` should be set in `user_event_states`

5. **Daily limit works**
   - View banner (creates `last_shown_at` record)
   - Dismiss it
   - Change `dismissed_at` to NULL in database
   - Refresh page - banner should NOT appear (already shown today)
   - Change `last_shown_at` to yesterday
   - Refresh - banner should reappear

6. **Learn More opens source**
   - For events with no matching bottles, primary CTA is "Learn More"
   - Click it - should open WSET article in new tab

7. **RTL support**
   - Switch to Hebrew
   - Verify banner text is right-aligned
   - Verify dismiss button is on top-left
   - Verify animations work correctly

8. **Mobile UX**
   - Test on iPhone/PWA
   - Verify banner doesn't cause horizontal scroll
   - Verify tap targets are >= 44px
   - Verify no layout shifts or blinking

### Unit Tests (TODO)

**Pending tests** (can be added later):

1. **Event selection logic**
   - Returns event within window
   - Returns null outside window
   - Returns null if dismissed
   - Returns null if shown today
   - Prioritizes event closest to today

2. **Bottle matching logic**
   - Matches grape in `grapes` field
   - Matches style in `style` field
   - Case-insensitive matching
   - Synonyms work (Syrah/Shiraz)
   - Only counts in-stock bottles (`quantity > 0`)

3. **API endpoints**
   - `/active` requires auth
   - `/active` returns correct event
   - `/dismiss` persists state
   - `/seen` updates timestamp

## Known Limitations

1. **No scraping:** Events must be manually added for 2027, 2028, etc.
2. **Simple matching:** Only matches exact grape names (no fuzzy matching or ML)
3. **Single event per day:** User sees max 1 event at a time
4. **SQLite API:** API uses SQLite for bottles, Supabase for events (hybrid architecture)

## Future Enhancements

- [ ] Unit tests for matching logic
- [ ] Admin UI to add/edit events
- [ ] Fuzzy matching for grape names (e.g., "Cab Sauv" → "Cabernet Sauvignon")
- [ ] Multiple events per week
- [ ] Event analytics (impressions, CTR, dismissals)
- [ ] Localized event names (Hebrew translations)
- [ ] Seed events for 2027+

## Files Changed

### New Files
- `supabase/migrations/20260130_add_wine_events.sql`
- `supabase/seed-events-2026.json`
- `apps/api/src/routes/events.ts`
- `apps/web/src/components/WineEventBanner.tsx`
- `apps/web/src/services/wineEventsService.ts`

### Modified Files
- `supabase/seed.sql` - Added event seeding
- `apps/api/src/index.ts` - Registered events router
- `apps/api/src/middleware/auth.ts` - Added `authenticateSupabase`
- `apps/web/src/pages/CellarPage.tsx` - Integrated banner
- `apps/web/src/i18n/locales/en.json` - Added translations
- `apps/web/src/i18n/locales/he.json` - Added translations

## Attribution

Event data sourced from:
**WSET - Wine and grape days 2026**  
https://www.wsetglobal.com/knowledge-centre/calendar/wine-and-grape-days-2026/

Every banner includes attribution to WSET as the source.

---

**Status:** ✅ Fully implemented (except unit tests)  
**Ready for:** Production deployment
