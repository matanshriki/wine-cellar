# 🎨 App Icon Setup Instructions

## Your Beautiful Wine Cellar Logo

I can see your gorgeous golden wine cellar logo! To use it as your favicon and PWA icon, you need to prepare a few image sizes.

---

## 📋 Required Image Sizes

### **For Favicon (Browser Tab)**
- `favicon.ico` - 32x32px (standard)
- `favicon-16x16.png` - 16x16px
- `favicon-32x32.png` - 32x32px

### **For iOS PWA (iPhone Home Screen)**
- `apple-touch-icon.png` - 180x180px (required for iPhone)

### **For Android PWA**
- `icon-192.png` - 192x192px
- `icon-512.png` - 512x512px

---

## 🛠️ How to Prepare Your Icons

### **Option 1: Use Online Tool (Easiest)**

1. **Go to [favicon.io](https://favicon.io/favicon-converter/)**
2. **Upload your wine cellar image**
3. **Download the generated package**
4. **Extract and you'll get:**
   - `favicon.ico`
   - `favicon-16x16.png`
   - `favicon-32x32.png`
   - `apple-touch-icon.png`
   - `android-chrome-192x192.png`
   - `android-chrome-512x512.png`

### **Option 2: Use [realfavicongenerator.net](https://realfavicongenerator.net/)**
1. Upload your image
2. Customize appearance
3. Generate all icon sizes automatically

### **Option 3: Manual Resize (Photoshop/Figma)**
Resize your image to each required size and export as PNG (except favicon.ico).

---

## 📁 Where to Place the Files

Once you have the icon files, place them in:
```
wine/apps/web/public/
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
```

---

## 🚀 After You Have the Files

Once you've placed the icon files in the `public/` folder, let me know and I'll:
1. Update `index.html` to reference the new favicon
2. Update `manifest.json` for PWA icons
3. Ensure iOS grabs the correct icon for home screen

---

## 💡 Quick Steps Summary

1. **Download your wine cellar image** (the one you just showed me)
2. **Go to [favicon.io/favicon-converter](https://favicon.io/favicon-converter/)**
3. **Upload the image**
4. **Click "Download"**
5. **Extract the zip file**
6. **Copy these files to `wine/apps/web/public/`:**
   - `favicon.ico`
   - `android-chrome-192x192.png` → rename to `icon-192.png`
   - `android-chrome-512x512.png` → rename to `icon-512.png`
   - `apple-touch-icon.png` (keep as is)
7. **Let me know when done** ✅

---

## 🍎 iOS PWA Icon Requirements

For iPhone home screen, iOS requires:
- **Size:** 180x180px minimum (or 167x167 for iPad)
- **Format:** PNG with transparency OR solid background
- **Name:** `apple-touch-icon.png`
- **Recommended:** Square image with slight padding inside

Your wine cellar logo with the dark background will look great! 🍷

---

Ready? Get the icons from favicon.io and let me know when they're in the `public/` folder! 🎨

