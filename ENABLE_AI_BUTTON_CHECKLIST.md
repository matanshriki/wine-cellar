# ✅ AI Label Art Button - Setup Checklist

**Goal**: Make the "Generate Label Art" button appear in Wine Details Modal

---

## 📋 Checklist

### ☐ Step 1: Run Database Migration

Open **Supabase SQL Editor** and run:

```sql
-- Add the ai_label_art_enabled column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index
CREATE INDEX IF NOT EXISTS profiles_ai_label_art_enabled_idx 
ON public.profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;
```

**Verify it worked:**
```sql
-- Check if column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name = 'ai_label_art_enabled';
```

Expected result: Should show 1 row with the column details.

---

### ☐ Step 2: Enable Flag for Your User

Run this SQL (replace `your-email@example.com` with your actual email):

```sql
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';
```

**Verify it worked:**
```sql
SELECT email, ai_label_art_enabled 
FROM public.profiles 
WHERE email = 'your-email@example.com';
```

Expected result: `ai_label_art_enabled` should be `true`.

---

### ☐ Step 3: Set Environment Variable

Check your `.env` file at: `apps/web/.env`

It should contain:
```bash
VITE_FEATURE_GENERATED_LABEL_ART=true
```

If it's missing or set to `false`, add/change it to `true`.

---

### ☐ Step 4: Restart Dev Server

If you changed the `.env` file, restart:

```bash
# Stop the server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

---

### ☐ Step 5: Hard Refresh Browser

Press: **`Cmd + Shift + R`** (Mac) or **`Ctrl + Shift + R`** (Windows)

---

### ☐ Step 6: Check Console Logs

1. Open browser **Console** (F12 → Console tab)
2. Click on a **bottle with no image**
3. Look for logs starting with `[AI Label Art]`

**What to look for:**

✅ **SUCCESS** (button will appear):
```
[AI Label Art] Global flag: true
[AI Label Art] Checking user flag for user: your@email.com
[AI Label Art] User flag: true → ENABLED ✅
[AI Label Art] ✅ Button WILL appear (both flags enabled)
```

❌ **PROBLEM - Global flag disabled**:
```
[AI Label Art] Global flag: false
[AI Label Art] Feature disabled globally - button will not appear
```
**Fix**: Check `.env` file (Step 3)

❌ **PROBLEM - User flag disabled**:
```
[AI Label Art] Global flag: true
[AI Label Art] Checking user flag for user: your@email.com
[AI Label Art] User flag: false → DISABLED ❌
[AI Label Art] ❌ Button will NOT appear - user flag is disabled
[AI Label Art] Run this SQL: UPDATE public.profiles SET ai_label_art_enabled = true WHERE email = 'your@email.com';
```
**Fix**: Run the SQL command shown in the console

---

### ☐ Step 7: Verify Button Appears

1. Go to **Cellar** page
2. Click a **bottle with NO image** (should show "No image" placeholder)
3. Wine Details Modal opens
4. Look below the image placeholder
5. You should see:
   - **"Add Image"** button (white)
   - **"Generate Label Art"** button (gold gradient) ← **This is the AI button!**

---

## 🐛 Troubleshooting

### "Column already exists" error
This is fine! It means Step 1 was already done. Continue to Step 2.

### "ai_label_art_enabled is null"
Run this to set it to true:
```sql
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';
```

### Button only appears for bottles with NO image
This is correct behavior! The AI generation is meant as a **fallback** when you don't have a real wine photo. If you want to test:
1. Find a bottle with an image
2. Click "Remove Image" in the modal
3. Now the "Generate Label Art" button should appear

### I see "Add Image" but not "Generate Label Art"
Check the console logs (Step 6). They will tell you exactly what's wrong.

---

## 🎯 Quick Debug SQL

Run this to see all your users and their flags:

```sql
SELECT 
  email,
  ai_label_art_enabled,
  created_at
FROM public.profiles
ORDER BY created_at DESC;
```

---

## ✅ Done?

Once you see the gold **"Generate Label Art"** button, you're all set! 🍷

**Note**: The button will only work if you also set up OpenAI API key in Supabase Edge Function secrets, but seeing the button means the per-user flag system is working correctly.

