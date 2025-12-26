# Supabase Integration Setup Guide

## Overview

Wine Cellar Brain now uses Supabase for:
- **Authentication**: Email/password login with secure session management
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Real-time**: Automatic data sync across clients

This guide covers local development setup. Production deployment to Vercel is covered separately.

---

## Architecture Changes

### What Changed
- **Removed**: Express backend (`/apps/api`)
- **Added**: Supabase client in frontend
- **Database**: SQLite → PostgreSQL (via Supabase)
- **Auth**: JWT (custom) → Supabase Auth
- **API**: REST endpoints → Supabase client queries

### Data Model
- **Separation of Concerns**: `wines` table (catalog) separate from `bottles` table (inventory)
- **Multi-tenant**: All tables have `user_id` with RLS policies
- **Audit Trail**: `consumption_history` and `recommendation_runs` for tracking

---

## Prerequisites

1. **Node.js 18+** and npm
2. **Supabase CLI** (for local development)
3. **Docker Desktop** (required by Supabase CLI)

---

## Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
# See: https://supabase.com/docs/guides/cli/getting-started
```

Verify installation:
```bash
supabase --version
```

---

## Step 2: Start Supabase Locally

From the project root:

```bash
# Start local Supabase (PostgreSQL, Auth, Storage, etc.)
npx supabase start
```

**Important**: This command will:
- Download Docker images (~1-2GB first time)
- Start local PostgreSQL, PostgREST, Auth, Storage
- Output API URLs and keys

**Save the output!** You'll need:
- `API URL`: Usually `http://127.0.0.1:54321`
- `anon key`: A long JWT token

Example output:
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Apply Database Migrations

The schema is defined in `/supabase/migrations/20251226_initial_schema.sql`.

Apply it:

```bash
# Run migrations
npx supabase db reset
```

This will:
- Create all tables (`profiles`, `wines`, `bottles`, `consumption_history`, `recommendation_runs`)
- Enable RLS on all tables
- Create RLS policies
- Set up triggers (auto-create profile on signup)

---

## Step 4: Configure Environment Variables

### Frontend (`/apps/web`)

Create `/apps/web/.env`:

```bash
# Copy from the output of `supabase start`
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: Use the `anon key`, **NOT** the `service_role key`. The anon key is safe to use in the frontend and respects RLS policies.

---

## Step 5: Start the Frontend

```bash
cd apps/web
npm install  # If you haven't already
npm run dev
```

The app will be available at: `http://localhost:5173`

---

## Step 6: Create Your First User

1. Go to `http://localhost:5173/login`
2. Click "Create Account"
3. Enter email and password
4. Submit

The app will:
- Create a user in Supabase Auth
- Automatically create a profile row (via database trigger)
- Log you in

---

## Local Development Workflow

### Starting Everything

```bash
# Terminal 1: Supabase
npx supabase start

# Terminal 2: Frontend
cd apps/web
npm run dev
```

### Stopping Everything

```bash
# Stop Supabase
npx supabase stop

# Stop frontend (Ctrl+C in terminal)
```

### Viewing the Database

Supabase Studio (local dashboard):
```
http://127.0.0.1:54323
```

You can:
- Browse tables
- Run SQL queries
- View RLS policies
- Check auth users
- Monitor logs

---

## Database Schema

### Tables

#### `profiles`
User profiles (one per auth user)
- `id` (references `auth.users`)
- `display_name`
- `preferred_language` ('en' or 'he')

#### `wines`
Wine catalog (the "label")
- `producer`, `wine_name`, `vintage`
- `color` (red/white/rose/sparkling)
- `region`, `country`, `appellation`
- `grapes` (JSONB array)
- `vivino_wine_id` (optional)

#### `bottles`
Inventory instances
- `wine_id` (FK to wines)
- `quantity`
- `purchase_date`, `purchase_price`, `purchase_location`
- `drink_window_start/end`, `readiness_status`
- `serve_temp_c`, `decant_minutes` (from AI analysis)
- `storage_location`, `bottle_size_ml`

#### `consumption_history`
When bottles are opened
- `bottle_id`, `wine_id`
- `opened_at`
- `occasion`, `meal_type`, `vibe`
- `user_rating`, `tasting_notes`

#### `recommendation_runs`
Audit trail for "What to Open Tonight?"
- `input_payload` (JSON)
- `output_payload` (JSON)

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- **SELECT**: Users can only see their own data (`auth.uid() = user_id`)
- **INSERT**: Users can only insert with their own `user_id`
- **UPDATE**: Users can only update their own rows
- **DELETE**: Users can only delete their own rows

**Testing RLS**: Try querying in Supabase Studio as a specific user to verify policies work.

---

## Data Access Layer

