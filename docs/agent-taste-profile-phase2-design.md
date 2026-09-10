# Phase 2 Design — Taste Profile & Agent Memory Unification

**Date:** 2026-09-10 (revised concurrency + Phase 2A product lock)  
**Status:** Design only — no implementation  
**Inputs:** Live code after Phase 0/1; prior audit `docs/agent-taste-profile-memory-audit.md`; concurrency review of client JSONB RMW.

Evidence labels:

| Label | Meaning |
|---|---|
| **VERIFIED** | Confirmed in current repo code / migrations |
| **PROPOSED** | Recommended design choice in this document |
| **DECIDED** | Approved product/engineering decision for Phase 2A |

---

## 0. Goals and non-goals

### Goal

Make `profiles.taste_profile` the **canonical store of stable wine preferences**, while treating chat as a source of **classified evidence**. Over time, `sommelier_agent_memory` stops being a competing long-term palate source — without a hard cutover.

### Non-goals (Phase 2A)

- Embeddings / vector search
- LLM extraction fallback
- Backfill execution
- Remembered-preferences Profile UI
- Deleting agent memory rows
- Automatic promotion of bottle feedback to global taste
- Changing Phase 1 shortlist weights except as required to consume `explicit`
- Writing taste profile from raw LLM JSON
- Client-side full-document `taste_profile` replacement for recompute / calibrate / reset / chat / forget

---

## 1. Current write flows and concurrency gap (VERIFIED)

```
┌──────────────────── Web (user JWT) — TODAY ────────────┐
│  rate → getMyTasteProfile → compute → attach overrides │
│       → UPDATE profiles SET taste_profile = <full JSON>│
│  calibrate → RMW full document replace                 │
│  reset → RMW full document (clear overrides)           │
└────────────────────────────────────────────────────────┘

┌──────────────────── API agent — TODAY ─────────────────┐
│  memory_update / feedback → sommelier_agent_memory     │
│  feedback → sommelier_feedback_events                  │
│  NO writer to profiles.taste_profile                   │
│  recommendCellar loads memory + taste_profile (Phase 1)│
└────────────────────────────────────────────────────────┘
```

### Concurrency gap that invalidates “preserve in JS”

**VERIFIED** race if chat writes `explicit` via RPC while web still does full-document replace:

1. Web recompute **reads** profile (no new explicit yet).  
2. Agent RPC **writes** new `explicit`.  
3. Web recompute **saves** its stale full document.  
4. New `explicit` is **lost**.

Preserving the `explicit` value that JavaScript read earlier does **not** fix this — the DB may have moved on after the read. **PROPOSED:** after Phase 2A foundation, every layer update is an atomic DB-side merge that preserves sibling fields from the **current row**, not from a stale client snapshot.

---

## 2. Statement classification (DECIDED for 2A behavior)

| Class | Scope | Canonical write in 2A? | Evidence? | Examples |
|---|---|---|---|---|
| Explicit remember / store | `stable` | **Yes** (unambiguous remember language only) | Yes | “Remember that I like Rioja”, “תזכור שאני אוהב ריוחה” |
| General like/dislike (no remember) | `stable_candidate` | **No** | Yes only | “I like Rioja”, “אני אוהב ריוחה” |
| Bottle-specific | `bottle` | **Never** in 2A | Yes | “This was too heavy”, “היין הזה היה מושלם” |
| Temporary / session | `session` | **Never** | Optional | “Tonight something light”, “הערב בא לי לבן” |
| Operational | `operational` | **Never** | Optional | “Drank yesterday”, “Save for anniversary” |
| Ambiguous | `ambiguous` | **Never** | Optional | “Interesting”, “Not my favorite” |
| Contradiction vs existing explicit | `stable` pending | **No auto overwrite** | Yes (`status=pending_unsupported` in 2A) | New body vs existing opposite body |
| Forget / retract | `stable` pending | **No auto remove** in 2A | Yes | “Forget Rioja”, “I don’t like Rioja anymore” |

---

## 3. Corrected explicit JSON model (PROPOSED)

No global `explicit.source`. Every preference value carries its own provenance.

