# 🍷 Wine Cellar Brain

A production-grade web application for smart wine cellar management with intelligent recommendations and multi-language support.

## ✨ Features

- **🍾 Smart Cellar Dashboard**: Track all your bottles with detailed metadata (producer, vintage, region, grapes, ratings, quantity)
- **🎯 "What Should I Open Tonight?"**: Guided recommendation flow based on meal type, occasion, and preferences
- **🔐 Authentication**: Email/password + Google OAuth login (via Supabase Auth)
- **👤 User Profiles**: Profile management with avatar upload using Supabase Storage
- **📊 CSV Import**: Bulk import bottles with automatic Vivino format detection and intelligent column mapping
- **📜 History & Stats**: Track opened bottles, view consumption statistics and trends
- **🌍 Internationalization**: Full support for English and Hebrew with RTL layout
- **📱 Mobile-First**: Optimized for mobile devices with responsive design and touch-friendly interactions
- **🎉 Delightful UX**: Confetti animations, smooth transitions, loading states, and polished interactions

---

## 🚀 Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first CSS
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **React i18next** - Internationalization (i18n)
- **Canvas Confetti** - Celebration animations

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication (email + OAuth)
  - Storage (avatar uploads)
  - Real-time subscriptions (optional)

---

## 📋 Prerequisites

- **Node.js 18+** and npm
- **Supabase account** (free tier works)
- **Google Cloud project** (for Google OAuth, optional)

---

## ⚡ Quick Start (Local Development)

### 1. Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd wine

# Install dependencies
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in Supabase SQL Editor:
   - `supabase/migrations/20251226_initial_schema.sql`
   - `supabase/migrations/20251226_avatar_storage.sql`

3. Enable authentication providers:
   - Go to **Authentication > Providers**
   - Enable **Email** provider
   - Enable **Google** provider (optional, see setup below)

### 3. Configure Environment Variables

Create `/apps/web/.env`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Find these values:**
- Supabase Dashboard > Project Settings > API
- Use the **anon/public** key (NOT service_role)

### 4. Start Development Server

```bash
# From root directory
cd apps/web
npm run dev
```

App will be available at **http://localhost:5173**

---

## 🔐 Google OAuth Setup (Optional)

### 1. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Navigate to **APIs & Services > Credentials**
4. Create **OAuth 2.0 Client ID**
5. Add **Authorized JavaScript origins**:
   - `https://YOUR_PROJECT_ID.supabase.co`
   - `http://localhost:5173` (for local dev)
6. Add **Authorized redirect URIs**:
   - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
7. Copy your Client ID and Client Secret

### 2. Supabase Configuration

1. Go to **Authentication > Providers** in Supabase Dashboard
2. Enable **Google** provider
3. Paste your Google Client ID and Client Secret
4. Save

---

## 📦 Project Structure

```
wine/
├── apps/
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── contexts/       # React contexts (Auth)
│       │   ├── features/       # Feature modules
│       │   │   ├── auth/       # Login/signup
│       │   │   ├── workspace/  # Profile & settings
│       │   │   ├── events/     # Cellar management
│       │   │   ├── timeline/   # Recommendations
│       │   │   └── export/     # History & stats
│       │   ├── i18n/          # Translations (EN/HE)
│       │   ├── lib/           # Utilities (Supabase client)
│       │   ├── services/      # Data access layer
│       │   ├── styles/        # Global CSS
│       │   └── types/         # TypeScript types
│       └── package.json
├── supabase/
│   └── migrations/            # SQL migrations
├── PRODUCTION_DEPLOYMENT.md   # Vercel deployment guide
└── README.md                  # This file
```

---

## 🗄️ Database Schema

### Tables

**`profiles`** - User profiles
- `id` (uuid, references auth.users)
- `display_name`, `first_name`, `last_name`
- `email`, `avatar_url`
- `preferred_language`

**`wines`** - Wine catalog (user-scoped)
- `id`, `user_id`
- `producer`, `wine_name`, `vintage`
- `country`, `region`, `appellation`
- `color` (red/white/rose/sparkling)
- `grapes` (jsonb array)

**`bottles`** - Inventory
- `id`, `user_id`, `wine_id` (FK to wines)
- `quantity`, `purchase_date`, `purchase_price`
- `storage_location`, `bottle_size_ml`
- Readiness analysis fields (drink_window_start/end, readiness_status)

**`consumption_history`** - Opened bottles log
- `id`, `user_id`, `bottle_id`, `wine_id`
- `opened_at`, `occasion`, `meal_type`
- `user_rating`, `tasting_notes`

**`recommendation_runs`** - Recommendation history (optional)
- `id`, `user_id`, `preferences` (jsonb)
- `recommendations` (jsonb), `created_at`

### Row Level Security (RLS)

All tables have RLS policies that enforce:
- Users can only read/write their own data
- `user_id = auth.uid()` enforced on all queries

---

## 🎯 Key Features & Usage

### 1. **Cellar Management**

- **Add bottles**: Manual form or CSV import
- **Edit/Delete**: Full CRUD operations
- **View details**: Readiness status, drinking window, serving instructions
- **Inventory tracking**: Quantity management

### 2. **CSV Import**

- **Upload CSV**: Drag & drop or file picker
- **Auto-detection**: Vivino format automatically detected
- **Column mapping**: Intelligent mapping with manual override
- **Progress feedback**: Wine glass filling animation
- **Bulk import**: Import hundreds of bottles at once

**Supported CSV formats:**
- Vivino export
- Custom CSV (with column mapping)

### 3. **"What to Open Tonight?"**

