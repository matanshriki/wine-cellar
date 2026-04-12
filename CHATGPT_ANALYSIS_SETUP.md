# ChatGPT-Powered Sommelier Notes - Complete Setup Guide

## 🎯 Overview

The Sommi app now features **AI-powered sommelier notes** using ChatGPT. Each bottle gets a unique, personalized analysis that references specific details (producer, region, vintage) and provides explainable insights.

### **Key Features**:
- ✅ **Per-bottle analysis** (not generic templates)
- ✅ **Cached for 30 days** (fast, consistent, cost-effective)
- ✅ **Luxury UI** with expandable "Why" section
- ✅ **Confidence badges** (LOW/MEDIUM/HIGH)
- ✅ **Full i18n** (EN/HE) + RTL support
- ✅ **Secure** (OpenAI key on backend only)

---

## 📂 Files Created/Modified

### **New Files**:
1. `/supabase/migrations/20251227_ai_analysis.sql` - Database schema for AI fields
2. `/supabase/functions/analyze-wine/index.ts` - Edge Function for ChatGPT integration
3. `/apps/web/src/services/aiAnalysisService.ts` - Frontend service for AI analysis
4. `/apps/web/src/components/SommelierNotes.tsx` - Premium UI component

### **Modified Files**:
1. `/apps/web/src/services/bottleService.ts` - Updated to fetch analysis data
2. `/apps/web/src/pages/CellarPage.tsx` - Updated to use AI analysis
3. `/apps/web/src/components/BottleCard.tsx` - Updated to display Sommelier Notes
4. `/apps/web/src/i18n/locales/en.json` - Added i18n strings
5. `/apps/web/src/i18n/locales/he.json` - Added RTL translations
6. `/apps/web/src/styles/design-tokens.css` - Added status colors

---

## 🚀 Setup Instructions

### **Step 1: Database Migration**

Run the SQL migration to add AI analysis fields:

```bash
# From project root
cd supabase
supabase db push
```

Or manually run the SQL in Supabase Dashboard:
```sql
-- See: /supabase/migrations/20251227_ai_analysis.sql
```

**New Fields Added**:
- `analysis_summary` (TEXT) - AI-generated sommelier note
- `analysis_reasons` (JSONB) - Bullet points explaining the analysis
- `drink_window_start` / `drink_window_end` (INTEGER) - Year range
- `confidence` (TEXT) - LOW/MEDIUM/HIGH
- `assumptions` (TEXT) - Notes when confidence is low
- `analyzed_at` (TIMESTAMPTZ) - Analysis timestamp

---

### **Step 2: Deploy Supabase Edge Function**

1. **Install Supabase CLI** (if not already):
   ```bash
   brew install supabase/tap/supabase
   supabase login
   ```

2. **Link your project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```

3. **Set OpenAI API key** (required!):
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-api-key-here
   ```

4. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy analyze-wine
   ```

5. **Verify deployment**:
   ```bash
   supabase functions list
   ```

**Edge Function Location**: `/supabase/functions/analyze-wine/index.ts`

---

### **Step 3: Frontend Environment Variables**

Your frontend `.env` file should already have:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**No OpenAI key needed in frontend!** It's securely stored in Supabase Edge Function secrets.

---

## 🧠 How It Works

### **1. User Clicks "Generate Sommelier Notes"**

```
User (Browser)
    ↓
Frontend: aiAnalysisService.generateAIAnalysis()
    ↓
Supabase Edge Function: analyze-wine
    ↓
OpenAI API: gpt-4o-mini (with structured JSON prompt)
    ↓
Edge Function: Returns analysis JSON
    ↓
Frontend: Stores in database (bottle_analysis table)
    ↓
UI: Displays SommelierNotes component
```

---

### **2. ChatGPT Prompt Structure**

**System Prompt**:
```
You are an expert sommelier analyzing wines. You MUST respond with valid JSON only.

{
  "analysis_summary": "2-3 sentence sommelier note",
  "analysis_reasons": ["bullet 1", "bullet 2", "bullet 3"],
  "readiness_label": "READY" | "HOLD" | "PEAK_SOON",
  "serving_temp_c": number,
  "decant_minutes": number,
  "drink_window_start": number | null,
  "drink_window_end": number | null,
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "assumptions": "string or null"
}

IMPORTANT:
- Reference the SPECIFIC wine details (producer, region, vintage)
- Do NOT use generic template language
- If data is missing, lower confidence and mention assumptions
```

**User Prompt** (includes actual bottle data):
```
Wine Name: Château Margaux
Producer: Château Margaux
Vintage: 2015
Age: 10 years
Region: Bordeaux
Grapes: Cabernet Sauvignon, Merlot
Style: red
User Notes: Purchased at auction