```ts
/** Shared value object for region / grape / style / descriptor terms */
interface ExplicitPreferenceValue {
  id: string;                 // language-independent slug, max 64
  confidence: number;         // 0..1
  updated_at: string;         // ISO
  source: 'chat' | 'backfill' | 'import';
  evidence_event_ids: string[]; // capped; newest first after dedupe
  label_en?: string;
  label_he?: string;
}

interface ExplicitBodyPreference {
  value: 'light' | 'medium' | 'full';
  confidence: number;
  updated_at: string;
  source: 'chat' | 'backfill' | 'import';
  evidence_event_ids: string[];
}

interface ExplicitTastePreferences {
  regions_liked: ExplicitPreferenceValue[];
  regions_disliked: ExplicitPreferenceValue[];
  grapes_liked: ExplicitPreferenceValue[];
  grapes_disliked: ExplicitPreferenceValue[];
  styles_liked: ExplicitPreferenceValue[];
  styles_disliked: ExplicitPreferenceValue[];
  body: ExplicitBodyPreference | null;
  updated_at: string; // max(child updated_at) for convenience
}

interface TasteProfileV2 {
  version: 2;
  vector: TasteProfileVector;
  preferences: TasteProfilePreferences;
  overrides?: { vector?: Partial<TasteProfileVector> };
  explicit?: ExplicitTastePreferences;
  confidence: 'low' | 'med' | 'high';
  data_points: { rated_count: number; last_rated_at: string | null };
}
```

### Caps and conflict rules (PROPOSED)

| Rule | Value |
|---|---|
| Max terms per list (`regions_liked`, etc.) | **20** |
| Max `id` / label length | **64** / **80** |
| Max `evidence_event_ids` retained per preference | **10** (drop oldest) |
| Dedup within a list | by `id` (case-normalized); keep higher confidence, merge evidence ids |
| Like vs dislike same `id` | **Disliked wins for scoring**; remove from liked on confirmed dislike (2B+); in 2A remember-like on already-disliked → pending unsupported |
| Body replace | Only on unambiguous remember of body; contradiction → no overwrite (Option B) |
| Superseded values | Remain **only in evidence history**, not in `explicit` arrays |

**Example**

```json
{
  "version": 2,
  "vector": { "body": 0.62, "tannin": 0.55, "acidity": 0.5, "oak": 0.4, "sweetness": 0.15, "power": 0.58 },
  "preferences": { "reds_bias": 0.4, "whites_bias": -0.1, "sparkling_bias": 0, "style_tags": {}, "regions": { "Bordeaux": 0.7 }, "grapes": {} },
  "overrides": { "vector": { "body": 0.8 } },
  "explicit": {
    "regions_liked": [{
      "id": "rioja",
      "confidence": 0.9,
      "updated_at": "2026-09-10T17:00:00.000Z",
      "source": "chat",
      "evidence_event_ids": ["11111111-1111-1111-1111-111111111111"],
      "label_en": "Rioja",
      "label_he": "ריוחה"
    }],
    "regions_disliked": [],
    "grapes_liked": [],
    "grapes_disliked": [],
    "styles_liked": [],
    "styles_disliked": [],
    "body": null,
    "updated_at": "2026-09-10T17:00:00.000Z"
  },
  "confidence": "med",
  "data_points": { "rated_count": 12, "last_rated_at": "2026-09-01T00:00:00.000Z" }
}
```

---

## 4. Atomic writes for every profile layer (PROPOSED)

### Architecture choice: **one action-based SECURITY INVOKER RPC** + thin typed wrappers

Prefer a **single auditable entrypoint** over five near-duplicate functions:

```text
public.apply_taste_profile_patch(p_action text, p_payload jsonb)
  RETURNS jsonb
```

Actions (allowlist):

| Action | Updates | Preserves from **current DB row** |
|---|---|---|
| `recompute_inferred` | `vector`, `preferences`, `confidence`, `data_points`; sync versions | `overrides`, `explicit` |
| `set_overrides` | `overrides.vector` (replace with payload vector) | inferred fields, `explicit` |
| `clear_overrides` | remove `overrides` key | inferred fields, `explicit` |
| `merge_explicit` | targeted explicit dimension/value merge | inferred fields, `overrides` |
| `noop_read` | none (optional) | — |

Forget/retract **canonical removal** is **not** an applied action in 2A (Option B). A future `retract_explicit` action is reserved for 2B+.