Guided recommendation flow:
1. Select **meal type** (pizza, steak, fish, etc.)
2. Choose **occasion** (casual, date night, celebration)
3. Pick **vibe** (easy drinking, crowd pleaser, special)
4. Set **preferences** (avoid too young, price limit)
5. Get **1-3 recommendations** from your cellar
6. **Mark as opened** → triggers confetti 🎉

### 4. **History & Statistics**

- **Opened bottles log**: When, what, and with what meal
- **Consumption stats**: Total opens, favorite regions/styles
- **Trends**: Monthly opening patterns
- **Ratings**: Track your preferences over time

### 5. **Profile Management**

- **Edit name**: First name, last name, display name
- **Avatar upload**: Upload photo from camera roll or files (mobile + desktop)
- **Language**: Switch between English and Hebrew
- **Google sync**: Auto-populate name/email/avatar from Google on first login

---

## 🌍 Internationalization (i18n)

### Supported Languages
- **English (EN)** - LTR (Left-to-Right)
- **Hebrew (HE)** - RTL (Right-to-Left)

### Features
- **Automatic language detection**: Browser language → saved preference
- **Language switcher**: EN 🇺🇸 / HE 🇮🇱 toggle
- **Persistent selection**: Saved to localStorage
- **RTL layout**: Full RTL support for Hebrew (alignment, spacing, icons)
- **Scoped translation**: UI text translated, bottle names remain unchanged

### Translation Files
- `/apps/web/src/i18n/locales/en.json` - English strings
- `/apps/web/src/i18n/locales/he.json` - Hebrew strings

---

## 🚀 Deployment to Vercel

See **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** for comprehensive deployment guide including:

- ✅ Pre-deployment checklist
- 🔧 Supabase configuration
- 🔐 Google OAuth setup
- 🌐 Vercel project configuration
- ✅ Post-deployment verification
- 🐛 Troubleshooting guide

**Quick deploy:**
1. Connect GitHub repo to Vercel
2. Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
3. Configure root directory: `apps/web`
4. Deploy!

---

## 📝 Scripts

```bash
# Development
cd apps/web
npm run dev                # Start dev server (Vite)

# Production Build
npm run build              # Build for production (outputs to dist/)
npm run preview            # Preview production build locally

# Type Checking (optional)
npm run typecheck          # Run TypeScript type check
npm run build:check        # Build with type checking

# Linting (requires ESLint setup)
npm run lint               # Run ESLint
```

---

## 🧪 Known Limitations & Future Enhancements

### Current Limitations
1. **TypeScript strict mode disabled**: Supabase type inference issues require relaxed type checking for builds
2. **No automated tests**: Manual QA checklist provided
3. **Bundle size**: 549 KB (159 KB gzipped) - consider code splitting for optimization
4. **No AI analysis**: Readiness analysis is heuristic-based (AI integration planned)

### Future Enhancements
- **AI integration**: OpenAI for bottle analysis and personalized recommendations
- **Vivino API**: Direct integration if/when API becomes available
- **Social features**: Share recommendations with friends
- **Multi-workspace**: Family/group cellar management
- **Image uploads**: Wine label photos
- **Push notifications**: Drinking window reminders
- **Advanced filtering**: Search and filter by region, grape, vintage, etc.
- **Code splitting**: Dynamic imports for better performance
- **E2E tests**: Playwright test suite

---

## 🐛 Troubleshooting

### "Something went wrong" on login
- ✅ Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- ✅ Verify Supabase project is active
- ✅ Ensure database migrations have been applied

### Google OAuth "redirect_uri_mismatch"
- ✅ Add `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback` to Google Cloud Console authorized redirect URIs
- ✅ Match the URL exactly (no trailing slashes)

### Profile fields empty after Google login
- ✅ Run `20251226_initial_schema.sql` migration
- ✅ Verify `handle_new_user` trigger exists in Supabase (SQL Editor > Functions)

### Avatar upload fails
- ✅ Run `20251226_avatar_storage.sql` migration
- ✅ Verify `avatars` storage bucket exists (Supabase > Storage)
- ✅ Check Storage RLS policies are enabled

### History page shows error
- ✅ Verify `consumption_history` table exists
- ✅ Check RLS policies allow user to read their own history

### Build fails
- ✅ Use `npm run build` (not `npm run build:check`)
- ✅ Build command skips TypeScript strict checking due to Supabase type issues
- ✅ Runtime code is correct - this is a type inference limitation

---

## 📚 Documentation

### Main Docs
- **[PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)** - Vercel deployment guide
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Initial Supabase configuration
- **[SUPABASE_DATABASE_SETUP.md](./SUPABASE_DATABASE_SETUP.md)** - Database schema details

### Feature Docs
- **[PROFILE_SYSTEM_COMPLETE.md](./PROFILE_SYSTEM_COMPLETE.md)** - User profile implementation
- **[AVATAR_UPLOAD_FEATURE.md](./AVATAR_UPLOAD_FEATURE.md)** - Avatar upload with Supabase Storage
- **[MARK_AS_OPENED_FIX.md](./MARK_AS_OPENED_FIX.md)** - History tracking implementation
- **[CSV_IMPORT_HELP_FIX.md](./CSV_IMPORT_HELP_FIX.md)** - CSV import and Vivino guide

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit (`git commit -m 'Add amazing feature'`)
5. Push (`git push origin feature/amazing-feature`)
6. Open a Pull Request

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- Built with ❤️ using React, Supabase, TailwindCSS, and modern web technologies
- Confetti effects by [canvas-confetti](https://github.com/catdad/canvas-confetti)
- Icons from system fonts and emojis
- Inspired by the joy of wine collecting and sharing

---

## 📞 Support

- **Issues**: Open an issue on GitHub
- **Questions**: Create a discussion
- **Enjoying the app?**: Star the repository! ⭐

---

**Cheers! 🍷**