Current Year: 2025

Provide a detailed, bottle-specific analysis...
```

---

### **3. Example Output**

**Request**:
```json
{
  "bottle_id": "abc123",
  "wine_data": {
    "wine_name": "Château Margaux",
    "producer": "Château Margaux",
    "vintage": 2015,
    "region": "Bordeaux",
    "grapes": ["Cabernet Sauvignon", "Merlot"],
    "color": "red"
  }
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "analysis_summary": "This 2015 Château Margaux from Bordeaux is entering its drinking window with exceptional balance. The 10-year-old wine shows developing tertiary aromas while maintaining vibrant fruit. It will continue to improve for another 10-15 years.",
    "analysis_reasons": [
      "2015 was an outstanding vintage in Bordeaux with perfect ripening conditions",
      "At 10 years old, Margaux wines from premier estates are approaching peak maturity",
      "Cabernet Sauvignon-dominant blends benefit from extended aging in this region",
      "The wine shows excellent structure typical of Left Bank Bordeaux"
    ],
    "readiness_label": "READY",
    "serving_temp_c": 17,
    "decant_minutes": 60,
    "drink_window_start": 2025,
    "drink_window_end": 2040,
    "confidence": "HIGH",
    "assumptions": null
  }
}
```

---

## 🎨 Luxury UI Component

### **SommelierNotes Component Features**:

1. **Status Chip**:
   - 🟢 READY (green) - "Ready to Drink"
   - 🟡 PEAK_SOON (yellow) - "Peak Soon"
   - 🔵 HOLD (blue) - "Hold for Aging"

2. **Confidence Badge**:
   - High confidence (green)
   - Medium confidence (yellow)
   - Low confidence (orange)

3. **AI-Powered Label**:
   - Small badge: "AI-powered analysis"

4. **Summary**:
   - 2-3 sentences from ChatGPT
   - References specific wine details

5. **Serving Suggestions**:
   - Temperature: 🌡️ 17°C
   - Decant: ⏱️ 60min
   - Drink window: 📅 2025-2040

6. **Expandable "Why" Section**:
   - Click to reveal bullet points
   - Smooth animation
   - Shows reasoning

7. **Refresh Button**:
   - Re-generate analysis
   - Spinning icon during refresh

8. **Analysis Date**:
   - "Analyzed on Dec 27, 2025"

---

## 💰 Cost Estimation

**OpenAI API Pricing** (gpt-4o-mini):
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Per Analysis**:
- Prompt: ~200 tokens input
- Response: ~150 tokens output
- **Cost per bottle**: ~$0.0001 (less than 1 cent!)

**With 30-day caching**:
- 100 bottles analyzed once: $0.01
- Re-analysis after 30 days: Another $0.01
- **Monthly cost for 100 bottles**: ~$0.01

**Extremely affordable!** 🎉

---

## 🔒 Security

### **What's Secure**:
✅ OpenAI API key stored in Supabase Edge Function secrets (not in frontend)  
✅ Edge Function requires user authentication  
✅ RLS policies ensure users only analyze their own bottles  
✅ No API key exposure in browser console/network  

### **What to NEVER Do**:
❌ Don't commit OpenAI key to git  
❌ Don't put OpenAI key in frontend `.env`  
❌ Don't bypass authentication checks  

---

## 📊 Caching Strategy

**Freshness Window**: 30 days

### **Logic**:
```typescript
// Check if analysis exists and is fresh
const existing = await getBottleAnalysis(bottleId);