**Why not only optimistic concurrency?** Useful as a secondary guard (`taste_profile_updated_at` match), but **insufficient alone**: web would still need a merge strategy. Atomic server merge is the primary fix.

**Why not five separate RPCs?** Acceptable, but one allowlisted action RPC is smaller to audit/grant. Typed SQL helpers inside the same migration keep clarity.

### Semantics by layer

#### A. Rating-derived recompute — `recompute_inferred`

Input payload (from web after local compute only — **no** full document):

```json
{
  "vector": { "...": 0.5 },
  "preferences": { "...": {} },
  "confidence": "med",
  "data_points": { "rated_count": 12, "last_rated_at": "..." }
}
```

DB algorithm:

1. `SELECT taste_profile, taste_profile_version FOR UPDATE` on `profiles` where `id = auth.uid()`.
2. If document version is unknown future (`> 2`): **abort** with `unsupported_version` (do not overwrite).
3. Build next doc:
   - set `vector` / `preferences` / `confidence` / `data_points` from payload
   - copy `overrides` from **DB** (not client)
   - copy `explicit` from **DB** (not client)
   - if DB had `explicit` or version≥2 → `version = 2`; else `version = 1` unless creating first profile with only inferred → `1`
   - if DB `explicit` present → **never downgrade** to v1
4. `UPDATE` JSON + `taste_profile_version = next.version` + `taste_profile_updated_at = now()`.

#### B. Calibration — `set_overrides`

Payload: `{ "vector": { "body": 0.8, ... } }`  
Merge: `overrides := jsonb_build_object('vector', payload.vector)`  
Preserve inferred + explicit from DB. Preserve/set version: if explicit exists keep 2.

#### C. Calibration Reset — `clear_overrides`

Remove `overrides` key only. **DECIDED:** does **not** clear `explicit`. Preserve version 2 if explicit remains.

#### D. Canonical chat write — `merge_explicit` (via transactional apply RPC below)

Targeted dimension/value only. Preserve inferred + overrides from DB.

#### E. Explicit forget/retract — Phase 2A

**No canonical mutation.** Evidence only + user-facing “not yet supported” (Option B).

### Web migration requirement (PROPOSED)

After 2A foundation ships:

| Today | After |
|---|---|
| `saveTasteProfile(full)` | **Deprecated** for recompute/calibrate/reset |
| `recomputeMyTasteProfile` | compute inferred locally → `rpc('apply_taste_profile_patch', { action: 'recompute_inferred', payload })` |
| `applyCalibration` | `set_overrides` RPC |
| `resetTasteProfile` | `clear_overrides` RPC (**not** full recompute-with-wipe of explicit) |
| Optional: still call `recompute_inferred` after clear if product wants fresh inferred bars | separate call |

`resetTasteProfile` today = `recompute({ preserveOverrides:false })` which rebuilds inferred and clears overrides. **DECIDED product:** Reset clears **overrides only**. Implementation should: `clear_overrides` then optionally `recompute_inferred` if ratings exist — never clear `explicit`.

---

## 5. Evidence + canonical application: idempotent transaction (PROPOSED)

### Preferred: one transactional SECURITY INVOKER RPC

```text
public.apply_taste_evidence_and_canonical(p_payload jsonb)
  RETURNS jsonb
```

Runs in **one transaction**:

1. `v_uid := auth.uid()`; reject if null.  
2. Validate allowlisted payload (scope, polarity, dimension, value_id, idempotency_key, …).  
3. **Insert or find** evidence by `(user_id, idempotency_key)` unique index.  
4. If existing row already `applied_to_canonical = true` → return success metadata (**idempotent replay**); do not re-merge.  
5. If existing row `applied_to_canonical = false` and action is auto-apply remember → **retry apply** (recoverable).  
6. If policy says no canonical write (general like, bottle, session, ambiguous, contradiction, forget) → insert/update evidence only; return.  
7. If auto-apply remember: call internal merge of `explicit` on `profiles` (`FOR UPDATE`), set evidence `applied_to_canonical = true`, `status = 'active'`.  
8. Return `{ event_id, applied, profile_version, explicit_updated_at }` — **not** full taste profile.

Legacy `sommelier_agent_memory` dual-write stays **outside** this transaction (see §5.2).

### Failure matrix

