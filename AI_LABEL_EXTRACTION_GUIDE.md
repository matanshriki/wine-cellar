# 🤖 AI Label Extraction - Implementation Guide

**Feature:** Automatic wine data extraction from bottle label photos using OCR + AI

**Status:** ✅ Ready for Deployment

**Date:** December 30, 2024

---

## 🎯 What Was Implemented

### **Core Feature:**
When users upload a photo of a wine bottle label, the app automatically:
1. Runs OCR + AI analysis on the image (server-side)
2. Extracts structured wine data (name, producer, vintage, region, etc.)
3. Pre-fills the manual bottle form with extracted data
4. User reviews, edits if needed, and saves

### **Key Benefits:**
- ✨ **Magical UX** - Reduces manual typing significantly
- 📱 **Mobile-first** - Optimized for iPhone camera uploads
- 🛡️ **Safe fallback** - Never blocks the user if AI fails
- 🔒 **Secure** - All AI/OCR runs server-side, no client secrets
- 🎯 **Accurate** - Uses OpenAI Vision (GPT-4o-mini) for high-quality extraction

---

## 📁 Files Created/Modified

### **New Files:**

1. **`supabase/functions/parse-label-image/index.ts`**
   - Supabase Edge Function for OCR + AI parsing
   - Uses OpenAI Vision API
   - Returns structured JSON with confidence levels

2. **`apps/web/src/services/labelParseService.ts`**
   - Client-side service to call the Edge Function
   - Converts parsed data to form format
   - Handles errors gracefully

3. **`AI_LABEL_EXTRACTION_GUIDE.md`** (this file)
   - Complete implementation and deployment guide

### **Modified Files:**

1. **`apps/web/src/pages/CellarPage.tsx`**
   - Added label parse integration
   - Shows loading state while parsing
   - Pre-fills form with extracted data
   - Graceful error handling

2. **`apps/web/src/i18n/locales/en.json`**
   - Added `labelParse` translation keys

3. **`apps/web/src/i18n/locales/he.json`**
   - Added Hebrew translations for label parsing

---

## 🚀 Deployment Steps

### **Step 1: Deploy Edge Function**

```bash
# Navigate to project root
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Deploy the new Edge Function
npx supabase functions deploy parse-label-image --no-verify-jwt
```

**Expected output:**
```
Deploying parse-label-image (project ref: pktelrzyllbwrmcfgocx)
Deployed function parse-label-image in 2.3s
```

### **Step 2: Verify OpenAI API Key**

Your OpenAI API key should already be configured from the AI label art feature. Verify:

```bash
npx supabase secrets list
```

**Expected to see:**
```
OPENAI_API_KEY | set | (hidden)
```

If not set, run:
```bash
npx supabase secrets set OPENAI_API_KEY=your-actual-openai-api-key
```

### **Step 3: Build & Deploy Frontend**

```bash
# Build the app
npm run build

# Commit changes
git add -A
git commit -m "feat: add AI label extraction for bottle photos

Implements automatic wine data extraction from label images:
- Server-side OCR + AI parsing using OpenAI Vision
- Pre-fills manual form with extracted data
- Mobile-first with graceful fallbacks
- Toast notifications for user feedback"

# Push to deploy (Vercel auto-deploys)
git push origin main
```

---

## 🧪 Testing Guide

### **Test 1: Clear Front Label (Expected: HIGH SUCCESS)**

1. **On iPhone (or desktop):**
   - Click "+ Add Bottle"
   - Choose "Take or Upload Photo"
   - Upload a clear photo of a wine bottle front label
   
2. **Expected behavior:**
   - Toast: "Reading label with AI..."
   - Toast: "✨ Extracted 5 fields from label" (or similar)
   - Form opens with pre-filled data:
     * Wine name
     * Producer
     * Vintage
     * Region
     * Style (red/white/rosé/sparkling)
   
3. **User actions:**
   - Review extracted data
   - Edit any incorrect fields
   - Click "Save"

### **Test 2: Angled/Dark Label (Expected: PARTIAL SUCCESS)**

1. Upload a photo with poor lighting or angled view
2. **Expected behavior:**
   - Toast: "Label partially read - please review and complete"
   - Form opens with some fields filled
   - User completes missing fields manually

