# 🧪 Testing AI-Generated Label Images

**Quick Guide for Verifying the Fix**

---

## ✅ What to Test

### 1. **Cellar Page - Main View**

**Test:** Open your cellar page

**Expected Results:**
- ✅ Bottles with AI-generated labels show the AI image
- ✅ Small "AI" badge appears on AI-generated images
- ✅ Bottles with user-uploaded images show user images (no AI badge)
- ✅ Bottles with no images show text only (no broken images)

**How to Verify:**
1. Open the app
2. Go to "Cellar" tab
3. Look at your bottle cards
4. Check if AI-generated labels are visible

---

### 2. **Tonight's Selection Widget**

**Test:** Check the "Tonight's Selection" circular widget

**Expected Results:**
- ✅ Recommended bottles show AI-generated labels if available
- ✅ Small "AI" badge appears on generated images
- ✅ Images are properly sized (20x28)

**How to Verify:**
1. Open the app
2. Look at the "Tonight's Selection" widget on the Cellar page
3. Check if AI labels are visible in the circular layout

---

### 3. **Wine Details Modal**

**Test:** Click on a bottle to open details

**Expected Results:**
- ✅ AI-generated label shows as the main image
- ✅ "AI" badge appears on the image
- ✅ Image is properly sized and centered
- ✅ "Generate AI Label Art" button still works

**How to Verify:**
1. Click any bottle card
2. Modal opens with bottle details
3. Check if AI label is visible at the top
4. Look for the "AI" badge

---

### 4. **Recommendation Page**

**Test:** Go to "Tonight?" tab and get recommendations

**Expected Results:**
- ✅ Recommended bottles show AI-generated labels
- ✅ Images display correctly in recommendation cards
- ✅ No broken image placeholders

**How to Verify:**
1. Go to "Tonight?" tab
2. Fill out the recommendation form
3. Click "Get Recommendations"
4. Check if AI labels appear in results

---

## 🎯 Priority Testing

### Test Case 1: Bottle with User Image
**Setup:** Bottle has a user-uploaded image

**Expected:**
- ✅ User image shows everywhere
- ✅ AI label is NOT shown (even if it exists)
- ✅ No "AI" badge

**Why:** User images have highest priority

---

### Test Case 2: Bottle with AI Label Only
**Setup:** Bottle has AI-generated label, no user image

**Expected:**
- ✅ AI label shows everywhere
- ✅ "AI" badge visible
- ✅ Image loads correctly

**Why:** AI labels are second priority

---

### Test Case 3: Bottle with No Image
**Setup:** Bottle has no user image and no AI label

**Expected:**
- ✅ No image in cellar cards (text only)
- ✅ Placeholder in details modal
- ✅ No broken image icons
- ✅ Layout doesn't break

**Why:** Graceful fallback to placeholder

---

## 🔄 After AI Generation

### Test: Generate a New AI Label

**Steps:**
1. Open a bottle that has NO user image
2. Click "Generate AI Label Art"
3. Choose a style (Classic or Modern)
4. Wait for generation (10-30 seconds)

**Expected Results:**
- ✅ Modal shows loading state
- ✅ Success message appears
- ✅ AI-generated image appears immediately (no refresh needed)
- ✅ "AI" badge appears on the image
- ✅ Image is visible in cellar when you go back

**If it fails:**
- Check browser console for errors
- Verify you have OpenAI credits
- Check Supabase Edge Function logs

---

## 📱 Mobile Testing (iPhone/PWA)

### Test on iPhone:

**Steps:**
1. Open app in Safari or as PWA
2. Go to Cellar page
3. Scroll through bottles
4. Tap a bottle to open details
5. Check Tonight's Selection widget

**Expected:**
- ✅ AI labels load on mobile
- ✅ Images are properly sized
- ✅ "AI" badges don't overlap text
- ✅ Touch targets work (44x44px minimum)
- ✅ Smooth scrolling
- ✅ No layout breaks

---

## 🖥️ Desktop Testing (Mac/PC)

### Test on Desktop:

**Steps:**
1. Open app in Chrome/Safari/Firefox
2. Resize window to different sizes
3. Hover over bottle cards
4. Click to open details
5. Check all image displays

**Expected:**
- ✅ AI labels visible at all screen sizes
- ✅ Images scale properly (16x20 → 20x24 → 24x28)
- ✅ Hover effects work (image zoom)
- ✅ "AI" badges clear and readable
- ✅ No layout shifts

---

