# Admin Intelligence Dashboard — Implementation Notes

## How admin access works

Access is gated by `profiles.is_admin = true`.

1. **Frontend** — `AdminDashboardPage` calls `supabase.rpc('is_admin', { check_user_id: user.id })` on mount.
   If false, renders a "Not authorized" card. No redirect.
2. **Database** — Every admin RPC function (`admin_overview_metrics`, `admin_get_users`, etc.) is `SECURITY DEFINER`
   and checks `is_admin(auth.uid())` at the top. Non-admins get `RAISE EXCEPTION 'Unauthorized'`.
3. **RLS policies** — `app_events`, `ai_usage_events`, `wines`, `bottles`, `profiles` all have admin SELECT policies:
   `USING (public.is_admin(auth.uid()))`.
4. To grant admin access to a user:
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'you@example.com';
   ```

## Route

`/admin` → `AdminDashboardPage` — wrapped in `PrivateRoute` (requires auth) + Layout.
Existing `/admin/enrich` route is unchanged.

---

## Event tracking

### How to add a new event

```ts
import { trackEvent } from '../lib/analytics/trackEvent';

trackEvent({
  event_name: 'my_event',          // snake_case
  event_type: 'action',            // optional: 'action' | 'error' | 'view'
  source: 'component_name',        // optional: where the event fired
  metadata: { wine_id: 'abc...' }, // optional: scalar values only
});
```

Call it anywhere — it's fire-and-forget and **never throws**. Call it alongside GA4 events if you want both.

### Events tracked at launch

| Event | Where | Notes |
|-------|-------|-------|
| `user_signed_up` | `SupabaseAuthContext.signUp` | Email signup only; Google OAuth fires `login_completed` via `SIGNED_IN` |
| `login_completed` | `SupabaseAuthContext.onAuthStateChange` | Fires on every `SIGNED_IN` event |
| `bottle_scan_started` | `AddBottleContext.handleSmartScan` | Any scan mode |
| `bottle_scan_completed` | `AddBottleContext.handleSmartScan` | Includes `mode`, `detected_count` in metadata |
| `bottle_scan_failed` | `AddBottleContext.handleSmartScan` | Includes `error_type` in metadata |

### Events documented but not yet instrumented

These flows exist in the app but `trackEvent` has not been added yet:

| Event | Why not added | Where to add |
|-------|--------------|-------------|
| `wine_analysis_started` | Needs locating the analysis trigger | Component that calls `analyze-wine` Edge Function |
| `wine_analysis_completed` | Same | Same |
| `wine_analysis_failed` | Same | Same |
| `food_pairing_viewed` | Feature exists but call site not located | Food pairing display component |
| `food_pairing_generated` | Same | `generate-food-pairing` invocation site |
| `tonights_selection_opened` | Feature exists | `RecommendationPage` or context |
| `language_changed` | Exists in GA4 (`trackLocalization`) | Language switcher component — add internal trackEvent alongside |
| `wine_page_viewed` | Page-level event | Wine detail component |
| `bottle_added` | After successful bottle creation | Bottle creation success callback |

---

## AI usage logging

All major user-facing AI Edge Functions already call `logCreditUsage()` from `_shared/creditHelper.ts`,
which writes to the `ai_usage_events` table. The admin **AI & Usage** tab reads directly from this table.

### Covered (logs to `ai_usage_events`)

| Edge Function | `action_type` in table |
|---------------|----------------------|
| `analyze-wine` | `wine_bottle_analysis` |
| `parse-label-image` | logged |
| `generate-food-pairing` | logged |
| `generate-wine-profile` | logged |
| `generate-label-art` | logged |
| `analyze-cellar` | logged |

### Not yet logging

| Function | Reason |
|---------|--------|
| `extract-wine-label` | Does not call `logCreditUsage`; secondary scan path |
| `backfill-he-translations` | Batch admin operation; high volume would pollute the table |
| `backfill-wine-profiles` | Same |
| `backfill-food-pairing` | Same |
| `backfill-analysis` | Same |
| Cellar Agent (`apps/api`) | Uses Express + `openai` npm package, separate from Edge Functions; would need a separate log insert |

For backfill functions, consider logging one summary row per batch run rather than per wine.

---

## Dashboard metrics

### What is real data now

All metrics in the **Overview**, **Users**, **Wine Data**, and **AI & Usage** tabs derive from real
Supabase tables. No mocks. Data existed before this dashboard was added.

### What starts at zero

| Metric | Requires |
|--------|---------|
| Events (7d) | `app_events` rows — fires once `trackEvent()` is called |
| Event-active users (7d) | Same |
| Scan starts/failures (7d) | `bottle_scan_started`/`bottle_scan_failed` events in `app_events` |
| Analysis failures (7d) | `wine_analysis_failed` events in `app_events` |
| Top events (Insights) | Any `app_events` rows |
| Last event per user (Users tab) | Any `app_events` rows |

### `last_active_at` on profiles

Added in migration `20260505000001`. Starts `NULL` for all existing users.
Updated on login via `touch_profile_last_active()` (throttled to once/hour) from
`SupabaseAuthContext` on `SIGNED_IN`. Login heartbeat is **not** counted as meaningful
activity by the Engagement tab — outcome tables are.

---

## Engagement tab (user health)

Route: `/admin` → **Engagement**. Migration: `20261030_admin_engagement_dashboard.sql`.

Rules live in SQL RPCs and are mirrored in `apps/web/src/lib/admin/engagementRules.ts`
(unit-tested). Thresholds are **heuristics for a wine app**, not validated churn scores.
There is no subscription churn probability.

### Definitions (UTC)

- **Active day**: ≥1 completed **feature family** on that UTC date after dedupe:
  cellar (bottle ∪ scan wine), consumption, delivered recommendation / agent rec,
  evening plan, meaningful Sommi chat, successful AI call, reminder created, wishlist.
  Login heartbeat, failed/started-only analysis, empty chats, and app_events that
  duplicate durable tables are excluded.
- **Activated**: current bottle, scan wine, delivered recommendation
  (`recommendation_count > 0`), meaningful Sommi chat (user + assistant messages),
  consumption, or `bottle_added` app_event. Empty conversation shells and zero-result
  recommendation runs do **not** count.
- **Activation durability**: survives bottle delete when wines/recs/chats/consumption/
  `bottle_added` events remain. Pre-tracking hard deletes without other durable signals
  **cannot** be reconstructed.
- **Activation rate denominator**: users with account age ≥ 14 days only (exclusions applied).
- **Windows** (fixed as-of **T**, half-open, non-overlapping): current `[T-28d, T)`;
  previous `[T-56d, T-28d)`. Optional GUC `app.engagement_as_of` for deterministic tests.
- **Observation coverage**: period-over-period risk requires
  `observed_retained_comparable` (age ≥ 56d so both windows exist, non-empty retained
  comparison, and complete chat message timestamps when chats exist). Age alone is not
  tracking completeness. Metrics are **observed retained activity** only.
  Incomplete chat timestamps, hard deletes, and unlogged paths suppress confident
  “At risk” / “Declining” / “No decline” (risk stays `insufficient_history` or
  `prolonged_inactivity`).
- **Activation rate**: lifetime observed activation among accounts aged ≥14 days —
  **not** a 14-day conversion rate.
- **Sommelier cadence**: per-message `timestamp` with non-empty user+assistant content
  on the same UTC day. `last_message_at` is never used as daily history.

### Segments (priority)

| Segment | Rule |
|---------|------|
| New | Account age &lt; 14 days |
| Not activated | Age ≥ 14 and not activated |
| Dormant | Activated and ≥ 60 days since last meaningful activity |
| Power user | ≥ 8 active days in 28d (**active days only** — no action-volume shortcut) |
| Regular | ≥ 3 active days in 28d |
| Occasional engaged | Activated, not dormant, below regular/power |

### Engagement risk (independent of segment)

| Risk | Rule |
|------|------|
| Prolonged inactivity | ≥ 60 days since last activity **and** both 28d windows empty (never “no decline”) |
| Insufficient history | Age &lt; 56d, or lifetime active days &lt; 3, or both windows empty after age ≥ 56 |
| At risk of disengagement | Prior 28d ≥ 3 active days, current ≤ 1, and ≥ 14 days since last activity |
| Declining engagement | Prior ≥ 2 days, current &lt; 50% of prior, absolute drop ≥ 2 |
| No detected decline | Otherwise (occasional users are not auto-flagged) |

### Exclusions

Admins and emails matching `@example.com`, `@sommi.test`, `test*@`, `*+test*@`,
`demo+*`, `*+admin*@sommi*` are excluded from overview metrics by default. The UI
shows the rule and count; toggle **Include excluded** on the user table.

### Historical vs forward-looking

| Durable historical (drives cadence / activation) | Tracking-since only (not cadence) |
|--------------------------------------------------|-----------------------------------|
| bottles, wines/`ai_scan`, consumption, delivered recommendations, evening plans, meaningful Sommi chats, agent rec events, successful AI usage, reminder creation, wishlist | `app_events` (errors / timeline / `bottle_added` durability), `last_active_at` heartbeat |

Missing forward-only series are never invented into “At risk” or “No decline.”

### Manual staging handoff (preferred)

See `supabase/verification/ENGAGEMENT_MANUAL_HANDOFF.md` for preflight, apply,
post-checks, auth matrix, fixtures, and rollback. Apply **only**
`supabase/migrations/20261030_admin_engagement_dashboard.sql` after preflight —
do not re-run the entire historical migrations folder blindly.

### Optional local stub Postgres (no Auth/PostgREST)

```bash
pg_ctl -D .local/pg-engagement -o "-p 54329" start   # after one-time initdb
createdb -h 127.0.0.1 -p 54329 -U postgres sommi_engagement_test
psql -h 127.0.0.1 -p 54329 -U postgres -d sommi_engagement_test \
  -f supabase/verification/engagement_local_setup.sql \
  -f supabase/migrations/20261030_admin_engagement_dashboard.sql \
  -f supabase/verification/engagement_local_tests.sql