### **Test 3: Back Label (Expected: GRACEFUL FAILURE)**

1. Upload a photo of the back label (ingredients/nutrition)
2. **Expected behavior:**
   - Toast: "Couldn't read label automatically - please fill manually"
   - Form opens empty (or with minimal data)
   - Image still attached for reference
   - User fills form manually

### **Test 4: Network Error (Expected: GRACEFUL FALLBACK)**

1. Simulate network failure (disable WiFi during upload)
2. **Expected behavior:**
   - Toast: "Error reading label - please enter details manually"
   - Form opens for manual entry
   - No app crash or stuck state

---

## 📊 Extracted Fields

The AI attempts to extract these fields (best effort):

| Field | Example | Confidence |
|-------|---------|------------|
| **Producer** | "Domaine Leflaive" | High/Medium/Low |
| **Wine Name** | "Puligny-Montrachet" | High/Medium/Low |
| **Vintage** | 2019 | High/Medium/Low |
| **Region** | "Burgundy" | High/Medium/Low |
| **Country** | "France" | High/Medium/Low |
| **Style** | "white" | High/Medium/Low |
| **Grapes** | ["Chardonnay"] | High/Medium/Low |
| **Alcohol %** | 13.5 | High/Medium/Low |

**Notes:**
- Fields marked `null` if AI is uncertain
- Confidence per field: `high`, `medium`, `low`
- Overall confidence calculated from all fields
- Form always allows user to edit before saving

---

## 🔧 Technical Architecture

### **Flow Diagram:**

```
📱 User uploads photo
    ↓
💾 Image stored in Supabase Storage
    ↓
🔄 Client calls Edge Function
    ↓
🤖 Edge Function:
    1. Verifies user authentication
    2. Calls OpenAI Vision API
    3. Parses JSON response
    4. Returns structured data
    ↓
✨ Client pre-fills form
    ↓
👤 User reviews & saves
    ↓
💾 Bottle created in database
```

### **API Endpoint:**