| Case | Behavior |
|---|---|
| Evidence insert succeeds, canonical merge throws | **Same transaction** → both roll back |
| Canonical succeeds, client loses response, retries same key | Unique key hits existing applied row → **no-op success** |
| Concurrent duplicates same key | One insert wins; loser finds row; only one apply |
| Evidence exists, `applied_to_canonical=false` | Retry apply once (recover stuck row) |
| Memory dual-write fails after canonical success | Log warning; **do not** roll back canonical; queue/retry memory |
| Memory succeeds, canonical fails | Transaction aborted ⇒ evidence not committed; memory write should run **after** canonical success only |
| Kill switch OFF | Evidence may still insert with `applied_to_canonical=false`; no profile mutate |

### Authoritative store

| Store | Role in 2A |
|---|---|
| `profiles.taste_profile.explicit` | **Authoritative** stable conversational prefs |
| `sommelier_feedback_events` | Authoritative **evidence** log |
| `sommelier_agent_memory` | Legacy dual-write mirror; **non-authoritative** |

**DECIDED:** Continue dual-writing legacy memory **after** successful canonical apply. Canonical success must **not** be rolled back if memory fails.

### Idempotency key (PROPOSED)

```
sha256(user_id + "|" + conversation_turn_id_or_message_hash + "|" + extraction_version + "|" + dimension + "|" + value_id + "|" + polarity)
```

Agent must pass a stable turn id when available; else hash of normalized message text + route.

---

## 6. Finalized Phase 2A product decisions (DECIDED)

| # | Decision |
|---|---|
| P1 | Profile **Reset** clears **calibration overrides only**; does **not** clear conversational `explicit` |
| P2 | Only **unambiguous remember/store** language auto-writes canonical taste (“Remember…”, “תזכור…”, equivalents) |
| P3 | General “I like X” / “אני אוהב X” → **evidence only** |
| P4 | Bottle-specific feedback → **evidence only**; never stable global in 2A |
| P5 | Temporary/session and operational → **never** update stable taste |
| P6 | Ambiguous → **never** update stable taste |
| P7 | Contradictions → **no automatic overwrite**; evidence + no canonical change in 2A |
| P8 | Forget/retract → **confirmation required**; in 2A **no canonical removal** (see §7 Option B) |
| P9 | **No** LLM extraction fallback in 2A |
| P10 | **No** backfill execution in 2A |
| P11 | **No** remembered-preferences Profile UI in 2A |
| P12 | Dual-write legacy agent memory after successful canonical write |
| P13 | Canonical is authoritative if legacy dual-write fails |
| P14 | `CANONICAL_TASTE_WRITES` default **OFF** when unset: `undefined→OFF`; `0/false/off→OFF`; only `1/true/on→ON` |

---

## 7. Confirmation scope for Phase 2A (DECIDED — Option B)

Contradiction and forget/retract **require** confirmation in the product sense, but Phase 2A does **not** implement pending-confirm tokens.

**Option B (selected):**

- Detect contradiction / forget / retract.  
- Write evidence with `status = 'pending_unsupported'` (or `recorded_no_apply`).  
- Make **no** canonical change.  
- Agent replies that managing this preference change is **not yet supported** (localized EN/HE).

**Option A** (deferred to 2B+): minimal yes/no confirmation in conversation state.

Rationale: existing conversation-state is recommendation-centric; a reliable confirm token store is not “genuinely small.” Option B is safer for 2A.

---

## 8. Version correctness (PROPOSED)

| Rule | Behavior |
|---|---|
| v1 readers | Continue: parser accepts v1; missing `explicit` OK |
| Write v2 when | `explicit` is non-empty **or** DB already v2 |
| Recompute | Must **never** downgrade v2→v1; copy `explicit` from DB row |
| Sync | `taste_profile.version` === `profiles.taste_profile_version` on every patch RPC |
| Calibration | Preserve existing document version; if explicit present keep 2 |
| Reset (clear overrides) | If `explicit` remains → stay on **v2** |
| Unknown future version (`>2`) | Patch RPCs **refuse** with `unsupported_version`; web must not replace with v1 |
| Old web client | Must call patch RPCs; if it still has legacy `saveTasteProfile`, gate behind feature flag / remove in same PR as RPC adoption |

---

## 9. RPC security (PROPOSED)

Applies to `apply_taste_profile_patch` and `apply_taste_evidence_and_canonical`.

