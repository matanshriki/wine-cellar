# 🚀 Local Development Quick Start

## Run the App Locally (Before Dark Mode Implementation)

### Step 1: Start Development Server

```bash
# Open terminal and navigate to the web app
cd apps/web

# Start the dev server
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

### Step 2: Open in Browser

Visit: **http://localhost:5173**

You should see your Wine Cellar app running locally!

---

## Verify Local Setup

### ✅ Checklist:
- [ ] App loads at localhost:5173
- [ ] You can log in
- [ ] Cellar page shows your bottles
- [ ] Navigation works (cellar, tonight, agent, profile)
- [ ] No console errors (F12 → Console tab)

### Common Issues:

**Issue: "Cannot find module" or TypeScript errors**
```bash
# Reinstall dependencies
cd apps/web
rm -rf node_modules
npm install
npm run dev
```

**Issue: "Port 5173 already in use"**
```bash
# Kill the existing process
lsof -ti:5173 | xargs kill -9
npm run dev
```

**Issue: Supabase connection error**
- Check `apps/web/.env` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

---

## Ready to Implement Dark Mode?

Once local dev is working:

1. ✅ Confirmed app runs locally
2. ✅ Tested basic navigation
3. ✅ No console errors

**Next:** Read `DARK_MODE_V2_PLAN.md` and start implementing!

---

## Helpful Commands

```bash
# Start dev server
npm run dev

# Build for production (test build)
npm run build

# Preview production build locally
npm run build && npm run preview

# Type checking
npm run typecheck

# Stop dev server
Ctrl + C
```

---

## Testing Flow

**Always test locally before pushing:**

1. **Make code changes** (e.g., add dark mode)
2. **Check in browser** (http://localhost:5173)
3. **Test thoroughly** (see DARK_MODE_V2_PLAN.md checklist)
4. **Fix any issues** immediately
5. **Only when perfect** → commit and push

---

## Development Tips

### Hot Reload
- Changes to `.tsx`, `.ts`, `.css` files reload automatically
- No need to restart server for most changes
- If something breaks, restart: `Ctrl+C` → `npm run dev`

### Browser DevTools
- **F12** or **Cmd+Option+I** to open DevTools
- **Console tab**: Check for errors
- **Elements tab**: Inspect CSS variables
- **Network tab**: Check API calls
- **Application → Local Storage**: Check theme persistence

### Testing Multiple Themes
```javascript
// In browser console, force theme change:
localStorage.setItem('theme', 'dark')
location.reload()

// Or clear theme:
localStorage.removeItem('theme')
location.reload()
```

---

## When Ready for Production

**DO NOT push to main yet!**

Instead:
1. Test locally for 1-2 days minimum
2. Complete full testing checklist
3. Get approval/review if needed
4. Then push to feature branch first
5. Finally merge to main (triggers Vercel deploy)

---

Happy coding! 🍷✨
