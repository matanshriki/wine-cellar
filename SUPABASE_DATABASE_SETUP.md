# Supabase Database Setup

## ⚠️ Important: You MUST run the SQL migration before the app will work!

The Cellar page and all other features require these database tables to exist in Supabase.

## 📋 Steps to Create the Database Tables

### 1. Go to Supabase SQL Editor

1. Open your Supabase project: https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**

### 2. Copy and Paste the SQL Migration

Copy the **entire content** from this file:

```
/Users/matanshr/Desktop/Projects/Playground/wine/supabase/migrations/20251226_initial_schema.sql
```

And paste it into the SQL Editor in Supabase.

### 3. Run the Migration

Click the **"Run"** button (or press Cmd+Enter / Ctrl+Enter)

You should see:
```
Success. No rows returned
```

### 4. Verify Tables Were Created

1. Click **"Table Editor"** in the left sidebar
2. You should see these tables:
   - ✅ `profiles`
   - ✅ `wines`
   - ✅ `bottles`
   - ✅ `consumption_history`
   - ✅ `recommendation_runs`

## 🔒 Security: Row Level Security (RLS)

The migration automatically enables RLS on all tables, so users can only see their own data.

## 🎯 What the Migration Creates

### Tables:
- **profiles** - User profile info (display name, language preference)
- **wines** - Wine catalog (producer, name, vintage, region, etc.)
- **bottles** - User's bottle inventory (quantity, purchase info, readiness analysis)
- **consumption_history** - Record of opened bottles
- **recommendation_runs** - History of "What Should I Open Tonight?" recommendations

### Triggers:
- **handle_new_user** - Automatically creates a profile when a user signs up
- **update_updated_at_column** - Automatically updates the `updated_at` timestamp

### View:
- **bottles_with_wine_info** - Joins bottles and wines for easier querying

## ✅ Next Steps

After running the migration:

1. **Refresh your app** at http://localhost:5173
2. **Try adding a bottle** - click "+ Add Bottle"
3. **The errors should be gone!** 🎉

## 🐛 Troubleshooting

### If you see "Something went wrong" errors:

**Check 1: Did you run the migration?**
- Go to SQL Editor and run the migration again

**Check 2: Are the tables created?**
- Go to Table Editor and verify all 5 tables exist

**Check 3: Check browser console**
- Open Developer Tools (F12 or Cmd+Option+I)
- Look for error messages in the Console tab
- Share the error with me if you need help

### If Google login doesn't work:

**Check redirect URL in Google Cloud Console:**
- Add: `https://pktelrzyllbwrmcfgocx.supabase.co/auth/v1/callback`

**Check Supabase Auth settings:**
- Go to Authentication → Providers → Google
- Make sure it's enabled with your Client ID and Secret

---

## 📍 You Are Here

✅ Supabase credentials configured  
✅ Google OAuth working  
⏳ **Need to run SQL migration** ← YOU ARE HERE  
⏳ Test adding/editing bottles  
⏳ Test other pages (Tonight?, History)

