# 🚀 Install Everything - Simple Guide

**No Homebrew needed!** Just copy-paste these commands into your Terminal.

---

## ⚡ Quick Install (Copy-Paste Method)

### Step 1: Open Terminal

Press `Cmd + Space`, type "Terminal", press Enter

---

### Step 2: Copy & Paste These Commands

**Just copy each block and paste into Terminal, press Enter after each:**

#### A. Install Supabase CLI
```bash
npm install -g supabase
```

Wait for it to finish (30-60 seconds)...

---

#### B. Verify Installation
```bash
supabase --version
```

You should see: `supabase 1.x.x` or similar ✅

---

#### C. Login to Supabase
```bash
supabase login
```

- A browser window will open
- Click "Authorize"
- Close the browser tab
- Return to Terminal

---

#### D. Go to Your Project Directory
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
```

---

#### E. Link Your Project
```bash
supabase link --project-ref oktelrzzyllbwrmcfqgocx
```

**You'll be asked for:**
- Database password (your Supabase database password)

💡 **Forgot password?** 
1. Go to: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/settings/database
2. Click "Reset Database Password"
3. Copy the new password
4. Paste when Terminal asks

---

#### F. Get OpenAI API Key

**Before the next step, you need an OpenAI key:**

1. Go to: https://platform.openai.com/api-keys
2. Sign in (create account if needed)
3. Click **"Create new secret key"**
4. Name it: `wine-cellar-label-art`
5. **Copy the key** (starts with `sk-...`) ← SAVE THIS!

**Enable Billing:**
1. Go to: https://platform.openai.com/account/billing
2. Add payment method
3. Add $5 minimum (gets you 125 AI images)

---

#### G. Set OpenAI Key
```bash
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

**Replace `sk-YOUR_KEY_HERE` with your actual OpenAI key!**

Example:
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-abc123def456...
```

---

#### H. Deploy Edge Function
```bash
supabase functions deploy generate-label-art
```

Wait 30-60 seconds... You'll see:
```
✅ Deploying function generate-label-art
✅ Function URL: https://oktelrzzyllbwrmcfqgocx.supabase.co/functions/v1/generate-label-art
```

---

## 🎉 Done! Test It

1. **Hard refresh browser**: `Cmd + Shift + R`
2. Go to your cellar
3. Click a **bottle with no image**
4. Click **"Generate Label Art"** (gold button)
5. Choose **Classic** or **Modern**
6. **Wait 10-30 seconds**
7. ✨ **AI-generated label appears!**

---

## 📋 Complete Command List (Copy All at Once)

If you want to copy everything at once, here's the full sequence:

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Go to project
cd /Users/matanshr/Desktop/Projects/Playground/wine

# 4. Link project (you'll be prompted for password)
supabase link --project-ref oktelrzzyllbwrmcfqgocx

# 5. Set OpenAI key (replace with your key!)
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE

# 6. Deploy function
supabase functions deploy generate-label-art
```

**Note**: You still need to:
- Enter your database password at step 4
- Get OpenAI key before step 5
- Replace `sk-YOUR_KEY_HERE` with your actual key

---

## 🐛 Troubleshooting

### "npm: command not found"
You need Node.js. Install from: https://nodejs.org/
Then restart Terminal and try again.

### "Permission denied" when installing
Try with sudo:
```bash
sudo npm install -g supabase
```
(Enter your Mac password when prompted)

### "Invalid database password"
Reset it:
1. https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/settings/database
2. Click "Reset Database Password"
3. Copy new password
4. Try linking again

### "Invalid OpenAI API key"
Check:
- Key starts with `sk-`
- Billing is enabled on OpenAI
- No extra spaces when copying

### Edge Function deployed but still errors
Check:
1. Hard refresh browser (`Cmd+Shift+R`)
2. Check Edge Function logs: https://supabase.com/dashboard/project/oktelrzzyllbwrmcfqgocx/functions/generate-label-art/logs
3. Verify secret was set:
   ```bash
   supabase secrets list
   ```
   Should show `OPENAI_API_KEY`

---

## 💰 Cost

- **Per image**: $0.04 (1024×1024 DALL-E 3)
- **Cached images**: Free (same prompt = no cost)
- **Example**: 100 images = $4

---

## ✅ What You Installed

- ✅ Supabase CLI (globally via npm)
- ✅ Edge Function (`generate-label-art`)
- ✅ OpenAI integration (server-side)

No other software needed!

---

## 🚀 Alternative: Automated Script

If you prefer, run this automated script:

```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
bash setup-ai-deployment.sh
```

The script will:
1. Install Supabase CLI
2. Login (opens browser)
3. Link project (asks for password)
4. Ask for OpenAI key
5. Deploy function

---

**Need help?** Let me know which step you're stuck on!

🍷 Good luck!



