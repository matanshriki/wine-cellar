# Sommi Memory Surface — Product, UI & Architecture Audit

**Status:** Read-only audit (no implementation)  
**Date:** 2026-09-12  
**Scope:** Proposed “What Sommi remembers about me” Profile surface + deterministic chat summary  
**Constraint:** Do not implement; do not create migrations; labels below mark evidence quality.

Legend:

- **VERIFIED** — confirmed in current codebase
- **PROPOSED** — recommendation based on verified patterns (not built)
- **UNKNOWN** — not established from inspection

Related prior work: Phase 2A/2B.1 (`docs/agent-taste-profile-phase2-design.md`), conversation-ID lifecycle on `main` (`c3a7e64`).

---

## 1. Verified current architecture

### Product surfaces today

| Surface | Role | Explicit remembered prefs (`taste_profile.explicit`) |
|---------|------|------------------------------------------------------|
| Profile `/profile` | Identity, Taste Profile (inferred + calibration), billing | **Not shown** — VERIFIED |
| Agent `/agent` (`AgentPageWorking`) | Chat recommend + Phase 2A/2B.1 remember/forget/confirm | **Writes** explicit via RPCs; no “what do you remember” route — VERIFIED |
| Taste Profile card | Vector bars, inferred top regions/grapes, calibration modal | Reads full JSON but **ignores `explicit`** — VERIFIED |

Phase 2A design explicitly deferred “Remembered-preferences Profile UI” (P11) — VERIFIED in `docs/agent-taste-profile-phase2-design.md`.

### Canonical vs inferred vs legacy

```
profiles.taste_profile.explicit     ← canonical conversational prefs (2A/2B.1)
profiles.taste_profile.vector/prefs ← inferred from ratings
profiles.taste_profile.overrides    ← calibration sliders
sommelier_agent_memory              ← legacy dual-write mirror (non-authoritative)
sommelier_feedback_events           ← evidence + pending confirmations
```

Scoring precedence (API): request > explicit > memory > override/inferred — VERIFIED in `tasteScoring.ts` / Phase 2 tests.

---

## 2. File / component map

### Profile & taste UI

| Path | Role |
|------|------|
| `apps/web/src/App.tsx` | Route `path="/profile"` → `PrivateRoute` → `Layout` → lazy `ProfilePage` |
| `apps/web/src/pages/ProfilePage.tsx` | Active Profile page |
| `apps/web/src/components/TasteProfileCard.tsx` | Taste section + `CalibrationModal` (private) |
| `apps/web/src/components/WeeklySummaryCard.tsx` | Optional weekly snapshot card |
| `apps/web/src/services/tasteProfileService.ts` | `getMyTasteProfile`, calibrate, recompute, reset via `apply_taste_profile_patch` |
| `apps/web/src/services/tasteProfileCalibration.ts` | Slider/display vector helpers |
| `apps/web/src/types/supabase.ts` | Thin web `TasteProfile` / `explicit` types |
| `apps/web/src/components/UserMenu.tsx` | Primary nav link to `/profile` |

### Agent

| Path | Role |
|------|------|
| `apps/web/src/pages/AgentPageWorking.tsx` | Active `/agent` UI |
| `apps/web/src/services/agentService.ts` | `AgentMessage` / `AgentResponse` / `sendAgentMessage` |
| `apps/web/src/services/ensurePersistedConversation.ts` | Persist conversation ID before first recommend |
| `apps/api/src/routes/agent.ts` | JWT → flag → rate limit → credit → orchestrate |
| `apps/api/src/services/cellarAgent/agentRouter.ts` | `classifyAgentRoute` |
| `apps/api/src/services/cellarAgent/orchestrator.ts` | Route switch + response builders |
| `apps/api/src/services/cellarAgent/canonicalTasteWrite.ts` | Preference extract + pending + resolve clients |
| `apps/api/src/services/cellarAgent/tasteConfirmation.ts` | Pending detection + bilingual acks |
| `apps/api/src/services/cellarAgent/tasteProfileTypes.ts` | Canonical API parser/types for `explicit` |
| `apps/api/src/services/cellarAgent/tasteProfileRepo.ts` | `loadUserTasteProfile` |
| `apps/api/src/services/cellarAgent/sommelierTypes.ts` | `AgentRoute`, `ActionContext`, meta |

