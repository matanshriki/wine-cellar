# 🚀 Quick Start: Enable AI Label Generation

## ⚡ 5-Minute Setup

### 1️⃣ **Add Environment Variable**

Edit `apps/web/.env` and add:
```bash
VITE_FEATURE_GENERATED_LABEL_ART=true
```

---

### 2️⃣ **Get OpenAI API Key**

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-`)
4. Add $5-10 credits to your account

**Cost**: ~$0.04 per generated image

---

### 3️⃣ **Set Supabase Secrets**

```bash
# Replace YOUR_PROJECT_REF with your Supabase project reference ID
# (Find it in: Supabase Dashboard → Settings → General → Reference ID)

npx supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here --project-ref YOUR_PROJECT_REF
```

---

### 4️⃣ **Create Storage Bucket**

Go to [Supabase SQL Editor](https://supabase.com/dashboard) and run:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-labels', 'generated-labels', true)
ON CONFLICT (id) DO NOTHING;

-- Drop old policies
DROP POLICY IF EXISTS "Users can upload own generated labels" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own generated labels" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own generated labels" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view generated labels" ON storage.objects;

-- Create policies
CREATE POLICY "Users can upload own generated labels"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-labels' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own generated labels"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generated-labels' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own generated labels"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-labels' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view generated labels"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'generated-labels');
```

---

### 5️⃣ **Enable for Your User**

In Supabase SQL Editor, run (replace with your email):

```sql
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';
```

**Verify:**
```sql
SELECT email, ai_label_art_enabled FROM profiles WHERE email = 'your-email@example.com';
```

---

### 6️⃣ **Deploy Edge Function**

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine

npx supabase functions deploy generate-label-art --project-ref YOUR_PROJECT_REF
```

---

### 7️⃣ **Deploy Frontend**

The code is already pushed to GitHub. Vercel will auto-deploy, or run:

```bash
vercel --prod
```

---

## ✅ Test It!

1. Open your app
2. Go to **Cellar** page
3. Click **Details** on any bottle
4. You should see **"Generate AI Label Art"** button
5. Click it → Choose **Modern** or **Classic**
6. Wait ~10-15 seconds
7. **Done!** 🎨

---

## 🔍 Troubleshooting

### Button doesn't appear?

**Check console logs:**
```javascript
[AI Label Art] Feature flag check: { envVar: 'true', enabled: true }
[AI Label Art] User flag (ai_label_art_enabled): true → ENABLED ✅
```

**If `envVar: undefined`:**
- Add `VITE_FEATURE_GENERATED_LABEL_ART=true` to `apps/web/.env`
- Rebuild: `npm run build`

**If user flag is `false`:**
- Run the SQL from Step 5 again

### 401 Unauthorized?

- Make sure Edge Function is deployed (Step 6)
- Try logging out and back in

### 503 Not configured?

- OpenAI API key not set (Step 3)
- Check secrets: `npx supabase secrets list --project-ref YOUR_REF`

---

## 📊 What You Get

**Modern Style:**
- Clean, minimal design
- Sans-serif typography
- Geometric shapes
- Contemporary aesthetic

**Classic Style:**
- Traditional, elegant design
- Serif typography
- Classic ornamental elements
- Timeless aesthetic

**Both styles:**
- Original artwork (no trademark infringement)
- Wine name, vintage, region displayed
- High-quality 1024×1024 PNG
- Cached (same wine + style = free regeneration)

---

## 💰 Cost

- **First generation**: $0.04 per image
- **Cached regeneration**: Free
- **Different style**: $0.04 (new image)

**Example:**
- 50 bottles × 1 style = **$2.00**
- 50 bottles × 2 styles = **$4.00**

---

## 📁 Full Documentation

For detailed technical info, see: **`ENABLE_AI_LABEL_GENERATION.md`**

---

**Ready to generate beautiful wine labels!** 🍷✨



