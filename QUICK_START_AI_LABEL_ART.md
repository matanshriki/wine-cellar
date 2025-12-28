# 🚀 Quick Start: Enable AI Label Art for Yourself

## ⚡ 3-Step Setup (5 minutes)

### Step 1: Run Database Migration

1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Paste and run this SQL:

```sql
-- Add per-user AI label art feature flag
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS profiles_ai_label_art_enabled_idx 
ON public.profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;
```

3. Click **Run** ✅

---

### Step 2: Enable Global Feature Flag

**Local Development** (`.env` file):
```bash
VITE_FEATURE_GENERATED_LABEL_ART=true
```

**Production** (Supabase Dashboard):
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add:
   - Key: `VITE_FEATURE_GENERATED_LABEL_ART`
   - Value: `true`

---

### Step 3: Enable for Your User

Run this SQL in **Supabase SQL Editor** (replace with your email):

```sql
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';
```

---

## ✅ Verify It Works

1. **Restart dev server**: `npm run dev`
2. **Hard refresh browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. **Open a bottle** in your cellar (one without an image)
4. **Look for the gold "Generate Label Art" button** below the image placeholder

---

## 🎯 Expected Result

**Before**:
- No "Generate Label Art" button visible

**After**:
- Gold button appears: **"Generate Label Art"**
- Click → Choose style (Classic/Modern)
- Wait 10-30 seconds
- AI-generated label appears with "AI" badge

---

## 🐛 Troubleshooting

### Button Still Not Showing?

**Quick Check SQL**:
```sql
-- Verify your user's flag
SELECT id, email, ai_label_art_enabled 
FROM public.profiles 
WHERE email = 'your-email@example.com';
```

**Expected Output**:
```
| id                                   | email              | ai_label_art_enabled |
|--------------------------------------|--------------------|-----------------------|
| abc123...                            | your@email.com     | true                  |
```

If `ai_label_art_enabled` is `false` or `null`, re-run Step 3.

---

## 🎨 How to Use

1. **Open Wine Details Modal** (click bottle in cellar)
2. **If no image exists**, you'll see:
   - "Add Image" button (paste URL)
   - "Generate Label Art" button (AI generation) ← **NEW!**
3. **Click "Generate Label Art"**
4. **Choose style**: Classic or Modern
5. **Wait 10-30 seconds** (OpenAI processing)
6. **Done!** Image appears with "AI" badge

---

## 💡 Tips

### Enable for Multiple Users
```sql
UPDATE public.user_profiles 
SET ai_label_art_enabled = true 
WHERE email IN (
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
);
```

### Enable for ALL Users
```sql
UPDATE public.user_profiles 
SET ai_label_art_enabled = true;
```

### Disable for a User
```sql
UPDATE public.user_profiles 
SET ai_label_art_enabled = false 
WHERE email = 'user@example.com';
```

---

## 📊 Check Who Has Access

```sql
-- List all users with AI enabled
SELECT email, ai_label_art_enabled, created_at
FROM public.profiles
WHERE ai_label_art_enabled = true
ORDER BY created_at DESC;
```

---

## 💰 Cost Reminder

- **Per image**: $0.040 (OpenAI DALL-E 3)
- **Cached images**: Free (no regeneration)
- **Example**: 100 images = $4

---

## 🔗 Full Documentation

For advanced features (beta testing, premium tiers, gradual rollout, cost control), see:
- **[PER_USER_AI_LABEL_ART.md](./PER_USER_AI_LABEL_ART.md)** (comprehensive guide)

---

## ✨ That's It!

You should now see the **"Generate Label Art"** button in the Wine Details Modal.

🍷 Enjoy your AI-generated wine labels!