### Schema / RPCs

| Path | Role |
|------|------|
| `supabase/migrations/20260910_taste_profile_phase2a_atomic.sql` | `apply_taste_evidence_and_canonical`, `apply_taste_profile_patch` |
| `supabase/migrations/20260910_taste_profile_phase2b1_confirmation.sql` | Pending create/resolve (already applied in prod) |

### Dead / legacy (Profile-adjacent)

| Item | Note | Label |
|------|------|-------|
| Theme block on Profile | Commented out in `ProfilePage.tsx` | VERIFIED |
| `AgentPage.tsx`, `AgentPageSimple.tsx` | Not routed; active is `AgentPageWorking` | VERIFIED |
| `TasteProfileCard.onProfileUpdated` | Defined; Profile does not pass it | VERIFIED |
| `saveTasteProfile` full-doc write | Deprecated vs patch RPC | VERIFIED |

---

## 3. UI-pattern inventory

### 3.1 Profile page architecture — VERIFIED

**Route / component:** `/profile` → `ProfilePage` (`App.tsx` ~361–369). No nested Profile routes.

**Hierarchy:**

```
Layout
└── ProfilePage (max-w-2xl mx-auto)
    ├── Header (title/subtitle)
    ├── .card — identity (inline edit expand)
    ├── TasteProfileCard
    ├── WeeklySummaryCard (may return null)
    ├── .card — Account Information
    ├── .card — Billing (feature-gated)
    └── Admin*Backfill (admin-gated)
```

**Section pattern:** Ad hoc stacked cards — no shared `ProfileSection` component. Closest template is `TasteProfileCard`: icon tile + title + subtitle + badge + body + bottom action row (`btn-primary` / `btn-secondary`).

**Visual conventions:** CSS vars (`--bg-surface`, `--border-subtle`, `--shadow-card`, `--radius-lg`, `--text-*`); `.card` utility; responsive grids `sm:grid-cols-2|3`; buttons `.btn*`; mobile card padding shrinks ≤640px.

**States:** Profile waits on `useAuth().profile` + `WineLoader`; Taste card has own loading/empty CTA/toasts; reset uses `window.confirm`; calibration is a local overlay modal.

**Taste card data:** Own `useEffect` → `getMyTasteProfile()`. Shows inferred descriptors/regions/grapes + vector; **does not render `explicit`**.

**Calibration:** `openCalibration()` / `setShowCalibration`; Framer `AnimatePresence`; `role="dialog"` `aria-modal`; overlay click closes; **no Escape handler**; safe-area bottom padding.

**Refresh:** Taste remount-only load; identity save uses `window.location.reload()`; no React Query / shared taste store.

### 3.2 Modal / dialog / drawer / sheet — VERIFIED

**No Radix/Vaul Dialog library** in web deps. Patterns are custom Framer + fixed overlays.

| Pattern | Location | Mobile/PWA | RTL | Focus/Escape | Destructive | Fit for memory |
|---------|----------|------------|-----|--------------|-------------|----------------|
| Calibration overlay | `TasteProfileCard` private modal | safe-area, scroll | inherits `dir` | overlay click; **no Escape**; no focus trap | reset via `confirm()` | **Good** for view/edit body |
| Luxury confirm (inline) | `CellarPage` / `WishlistPage` (`confirmationData` + `isDanger`) | `min-h-[44px]` targets | inherits | overlay cancel; **no Escape** | yes (red) | **Best** for remove confirm |
| Bottom sheets | `AddBottleSheet`, ritual sheets, etc. | PWA-aware slide-up | some flip | inconsistent Escape | rare | Possible mobile list editor; heavier than Profile style |
| `WineDetailsModal` | near-fullscreen | yes | yes | Escape handled | no | Overkill |
| `window.confirm` | Taste reset, avatar, admin | OS | OS | OS | yes | Inconsistent with luxury UX |
| `CompleteProfileModal` | forced onboarding | `100dvh` | inherits | non-dismissible | n/a | Poor fit |

**Recommendation (PROPOSED):** Reuse Calibration-style overlay for management detail; extract or copy Cellar luxury confirm for removals — do **not** invent a new primitive library for MVP.

