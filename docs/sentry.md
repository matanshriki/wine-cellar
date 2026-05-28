# Sentry Integration — Sommi AI

Sentry is integrated across all three production surfaces: the React/Vite frontend, the Express/Node API, and Supabase Edge Functions (Deno).

---

## Sentry Projects

Create three separate Sentry projects for clean signal separation:

| Project name           | Platform      | Surface                          |
|------------------------|---------------|----------------------------------|
| `sommi-web`            | React         | apps/web (Vite SPA)              |
| `sommi-api`            | Node.js (Express) | apps/api (Railway)           |
| `sommi-edge-functions` | Deno          | supabase/functions               |

Each project has its own DSN. Never mix DSNs between projects.

---

## Required Environment Variables

### apps/web — Vercel

Set these in Vercel → Project → Settings → Environment Variables.

| Variable               | Value example                     | Notes                                    |
|------------------------|-----------------------------------|------------------------------------------|
| `VITE_SENTRY_DSN`      | `https://abc123@sentry.io/123456` | Browser DSN for `sommi-web`              |
| `VITE_SENTRY_ENVIRONMENT` | `production` or `preview`      | Controls traces sample rate              |
| `VITE_APP_VERSION`     | `2.1.0`                           | Shown as release in Sentry               |
| `SENTRY_AUTH_TOKEN`    | `sntrys_…`                        | **Build-only** — source map upload token |
| `SENTRY_ORG`           | `your-org-slug`                   | Your Sentry organization slug            |
| `SENTRY_PROJECT`       | `sommi-web`                       | Must match Sentry project slug           |

`SENTRY_AUTH_TOKEN` is **never** exposed to the browser. It is only used during `vite build` by the Sentry Vite plugin.

### apps/api — Railway

Set these in Railway → Service → Variables.

| Variable               | Value example                     | Notes                                    |
|------------------------|-----------------------------------|------------------------------------------|
| `SENTRY_DSN`           | `https://def456@sentry.io/789012` | Node DSN for `sommi-api`                 |
| `SENTRY_ENVIRONMENT`   | `production`                      |                                          |
| `SENTRY_RELEASE`       | `2.1.0` or git SHA                | Optional; improves release tracking      |

### supabase/functions — Supabase Dashboard

Set these in Supabase → Project → Settings → Edge Functions → Secrets.

| Variable               | Value example                     | Notes                                    |
|------------------------|-----------------------------------|------------------------------------------|
| `SENTRY_DSN`           | `https://ghi789@sentry.io/345678` | Deno DSN for `sommi-edge-functions`      |
| `SENTRY_ENVIRONMENT`   | `production`                      |                                          |
| `SENTRY_RELEASE`       | `2.1.0`                           | Optional                                 |

> Sentry is completely disabled (no-op) when the DSN variable is absent. Safe to deploy without setting any Sentry vars — it will just not report.

---

## How to Get a Sentry Auth Token (for source maps)

1. Go to **Sentry → Settings → Account → API → Auth Tokens**
2. Create a new token with scopes: `project:releases`, `org:read`
3. Copy the token and add it as `SENTRY_AUTH_TOKEN` in Vercel's build environment

Source maps are generated **only** during production builds when `SENTRY_AUTH_TOKEN` is present, and are **deleted from the deployment** after upload so they are never shipped to users.

---

## How to Test Sentry Locally

### Frontend

1. Add to `apps/web/.env.local`:
   ```
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   VITE_SENTRY_ENVIRONMENT=development
   ```
2. Start the dev server: `npm run dev`
3. Navigate to `/admin` (admin users only) → **Monitoring** tab
4. Click **"Send test error to Sentry"**
5. Check the Sentry dashboard for a new issue tagged `test: true`

### API

1. Add to `apps/api/.env.local`:
   ```
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_ENVIRONMENT=development
   ```
2. Start the API: `npm run dev`
3. Trigger an error by hitting an invalid route or throwing manually in a route handler

### Edge Functions

1. Add secrets via Supabase CLI or dashboard
2. Deploy and invoke a function; errors will appear in Sentry under `sommi-edge-functions`

---

## How to Verify Source Maps

After a production deploy with `SENTRY_AUTH_TOKEN` set:

1. Go to **Sentry → sommi-web → Settings → Source Maps**
2. Find the release matching `VITE_APP_VERSION`
3. Verify artifact count > 0
4. Trigger a real error in production and check that the stack trace shows original TypeScript source lines

If source maps are missing, check the Vercel build log for lines like:
```
[sentry] Uploading source maps to Sentry...
[sentry] Successfully uploaded source maps for release X.X.X
```

---

## Privacy Rules — What Must Never Be Sent to Sentry

