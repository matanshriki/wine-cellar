# Wine - TODO

## MVP (Core Functionality)

### Slice 1: Project setup + Auth
- [ ] Initialize Vite React TypeScript project
- [ ] Install dependencies (React Router, TanStack Query, React Hook Form, Zod, Tailwind, shadcn/ui)
- [ ] Configure Tailwind + shadcn/ui
- [ ] Set up Supabase client
- [ ] Implement auth UI (login/signup with magic link)
- [ ] Protected route guards
- [ ] Test auth flow

### Slice 2: Workspace + Baby setup
- [ ] Create Supabase migrations (workspaces, workspace_members, babies, events, invites)
- [ ] Implement RLS policies
- [ ] Create workspace form
- [ ] Create baby profile form
- [ ] Workspace selection UI
- [ ] Test workspace creation

### Slice 3: Event logging - Feeding
- [ ] Event validation schemas (Zod)
- [ ] Add feeding event form
- [ ] API functions for events
- [ ] Display events in timeline
- [ ] Edit event
- [ ] Delete event
- [ ] Test feeding event CRUD

### Slice 4: Other event types
- [ ] Sleep event form
- [ ] Diaper event form
- [ ] Growth event form
- [ ] Note event form
- [ ] Unified event creation dialog
- [ ] Timeline filters by type
- [ ] Test all event types

### Slice 5: Timeline & realtime
- [ ] Day-grouped timeline view
- [ ] Last event summary cards
- [ ] Supabase realtime subscription
- [ ] Optimistic updates
- [ ] Test realtime sync

## Polish

### Slice 6: Stats & trends
- [ ] Daily aggregation queries
- [ ] 7-day trend charts (Recharts)
- [ ] Filter controls
- [ ] Test stats accuracy

### Slice 7: Multi-user
- [ ] Invite user form
- [ ] Email invite storage
- [ ] Accept invite flow
- [ ] List workspace members
- [ ] Test invite flow

### Slice 8: Export
- [ ] Date range picker
- [ ] CSV export function
- [ ] Test export with various date ranges

## Production Checks

### Slice 9: Testing
- [ ] Unit tests: validation schemas
- [ ] Unit tests: utility functions
- [ ] Component tests: AddEventDialog
- [ ] Component tests: Timeline
- [ ] E2E test: full user flow
- [ ] All tests passing

### Slice 10: Production hardening
- [ ] Error boundaries
- [ ] Retry logic for failed requests
- [ ] Timezone handling with date-fns-tz
- [ ] Loading skeletons
- [ ] Toast notifications
- [ ] Verify RLS (manual testing)
- [ ] Mobile responsiveness check
- [ ] Accessibility audit

### Slice 11: Documentation
- [ ] README.md with setup instructions
- [ ] DEPLOYMENT.md
- [ ] Environment variables guide
- [ ] Code comments for complex logic

## Final Checks
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] `npm run test:e2e` passes
- [ ] Fresh clone test