### 3.3 Chips / pills / tags / rows — VERIFIED

| Pattern | Where | Removable? | Localized? |
|---------|-------|------------|------------|
| Descriptor pills | `TasteProfileCard` | no | hardcoded EN descriptors |
| Favorite region/grape tags | `TasteProfileCard` via `getTopRegions`/`getTopGrapes` | no | raw preference keys |
| Filter pills | `CellarPage` | toggle | i18n filters |
| Mood chips | ritual sheets | toggle | i18n |
| `ChoiceCard` | Tonight flow | select | props |
| Settings rows | `UserMenu` / Profile account | navigate/action | i18n |
| Empty-state card | Taste card empty CTA | — | i18n |
| **Removable preference chip** | **does not exist** | — | — |

`explicit` liked/disliked lists are **not rendered anywhere** in `apps/web` — VERIFIED.

### 3.4 Navigation — VERIFIED

- Flat `/profile` only; entry via `UserMenu` `Link to="/profile"`.
- Query-param precedent: cellar/upgrade consume then `replace` clear — Profile has **no** section reader.
- Agent does **not** deep-link to Profile today.
- Overlays are not history entries; PWA back closes **route**, not modal.

**Smallest navigation design (PROPOSED):**

1. Primary: new **Profile card section** (no new route).
2. Optional later: `/profile?section=sommi-memory` for agent CTA scroll/highlight (matches cellar query precedent).
3. Avoid `/profile/memory` nested route (no Profile nesting precedent).

---

## 4. Profile data flow

```
TasteProfileCard.mount
  → tasteProfileService.getMyTasteProfile()
  → supabase.from('profiles').select('taste_profile').eq('id', auth.uid)
  → cast to web TasteProfile (includes explicit if present in JSON)

Calibration / recompute / reset
  → apply_taste_profile_patch { recompute_inferred | set_overrides | clear_overrides }
  → preserves explicit (SQL) — VERIFIED

Chat remember / forget / confirm
  → POST /api/agent/recommend
  → processPreferenceMessage / processTasteConfirmation
  → create_taste_pending_confirmation / resolve_taste_confirmation
    or apply_taste_evidence_and_canonical
  → optional legacy dual-write (sommelierRepo)
```

| Question | Answer | Label |
|----------|--------|-------|
| Does Profile already receive `explicit`? | Yes in raw JSON if stored; UI ignores it | VERIFIED |
| New fetch needed? | No for read; yes for post-chat refresh strategy | VERIFIED / PROPOSED |
| Supabase vs API for Profile read? | Direct Supabase (JWT) | VERIFIED |
| Stale after chat write? | Until remount / manual reload | VERIFIED |
| Duplicate loaders? | Taste card + agent each load independently; AuthContext does not hold taste | VERIFIED |
| Shared hook? | None today | VERIFIED |

**PROPOSED load strategy:** Keep `getMyTasteProfile` (or thin wrapper that parses `explicit` + `legacy_suppress`). Optionally pass `onProfileUpdated` between cards later. Avoid global state rewrite.

**Type gap (VERIFIED):** Web `TasteProfile.explicit` omits `legacy_suppress`, `source`, `evidence_event_ids`, per-item `updated_at`. API parser keeps suppress/source/labels/confidence but **drops `evidence_event_ids`** at parse time.

---

## 5. Explicit model map

### TypeScript (API canonical) — VERIFIED

From `apps/api/src/services/cellarAgent/tasteProfileTypes.ts`:

- `ExplicitPreferenceValue`: `id`, `confidence`, optional `updated_at`, `source`, `evidence_event_ids`, `label_en`, `label_he`
- `ExplicitBodyPreference`: `value: 'light'|'medium'|'full'`, `confidence`, optional timestamps/source/evidence
- `ExplicitTastePreferences`: `regions_liked|disliked`, `grapes_*`, `styles_*`, `body`, `updated_at`, `legacy_suppress?: { regions?, grapes?, body? }`

**No `provenance` field** — VERIFIED absent.

### Parser behavior — VERIFIED

`parseExplicit` / `parseExplicitTermList`:

