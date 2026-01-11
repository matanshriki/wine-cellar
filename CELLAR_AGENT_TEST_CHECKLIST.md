# Cellar Agent - Testing Checklist

**Use this checklist to verify all features are working correctly**

---

## Pre-Test Setup

- [ ] Dependencies installed: `npm install`
- [ ] OpenAI API key configured in `/apps/api/.env.local`
- [ ] Dev servers running: `npm run dev`
- [ ] API server healthy: http://localhost:3001/health returns `{"status":"ok"}`
- [ ] Web app loaded: http://localhost:5173
- [ ] Logged in to the app
- [ ] At least 5 bottles in cellar (for meaningful tests)

---

## Test 1: Basic Access (Dev-Only Guards)

### 1.1 Menu Button Visibility
- [ ] Open User Menu (click avatar)
- [ ] "Ask Cellar Agent" button visible
- [ ] Button has blue "dev" badge
- [ ] Button has chat icon

### 1.2 Route Access
- [ ] Click "Ask Cellar Agent"
- [ ] Navigates to `/agent`
- [ ] Page loads without errors
- [ ] Header shows "Cellar Agent (dev only)"
- [ ] Back button returns to cellar

### 1.3 Production Guard (Optional)
- [ ] Build app or simulate production URL
- [ ] Menu button hidden
- [ ] `/agent` redirects to `/cellar`
- [ ] Toast: "Agent is not enabled."

**Expected Result**: ✅ Feature only accessible on localhost

---

## Test 2: Chat Interface

### 2.1 Empty State
- [ ] Empty state shows welcome message
- [ ] "Ask Your Cellar Agent" title visible
- [ ] Subtitle: "I'll recommend wines from your cellar..."
- [ ] Three quick prompt chips visible:
  - "What should I drink tonight?"
  - "Ready to drink now"
  - "Pair with steak"

### 2.2 Input Controls
- [ ] Text input field visible
- [ ] Placeholder: "Ask about your wines..."
- [ ] Send button visible (paper plane icon)
- [ ] Microphone button visible (if dev environment)
- [ ] Input expands with long text

### 2.3 Quick Prompts
- [ ] Click "What should I drink tonight?"
- [ ] Prompt populates input
- [ ] Message sends automatically
- [ ] Quick prompts disappear after first message

**Expected Result**: ✅ Clean, intuitive chat interface

---

## Test 3: AI Recommendations

### 3.1 Basic Recommendation
- [ ] Send message: "What should I drink tonight?"
- [ ] Loading indicator appears (3 bouncing dots)
- [ ] Response appears within 5-10 seconds
- [ ] Message bubble shows assistant response
- [ ] Recommendation card displays below message

### 3.2 Recommendation Card Content
- [ ] Bottle name visible (producer + wine name)
- [ ] Vintage shown (if available)
- [ ] Reason/explanation text (2-3 sentences)
- [ ] Serving temperature badge (e.g., "🌡️ 16-18°C")
- [ ] Decanting suggestion (e.g., "🍷 Decant 30 minutes")
- [ ] "ALTERNATIVES" section with 2-3 options
- [ ] Each alternative has bottle name + reason

### 3.3 Cellar Validation
- [ ] Open browser DevTools → Network tab
- [ ] Send another message
- [ ] Find POST request to `/api/agent/recommend`
- [ ] Check response JSON
- [ ] Verify `recommendedBottleId` exists in your cellar
- [ ] Verify alternative bottle IDs exist in your cellar

**Expected Result**: ✅ Agent only recommends from your cellar

---

## Test 4: Multiple Query Types

### 4.1 Pairing Query
- [ ] Send: "Best wine for steak?"
- [ ] Response mentions pairing logic
- [ ] Recommends red wine (if available)
- [ ] Explanation mentions tannins/structure

### 4.2 Readiness Query
- [ ] Send: "What's ready to drink now?"
- [ ] Recommends bottle with readiness status "ready" or "peak"
- [ ] Explanation mentions drinking window

### 4.3 Color/Type Query
- [ ] Send: "Show me a white wine"
- [ ] Recommends white wine (if available)
- [ ] If no white wines: explains and suggests alternatives

### 4.4 Region Query
- [ ] Send: "Do you have anything from [region in your cellar]?"
- [ ] Recommends bottle from that region
- [ ] Mentions region in explanation

### 4.5 Impossible Request
- [ ] Send: "Show me a wine from Antarctica"
- [ ] Response explains no wines from Antarctica
- [ ] Suggests closest alternatives
- [ ] No recommendation card (just message)

**Expected Result**: ✅ Agent handles diverse query types

---

## Test 5: Conversation Flow

