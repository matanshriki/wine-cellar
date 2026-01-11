# Cellar Agent - AI Chat Assistant (DEV ONLY)

**Status**: ✅ Implemented (localhost only, NOT in production)

## Overview

The Cellar Agent is an AI-powered chat assistant that recommends wines **ONLY** from the user's personal cellar. It uses OpenAI GPT-4o to provide intelligent, context-aware recommendations based on user requests.

### Key Features

- **Cellar-only recommendations**: Never recommends wines outside the user's collection
- **Natural language chat**: Ask questions like "What should I drink tonight?"
- **Smart context**: Considers readiness, pairing, and occasion
- **Voice input**: Optional speech-to-text for queries (dev-only)
- **Rich recommendation cards**: Includes serving temperature, decanting time, and alternatives
- **Localhost-only**: Completely guarded - UI, routes, and API are blocked in production

---

## Security & Guards

### Client-Side Guards
- `/agent` route redirects to `/cellar` if not localhost/dev
- Menu button hidden if not `isDevEnvironment()`
- Service throws error if called in production

### Server-Side Guards
- `/api/agent/*` routes return 404 if not localhost
- Middleware checks hostname and NODE_ENV
- Requires authentication (JWT token)

### Environment Check
```typescript
isDevEnvironment() returns true ONLY when:
- hostname is 'localhost', '127.0.0.1', or starts with '192.168.'
- OR import.meta.env.DEV === true
- OR process.env.NODE_ENV === 'development'
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
# From repo root
npm install

# Or install API deps specifically
cd apps/api
npm install
```

New dependencies added:
- `openai`: ^4.24.1 (already installed)
- `multer`: ^1.4.5-lts.1 (for audio uploads)
- `@types/multer`: ^1.4.11

### 2. Configure OpenAI API Key

Create or update `/apps/api/.env.local`:

```bash
OPENAI_API_KEY=sk-proj-...your-key-here
```

**IMPORTANT**: Never commit this file. It's in `.gitignore`.

To get an API key:
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and paste into `.env.local`

### 3. Start the Development Servers

```bash
# From repo root
npm run dev

# This starts both:
# - API server (http://localhost:3001)
# - Web app (http://localhost:5173)
```

---

## How to Use

### Access the Agent

1. **Start the dev servers** (see above)
2. **Log in** to the app at http://localhost:5173
3. **Add bottles** to your cellar (at least 1)
4. **Open the User Menu** (click your avatar in the top-right)
5. **Click "Ask Cellar Agent"** (with blue "dev" badge)

### Chat Interface

#### Quick Prompts
Three default prompts appear when starting:
- "What should I drink tonight?"
- "Ready to drink now"
- "Pair with steak"

#### Custom Messages
Type any question:
- "Best wine for salmon?"
- "What's ready to drink?"
- "Show me a wine from Bordeaux"
- "I want something light and fruity"

#### Voice Input (Optional)
1. Click the **microphone icon** (left of text input)
2. Speak your question
3. Click again to stop recording
4. Review the transcribed text
5. Press **Send**

### Recommendation Cards

When the agent recommends a wine, you'll see:
- **Bottle details**: Producer, name, vintage
- **Reasoning**: Why this wine fits your request
- **Serving info**: Temperature and decanting suggestions
- **Alternatives**: 2-3 other options from your cellar

### Empty Cellar

If your cellar has 0 bottles:
- Message: "Add at least one bottle to get recommendations"
- CTA button: "Go to Cellar"

---

## Testing Checklist

### ✅ Basic Functionality

- [ ] `/agent` route is accessible on localhost
- [ ] `/agent` redirects to `/cellar` on production-like URL
- [ ] "Ask Cellar Agent" button appears in User Menu (localhost only)
- [ ] Agent page loads with chat UI
- [ ] Can send text messages
- [ ] Agent responds with recommendations
- [ ] Recommendation cards display correctly