- Normalizes ids to lowercase; max 20 items; max id length 64
- Keeps labels, confidence, source, updated_at, legacy_suppress
- **Does not copy `evidence_event_ids` into scoring struct** (even though type declares them)
- Empty lists + null body + no suppress → `explicit` omitted

### Field exposure matrix

| Field | Written 2A | Changed 2B.1 | Scoring | UI-safe | Hide |
|-------|------------|--------------|---------|---------|------|
| regions/grapes liked/disliked | like apply | remove / move_polarity | yes | **yes** (use labels) | raw evidence ids |
| styles_* | schema ready; rare extract | resolve supports style | weak/none | postpone | — |
| body | apply / merge | replace / remove + suppress | yes | **yes** | — |
| label_en / label_he | yes | pending payload | display | **primary labels** | — |
| confidence / updated_at / source | yes | yes | confidence unused in weight | optional | source optional |
| evidence_event_ids | SQL merge | SQL merge | not in parser output | **no** | **internal** |
| legacy_suppress | — | remove paths | yes (tombstone) | **no** | **internal** |

### Realistic v2 example (implementation-shaped) — VERIFIED pattern

```json
{
  "version": 2,
  "vector": { "body": 0.55, "tannin": 0.5, "acidity": 0.5, "oak": 0.45, "sweetness": 0.2, "power": 0.5 },
  "preferences": {
    "reds_bias": 0.4,
    "whites_bias": -0.1,
    "sparkling_bias": 0,
    "style_tags": {},
    "regions": { "Rioja": 0.6 },
    "grapes": { "Tempranillo": 0.5 }
  },
  "overrides": { "vector": { "body": 0.7 } },
  "explicit": {
    "regions_liked": [{
      "id": "rioja",
      "confidence": 0.9,
      "updated_at": "2026-09-10T12:00:00.000Z",
      "source": "chat",
      "label_en": "Rioja",
      "label_he": "ריוחה"
    }],
    "regions_disliked": [],
    "grapes_liked": [],
    "grapes_disliked": [],
    "styles_liked": [],
    "styles_disliked": [],
    "body": {
      "value": "full",
      "confidence": 0.9,
      "updated_at": "2026-09-10T12:00:00.000Z",
      "source": "chat"
    },
    "updated_at": "2026-09-10T12:00:00.000Z",
    "legacy_suppress": { "regions": ["bordeaux"] }
  },
  "confidence": "med",
  "data_points": { "rated_count": 8, "last_rated_at": "2026-08-01T00:00:00.000Z" }
}
```

---

## 6. Management-operation capability table

RPCs available to `authenticated` (JWT): `create_taste_pending_confirmation`, `resolve_taste_confirmation`, `apply_taste_evidence_and_canonical`, `apply_taste_profile_patch`.

| Operation | Already supported | Chat pending required today? | Safe for Profile UI without fake chat UX? | Needs new RPC? |
|-----------|-------------------|------------------------------|-------------------------------------------|----------------|
| Remove liked region | resolve `remove` | yes (user yes/no in chat) | **PROPOSED yes:** create pending + immediate resolve with `event_id` (same pattern as first-time dislike auto-confirm) | No |
| Remove disliked region | resolve `remove` | yes | same | No |
| Remove liked grape | resolve `remove` | yes | same | No |
| Remove disliked grape | resolve `remove` | yes | same | No |
| Replace body | resolve `replace` | yes | same | No |
| Clear body | resolve `remove` + `legacy_suppress.body` | yes | same | No |
| Move liked → disliked | resolve `move_polarity` | yes (or auto for first dislike) | same | No |
| Move disliked → liked | resolve `move_polarity` | yes | same | No |
| Add liked (remember) | `apply_taste_evidence_and_canonical` | no (direct when no contradiction) | possible via RPC; product may keep chat-only for adds | No |
| Edit via `apply_taste_profile_patch` | **unsupported** for explicit | n/a | **Not safe** | Would need new action — postpone |

### Invariants if Profile reuses create→resolve — PROPOSED

