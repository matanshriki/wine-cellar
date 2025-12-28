# Per-User AI Label Art Feature Flag

## 🎯 Overview

The AI Label Art feature is now controlled **per-user** instead of globally. This gives you granular control over who can use AI generation.

---

## 🏗️ Architecture

### Two-Level Check System

```
User clicks "Generate Label Art" 
    ↓
1. Is VITE_FEATURE_GENERATED_LABEL_ART=true? (App-level master switch)
    ↓ No → Button hidden
    ↓ Yes
2. Does user have ai_label_art_enabled=true in database? (User-level flag)
    ↓ No → Button hidden
    ↓ Yes
Button is visible → User can generate
```

**Both checks must pass** for the button to appear.

---

## 📋 Setup Instructions

### Step 1: Run Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add per-user AI label art feature flag
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_label_art_enabled BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS profiles_ai_label_art_enabled_idx 
ON public.profiles(ai_label_art_enabled) 
WHERE ai_label_art_enabled = true;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.ai_label_art_enabled IS 
'Per-user feature flag for AI-generated label art. Enables "Generate Label Art" button. Default false (opt-in).';
```

### Step 2: Enable Global Master Switch

In your `.env` file (local) or Environment Variables (Supabase):

```bash
VITE_FEATURE_GENERATED_LABEL_ART=true
```

**Important**: Without this, the feature is disabled for **everyone** regardless of user flags.

### Step 3: Enable for Specific Users

Run SQL to enable for specific users:

```sql
-- Enable for yourself (replace with your email)
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';

-- Or enable for multiple users
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email IN (
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
);

-- Or enable for ALL users (use carefully!)
UPDATE public.profiles 
SET ai_label_art_enabled = true;
```

---

## 💼 Use Cases

### 1. **Beta Testing**
Enable only for yourself and a few testers:
```sql
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email IN (
  'admin@yourapp.com',
  'beta-tester-1@example.com',
  'beta-tester-2@example.com'
);
```

### 2. **Premium Feature** (Future)
- Charge users $X/month for AI generation access
- Enable when they subscribe:
```sql
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE user_id = 'subscription_user_id';
```

### 3. **Gradual Rollout**
- Week 1: Enable for 10% of users
- Week 2: Enable for 50% of users
- Week 3: Enable for 100%

```sql
-- Enable for 10% of users (randomized)
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE (hashtext(id::text)::bigint % 100) < 10;
```

### 4. **Cost Control**
- Limit who can generate to control OpenAI API costs
- Monitor usage per user
- Disable for users who generate too many images

---

## 🧪 Testing Locally

### Test 1: Feature Disabled Globally
```bash
# In .env
VITE_FEATURE_GENERATED_LABEL_ART=false
```
**Expected**: Button never appears, even if user flag is true.

### Test 2: Feature Enabled Globally, User Disabled
```bash
# In .env
VITE_FEATURE_GENERATED_LABEL_ART=true
```
```sql
-- In database
UPDATE public.profiles 
SET ai_label_art_enabled = false 
WHERE email = 'your-email@example.com';
```
**Expected**: Button does not appear.

### Test 3: Both Enabled
```bash
# In .env
VITE_FEATURE_GENERATED_LABEL_ART=true
```
```sql
-- In database
UPDATE public.profiles 
SET ai_label_art_enabled = true 
WHERE email = 'your-email@example.com';
```
**Expected**: Button appears in Wine Details Modal (for bottles without user images).

---

## 🔍 Troubleshooting

### Button Not Showing?

**Checklist**:
1. ✅ Is `VITE_FEATURE_GENERATED_LABEL_ART=true` in env?
2. ✅ Did you rebuild the frontend after changing env? (`npm run dev`)
3. ✅ Is `ai_label_art_enabled=true` for your user in the database?
4. ✅ Does the bottle have NO `image_url`? (Button only shows when no user image exists)
5. ✅ Did you hard refresh the browser? (Cmd+Shift+R / Ctrl+Shift+R)

**Debugging SQL**:
```sql
-- Check your user's profile
SELECT id, email, ai_label_art_enabled 
FROM public.profiles 
WHERE email = 'your-email@example.com';
```

**Debugging Console**:
```javascript
// In browser console
import * as labelArtService from './services/labelArtService';

// Check global flag
console.log('Global flag:', labelArtService.isLabelArtFeatureAvailable());

// Check user flag (async)
labelArtService.isLabelArtEnabledForUser().then(enabled => {
  console.log('User enabled:', enabled);
});
```

---

## 🔐 Security & Permissions

### Database RLS (Row Level Security)

Ensure only authenticated users can see their own profile:

```sql
-- Check existing RLS policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- If missing, add RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

---

## 📊 Monitoring & Analytics