### ✅ Cellar Integration

- [ ] Agent only recommends bottles from user's cellar (check bottle IDs)
- [ ] Empty cellar shows warning message
- [ ] Adding bottles updates available recommendations
- [ ] Cellar context includes readiness, region, color, etc.

### ✅ API Security

- [ ] `/api/agent/recommend` returns 404 on non-localhost
- [ ] `/api/agent/recommend` requires authentication
- [ ] API key is NOT exposed to client (check Network tab)

### ✅ Voice Input (Optional)

- [ ] Microphone button appears (dev-only)
- [ ] Recording starts/stops on click
- [ ] Audio transcribes to text
- [ ] Transcribed text appears in input (ready to edit/send)

### ✅ Edge Cases

- [ ] Long cellar (>60 bottles) is truncated/summarized
- [ ] Impossible requests get helpful responses
- [ ] Follow-up questions work correctly
- [ ] Conversation history is maintained (last 8 messages)

---

## Architecture

### Client-Side (`apps/web`)

**Files Created/Modified:**
- `src/pages/AgentPage.tsx` - Main chat UI
- `src/services/agentService.ts` - API client
- `src/App.tsx` - Added `/agent` route
- `src/components/UserMenu.tsx` - Added "Ask Cellar Agent" button

**Key Components:**
- `AgentPage`: Full-screen chat interface with message list and input
- `MessageBubble`: Displays user/assistant messages
- `RecommendationCard`: Rich card for wine recommendations

**Services:**
- `sendAgentMessage()`: Sends message to API with history and cellar context
- `buildCellarContext()`: Creates compact bottle list (limits to 60 bottles)

### Server-Side (`apps/api`)

**Files Created/Modified:**
- `src/routes/agent.ts` - Agent API routes
- `src/index.ts` - Registered agent router
- `package.json` - Added multer dependency

**API Endpoints:**

1. **POST /api/agent/recommend**
   - Body: `{ message, history, cellarContext }`
   - Returns: `{ message, recommendation?, followUpQuestion? }`
   - Guards: localhost-only, authentication required

2. **POST /api/agent/transcribe**
   - Body: multipart/form-data with 'audio' field
   - Returns: `{ text }`
   - Guards: localhost-only, authentication required

**OpenAI Integration:**
- Uses `gpt-4o` model (best reasoning)
- Response format: JSON object
- System prompt ensures cellar-only recommendations
- Retry logic (up to 2 attempts) for invalid responses

---

## How It Works

### 1. User Sends Message
```
User: "What should I drink tonight?"
```

### 2. Build Cellar Context
```typescript
{
  bottles: [
    {
      id: "uuid-1",
      producer: "Château Margaux",
      wineName: "Margaux",
      vintage: 2015,
      region: "Bordeaux",
      color: "red",
      readinessStatus: "ready",
      // ... more fields
    },
    // ... up to 60 bottles
  ],
  summary: "Total cellar: 120 bottles. Colors: red (80), white (30), ...",
  totalBottles: 120
}
```

### 3. Call OpenAI API
```typescript
{
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a sommelier..." },
    ...conversationHistory,
    { role: "user", content: "What should I drink tonight?" }
  ],
  response_format: { type: "json_object" }
}
```

### 4. Parse & Validate Response
```json
{
  "message": "Perfect for tonight!",
  "recommendedBottleId": "uuid-1",
  "reason": "This 2015 Margaux is at its peak...",
  "serveTemp": "16-18°C",
  "decant": "Decant 30 minutes",
  "alternatives": [
    { "bottleId": "uuid-2", "reason": "Also ready, lighter style" }
  ]
}
```

### 5. Display Recommendation Card
- Resolve bottle by ID
- Show producer, name, vintage
- Display reasoning, serving info, alternatives

---

## Troubleshooting

### "Agent is not enabled" toast
- **Cause**: Not running on localhost
- **Fix**: Use `http://localhost:5173` (not production URL)