The following data is **always scrubbed** by the `beforeSend` / `beforeBreadcrumb` hooks before any event leaves the client or server:

| Category                  | Specific fields                                              |
|---------------------------|--------------------------------------------------------------|
| Auth tokens               | `authorization`, `access_token`, `refresh_token`, `token`   |
| Secrets / keys            | `password`, `secret`, `private_key`, `api_key`, `service_role` |
| AI content                | `prompt`, `image_url`, `image`, `base64`                    |
| Payment data              | `payment`, `card`, `customer_email`, `cvv`, `pan`           |
| Session cookies           | `cookie`, `cookies`                                         |
| Raw request body          | Dropped entirely (`request.data` removed)                    |

Additionally:
- Sentry user context contains **only `user.id`** — never email, name, or profile data
- AI provider names (`openai`, `perplexity`) are safe to log; prompt text is not
- Bottle and wine IDs are safe; wine notes and analysis text are not
- Event metadata like `language`, `readiness_label`, and `operation` type are safe

---

## Breadcrumbs Instrumented

### Frontend

| Event                     | Category   | Location                          |
|---------------------------|------------|-----------------------------------|
| `cellar.loaded`           | navigation | `CellarPage` mount                |
| `bottle.modal_opened`     | ui         | `WineDetailsModal`                |
| `wine.analysis_started`   | ai         | `aiAnalysisService.generateAIAnalysis` |
| `wine.analysis_completed` | ai         | `aiAnalysisService.generateAIAnalysis` |
| `wine.analysis_failed`    | ai         | `aiAnalysisService.generateAIAnalysis` |
| `scan.started`            | ai         | `labelParseService.parseLabelImage` |
| `scan.failed`             | ai         | `labelParseService.parseLabelImage` |
| `i18n.language_changed`   | user       | `i18n/config.changeLanguage`      |
| `credits.modal_opened`    | ui         | `NoCreditsModal`                  |
| `checkout.started`        | billing    | `lib/paddle.openCheckout`         |

### API

| Event                      | Category | Location                |
|----------------------------|----------|-------------------------|
| `ai.analysis_started`      | ai       | `services/ai.ts`        |
| `ai.analysis_completed`    | ai       | `services/ai.ts`        |
| `ai.analysis_failed`       | ai       | `services/ai.ts`        |
| `billing.webhook_received` | billing  | `routes/billing.ts`     |
| `agent.session_started`    | ai       | `routes/agent.ts`       |

---

## Suggested Alert Rules

Configure in **Sentry → Alerts → Create Alert Rule** for each project.

### All projects

| Alert                          | Condition                              | Priority |
|--------------------------------|----------------------------------------|----------|
| New issue in production        | Issue first seen in `production`       | Medium   |
| High frequency issue           | Issue seen > 10 times in 1 hour        | High     |
| Error spike                    | Error rate increases by 2× in 10 min  | High     |

### sommi-web

| Alert                          | Condition                              | Priority |
|--------------------------------|----------------------------------------|----------|
| AI analysis failure spike      | `scan.failed` or `wine.analysis_failed` breadcrumbs > 20/hr | High |
| Checkout errors                | Error in `checkout.started` flow       | High     |

### sommi-api

| Alert                          | Condition                              | Priority |
|--------------------------------|----------------------------------------|----------|
| Payment webhook error          | Error tagged `event_type: subscription.*` or `transaction.*` | Critical |
| AI analysis failure            | Error in `ai.analysis_failed` > 5/hr  | High     |

### sommi-edge-functions

| Alert                          | Condition                              | Priority |
|--------------------------------|----------------------------------------|----------|
| analyze-wine errors            | `function_name: analyze-wine` > 10 errors/hr | High |
| analyze-cellar errors          | `function_name: analyze-cellar` > 5 errors/hr | High |
| parse-label-image errors       | `function_name: parse-label-image` > 15 errors/hr | High |
| admin-notifications errors     | `function_name: admin-notifications` any error | High |

---

## Architecture Summary

```
apps/web
  └── src/lib/sentry.ts          Sentry.init (DSN-gated)
  └── src/lib/monitoring.ts      Safe helper wrappers (setMonitoringUser, captureAppError, ...)
  └── src/lib/sentryPrivacy.ts   scrubEvent, scrubBreadcrumb, REDACTED_FIELDS

apps/api
  └── src/lib/sentry.ts          Sentry.init + scrubbers
  └── src/index.ts               expressRequestHandler + expressErrorHandler

supabase/functions
  └── _shared/sentry.ts          withSentry(name, handler) + setSentryWineContext
```

---

## Rollback

To disable Sentry entirely: remove the `VITE_SENTRY_DSN` / `SENTRY_DSN` environment variables. All Sentry code is no-op when the DSN is absent.