## 🐛 Troubleshooting

### Problem: AI label not showing after generation

**Solution:**
1. Check browser console for errors
2. Verify `generated-labels` storage bucket is public
3. Check if `generated_image_path` is set in database
4. Try refreshing the page

### Problem: User image not overriding AI label

**Solution:**
1. Verify `wine.image_url` is set in database
2. Check if image URL is valid
3. Clear browser cache
4. Check browser console for errors

### Problem: "AI" badge not appearing

**Solution:**
1. Check if `displayImage.isGenerated` is true
2. Verify `generated_image_path` exists in database
3. Check CSS for badge styling
4. Inspect element to see if badge is rendered

### Problem: Images not loading on mobile

**Solution:**
1. Check network tab for CORS errors
2. Verify storage bucket permissions
3. Check if images are too large
4. Try on different network (WiFi vs cellular)

---

## ✅ Quick Verification Checklist

Use this checklist to quickly verify everything works:

- [ ] Open Cellar page
- [ ] See AI labels on bottles without user images
- [ ] See "AI" badges on generated images
- [ ] Click a bottle with AI label
- [ ] AI label shows in details modal
- [ ] Go to Tonight's Selection
- [ ] AI labels visible in circular widget
- [ ] Go to "Tonight?" tab
- [ ] Get recommendations
- [ ] AI labels show in recommendation results
- [ ] Generate a new AI label
- [ ] New label appears immediately
- [ ] Test on mobile (iPhone)
- [ ] Test on desktop (Mac/PC)
- [ ] No console errors
- [ ] No broken images

---

## 📸 Visual Guide

### What You Should See:

**Cellar Page:**
```
┌─────────────────────┐
│  [AI Image]         │
│  ┌──────┐           │
│  │ AI 💡│           │ ← Small badge
│  └──────┘           │
│                     │
│  Wine Name          │
│  Producer           │
│  ★★★★☆ 4.2         │
└─────────────────────┘
```

**Tonight's Selection:**
```
┌──────────────┐
│ Tonight's    │
│ Selection    │
│              │
│  ┌────────┐  │
│  │[Image] │  │
│  │  ┌──┐  │  │
│  │  │AI│  │  │ ← Tiny badge
│  │  └──┘  │  │
│  └────────┘  │
│  Wine Name   │
└──────────────┘
```

**Details Modal:**
```
┌─────────────────────────────┐
│  Wine Details          [X]  │
├─────────────────────────────┤
│                             │
│    ┌──────────────┐         │
│    │              │         │
│    │  [AI Image]  │         │
│    │              │         │
│    │  ┌────────┐  │         │
│    │  │ AI 💡 │  │         │ ← Badge
│    │  └────────┘  │         │
│    └──────────────┘         │
│                             │
│  Wine Name                  │
│  Producer • 2020 • Red      │
│                             │
│  [Generate AI Label Art]    │
│  [Mark as Opened]           │
│  [View in Vivino]           │
└─────────────────────────────┘
```

---

## 🎉 Success Indicators

### You'll Know It's Working When:

1. ✅ **Cellar page shows AI labels** - No more empty spaces where AI labels should be
2. ✅ **"AI" badges are visible** - Clear indication of generated images
3. ✅ **User images take priority** - Your uploaded photos always show first
4. ✅ **Immediate updates** - New AI labels appear without refresh
5. ✅ **Works on mobile** - iPhone/PWA shows AI labels correctly
6. ✅ **No broken images** - Graceful fallbacks everywhere
7. ✅ **Consistent behavior** - Same priority everywhere in the app

---

## 📞 Need Help?

### If something doesn't work:

1. **Check browser console** - Look for errors
2. **Check network tab** - Verify images are loading
3. **Try different browser** - Rule out browser-specific issues
4. **Clear cache** - Force fresh image loads
5. **Check database** - Verify `generated_image_path` exists
6. **Check storage** - Verify `generated-labels` bucket is public

### Common Console Messages:

**Good:**
```
[AI Label] ✅ Feature enabled
[AI Label] ✅ User has access
[AI Label] ✅ Image loaded
```

**Bad:**
```
[AI Label] ❌ Feature disabled
[AI Label] ❌ No generated_image_path
[AI Label] ❌ Storage error
```

---

## 🚀 Ready to Test!

**Your AI-generated labels should now be visible throughout the app.**

Start with the Cellar page and work your way through each section. If you see AI labels with "AI" badges, everything is working correctly!

**Happy Testing! 🍷✨**