```

---

## Admin RPC reference

| Function | Returns | Purpose |
|---------|---------|---------|
| `admin_overview_metrics()` | JSONB | All KPI counts for Overview tab |
| `admin_get_users(limit, offset)` | TABLE | Paginated user list with counts |
| `admin_get_wine_data_quality(limit, offset)` | TABLE | Wines ordered by gap count |
| `admin_get_events(limit, offset, event_name)` | TABLE | Paginated app_events stream |
| `admin_get_ai_calls(limit, offset, status)` | TABLE | Paginated ai_usage_events |
| `admin_get_ai_summary()` | TABLE | AI calls grouped by feature |
| `admin_get_insights()` | JSONB | Product improvement signals |
| `admin_engagement_overview()` | JSONB | Engagement KPIs, segments, risk, coverage |
| `admin_engagement_users(...)` | JSONB | Filtered/sorted/paginated engagement users |
| `admin_engagement_user_detail(user_id)` | JSONB | Classification explanation + timeline |
| `touch_profile_last_active()` | void | Login heartbeat (caller only, 1/hour) |

All admin_* RPCs are `SECURITY DEFINER` and throw `Unauthorized` if caller is not admin.

---

## Recommended next phase

1. **Instrument remaining events** — food pairing, Tonight's Selection opened, Sommi message sent, evening plan completed.
2. **Cellar Agent AI logging** — add a Supabase insert to `ai_usage_events` in `apps/api/routes/agent.ts`.
3. **`extract-wine-label` logging** — add `logCreditUsage` call (same pattern as `parse-label-image`).
4. **Calibrate thresholds** — after a few weeks of live distributions, revisit power/regular/dormant cutoffs.
5. **`supabase gen types`** — regenerate `apps/web/src/types/supabase.ts` for new RPCs/columns.
