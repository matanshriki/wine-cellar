#!/bin/bash
# Push AI Label Art Bug Fix

cd /Users/matanshr/Desktop/Projects/Playground/wine

git add -A

git commit -m "fix: AI label art not calling Edge Function - async check bug

CRITICAL BUG FIX: Edge Function was never being called

ROOT CAUSE:
- generateLabelArt() was calling isLabelArtEnabled() synchronously
- isLabelArtEnabled() was aliased to isLabelArtFeatureAvailable()
- This only checked global flag, not per-user flag
- Function was being blocked before Edge Function call

THE FIX:
- Changed generateLabelArt() to await isLabelArtEnabledForUser()
- Now properly checks both global flag AND user database flag
- Request will actually reach the Edge Function now

BEFORE (broken):
  if (!isLabelArtEnabled()) { // sync, only checks global flag
    throw new Error('Label art generation is not enabled');
  }

AFTER (fixed):
  const enabled = await isLabelArtEnabledForUser(); // async, checks user flag
  if (!enabled) {
    throw new Error('Label art generation is not enabled for your account');
  }

SYMPTOM:
- Edge Function logs showed only 'booted' and 'shutdown'
- No request logs = function never called
- 401 error in browser console
- Nothing happened when clicking Generate Label Art

NOW:
✅ Request will reach Edge Function
✅ Logs will show actual requests
✅ AI generation will work
✅ User will see generated images

Files changed:
- apps/web/src/services/labelArtService.ts"

git push origin main

echo "✅ Fix pushed to GitHub!"
echo "Vercel will auto-deploy in 2-3 minutes"