All database operations go through typed services:

### `profileService.ts`
- `getMyProfile()`
- `updateMyProfile(updates)`
- `upsertMyProfile(updates)`

### `bottleService.ts`
- `listBottles()` - Get all user's bottles with wine info
- `getBottle(id)` - Get single bottle
- `createBottle(input)` - Create wine + bottle
- `updateBottle(id, updates)`
- `deleteBottle(id)`
- `updateBottleAnalysis(id, analysis)` - Save AI analysis

### `historyService.ts`
- `listHistory()` - Get consumption history
- `markBottleOpened(input)` - Record opening + decrement quantity
- `getConsumptionStats()` - Calculate statistics

---

## Migration from Old Backend

### What to Keep
- ✅ All UI components (React, Tailwind, i18n)
- ✅ All features (cellar, recommendations, history)
- ✅ Mobile optimization & RTL support

### What Changed
- ❌ No more Express API (`/apps/api`)
- ❌ No more Prisma + SQLite
- ❌ No more custom JWT auth
- ❌ No more Google OAuth (for now - can re-add with Supabase Auth)
- ✅ Direct Supabase client calls from frontend
- ✅ Supabase Auth (email/password)
- ✅ PostgreSQL with RLS

### Pages That Need Updating
- [x] `LoginPage.tsx` - Updated to use Supabase Auth
- [x] `App.tsx` - Updated to use SupabaseAuthProvider
- [x] `Layout.tsx` - Updated to use signOut
- [ ] `CellarPage.tsx` - Update to use `bottleService`
- [ ] `RecommendationPage.tsx` - Update to use `bottleService`
- [ ] `HistoryPage.tsx` - Update to use `historyService`
- [ ] `BottleForm.tsx` - Update to use `bottleService`
- [ ] `BottleCard.tsx` - Update to use `bottleService`

---

## Troubleshooting

### Supabase won't start
**Problem**: Docker not running  
**Solution**: Start Docker Desktop

**Problem**: Port conflicts (5432, 54321, etc.)  
**Solution**: Stop conflicting services or change ports in `supabase/config.toml`

### "Invalid API key" error
**Problem**: Wrong key or missing env vars  
**Solution**: Check `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### "Not authorized" errors
**Problem**: RLS policies blocking access  
**Solution**: 
1. Check you're logged in (`supabase.auth.getUser()`)
2. Verify RLS policies in Supabase Studio
3. Check `user_id` matches `auth.uid()`

### Migrations not applied
**Problem**: Old schema still present  
**Solution**: `npx supabase db reset` (resets and re-applies all migrations)

### Can't login
**Problem**: Email confirmation required  
**Solution**: For local dev, email confirmation is disabled by default. Check Supabase Studio > Authentication > Users to see if user was created.

---

## Production Deployment (Vercel)

### Setup Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to provision
4. Go to Project Settings > API
5. Copy:
   - `Project URL` (like `https://xyz.supabase.co`)
   - `anon public` key

### Apply Migrations to Production

```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push
```

### Configure Vercel

Set environment variables in Vercel:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Auth Configuration

In Supabase Dashboard:
- Go to Authentication > URL Configuration
- Add your Vercel domain to "Site URL"
- Add redirect URLs (e.g., `https://your-app.vercel.app/auth/callback`)

---

## Testing Checklist

- [ ] Start Supabase locally
- [ ] Apply migrations
- [ ] Start frontend
- [ ] Create account
- [ ] Login
- [ ] Add bottles (currently need to update CellarPage)
- [ ] View history
- [ ] Get recommendations
- [ ] Switch languages (EN/HE)
- [ ] Test RTL layout
- [ ] Test mobile view

---

## Next Steps

1. **Update Remaining Pages**: The data access layer is ready, but pages need to be updated to use it:
   - `CellarPage.tsx`
   - `Recommendation Page.tsx`
   - `HistoryPage.tsx`
   - `BottleForm.tsx`
   - `BottleCard.tsx`

2. **Add Seed Data**: Create a script to seed sample bottles for testing

3. **Add AI Integration**: Update to call OpenAI for bottle analysis (currently uses fallback)

4. **Add CSV Import**: Update CSV import to use Supabase instead of old API

5. **Testing**: Comprehensive E2E tests

---

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)

---

## Summary

✅ **Completed**:
- Supabase client setup
- Database schema with RLS
- Auth integration (Supabase Auth)
- Typed data access layer
- Login/logout flow
- Documentation

⏳ **In Progress**:
- Update all pages to use Supabase

📋 **TODO**:
- Test end-to-end
- Add seed data
- Re-add features (CSV import, AI analysis, recommendations)

**The foundation is solid. Now we need to update the UI layer to use Supabase instead of the old API.**