| Invariant | How preserved |
|-----------|---------------|
| Evidence for every management action | Pending event row + resolve marks applied |
| No full-document JSON writes | RPC merges under `FOR UPDATE` |
| Legacy tombstone | `legacy_suppress` + existing `patchSommelierMemoryRemovals` (today API-only after resolve — Profile must call equivalent or shared helper) |
| Canonical authoritative | Same resolve SQL as chat |
| Unrelated prefs unchanged | Scoped list/body merge |
| Idempotent | `idempotency_key` on create |

**Caveats (VERIFIED / PROPOSED):**

- Profile should **not** route mutations through `/api/agent/recommend` (credits + cellar required + rate limit).
- Legacy dual-write lives in API `canonicalTasteWrite` today; Profile direct RPC path must either call a small shared helper or accept temporary dual-write gap (**product decision**).
- `conversation_id: null` is valid for user-level pending (old-client path) — VERIFIED. Prefer Profile-scoped idempotency keys; do not invent fake chat messages.

---

## 7. Agent response / routing analysis

### Response shapes — VERIFIED

`AgentResponse` / `AgentMessage` (`agentService.ts`):

- `type?: 'single' | 'bottle_list' | 'buy_suggestions'`
- `message` prose
- optional `recommendation`, `bottles`/`bottleList`, `suggestions`/`buySuggestions`
- `agentMeta` (`routedAction`, `processingMode`, `actionResult`, `eventId`)
- `followUpQuestion` typed but **unused** in `AgentPageWorking`

**No** first-class `chips` / `cta` / navigation action object — VERIFIED.

Persistence: non-greeting messages saved on `sommelier_conversations.messages` JSON; survives refresh; unknown fields ignored by older clients if additive — VERIFIED pattern.

### Smallest memory-summary addition — PROPOSED

1. New deterministic route `memory_summary`.
2. Return `{ type: 'single', message: bilingualSummary, agentMeta: { routedAction: 'memory_summary', processingMode: 'deterministic_action' } }`.
3. Optionally extend payload with additive `memorySummary?: { groups: [...] }` for chips — client renders if present, ignores if old.
4. CTA: client-side button “Manage on Profile” → `navigate('/profile')` or `/profile?section=sommi-memory` (no server URL required for MVP).

### Route table today — VERIFIED

`AgentRoute`: `recommend | conversational | open_bottle | memory_update | similar | tasting_draft | feedback_inline | buy_recommendation | taste_confirmation`

**No `memory_summary`.**

### Classification order (`classifyAgentRoute`) — VERIFIED

1. `open_bottle`  
2. `tasting_draft`  
3. `similar`  
4. **`memory_update`** (remember / forget / prefer / don’t like)  
5. **`taste_confirmation`** (short yes/no)  
6. `feedback_inline`  
7. `buy_recommendation`  
8. `conversational` (aging/info/follow-ups)  
9. `recommend` (default)

### Future `memory_summary` placement — PROPOSED

Insert **before `memory_update`** with exclusive read-only phrase sets that do **not** match remember/forget regexes. Never share yes/no confirmation patterns.

### Mental routing outcomes (current classifier) — VERIFIED against regexes

| Phrase | Likely route today | Intended product class |
|--------|--------------------|------------------------|
| HE: `מה אתה זוכר עליי?` | `recommend` or `conversational` (question starters) — **not** memory_update | **explicit memory summary** |
| HE: `איזה דברים אתה זוכר שאני אוהב?` | likely `recommend`/`conversational` | explicit memory summary |
| HE: `מה הטעם שלי לדעתך?` | `recommend`/`conversational` | **inferred Taste Profile explanation** (distinct) |
| HE: `תזכור שאני אוהב ריוחה` | `memory_update` | memory update |
| HE: `שכח שאני אוהב ריוחה` | `memory_update` | forget / pending |
| HE: `איך אתה מכיר אותי?` | `recommend`/`conversational` | ambiguous: summary vs inferred — **product decision** |
| EN: `What do you remember about me?` | `recommend`/`conversational` | explicit memory summary |
| EN: `What wine preferences do you remember?` | same | explicit memory summary |
| EN: `What is my taste profile?` | same | inferred profile explanation |
| EN: `Remember that I like Rioja` | `memory_update` | memory update |
| EN: `Forget that I like Rioja` | `memory_update` | forget |

Distinction to preserve in UX copy (PROPOSED):

