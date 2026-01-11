# Production Deployment Guide

## Environment Variables Required

### API Server (apps/api)

The following environment variables MUST be set in your production environment:

```bash
# OpenAI API Key (REQUIRED for Cellar Sommelier feature)
OPENAI_API_KEY=sk-proj-...

# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Node Environment
NODE_ENV=production

# Database (if using separate database)
DATABASE_URL=postgresql://...
```

### Web App (apps/web)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Analytics (optional)
VITE_ANALYTICS_ENABLED=false
```

## Vercel Deployment Steps

### 1. Set Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables and add:

**For API:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `NODE_ENV` = `production`

**For Web:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

### 2. Run Database Migration

The Cellar Sommelier feature requires a new column in the profiles table.

**Option A: Using Supabase Dashboard**

1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase/migrations/20260111_add_cellar_agent_flag.sql`
3. Run the migration

**Option B: Using Supabase CLI**

```bash
# Push the migration to your production database
supabase db push
```

### 3. Deploy to Vercel

```bash
# Deploy from main branch
git push origin main

# Vercel will automatically deploy
# Or manually trigger from Vercel dashboard
```

### 4. Verify Deployment

1. Check that the API server is running: `https://your-api.vercel.app/health`
2. Check that environment variables are loaded (check server logs)
3. Verify no secrets are exposed in client bundle:
   ```bash
   # Check the built client for OPENAI_API_KEY (should find nothing)
   grep -r "OPENAI_API_KEY" apps/web/dist/
   ```

### 5. Enable Feature for Test Users

See section below on enabling the feature for specific users.

## Enabling Cellar Sommelier for Users

The Cellar Sommelier feature is **OFF by default** for all users. To enable it:

### Using Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Open the `profiles` table
3. Find the user you want to enable
4. Set `cellar_agent_enabled` = `true`
5. Save changes

The user will see the feature appear immediately (no logout required, thanks to Realtime).

### Using SQL

```sql
-- Enable for a specific user
UPDATE profiles
SET cellar_agent_enabled = true
WHERE id = 'user-uuid-here';

-- Enable for all users (use with caution!)
UPDATE profiles
SET cellar_agent_enabled = true;

-- Disable for a specific user
UPDATE profiles
SET cellar_agent_enabled = false
WHERE id = 'user-uuid-here';
```

### Beta Testing Strategy

Recommended rollout:

1. **Phase 1**: Enable for 1-2 internal users (your own accounts)
2. **Phase 2**: Enable for 5-10 trusted beta testers
3. **Phase 3**: Enable for 50-100 users
4. **Phase 4**: Enable for all users (or keep it as a premium feature)

## Cost Monitoring

### OpenAI API Usage

Monitor your OpenAI usage at: https://platform.openai.com/usage

**Rate limits in place:**
- 30 requests per user per day
- Max 50 bottles sent per request
- Max 8 conversation turns

**Estimated costs (GPT-4o):**
- ~500 tokens per request (input)
- ~200 tokens per response (output)
- $5 per 1M input tokens, $15 per 1M output tokens
- **Cost per request: ~$0.006** (0.6 cents)
- **Cost per user per day (at limit): ~$0.18**

For 1000 active users: ~$180/day = ~$5,400/month (worst case)

### Recommended Monitoring

1. Set up OpenAI usage alerts
2. Monitor Vercel function execution costs
3. Monitor Supabase database size (conversations not stored, so minimal impact)
4. Set up Sentry or similar for error tracking

## Security Checklist

- [ ] `OPENAI_API_KEY` is set as environment variable (not in code)
- [ ] `OPENAI_API_KEY` is NOT in client bundle (`grep` check passes)
- [ ] Feature flag is enforced server-side (cannot be bypassed via API)
- [ ] Rate limiting is active (30 requests/day per user)
- [ ] User authentication is required for API endpoints
- [ ] No cellar data is logged or sent to third parties
- [ ] RLS policies are active on profiles table

## Rollback Plan

If you need to disable the feature:

### Emergency Disable (All Users)

```sql
-- Disable for all users immediately
UPDATE profiles
SET cellar_agent_enabled = false;
```

### Remove Feature Flag Column (Complete Rollback)

```sql
-- Remove the column (data will be lost)
ALTER TABLE profiles
DROP COLUMN cellar_agent_enabled;
```

Then redeploy without the Sommelier code.

## Support & Troubleshooting

### Common Issues

**User reports: "Sommelier not showing"**
1. Check `profiles.cellar_agent_enabled = true` for that user
2. Ask user to refresh the page
3. Check browser console for errors

**User reports: "Daily limit reached"**
1. This is expected behavior (30 requests/day)
2. Limit resets at midnight (server timezone)
3. To increase limit: modify `DAILY_LIMIT` in `apps/api/src/routes/agent.ts`

**API returns 403**
1. Check feature flag is enabled for user
2. Check user is authenticated
3. Check `OPENAI_API_KEY` is set in Vercel

**API returns 500**
1. Check Vercel function logs
2. Check OpenAI API status
3. Check Supabase connection

## Monitoring Queries

```sql
-- Count users with feature enabled
SELECT COUNT(*) 
FROM profiles 
WHERE cellar_agent_enabled = true;

-- List users with feature enabled
SELECT id, display_name, email 
FROM profiles 
WHERE cellar_agent_enabled = true;
```

## Contact

For issues or questions about deployment:
- Check Vercel logs
- Check Supabase logs
- Check OpenAI usage dashboard
