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
Update it on login by calling `UPDATE profiles SET last_active_at = now() WHERE id = auth.uid()`
from the auth event handler (next phase).

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

All are `SECURITY DEFINER` and throw `Unauthorized` if caller is not admin.

---

## Recommended next phase

1. **Update `last_active_at`** — in `SupabaseAuthContext.onAuthStateChange` for `SIGNED_IN`, call:
   ```ts
   supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', user.id)
   ```
2. **Instrument remaining events** — wire `trackEvent` into wine analysis, food pairing, Tonight's Selection, bottle added.
3. **Cellar Agent AI logging** — add a Supabase insert to `ai_usage_events` in `apps/api/routes/agent.ts`.
4. **`extract-wine-label` logging** — add `logCreditUsage` call (same pattern as `parse-label-image`).
5. **Date range filters** — extend admin RPC functions to accept `p_start_date`/`p_end_date` params.
6. **`supabase gen types`** — regenerate `apps/web/src/types/supabase.ts` so TypeScript knows about
   `app_events`, `last_active_at`, and all new columns added since last generation.