### 5.1 Multi-turn Conversation
- [ ] Send: "What should I drink tonight?"
- [ ] Agent responds
- [ ] Send: "Actually, I'm having fish"
- [ ] Agent considers previous context
- [ ] Recommends white wine instead

### 5.2 Follow-up Questions
- [ ] Send vague request: "Something good"
- [ ] Agent may ask clarifying question
- [ ] Answer the question
- [ ] Agent provides recommendation

### 5.3 Conversation History
- [ ] Have conversation with 10+ messages
- [ ] Agent maintains context
- [ ] Older messages (>8 messages) don't affect responses
- [ ] (Only last 8 messages sent to API)

**Expected Result**: ✅ Natural conversation flow

---

## Test 6: Voice Input (Optional)

### 6.1 Recording
- [ ] Click microphone button
- [ ] Button turns red
- [ ] Toast: "Recording... Tap to stop"
- [ ] Speak: "Show me a red wine"
- [ ] Click microphone again to stop

### 6.2 Transcription
- [ ] Wait 2-3 seconds
- [ ] Transcribed text appears in input field
- [ ] Toast: "Transcribed! Review and press Send"
- [ ] Text is accurate
- [ ] Can edit text before sending

### 6.3 Send Transcribed Message
- [ ] Press Send
- [ ] Message sends normally
- [ ] Agent responds

### 6.4 Browser Compatibility
- [ ] Test in Chrome (should work)
- [ ] Test in Edge (should work)
- [ ] Test in Firefox (may have issues)
- [ ] Test in Safari (may have issues)

**Expected Result**: ✅ Voice input works in supported browsers

---

## Test 7: Empty Cellar Handling

### 7.1 Delete All Bottles
- [ ] Navigate to cellar
- [ ] Delete all bottles (or use a new account)
- [ ] Navigate to `/agent`

### 7.2 Empty State
- [ ] Warning box visible
- [ ] Message: "Add at least one bottle to get recommendations"
- [ ] "Go to Cellar" button visible
- [ ] Input field disabled
- [ ] Send button disabled

### 7.3 Input Prevention
- [ ] Try to type in input field → disabled
- [ ] Try to click send → disabled
- [ ] Try to send message → toast warning

### 7.4 CTA Button
- [ ] Click "Go to Cellar" button
- [ ] Navigates to cellar page

**Expected Result**: ✅ Graceful empty cellar handling

---

## Test 8: Large Cellar (>60 bottles)

### 8.1 Setup
- [ ] Add 80+ bottles to cellar
- [ ] Navigate to `/agent`

### 8.2 Context Truncation
- [ ] Send message
- [ ] Open DevTools → Network → POST `/api/agent/recommend`
- [ ] Check request payload → `cellarContext.bottles`
- [ ] Verify only 60 bottles sent
- [ ] Check `cellarContext.summary` exists
- [ ] Summary includes: total count, color counts, region counts, vintage range

### 8.3 Recommendations Still Work
- [ ] Agent still provides valid recommendations
- [ ] Recommended bottle may be from the 60 selected
- [ ] No errors or hallucinations

**Expected Result**: ✅ Large cellars handled efficiently

---

## Test 9: Error Handling

### 9.1 Network Error
- [ ] Stop API server (Ctrl+C)
- [ ] Send message
- [ ] Error toast: "Failed to get recommendation"
- [ ] Error message in chat
- [ ] Can retry after restarting server

### 9.2 Invalid API Key
- [ ] Edit `.env.local`: set `OPENAI_API_KEY=invalid`
- [ ] Restart API server
- [ ] Send message
- [ ] Error: "OpenAI API key not configured" or similar

### 9.3 OpenAI API Error (Simulate)
- [ ] Send very long message (>2000 characters)
- [ ] May hit token limit or rate limit
- [ ] Error handling shows friendly message

**Expected Result**: ✅ Graceful error handling

---

## Test 10: API Security

### 10.1 Authentication Required
- [ ] Open DevTools → Network
- [ ] Clear cookies
- [ ] Send message to `/api/agent/recommend`
- [ ] Response: 401 Unauthorized

### 10.2 Localhost-Only
- [ ] Try to call API from non-localhost (e.g., curl from remote)
- [ ] Response: 404 Not Found

### 10.3 API Key Not Exposed
- [ ] Open DevTools → Network → All requests
- [ ] Search for "sk-proj" or "OPENAI_API_KEY"
- [ ] API key NOT visible in any client-side request/response

**Expected Result**: ✅ API is secure

---

## Test 11: Performance

### 11.1 Response Time
- [ ] Send message
- [ ] Response appears in <10 seconds
- [ ] (Typical: 3-7 seconds)