### "OpenAI API key not configured"
- **Cause**: Missing `OPENAI_API_KEY` in `.env.local`
- **Fix**: Add key to `/apps/api/.env.local` and restart API server

### "Failed to get recommendation"
- **Cause**: OpenAI API error or network issue
- **Fix**: Check API key, check console for errors, verify internet connection

### Agent recommends invalid bottle
- **Cause**: OpenAI returned wrong bottle ID
- **Fix**: The system has retry logic (up to 2 attempts). If persistent, check system prompt.

### Voice input not working
- **Cause**: Browser doesn't support MediaRecorder API
- **Fix**: Use Chrome/Edge (best support). Safari may have issues.

### "Add at least one bottle"
- **Cause**: Cellar is empty
- **Fix**: Add bottles to your cellar first

---

## Production Readiness

### ⚠️ NOT READY FOR PRODUCTION

This feature is **explicitly blocked** from production:

1. **Cost concerns**: OpenAI API calls are not free
2. **Rate limiting**: No rate limiting implemented yet
3. **User testing**: Needs more feedback before public release
4. **Feature flag**: Should be behind a feature flag when ready

### Before Production Deployment:

- [ ] Add rate limiting (e.g., 20 requests/user/day)
- [ ] Add cost monitoring and alerts
- [ ] Implement proper error tracking (Sentry, etc.)
- [ ] Add user feedback mechanism
- [ ] Create feature flag in database
- [ ] Add usage analytics
- [ ] Test with real users (beta)
- [ ] Add caching for common queries
- [ ] Optimize cellar context (reduce token usage)
- [ ] Add fallback for OpenAI outages

---

## Code Structure

```
apps/
├── web/
│   └── src/
│       ├── pages/
│       │   └── AgentPage.tsx          # Main chat UI
│       ├── services/
│       │   └── agentService.ts        # API client
│       ├── utils/
│       │   └── devOnly.ts             # isDevEnvironment() guard
│       ├── components/
│       │   └── UserMenu.tsx           # Added "Ask Cellar Agent" button
│       └── App.tsx                    # Added /agent route
│
└── api/
    └── src/
        ├── routes/
        │   └── agent.ts               # Agent API endpoints
        ├── middleware/
        │   └── auth.ts                # Authentication middleware
        └── index.ts                   # Registered agent router
```

---

## FAQ

### Q: Can I use this in production?
**A:** No. This feature is explicitly localhost-only. All UI, routes, and API endpoints are guarded.

### Q: What OpenAI model does it use?
**A:** GPT-4o (best reasoning, supports JSON response format).

### Q: How much does it cost?
**A:** GPT-4o pricing (as of Jan 2026):
- Input: ~$2.50 per 1M tokens
- Output: ~$10.00 per 1M tokens
- Typical query: ~1,000-2,000 tokens (< $0.05)

### Q: What if my cellar has 500 bottles?
**A:** The system limits to 60 bottles + a summary. It prioritizes:
1. Bottles marked "ready" or "peak"
2. Recently added bottles

### Q: Can it recommend wines I don't own?
**A:** No. The system prompt explicitly forbids this, and the response is validated server-side.

### Q: What languages does voice input support?
**A:** Currently English only (hardcoded in transcription API). Can be changed to auto-detect.

### Q: How is conversation history handled?
**A:** Last 8 messages are sent to OpenAI for context. Older messages are dropped to save tokens.

---

## Next Steps

1. **Test thoroughly** using the checklist above
2. **Gather user feedback** (internal testing)
3. **Add rate limiting** before considering production
4. **Create feature flag** for controlled rollout
5. **Monitor costs** and usage patterns

---

## Support

For questions or issues:
1. Check this guide
2. Check console logs (browser & server)
3. Verify localhost and API key setup
4. Review OpenAI API documentation

---

**Remember**: This is a DEV-ONLY feature. Do NOT deploy to production.