### Track Usage
```sql
-- Count how many users have AI enabled
SELECT COUNT(*) as users_with_ai
FROM public.profiles
WHERE ai_label_art_enabled = true;

-- Track generated images per user
SELECT 
  up.email,
  COUNT(w.generated_image_path) as ai_images_generated
FROM public.profiles up
LEFT JOIN public.wines w ON w.user_id = up.id AND w.generated_image_path IS NOT NULL
WHERE up.ai_label_art_enabled = true
GROUP BY up.email
ORDER BY ai_images_generated DESC;
```

---

## 🚀 Deployment Checklist

### Local Development
- [ ] Run migration: `20251229_add_user_label_art_preference.sql`
- [ ] Set `VITE_FEATURE_GENERATED_LABEL_ART=true` in `.env`
- [ ] Enable for your test user
- [ ] Rebuild: `npm run dev`
- [ ] Test: Open Wine Details Modal, verify button appears

### Staging
- [ ] Run migration in Supabase Dashboard (SQL Editor)
- [ ] Set env var in Supabase Project Settings → Edge Functions → Secrets
- [ ] Enable for beta testers
- [ ] Deploy frontend: `npm run build && supabase deploy`
- [ ] Test end-to-end

### Production
- [ ] Backup database before migration
- [ ] Run migration
- [ ] Set env var
- [ ] Enable for Phase 1 users (e.g., 10%)
- [ ] Monitor costs (OpenAI API usage)
- [ ] Monitor errors (check Edge Function logs)
- [ ] Gradually increase rollout

---

## 💰 Cost Management

### Estimates (OpenAI DALL-E 3)
- **Per image**: $0.040 (1024x1024)
- **100 users @ 5 images each**: $20
- **1,000 users @ 5 images each**: $200

### Cost Control Strategies
1. **Per-user limits**: Track `generated_at` and limit to X images per day/month
2. **Caching**: Idempotency hash prevents re-generation
3. **Smaller images**: Use 768x768 instead of 1024x1024 (still good quality)
4. **Rate limiting**: Add cooldown between generations

**Example: Limit to 3 generations per day**:
```sql
-- Check user's generations today
SELECT COUNT(*) 
FROM public.wines 
WHERE user_id = 'user_id_here'
  AND generated_at >= NOW() - INTERVAL '1 day';
```

---

## 🎨 UI/UX Behavior

### Button Visibility Rules

The "Generate Label Art" button appears when **ALL** of these are true:
1. ✅ Global feature flag = `true`
2. ✅ User flag = `true`
3. ✅ Bottle has NO `image_url` (no user-provided image)
4. ✅ User is viewing Wine Details Modal

### Button States
- **Hidden**: Feature disabled (global or user)
- **Visible**: Ready to generate
- **Generating...**: API call in progress (10-30 seconds)
- **Done**: Image appears with "AI" badge

---

## 📱 Mobile Testing

Test on actual devices:
1. **iPhone Safari**: Verify button tap works first time
2. **Android Chrome**: Verify layout and button sizing
3. **Progressive Web App (Home Screen)**: Verify session persists

---

## 🔄 Future Enhancements

### Admin UI (Future)
Build an admin panel to manage user flags:
```typescript
// Example admin toggle component
<Switch
  checked={user.ai_label_art_enabled}
  onChange={(enabled) => updateUserFlag(user.id, enabled)}
  label="AI Label Art Access"
/>
```

### Analytics Dashboard (Future)
- Total AI images generated
- Top users by generation count
- Cost per user
- Error rate

---

## 📞 Support

### Common Issues

**"Button doesn't appear"**:
- Check both flags (global + user)
- Verify bottle has no `image_url`
- Hard refresh browser

**"Generation fails"**:
- Check Edge Function logs in Supabase
- Verify `OPENAI_API_KEY` is set in Edge Function secrets
- Check OpenAI API quota/billing

**"Slow generation"**:
- OpenAI typically takes 10-30 seconds
- Show loading state to user
- Consider adding progress updates

---

## ✅ Summary

| Aspect | Implementation |
|--------|---------------|
| **Database Column** | `profiles.ai_label_art_enabled` (BOOLEAN, default `false`) |
| **Global Flag** | `VITE_FEATURE_GENERATED_LABEL_ART` (env var, default `false`) |
| **Check Function** | `labelArtService.isLabelArtEnabledForUser()` |
| **UI Location** | Wine Details Modal (below image) |
| **Default State** | **Disabled** (opt-in per user) |
| **Cost per Image** | $0.040 (OpenAI DALL-E 3, 1024x1024) |

---

**Next Steps**:
1. Run the migration SQL
2. Enable global flag in `.env`
3. Enable for your user
4. Test locally
5. Deploy to staging
6. Gradually roll out to production

🍷 Enjoy your per-user AI label art feature!