- **Explicit memory** = `taste_profile.explicit` confirmed prefs  
- **Inferred taste** = ratings/vector/calibration  
- Do not conflate in one answer without labeling

---

## 8. Credit-flow analysis

### `/api/agent/recommend` gate order — VERIFIED

1. JWT (`authenticateProduction`)  
2. Feature flag `cellar_agent_enabled`  
3. In-memory rate limit (~30/day/user)  
4. `checkCreditBalance(..., 'sommelier_chat_message')` — 1 credit  
5. Orchestrate (deterministic **or** LLM)  
6. On success: `processAiCreditUsage` same action type  

**There is no route-based exemption.** Deterministic `memory_update`, `taste_confirmation`, `open_bottle`, etc. still cost **1 credit** on success when enforcement is on — VERIFIED.

### Future free operations — PROPOSED

| Action | Safe free approach | Spoof risk |
|--------|--------------------|------------|
| View memory on Profile | Direct Supabase read (already free) | none |
| Remove/edit on Profile | Direct authenticated RPCs (create→resolve) | none if not via `/recommend` |
| Chat `memory_summary` | Prefer **separate endpoint** or pre-credit branch that only allows deterministic `memory_summary` and never LLM | High if client can claim free route then fall through to LLM |

**Anti-spoof requirement (PROPOSED):** Free path must be server-authoritative: classification + handler run **before** credit charge **or** on a dedicated route that cannot invoke OpenAI. Do not trust client `routedAction`.

**MVP credit recommendation:** Profile management = 0 credits. Chat summary = 0 credits only if implemented as hard deterministic free path; otherwise charge like other deterministic chat until billing redesign.

---

## 9. i18n / mobile / accessibility requirements

### i18n — VERIFIED

- Framework: `i18next` + `react-i18next`; files `apps/web/src/i18n/locales/en.json`, `he.json`; single `translation` namespace.
- RTL: `languages.he.dir = 'rtl'`; `Layout` sets `document.documentElement.dir`.
- Profile taste keys: `tasteProfile.*` in locale JSON.
- Agent preference acks: largely **hardcoded HE/EN in API** (`tasteConfirmation.ts`, `canonicalTasteWrite.ts`), not locale files.
- Explicit labels: prefer `label_he` / `label_en` by `i18n.language`; fallback to id title-case — PROPOSED.
- Body display: reuse `bodyLabel()` pattern (light/medium/full ↔ HE strings) — VERIFIED helper in `tasteConfirmation.ts`.
- Descriptor pills on Taste card are English-only today — known gap.

**Files to update later (PROPOSED, do not edit now):** `en.json` / `he.json` (`tasteProfile.*` or new `sommiMemory.*`), optionally agent greeting/CTA strings; API bilingual helpers if chat summary stays server-side.

### Mobile / a11y conventions the feature must follow — VERIFIED + PROPOSED

- Touch targets ≥ ~44px (Cellar confirm pattern)
- Safe-area padding on overlays (CalibrationModal)
- Scrollable max-height sheets/modals on small screens
- `role="dialog"` + `aria-modal` + labelled title for management modal
- Destructive confirm with clear title/message + danger styling (not only `window.confirm`)
- Disabled loading buttons during RPC
- RTL alignment via inherited `dir` (avoid hard-coded left-only layouts)
- PWA: do not rely on system back to dismiss modal; provide explicit close
- Long lists: group by liked/disliked; allow scroll inside modal or page section

---

## 10. Recommended UX based on actual patterns

### A. Placement on Profile — PROPOSED

New card **below** `TasteProfileCard` (or directly under it before Weekly Summary): “What Sommi remembers” / HE equivalent. Distinct from inferred Taste Profile to avoid conflation.

### B. Card vs page vs sheet — PROPOSED

- **Card on Profile** for overview + empty state  
- **Calibration-style modal** for full list / body edit  
- **Cellar luxury confirm** for remove  
- No nested `/profile/memory` for MVP

### C. Components to reuse

