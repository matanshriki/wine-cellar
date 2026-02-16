# 🚨 URGENT: Run Database Migration

## The theme toggle needs a database column to work!

### Quick Fix (2 minutes):

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy and paste this SQL:**

```sql
-- Add theme_preference column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS theme_preference TEXT 
DEFAULT 'light' 
CHECK (theme_preference IN ('light', 'dark'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_theme_preference 
ON profiles(theme_preference);

-- Add comment for documentation
COMMENT ON COLUMN profiles.theme_preference IS 
'User theme preference: light (default) or dark mode';
```

4. **Click "Run" button** (bottom right)

5. **Wait for success message**

6. **Go back to your app** (localhost:5173)

7. **Hard refresh** (Cmd+Shift+R or Ctrl+Shift+F5)

8. **Try the theme toggle again** ✅

---

## What This Does:

- Adds `theme_preference` column to `profiles` table
- Sets default to 'light'
- Only allows 'light' or 'dark' values
- Adds index for performance
- Fully backwards compatible (won't break existing users)

---

## Already Ran It?

If you've already run this migration, the `IF NOT EXISTS` checks mean it's safe to run again (won't duplicate anything).

---

**After running, the theme toggle should work perfectly!** 🍷✨