### 11.2 UI Responsiveness
- [ ] Chat scrolls smoothly
- [ ] Can type while waiting for response
- [ ] No UI freezes or lag
- [ ] Messages auto-scroll to bottom

### 11.3 Multiple Messages
- [ ] Send 10 messages rapidly
- [ ] All responses arrive
- [ ] Messages display in correct order

**Expected Result**: ✅ Fast and responsive

---

## Test 12: Mobile/Responsive (Optional)

### 12.1 Mobile View
- [ ] Open DevTools → Device toolbar (mobile view)
- [ ] Chat interface adapts to narrow screen
- [ ] Input remains visible
- [ ] Recommendation cards readable
- [ ] No horizontal scroll

### 12.2 Touch Interactions
- [ ] Quick prompt chips tappable
- [ ] Send button tappable
- [ ] Microphone button tappable
- [ ] Messages scrollable with touch

**Expected Result**: ✅ Mobile-friendly UI

---

## Test 13: Edge Cases

### 13.1 Very Long Message
- [ ] Send 500-character message
- [ ] Input expands
- [ ] Message sends successfully
- [ ] Agent responds normally

### 13.2 Special Characters
- [ ] Send message with emoji: "🍷 wine for tonight?"
- [ ] Send message with accents: "Château Margaux"
- [ ] Send message with quotes: 'Best "wine" for me?'
- [ ] All handled correctly

### 13.3 Rapid Follow-ups
- [ ] Send message
- [ ] Immediately send another
- [ ] Both responses arrive
- [ ] Displayed in order

### 13.4 Browser Refresh
- [ ] Have conversation with 5 messages
- [ ] Refresh page
- [ ] Chat history cleared (expected)
- [ ] Can start new conversation

**Expected Result**: ✅ Handles edge cases

---

## Test 14: Logging & Debugging

### 14.1 Console Logs
- [ ] Open browser console
- [ ] Look for errors → none
- [ ] API server console shows requests
- [ ] No sensitive data logged

### 14.2 Network Tab
- [ ] DevTools → Network
- [ ] POST `/api/agent/recommend` → 200 OK
- [ ] POST `/api/agent/transcribe` → 200 OK (if voice used)
- [ ] Request/response JSON valid

**Expected Result**: ✅ Clean logs, no errors

---

## Test 15: Documentation

### 15.1 Quick Start
- [ ] Follow `CELLAR_AGENT_QUICK_START.md`
- [ ] Can set up from scratch in <5 minutes

### 15.2 Complete Guide
- [ ] `CELLAR_AGENT_GUIDE.md` is comprehensive
- [ ] Covers setup, usage, troubleshooting

### 15.3 Implementation Details
- [ ] `CELLAR_AGENT_IMPLEMENTATION.md` explains architecture
- [ ] Lists all files changed

**Expected Result**: ✅ Excellent documentation

---

## Summary Checklist

### Core Features
- [ ] Dev-only guards working (UI + API)
- [ ] Chat interface functional
- [ ] AI recommendations accurate (cellar-only)
- [ ] Recommendation cards display correctly
- [ ] Voice input works (optional)
- [ ] Empty cellar handled gracefully
- [ ] Large cellars truncated efficiently

### Security
- [ ] API requires authentication
- [ ] Localhost-only enforcement
- [ ] API key not exposed
- [ ] Production guards active

### UX
- [ ] Fast response times (<10s)
- [ ] Smooth UI interactions
- [ ] Clear error messages
- [ ] Mobile-friendly (optional)

### Edge Cases
- [ ] Long messages handled
- [ ] Special characters work
- [ ] Network errors handled
- [ ] Invalid requests handled

---

## Pass/Fail Criteria

**✅ PASS**: All core features work, security guards active, no critical bugs
**⚠️ PARTIAL**: Most features work, minor bugs present
**❌ FAIL**: Core features broken, security concerns, major bugs

---

## Reporting Issues

If any test fails:

1. **Note the test number** (e.g., "Test 3.2 failed")
2. **Describe what happened** vs. what was expected
3. **Check console logs** (browser + API server)
4. **Include error messages** if any
5. **Note your environment**:
   - OS (Mac/Windows/Linux)
   - Browser (Chrome/Firefox/Safari/Edge)
   - Node version: `node --version`

---

## Testing Complete! 🎉

If all tests pass, the Cellar Agent is ready for:
- ✅ Localhost development
- ✅ Internal testing
- ✅ User feedback gathering

**Next**: Gather feedback before considering production deployment.

---

**Remember**: This feature is localhost-only. Do NOT deploy to production yet.