if (existing && isAnalysisFresh(existing.analyzed_at)) {
  // Use cached analysis (< 30 days old)
  return existing;
} else {
  // Generate new analysis
  return generateAIAnalysis(bottle);
}
```

**Why 30 days?**:
- Wine characteristics don't change rapidly
- Balance between freshness and cost
- User can manually refresh anytime

---

## 🌐 i18n Support

### **Translated UI Strings**:
- Button: "Generate Sommelier Notes"
- Status labels: "Ready to Drink", "Hold for Aging", "Peak Soon"
- Confidence: "High confidence", "Medium confidence", "Low confidence"
- Labels: "AI-powered analysis", "Why this analysis?", "Analyzed on"

### **NOT Translated**:
- AI-generated summary (English from ChatGPT)
- Bullet point reasons (English from ChatGPT)
- Wine names, producers, regions (original data)

**RTL (Hebrew)**:
- Layout mirrors correctly
- Icons flip appropriately
- Spacing adjusts for RTL

---

## 🧪 Testing Checklist

### **Local Testing** (Before Deploying Edge Function):
- [ ] Run database migration
- [ ] Deploy Edge Function with OpenAI key
- [ ] Test on a bottle with full data (name, producer, vintage, region, grapes)
- [ ] Test on a bottle with minimal data (only name + vintage)
- [ ] Verify analysis is cached (refresh page, analysis persists)
- [ ] Test "Refresh" button (re-generates analysis)

### **Production Testing**:
- [ ] Verify OpenAI key is set in Supabase secrets
- [ ] Test analysis generation (check browser network tab for Edge Function call)
- [ ] Verify no OpenAI key in frontend requests
- [ ] Test mobile UI (expandable sections, touch-friendly)
- [ ] Test Hebrew (RTL layout, translated UI strings)

---

## 🐛 Troubleshooting

### **Issue: "Failed to generate analysis"**

**Possible Causes**:
1. OpenAI API key not set in Supabase secrets
2. Edge Function not deployed
3. Invalid OpenAI key

**Fix**:
```bash
# Check if key is set
supabase secrets list

# Set the key if missing
supabase secrets set OPENAI_API_KEY=sk-your-key

# Redeploy Edge Function
supabase functions deploy analyze-wine
```

---

### **Issue: Analysis is always the same / generic**

**Cause**: Cached response (expected behavior!)

**Fix**: Click the "Refresh" button to regenerate analysis.

---

### **Issue: "OPENAI_API_KEY not configured"**

**Cause**: Edge Function env var not set.

**Fix**:
```bash
supabase secrets set OPENAI_API_KEY=sk-your-actual-key-here
```

---

### **Issue: Edge Function deployment fails**

**Cause**: Supabase CLI not linked to project.

**Fix**:
```bash
# Link your project
supabase link --project-ref YOUR_PROJECT_ID

# Try deploying again
supabase functions deploy analyze-wine
```

---

### **Issue: Analysis doesn't show in UI**

**Possible Causes**:
1. Database migration not run
2. `bottle_analysis` table missing columns
3. RLS policies blocking access

**Fix**:
```bash
# Re-run migration
supabase db push

# Check RLS policies in Supabase Dashboard
# Ensure "Users can view their own bottle analyses" policy exists
```

---

## 🔄 Fallback Behavior

If ChatGPT fails (API error, timeout, etc.), the app:
1. Shows an error toast: "Failed to generate analysis. Please try again."
2. Logs the error to console (for debugging)
3. Does NOT fallback to deterministic analysis (to avoid mixing AI and non-AI)

**User can retry** by clicking "Generate Sommelier Notes" again.

---

## 📈 Future Enhancements

### **Optional Improvements**:

1. **Multi-language AI Output**:
   - Pass user's preferred language to ChatGPT
   - Get analysis in Hebrew or English

2. **Comparison View**:
   - "Compare with similar wines"
   - Show how this bottle stacks up against others in cellar

3. **Food Pairing Suggestions**:
   - Ask ChatGPT for specific meal pairings
   - Display as a separate expandable section

4. **Historical Context**:
   - "1982 was a legendary Bordeaux vintage"
   - Add vintage notes to analysis

5. **Tasting Notes Prediction**:
   - "You might taste black cherry, tobacco, cedar..."
   - Help users know what to expect

---

## 📝 Summary

### **What Was Built**:
1. ✅ Supabase Edge Function for secure ChatGPT integration
2. ✅ Database schema for AI analysis storage
3. ✅ Frontend service for generating and caching analysis
4. ✅ Luxury UI component ("Sommelier Notes")
5. ✅ Full i18n support (EN/HE) + RTL compatibility

### **What Makes It Special**:
- **Per-bottle uniqueness**: References specific producer, region, vintage
- **Explainable**: "Why" section with bullet points
- **Cached**: 30-day freshness for speed and cost savings
- **Secure**: OpenAI key never exposed to frontend
- **Premium UX**: Luxury design with smooth animations

### **Cost**:
- **< 1 cent per bottle analysis**
- **~$0.01/month for 100 bottles** (with caching)

---

## 🚀 Next Steps

1. **Set OpenAI API Key**:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-key
   ```

2. **Deploy Edge Function**:
   ```bash
   supabase functions deploy analyze-wine
   ```

3. **Run Database Migration**:
   ```bash
   supabase db push
   ```

4. **Test It**:
   - Add a bottle with full data
   - Click "Generate Sommelier Notes"
   - Watch the magic happen! ✨

---

**The app now has truly intelligent, per-bottle sommelier notes powered by ChatGPT!** 🍷🤖

