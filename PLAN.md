# Wine - Implementation Plan

## Tech Stack & Rationale

### Frontend
- **React 18 + TypeScript + Vite**: Fast dev experience, strong typing, modern build tool
- **React Router 6**: Standard routing with data loaders
- **TanStack Query v5**: Server state management, caching, optimistic updates, realtime sync
- **React Hook Form + Zod**: Performant forms with type-safe validation
- **Tailwind CSS + shadcn/ui**: Accessible components, mobile-first, rapid UI development
- **Recharts**: Lightweight charting for trends
- **Vitest + React Testing Library**: Fast unit/integration tests
- **Playwright**: E2E testing for critical flows

### Backend
- **Supabase**: 
  - Postgres with RLS (row-level security)
  - Built-in Auth (magic link)
  - Realtime subscriptions for multi-user sync
  - Easy deployment, good DX

### Why this stack?
- Mobile-first priority: Tailwind + shadcn ensures responsive, accessible UI
- Real-time critical: Supabase Realtime + TanStack Query = instant updates
- Type safety: TS + Zod = runtime + compile-time validation
- Production-ready: RLS for security, proper error handling, offline support

## Database Schema

### Tables

**workspaces**
- id (uuid, pk)
- name (text)
- created_at (timestamptz)
- created_by (uuid, fk -> auth.users)

**workspace_members**
- id (uuid, pk)
- workspace_id (uuid, fk)
- user_id (uuid, fk -> auth.users)
- role (text: owner, member)
- joined_at (timestamptz)
- unique(workspace_id, user_id)

**babies**
- id (uuid, pk)
- workspace_id (uuid, fk)
- name (text)
- date_of_birth (date, nullable)
- photo_url (text, nullable)
- created_at (timestamptz)

**events**
- id (uuid, pk)
- baby_id (uuid, fk)
- workspace_id (uuid, fk) -- denormalized for RLS
- event_type (text: feeding, sleep, diaper, growth, note)
- event_time (timestamptz) -- actual event time
- duration_minutes (int, nullable)
- metadata (jsonb) -- type-specific data
- notes (text, nullable)
- created_by (uuid, fk -> auth.users)
- created_at (timestamptz)
- updated_at (timestamptz)

**invites**
- id (uuid, pk)
- workspace_id (uuid, fk)
- email (text)
- invited_by (uuid, fk -> auth.users)
- status (text: pending, accepted, expired)
- created_at (timestamptz)
- expires_at (timestamptz)

### Metadata Structure (JSONB)
- **Feeding**: `{ method: 'breast' | 'bottle' | 'pumping', side?: 'left' | 'right' | 'both', amount_ml?: number }`
- **Sleep**: `{ quality?: 'poor' | 'fair' | 'good' | 'excellent' }`
- **Diaper**: `{ type: 'wet' | 'dirty' | 'both' }`
- **Growth**: `{ weight_kg?: number, height_cm?: number, head_circumference_cm?: number }`
- **Note**: `{ category?: string }`

### RLS Policies
- Users can only access workspaces they're members of
- All queries filtered by workspace_members join
- Invite acceptance creates workspace_member row

## Routes & Pages

```
/ -> redirect to /app or /login
/login -> Auth (magic link)
/signup -> Auth (magic link)

/app (protected)
  /app/setup -> First-time workspace + baby setup
  /app/workspace/:id
    /app/workspace/:id/baby/:babyId/timeline (default)
    /app/workspace/:id/baby/:babyId/stats
    /app/workspace/:id/baby/:babyId/export
    /app/workspace/:id/settings -> manage workspace, invite users
  /app/accept-invite/:token -> Accept invitation flow
```

## Implementation Milestones

### MVP (Core Functionality)
- [ ] Slice 1: Project setup + Auth
  - Vite + React + TS
  - Supabase client + auth
  - Login/logout flow
  - Protected routes
  
- [ ] Slice 2: Workspace + Baby setup
  - DB migrations
  - Create workspace
  - Create baby profile
  - Basic RLS
  
- [ ] Slice 3: Event logging - Feeding
  - Events table + RLS
  - Add feeding form
  - Display in timeline
  - Edit/delete
  
- [ ] Slice 4: Other event types
  - Sleep, diaper, growth, note forms
  - Unified event creation dialog
  - Timeline with filters
  
- [ ] Slice 5: Timeline & realtime
  - Day view with grouping
  - Last event summary cards
  - Supabase realtime subscriptions
  - Optimistic updates

### Polish
- [ ] Slice 6: Stats & trends
  - Daily aggregations
  - 7-day trend charts
  - Filter controls
  
- [ ] Slice 7: Multi-user
  - Invite system
  - Accept invite flow
  - Show active caregivers
  
- [ ] Slice 8: Export
  - Date range picker
  - CSV export with proper formatting

### Production Checks
- [ ] Slice 9: Testing
  - Unit tests for validation
  - Component tests for forms
  - E2E test: auth -> add event -> timeline
  
- [ ] Slice 10: Production hardening
  - Error boundaries
  - Offline support (retry logic)
  - Timezone handling
  - Performance optimization
  - Security audit
  
- [ ] Slice 11: Documentation
  - README.md
  - DEPLOYMENT.md
  - Environment setup guide

## Key Technical Decisions

### Timezone Handling
- Store all timestamps in UTC in Postgres
- Convert to local time in UI using date-fns-tz
- Date grouping: convert event_time to local date, then group

### Realtime Strategy
- Subscribe to `events` table filtered by current baby_id
- On insert/update/delete: invalidate/update TanStack Query cache
- Optimistic updates for instant feedback

### Offline Support
- TanStack Query retry with exponential backoff
- Clear error toasts with retry button
- Optimistic UI updates

### Event Type Validation
- Zod schemas for each event type's metadata
- Validate on client before submission
- Postgres check constraints for critical fields

### Folder Structure
```
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
  features/
    auth/
      components/
      hooks/
      api.ts
    workspace/
    baby/
    events/
      components/
        AddEventDialog.tsx
        EventList.tsx
        EventCard.tsx
      hooks/
      validation.ts
      api.ts
      types.ts
    timeline/
    stats/
    export/
  components/
    ui/ (shadcn components)
    layout/
  lib/
    supabase.ts
    queryClient.ts
    utils.ts
  types/
    database.ts
    models.ts
  styles/
    globals.css
```

## Definition of Done Criteria
1. ✅ `npm run lint` passes
2. ✅ `npm run test` passes  
3. ✅ `npm run build` passes
4. ✅ Playwright e2e passes
5. ✅ Fresh clone + README works
6. ✅ RLS verified (cannot access other workspaces)
7. ✅ Mobile responsive
8. ✅ Accessible (keyboard nav, screen readers)
9. ✅ Error handling (toast notifications)
10. ✅ Loading states

