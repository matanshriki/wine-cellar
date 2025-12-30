# Debug: AI Label 401 Unauthorized Error

## ✅ What's Been Done

1. **Edge Function Fixed** ✅
   - Now uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
   - Deployed successfully to Supabase
   
2. **Frontend Updated** ✅
   - Better logging added
   - Pushed to GitHub (Vercel will auto-deploy)

3. **Project Linked** ✅
   - Supabase CLI linked to project `pktelrzyllbwrmcfgocx`

---

## 🔍 Check Edge Function Logs

### **Option 1: Supabase Dashboard (Easiest)**

1. Go to: [https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions](https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/functions)
2. Click on **"generate-label-art"**
3. Click on **"Logs"** tab
4. Try generating a label in your app
5. Refresh the logs page
6. Look for the detailed logs with emojis:
   ```
   [AI Label] ✅ User authenticated: ...
   [AI Label] 🔍 Fetching wine: ...
   [AI Label] ✅ Wine found, owner: ...
   ```

### **Option 2: Real-time Logs (Terminal)**

The Supabase CLI version you have doesn't support the `logs` command. You'll need to use the dashboard.

---

## 🧪 Test Again

1. **Wait for Vercel to deploy** (2-3 minutes)
   - Check: [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Or just wait and refresh your app

2. **Open your app**

3. **Open browser console** (F12 or Cmd+Option+I)

4. **Go to Cellar → Click Details on any bottle**

5. **Click "Generate AI Label Art"**

6. **Check console logs** - you should see:
   ```
   [AI Label Art] Feature flag check: { envVar: 'true', enabled: true }
   [AI Label Art] User flag (ai_label_art_enabled): true → ENABLED ✅
   [AI Label Client] ✅ Session found, user: ...
   [AI Label Client] ✅ Token length: 1379
   [AI Label Client] 📤 Sending request to Edge Function...
   [AI Label Client] 📋 Body: { wineId: ..., bottleId: ..., ... }
   [AI Label Client] 🚀 Invoking Edge Function...
   ```

---

## 🎯 Expected Outcomes

### **If it works:**
```
[AI Label Client] Response received: { hasData: true, hasError: false }
✅ Image generated successfully!
```

### **If still 401:**
Check Edge Function logs in dashboard. Look for:
- ❌ Missing Authorization header
- ❌ Auth error: ...
- ❌ No user found in token

### **If 402 (Payment Required):**
```
OpenAI API quota exceeded. Please add credits...
```
→ Add credits to OpenAI: [platform.openai.com/account/billing](https://platform.openai.com/account/billing)

### **If 500 (Server Error):**
Check Edge Function logs for:
- ❌ SUPABASE_SERVICE_ROLE_KEY not configured
- ❌ OpenAI error: ...
- ❌ Storage upload error: ...

---

## 🔧 Additional Debugging

### **Check if Edge Function is actually deployed:**

```bash
npx supabase functions list
```

You should see:
```
generate-label-art
```

### **Check environment variables:**

In your browser console:
```javascript
console.log('Feature flag:', import.meta.env.VITE_FEATURE_GENERATED_LABEL_ART);
```

Should output: `'true'`

### **Check user profile:**

Go to Supabase SQL Editor and run:
```sql
SELECT email, ai_label_art_enabled 
FROM profiles 
WHERE email = 'matan.shriki3@gmail.com';
```

Should show: `ai_label_art_enabled: true`

---

## 🚨 If Still Not Working

### **Last Resort: Check Service Role Key**

The Edge Function needs `SUPABASE_SERVICE_ROLE_KEY` to work. This is **automatically available** in Supabase Edge Functions, but let's verify:

1. Go to: [https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api](https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/settings/api)
2. Find **"service_role" key** (it's secret, don't share it!)
3. Make sure it exists

**Note**: You don't need to manually set this - Supabase provides it automatically as `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` in Edge Functions.

---

## 📊 What The Fix Does

**Before (Broken):**
```
User JWT → Edge Function → Database (RLS blocks) → ❌ 401
```

**After (Fixed):**
```
User JWT → Edge Function (verifies auth) → ✅
Service Role → Database (bypasses RLS) → ✅
Service Role → Storage (bypasses RLS) → ✅
```

The Edge Function now:
1. ✅ Verifies the user's JWT token (authentication)
2. ✅ Uses service role for database operations (authorization)
3. ✅ Ensures user can only generate for their own wines

---

## 📞 Next Steps

1. **Wait 2-3 minutes** for Vercel to deploy the frontend
2. **Refresh your app**
3. **Try generating a label again**
4. **Check the console logs**
5. **If still 401**, check Edge Function logs in Supabase Dashboard

---

**Status**: Edge Function deployed ✅ | Frontend pushed ✅ | Ready to test!

