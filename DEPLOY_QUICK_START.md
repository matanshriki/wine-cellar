# ⚡ AI Label Art - Quick Deploy

**5 commands to get it working!**

---

## 🎯 Prerequisites

1. Get OpenAI API key: https://platform.openai.com/api-keys
2. Enable billing on OpenAI: https://platform.openai.com/account/billing

---

## 🚀 Deploy (5 Commands)

```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase
# Windows: npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link to your project
cd /Users/matanshr/Desktop/Projects/Playground/wine
supabase link --project-ref oktelrzzyllbwrmcfqgocx
# Enter your database password when prompted

# 4. Set OpenAI API key (replace with your key)
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE

# 5. Deploy the function
supabase functions deploy generate-label-art
```

---

## ✅ Test It

1. Hard refresh browser: `Cmd+Shift+R`
2. Click bottle → Click **"Generate Label Art"**
3. Wait 10-30 seconds
4. ✨ AI-generated label appears!

---

## 💰 Cost

- **Per image**: $0.04
- **Cached images**: Free
- **Example**: 100 images = $4

---

## 🐛 Issues?

See full guide: [DEPLOY_AI_LABEL_ART.md](./DEPLOY_AI_LABEL_ART.md)

---

**That's it!** 🍷



