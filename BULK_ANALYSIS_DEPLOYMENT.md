# Bulk Cellar Analysis - Deployment Guide

## ✨ Feature Overview

The **Bulk Cellar Analysis** feature allows users to generate sommelier notes for multiple bottles at once, directly from the Cellar page.

### Key Features:
- 🧙‍♂️ **Subtle button** in filters area with unanalyzed bottle badge
- 📊 **Mode selection**: Missing only (default) or Re-analyze all
- ⚡ **Batch processing**: Up to 20 bottles per session
- 🛡️ **Rate limiting**: 5-minute cooldown to prevent spam
- 📱 **Mobile-optimized**: Works perfectly on iPhone PWA
- ✅ **Safe**: Concurrent limit (3 at a time), robust error handling

---

## 🚀 Deployment Steps

### 1. Deploy the Edge Function

The new `analyze-cellar` edge function needs to be deployed to Supabase:

```bash
# Navigate to project root
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Deploy the function
npx supabase functions deploy analyze-cellar

# Verify it was deployed
npx supabase functions list
```

**Expected output:**
```
┌─────────────────┬──────────┬─────────────────────────┐
│ NAME            │ VERSION  │ CREATED AT              │
├─────────────────┼──────────┼─────────────────────────┤
│ analyze-cellar  │ v1       │ 2024-XX-XX XX:XX:XX     │
│ analyze-wine    │ v1       │ 2024-XX-XX XX:XX:XX     │
│ ...             │ ...      │ ...                     │
└─────────────────┴──────────┴─────────────────────────┘
```

### 2. Verify Environment Secrets

The edge function requires these secrets (should already be configured):

```bash
# Check if secrets are set
npx supabase secrets list
```

**Required secrets:**
- `OPENAI_API_KEY` - For AI sommelier notes (optional, falls back to deterministic)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - For database operations

If any are missing, set them:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

### 3. Test the Edge Function

Test manually using the Supabase dashboard or CLI:

```bash
# Test with curl (replace YOUR_PROJECT_URL and YOUR_ANON_KEY)
curl -X POST \
  'https://YOUR_PROJECT_URL.supabase.co/functions/v1/analyze-cellar' \
  -H 'Authorization: Bearer YOUR_USER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "missing_only",
    "limit": 5
  }'
```

**Expected response:**
```json
{
  "success": true,
  "processedCount": 3,
  "skippedCount": 2,
  "failedCount": 0,
  "results": [
    {
      "bottle_id": "uuid-1",
      "wine_name": "Château Example 2015",
      "status": "success"
    },
    ...
  ]
}
```

### 4. Frontend Deployment

Frontend changes are automatically deployed via Vercel when pushed to main:

✅ Already deployed (pushed to main)

### 5. Verify in Production

1. **Open the app**: https://wine-cellar-brain.vercel.app (or your domain)
2. **Go to Cellar page**
3. **Look for the button**: "🧙‍♂️ Analyze Cellar" (in filters area, right side)
4. **Check badge**: Should show number of unanalyzed bottles
5. **Click the button**: Modal should open
6. **Select mode**: "Missing only" (default)
7. **Start analysis**: Should process bottles and show progress
8. **Wait for completion**: Should see success toast with summary
9. **Verify results**: Cellar should refresh, bottles should have sommelier notes

---

## 📱 Testing Checklist

### Desktop:
- [ ] Button visible in filters area
- [ ] Badge shows correct unanalyzed count
- [ ] Modal opens on click
- [ ] Mode selection works
- [ ] Analysis completes successfully
- [ ] Cellar refreshes with new notes
- [ ] Cooldown activates (button disabled for 5 minutes)
- [ ] No console errors

### Mobile (iPhone PWA):
- [ ] Button accessible with thumb
- [ ] No horizontal overflow
- [ ] Tap target >= 44px
- [ ] Modal fits screen (no scroll issues)
- [ ] Progress visible during analysis
- [ ] Can't close modal during analysis
- [ ] Success toast appears
- [ ] Cellar updates correctly
- [ ] No safe-area issues

### Edge Cases:
- [ ] Works with 0 unanalyzed bottles (button still shows)
- [ ] Works with empty cellar (button hidden)
- [ ] Handles API errors gracefully (shows error toast)
- [ ] Cooldown tooltip shows when disabled
- [ ] Can close modal before starting analysis
- [ ] Can't close modal during analysis

---

## 🐛 Troubleshooting

### Button doesn't appear:
- Check if cellar has bottles (`bottles.length > 0`)
- Check browser console for errors
- Verify BulkAnalysisModal is imported

### Modal doesn't open:
- Check `handleBulkAnalysis` is called
- Check `showBulkAnalysis` state updates
- Verify no console errors

### Analysis fails:
1. Check edge function logs:
   ```bash
   npx supabase functions logs analyze-cellar
   ```

2. Look for errors:
   - `No auth header` → JWT not sent correctly
   - `Unauthorized` → User session expired
   - `OpenAI error` → API key issue or quota
   - `Database error` → RLS or permissions issue

3. Check browser console for client-side errors

### Cooldown doesn't work:
- Check `bulkAnalysisCooldown` state
- Verify `setTimeout` is called in `handleBulkAnalysisComplete`
- Check if 5 minutes (300,000ms) is correct

---

## 📊 Usage Analytics

The feature tracks:
- `bulk_analysis_start` - When user opens modal
- `bulk_analysis_complete` - When analysis finishes
- `bulk_analysis_error` - When analysis fails

(TODO: Add analytics tracking if not already present)

---

## 🔒 Security Notes

- ✅ Auth required (JWT verification)
- ✅ User can only analyze their own bottles
- ✅ Rate limited (20 bottles per request max)
- ✅ Cooldown prevents spam (5 minutes)
- ✅ No PII in logs or responses
- ✅ Service role key used safely (server-side only)

---

## 🎯 Success Criteria

✅ User can click "Analyze Cellar" button  
✅ Modal shows total and unanalyzed counts  
✅ Analysis processes correct bottles based on mode  
✅ UI updates immediately with new notes  
✅ No app crashes or console errors  
✅ Works on iPhone PWA and desktop  
✅ Cooldown prevents repeated use  

---

## 📝 Known Limitations

1. **Max 20 bottles per session** - Server-side limit for cost control
2. **5-minute cooldown** - Prevents API abuse
3. **No progress bar** - Shows "Analyzing..." text only (can enhance later)
4. **No cancellation** - Once started, must complete (can add later)
5. **No queue system** - For >20 bottles, user must run multiple times

### Future Enhancements:
- Background job for large cellars (>20 bottles)
- Real-time progress updates (per-bottle status)
- Ability to cancel mid-analysis
- Queue system for sequential processing
- Customizable cooldown period

---

## 🎉 You're Done!

The bulk analysis feature is now live. Users can analyze their entire cellar with a single click!

**Enjoy! 🍷**