| Need | Approach | Bucket |
|------|----------|--------|
| Section chrome | Mirror `TasteProfileCard` header/actions | reuse as-is (pattern) |
| Preference tags | Extend Taste tag visual; add remove × | extend minimally |
| Body edit | Small choice row or 3-option control (not calibration sliders — those are continuous overrides) | new small control |
| Remove confirm | Copy Cellar `confirmationData` / `isDanger` | extend minimally (extract shared later) |
| Empty state | Taste empty CTA pattern | reuse as-is |
| Removable chip primitive | Does not exist | **requires new component** (thin) |
| Shared ConfirmDialog | Does not exist | postpone extract unless touched twice |

### D. Chat response format — PROPOSED

Deterministic bilingual prose summarizing explicit groups + optional structured `memorySummary` for chips + client CTA to Profile. No bottle carousel required.

### E. CTA / navigation — PROPOSED

Button in chat bubble → `navigate('/profile')`. Optional `?section=sommi-memory` if scroll highlight is needed in same phase.

### F. Management ops for MVP — PROPOSED

Ship: view all explicit regions/grapes/body; remove any listed item; replace/clear body.  
Postpone: style/descriptor prefs; polarity flip UI (can use remove + re-add via chat); Profile “add preference” form.

### G. Data loading — PROPOSED

Reuse `getMyTasteProfile`; parse/display `explicit`; refetch after mutations; hide `legacy_suppress` / evidence ids.

### H. Credits — PROPOSED

Profile ops free via RPC. Chat summary free only with anti-spoof deterministic path; else defer chat summary or charge.

### I. Mobile/RTL — PROPOSED

Follow Calibration + Cellar confirm patterns; full RTL via `dir`; safe areas.

### J. Smallest implementation phases — PROPOSED

1. **Read-only Profile card** (explicit lists + empty state)  
2. **Remove + body edit** via create→resolve + luxury confirm + legacy helper  
3. **Chat `memory_summary`** deterministic + CTA (credit policy decided)  
4. Polish: query deep-link, shared ConfirmDialog extract, styles_*

---

## 11. Exact likely files affected (if implemented later)

**Web:** `ProfilePage.tsx`, new `SommiMemoryCard.tsx` (or similar), `TasteProfileCard.tsx` (optional cross-refresh), `types/supabase.ts`, `tasteProfileService.ts`, `AgentPageWorking.tsx`, `agentService.ts`, `i18n/locales/en.json` + `he.json`, possibly shared `ConfirmDialog`.

**API:** `agentRouter.ts`, `sommelierTypes.ts`, `orchestrator.ts`, new small formatter module, tests under `cellarAgent/`.

**DB:** **None required for MVP** if reusing existing 2B.1 RPCs — VERIFIED capability.

---

## 12. Migration / RPC verdict

| Item | Verdict | Label |
|------|---------|-------|
| New migration for MVP read UI | **Not required** | VERIFIED |
| New migration for Profile remove/replace | **Not required** if create→resolve reused | VERIFIED / PROPOSED |
| New RPC | **Not required** for MVP ops listed | PROPOSED |
| Change applied 2B.1 migration | **Forbidden** (already live) | VERIFIED policy |
| Optional later | Profile-scoped `source: 'profile_ui'` metadata only if product wants analytics — still no schema change if stored in existing fields | PROPOSED |

---

## 13. Testing plan

### Existing utilities to reuse — VERIFIED

- `phase2aTaste.test.ts`, `phase2b1Confirmation.test.ts`, `phase2b1ConversationLifecycle.test.ts`
- `tasteProfileCalibration.test.ts`, `tasteProfileService.overrides.test.ts`
- Router tests in `cellarAgent.test.ts`
- SQL static: `phase2aMigration.static.test.ts`

### Minimum layers for this feature — PROPOSED

| Layer | Coverage |
|-------|----------|
| Pure formatter | Explicit → HE/EN summary groups; hide suppress; label fallback |
| Route tests | memory_summary phrases vs memory_update / confirmation / recommend |
| Orchestrator | Deterministic summary; no OpenAI; meta flags |
| UI component | Card empty/full; remove confirm; body edit disabled states |
| Navigation | CTA → `/profile` (+ optional query) |
| Persistence/refresh | After remove, card refetch shows update |
| RPC | Reuse existing 2B.1 tests; add Profile create→resolve helper test |
| Migration static | Only if new SQL (not expected) |

### Gaps today — VERIFIED