| Requirement | Spec |
|---|---|
| Security | `SECURITY INVOKER` |
| Identity | `auth.uid()` only — **do not accept `user_id` argument** |
| `search_path` | `SET search_path = public` |
| Input | Allowlisted `action` / keys only; reject unknown JSON keys |
| Sizes | payload ≤ 16KB; arrays ≤ 20; strings ≤ 64–4000 as appropriate |
| SQL | No dynamic SQL |
| Grants | `GRANT EXECUTE` to `authenticated`; `REVOKE` from `PUBLIC` / `anon` |
| Null profile | `recompute_inferred` / first calibrate: initialize minimal v1/v2 document for `auth.uid()` row; if **profile row missing**, return `profile_missing` (do not insert profiles — signup trigger owns row) |
| Unsupported version | Abort; no write |
| RLS | Relies on INVOKER + `WHERE id = auth.uid()` |

Match existing Phase 0 patterns (`open_bottles`, etc.): `v_uid uuid := auth.uid()`.

---

## 10. Extraction (Phase 2A) — PROPOSED

**Deterministic HE/EN rules only** (no LLM).

Auto-canonical only when:

- Remember/store verbs: remember / don’t forget / תזכור / אל תשכח / …  
- Plus allowlisted region/grape/body target  
- No “tonight/הערב” session markers  
- No bottle deixis  
- No negation of the liked target  
- No contradiction with existing explicit (else Option B path)

Everything else → evidence only or ignore.

---

## 11. Scoring (Phase 1+) — PROPOSED

Precedence:

```
current request
  > explicit (taste_profile.explicit)
  > legacy agent memory (dual-read while present)
  > calibration overrides / effective body
  > rating-derived preferences
```

Anti-double-count across explicit ∩ memory ∩ taste on the same dimension (same as Phase 1 memory vs taste).

---

## 12. Revised Phase 2A implementation boundary

### Slice order (smallest correct ship)

| Step | Deliverable | Writes ON? |
|---|---|---|
| **1. Migration / RPC foundation** | Feedback evidence columns + idempotency unique index; `apply_taste_profile_patch`; `apply_taste_evidence_and_canonical`; grants | N/A |
| **2. Web atomic migration** | Recompute / calibrate / reset call patch RPC; remove full-document replace from those paths; Reset = clear overrides only (+ optional recompute_inferred) | Uses patch RPC always |
| **3. API extraction / evidence / canonical** | HE+EN remember rules; evidence insert; canonical apply behind kill switch | Default **OFF** |
| **4. Phase 1 scoring consumes `explicit`** | Parser v2; `tasteScoring` reads explicit | Read path always safe |
| **5. Tests** | Unit + concurrent RPC tests | — |
| **6. Deploy** | Ship with `CANONICAL_TASTE_WRITES` unset/OFF; validate patch RPC in prod via web calibrate/recompute; then enable writes | OFF → ON |

### Exact migrations / RPCs proposed

1. `YYYYMMDD_taste_profile_atomic_patches.sql`  
   - `apply_taste_profile_patch(p_action text, p_payload jsonb)`  
2. `YYYYMMDD_taste_evidence_canonical.sql`  
   - columns on `sommelier_feedback_events`  
   - unique `(user_id, idempotency_key)` where key not null  
   - `apply_taste_evidence_and_canonical(p_payload jsonb)`  

(Can be one migration file if preferred.)

### Exact files affected (PROPOSED)

| Area | Files |
|---|---|
| DB | new supabase migration(s) |
| Web | `tasteProfileService.ts`, `tasteProfileOverrides.ts` (or retire client preserve in favor of RPC), `TasteProfileCard.tsx` (reset semantics copy), types |
| API | `preferenceInference.ts` (+ HE), `sommelierActions.ts`, `sommelierRepo.ts`, `orchestrator.ts`, `tasteProfileTypes.ts`, `tasteScoring.ts`, new `canonicalTasteApply.ts` |
| Config | API env `CANONICAL_TASTE_WRITES` |
| Tests | web RPC client mocks; API extract/apply; **concurrent** SQL/integration tests |
| Docs | this file |

---

## 13. Revised tests (including concurrency)