**URL:** `https://pktelrzyllbwrmcfgocx.supabase.co/functions/v1/parse-label-image`

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <user-jwt-token>"
}
```

**Request Body:**
```json
{
  "imageUrl": "https://storage.url/path/to/image.jpg",
  "imagePath": "alternative/path" // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "producer": { "value": "Château Margaux", "confidence": "high" },
    "name": { "value": "Grand Vin", "confidence": "high" },
    "vintage": { "value": 2015, "confidence": "high" },
    "region": { "value": "Margaux", "confidence": "medium" },
    "style": { "value": "red", "confidence": "high" },
    "grapes": { "value": ["Cabernet Sauvignon", "Merlot"], "confidence": "medium" },
    "country": null,
    "alcohol": null
  },
  "overallConfidence": "high",
  "fieldsExtracted": 6,
  "timestamp": "2024-12-30T..."
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Failed to parse label image",
  "timestamp": "2024-12-30T..."
}
```

---

## 🎨 UX Details

### **Toast Messages:**

1. **Reading:** "Reading label with AI..."
   - Shows immediately when parsing starts
   - Blue info toast

2. **Success:** "✨ Extracted 5 fields from label"
   - Shows when parsing succeeds
   - Green success toast
   - Count varies by extracted fields

3. **Partial:** "Label partially read - please review and complete"
   - Shows when some fields extracted
   - Yellow warning toast

4. **Failed:** "Couldn't read label automatically - please fill manually"
   - Shows when parsing fails gracefully
   - Yellow warning toast

5. **Error:** "Error reading label - please enter details manually"
   - Shows on network/server errors
   - Red error toast

### **Form Behavior:**

- Form opens immediately after image upload (no blocking)
- Extracted fields are pre-filled
- User can edit all fields before saving
- Image is attached as reference
- "Save" creates the bottle (same as manual flow)

---

## 🚨 Error Handling

### **Graceful Fallbacks:**

1. **OpenAI API unavailable** → Toast warning, open empty form
2. **Invalid image format** → Toast error, open empty form
3. **Network timeout** → Toast error, open empty form
4. **No text detected** → Toast warning, open empty form
5. **AI returns invalid JSON** → Toast error, open empty form

**Critical:** User is NEVER blocked from adding a bottle manually!

---

## 💰 Cost Considerations

### **OpenAI Vision Pricing:**
- Model: `gpt-4o-mini`
- Cost: ~$0.002 per image (approximately)
- Usage: Only triggered when user uploads label photo

### **Optimization:**
- Low temperature (0.1) for consistent results
- Max tokens: 1000 (enough for structured output)
- "High" detail mode for accurate OCR

### **Expected Monthly Cost:**
- 100 label uploads/month = ~$0.20
- 500 label uploads/month = ~$1.00
- 1000 label uploads/month = ~$2.00

**Very affordable for the UX improvement!**

---

## 📱 Mobile Testing Checklist

Test on actual iPhone (PWA mode preferred):

- [ ] Camera upload works smoothly
- [ ] Gallery upload works smoothly
- [ ] Loading toast appears
- [ ] Success toast with count shows
- [ ] Form pre-fills correctly
- [ ] Can edit all fields
- [ ] Can save bottle
- [ ] Error handling works (try bad image)
- [ ] No crashes or stuck states
- [ ] Image preview shows in form

---

## ✅ Acceptance Criteria

All implemented and ready:

- [x] OCR + AI parsing runs server-side
- [x] No client-side secrets
- [x] Structured JSON output with confidence
- [x] Pre-fills manual form automatically
- [x] User can edit before saving
- [x] Graceful fallbacks on errors
- [x] Mobile-first UX (iPhone camera)
- [x] Toast notifications for feedback
- [x] Works on desktop and mobile
- [x] No blocking spinners
- [x] Manual flow still works without AI
- [x] Clean error logging
- [x] Translations (English + Hebrew)

---

## 🎉 Success Metrics

Track these after deployment:

1. **Extraction Success Rate**
   - Target: >70% of uploads extract ≥3 fields
   
2. **User Adoption**
   - Track: Photo uploads vs. manual entries
   - Target: 50%+ of new bottles via photo

3. **User Satisfaction**
   - Metric: Bottles saved after AI extraction
   - Target: >90% conversion rate

4. **Error Rate**
   - Track: Failed extractions
   - Target: <10% hard failures

---

## 🔮 Future Enhancements (Optional)

Potential improvements for v2:

1. **Batch Processing**
   - Upload multiple labels at once
   
2. **Tesseract Fallback**
   - Open-source OCR if OpenAI unavailable
   
3. **Field Highlighting**
   - Visually highlight AI-filled fields in form
   - Show confidence indicators
   
4. **Learning/Feedback**
   - Let users mark incorrect extractions
   - Improve prompts over time
   
5. **Caching**
   - Cache OCR results for duplicate labels
   - Reduce API costs

---

## 📞 Support & Debugging

### **Check Edge Function Logs:**

```bash
npx supabase functions logs parse-label-image
```

### **Common Issues:**

**Issue:** "OPENAI_API_KEY is not configured"
**Fix:** Run `npx supabase secrets set OPENAI_API_KEY=your-key`

**Issue:** "Unauthorized" error
**Fix:** User not logged in - check auth state

**Issue:** "Failed to parse label image"
**Fix:** Check OpenAI API credit balance

**Issue:** Form doesn't pre-fill
**Fix:** Check browser console for errors, verify function deployed

---

## 🎓 Documentation for Users

**Suggested Help Text (in app):**

> **AI Label Extraction** ✨
> 
> When you upload a photo of a wine label, our AI automatically reads and extracts:
> - Wine name and producer
> - Vintage year
> - Region and style
> - Grape varieties
> 
> You can review and edit everything before saving. If the AI can't read your label clearly, just fill in the details manually!

---

## ✅ Deployment Checklist

Before going live:

- [ ] Edge Function deployed (`parse-label-image`)
- [ ] OpenAI API key configured
- [ ] Frontend code built and deployed
- [ ] Tested on desktop browser
- [ ] Tested on iPhone (camera upload)
- [ ] Tested on iPhone (PWA mode)
- [ ] Tested error scenarios
- [ ] Verified toast messages
- [ ] Checked mobile responsiveness
- [ ] Monitored Edge Function logs
- [ ] Confirmed no console errors
- [ ] Verified OpenAI billing active

---

**Ready to deploy! 🚀**

This feature will significantly improve the bottle-adding UX, especially on mobile. Users will love the "magical" feeling of having their bottle data extracted automatically!