- No Profile component tests for Taste card structure  
- No agent structured CTA tests  
- No RTL snapshot suite for Profile  
- Web explicit type lag vs API  

---

## 14. Open product decisions

1. Should chat distinguish **explicit memory** vs **inferred taste profile** in separate answers / routes?  
2. Is Profile remove allowed without chat-style confirmation copy (single luxury confirm enough)?  
3. Chat `memory_summary`: free credit or charge 1 like other deterministic actions?  
4. Should Profile mutations dual-write legacy memory immediately (parity with API)?  
5. Deep-link: plain `/profile` vs `?section=sommi-memory` in v1?  
6. Allow polarity flip on Profile, or only remove?  
7. Show confidence / “from chat” source badges?  
8. Empty state CTA: rate wines, open agent, or calibrate?  
9. Hebrew wine terms: keep `label_he` from extract vs transliterate ids?  
10. Include `styles_*` in UI before extract coverage improves?

---

## 15. Recommended smallest MVP

**In scope**

- Profile card listing explicit liked/disliked regions & grapes + preferred body (localized labels)  
- Empty state when no explicit prefs  
- Remove item with luxury confirm → create pending + resolve confirm (evidence-backed)  
- Replace/clear body with same atomic path  
- Refetch after mutation  
- Hide `legacy_suppress` and evidence ids  

**Out of scope (MVP)**

- Nested Profile route  
- New migration/RPC  
- Chat `memory_summary` (phase 2 of feature) **or** ship read-only prose without free-credit complexity  
- Styles/descriptors UI  
- Shared design-system Dialog extraction  
- Billing/credit redesign beyond not using `/recommend` for Profile edits  

---

# End matter — required summary answers

### A. Executive summary

Sommi already stores confirmed conversational preferences in `profiles.taste_profile.explicit` and mutates them through Phase 2B.1 pending/resolve RPCs, but Profile only shows **inferred** taste + calibration. The smallest coherent product is a new Profile card for explicit memory, reusing Taste card layout and Cellar danger confirms, calling existing RPCs without fake chat. A deterministic chat “what do you remember” route is a natural follow-on but needs careful routing and credit anti-spoof design; it is not required for the Profile MVP.

### B. Best existing components / patterns to reuse

- `TasteProfileCard` section chrome + empty CTA + calibration overlay pattern  
- Cellar/Wishlist luxury confirm (`isDanger`)  
- `.card` / CSS variables / `btn-*`  
- `getMyTasteProfile` + 2B.1 create/resolve RPCs  
- `bodyLabel` / bilingual ack patterns for copy  

### C. Exact recommended Profile placement

New card on `/profile` immediately under `TasteProfileCard` (before `WeeklySummaryCard`). No nested route for MVP.

### D. Exact recommended chat behavior

Later: deterministic `memory_summary` before `memory_update` in classifier; bilingual prose + optional structured groups + client CTA to Profile; never treat “what is my taste profile?” as the same as explicit memory without labeling.

### E. New route / page / RPC / migration?

| Artifact | MVP need |
|----------|----------|
| Nested Profile page | **No** |
| Query deep-link | Optional |
| Agent route type | Only if chat summary ships |
| New RPC | **No** (reuse 2B.1) |
| New migration | **No** |

### F. Credit recommendation

Profile view/edit: **0 credits** via direct JWT RPCs. Do not send Profile mutations through `/recommend`. Chat summary: free only with a server-enforced deterministic non-LLM path; otherwise charge or defer.

### G. Top five implementation risks

1. Conflating inferred Taste Profile UI with explicit memory (user confusion).  
2. Profile RPC path skipping legacy dual-write / tombstone helper → preferences “come back”.  
3. Free `memory_summary` spoofed into unpaid LLM recommend.  
4. Web/API type drift (`legacy_suppress`, evidence ids) causing silent UI bugs.  
5. Stale Profile after chat writes without refetch/remount strategy.

### H. Product decisions still required

See §14 (credit policy, dual-write parity, deep-link, polarity flip, inferred vs explicit chat answers).

### I. Exact proposed MVP scope

Read + remove + body replace/clear on Profile for `explicit` regions/grapes/body, evidence-backed via existing create→resolve, no new migration, no chat summary required in the first ship slice.
