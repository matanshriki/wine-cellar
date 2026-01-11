# Cellar Agent - Quick Start Guide

**🚀 Get up and running in 5 minutes**

---

## Step 1: Install Dependencies

```bash
# From repo root
npm install
```

---

## Step 2: Configure OpenAI API Key

Create a file: `/apps/api/.env.local` (this file is gitignored)

```bash
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-key-here
```

**How to get an API key:**
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...`)
5. Paste into `.env.local`

---

## Step 3: Start Dev Servers

```bash
# From repo root
npm run dev
```

This starts:
- **API**: http://localhost:3001
- **Web**: http://localhost:5173

---

## Step 4: Use the Agent

1. Open http://localhost:5173 in your browser
2. **Log in** or create an account
3. **Add bottles** to your cellar (at least 1)
4. Click your **avatar** (top-right corner)
5. Click **"Ask Cellar Agent"** (with blue "dev" badge)
6. Start chatting! Try:
   - "What should I drink tonight?"
   - "Best wine for salmon?"
   - "Show me something ready to drink"

---

## Troubleshooting

### "OpenAI API key not configured"
- Check that `.env.local` exists in `/apps/api/`
- Check that the key starts with `sk-proj-...`
- Restart the API server: `Ctrl+C` then `npm run dev`

### "Agent is not enabled" toast
- Make sure you're on **localhost** (not 127.0.0.1)
- URL should be: http://localhost:5173

### Voice input not working
- Use **Chrome** or **Edge** (best support)
- Allow microphone permissions when prompted

### API server won't start
- Check that port 3001 is not in use
- Run: `lsof -ti:3001 | xargs kill -9` to kill the process

---

## Quick Test Checklist

- [ ] `/agent` page loads on localhost
- [ ] Can send a text message
- [ ] Agent responds with a wine from your cellar
- [ ] Recommendation card shows bottle details
- [ ] Voice input button appears (microphone icon)
- [ ] Empty cellar shows "Add at least one bottle" message

---

## What's Next?

Read the full documentation:
- **`CELLAR_AGENT_GUIDE.md`** - Complete user & developer guide
- **`CELLAR_AGENT_IMPLEMENTATION.md`** - Technical details

---

## Key Commands

```bash
# Install dependencies
npm install

# Start dev servers (API + Web)
npm run dev

# Start API only
npm run dev:api

# Start Web only
npm run dev:web

# Check API health
curl http://localhost:3001/health
```

---

## Environment Variables (.env.local)

Create `/apps/api/.env.local` with:

```bash
OPENAI_API_KEY=sk-proj-your-key-here
JWT_SECRET=your-secret-key
DATABASE_URL=file:./dev.db
PORT=3001
NODE_ENV=development
API_URL=http://localhost:3001
WEB_URL=http://localhost:5173
```

---

## Important Notes

⚠️ **Localhost ONLY**: This feature is NOT available in production
⚠️ **Cost**: Each query costs ~$0.02-$0.05 (OpenAI API)
⚠️ **API Key**: Never commit your API key to git

---

**Happy testing! 🍷**