| ID | Test |
|---|---|
| C1 | Recompute RPC preserves DB `explicit` written after client compute started (simulated with two connections / sequential FOR UPDATE) |
| C2 | Calibrate RPC does not clobber `explicit` |
| C3 | Clear overrides RPC preserves `explicit` and v2 |
| C4 | Concurrent `merge_explicit` + `recompute_inferred` — both commit; final row has new inferred **and** explicit |
| C5 | Evidence+canonical RPC idempotent on retry |
| C6 | Evidence+canonical rolls back both on merge failure |
| C7 | Stuck `applied_to_canonical=false` recovers on retry |
| C8 | Memory dual-write failure after canonical — canonical remains |
| T1–T6 | HE/EN remember; general like evidence-only; bottle/session/ambiguous no canonical |
| T7 | Contradiction → evidence pending_unsupported, no overwrite |
| T8 | Forget → evidence only, no removal |
| T9 | Kill switch OFF → no canonical mutate |
| T10 | Unsupported document version refused |
| T11 | Scoring boost from explicit Rioja |
| T12 | v2 never downgraded by recompute |

---

## 14. Rollout / rollback

1. Deploy migration + RPCs + web patch callers + API code with writes **OFF**.  
2. Verify calibrate / recompute / reset in production use RPCs (no lost overrides/explicit in staging race tests).  
3. Enable `CANONICAL_TASTE_WRITES=1` on API.  
4. Monitor evidence/apply metrics; kill switch OFF rolls back **writes only**; web RPCs stay (still correct).  

Rollback of migration: leave RPCs in place (harmless); disable grants if needed. Do not delete evidence rows.

---

## 15. Backfill (still deferred)

Unchanged intent from prior design; **not in 2A**. When executed later, must use `merge_explicit` / evidence RPC with `source=backfill`, not full-document replace.

---

## End report

### A. Corrected concurrency architecture

All profile layer updates go through **SECURITY INVOKER patch RPCs** that `SELECT … FOR UPDATE` the caller’s row and merge only the targeted fields, always preserving sibling fields from the **database**, never from a stale client snapshot. Client full-document `taste_profile` replacement is removed from recompute / calibrate / reset / chat paths.

### B. Transaction / idempotency design

`apply_taste_evidence_and_canonical` inserts/finds evidence by idempotency key and applies canonical delta **once** in the same transaction, marking `applied_to_canonical`. Retries are no-ops. Legacy memory dual-write is **after** commit; failures are logged and retried; canonical is not rolled back.

### C. Corrected explicit JSON model

Per-value provenance (`source`, `evidence_event_ids`, confidence, timestamps); no global `explicit.source`; shared `ExplicitPreferenceValue` / `ExplicitBodyPreference`; caps 20 terms / 10 evidence ids; superseded values live in evidence only.

### D. Finalized product decisions

Remember-only auto-write; general likes / bottle / session / operational / ambiguous = evidence or ignore; Reset clears overrides only; dual-write memory after canonical; kill switch defaults **OFF**; no LLM, no backfill, no Profile explicit UI in 2A.

### E. Confirmation behavior for Phase 2A

**Option B:** record contradiction/forget evidence; no canonical change; reply that management is not yet supported. Confirm tokens deferred.

### F. Exact migrations / RPCs proposed

- `apply_taste_profile_patch(action, payload)` — recompute_inferred | set_overrides | clear_overrides | merge_explicit  
- `apply_taste_evidence_and_canonical(payload)` — evidence + optional canonical apply  
- Feedback columns + unique idempotency index  

### G. Exact files affected

Migration(s); `tasteProfileService.ts` (+ card reset copy); API inference/actions/repo/orchestrator/taste types/scoring; env kill switch; tests.

### H. Revised tests

Include **real concurrent-write** tests (C1–C4) plus idempotency/recovery (C5–C8) and product-path tests (T1–T12).

### I. Rollout / rollback

Deploy foundation with writes OFF → validate web RPCs → enable `CANONICAL_TASTE_WRITES` → kill switch OFF to stop canonical chat writes without reverting atomic web patches.

### J. Safe to implement?

**Yes — the revised design is safe to implement for Phase 2A**, provided implementation follows atomic RPCs first (steps 1–2) before enabling canonical chat writes (step 6). Do not ship chat canonical writes while web still full-document replaces `taste_profile`.

---

*End of revised Phase 2 design. Do not implement until explicitly kicked off.*
