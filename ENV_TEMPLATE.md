# Environment Variables Template

## Required for Vercel Deployment

Add these environment variables in your Vercel project settings:

### Supabase Configuration

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these values:**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon public** key → Use as `VITE_SUPABASE_ANON_KEY`

## Local Development

For local development, create a `.env` file in the root directory:

```bash
# .env (DO NOT COMMIT THIS FILE)
VITE_SUPABASE_URL=https://pktelrzyllbwrmcfgocx.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
```

The `.env` file is already in `.gitignore` and will not be committed.

