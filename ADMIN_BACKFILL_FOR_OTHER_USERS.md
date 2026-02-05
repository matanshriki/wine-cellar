# Admin Backfill for Other Users - Implementation Guide

## Current Limitation

The current `AdminWineProfileBackfill` component only processes wines for the **logged-in user**. 

```typescript
// Current logic (simplified)
const { data: wines } = await supabase
  .from('wines')
  .select('*')
  .eq('user_id', currentUser.id)  // ❌ Only current user's wines
  .is('wine_profile', null);
```

## What You Need

An **Admin-only** tool that can:
1. List all users in the system
2. Select a target user
3. Run profile backfill for that user's wines
4. Track progress per user

## Implementation Options

### Option 1: Enhanced Admin Component (Recommended)

Add a new section to the admin panel:

**UI:**
```
┌─────────────────────────────────────────┐
│ Admin: User Wine Profile Management     │
├─────────────────────────────────────────┤
│ Select User:                             │
│ [Dropdown with all users]                │
│                                          │
│ User: john@example.com                   │
│ Total wines: 42                          │
│ With profiles: 38                        │
│ Without profiles: 4                      │
│                                          │
│ [Run Backfill for This User]             │
│                                          │
│ Progress: ████████░░ 80% (32/40)         │
└─────────────────────────────────────────┘
```

**Features:**
- Dropdown to select any user
- Shows their profile coverage stats
- "Run Backfill" button
- Progress tracking
- Batch processing (5 wines at a time)

### Option 2: Bulk Backfill for All Users

Add a "Backfill All Users" button that processes everyone:

```
┌─────────────────────────────────────────┐
│ Admin: Bulk Profile Generation           │
├─────────────────────────────────────────┤
│ ⚠️  This will process ALL users          │
│                                          │
│ Total users: 150                         │
│ Total wines without profiles: 487        │
│                                          │
│ Estimated time: ~24 minutes              │
│ Estimated cost: ~$5 (OpenAI)             │
│                                          │
│ [Run Bulk Backfill]                      │
│                                          │
│ Current: Processing user 15/150          │
│ Progress: ████░░░░░░ 40%                 │
└─────────────────────────────────────────┘
```

### Option 3: CLI Script (Quick & Simple)

Create a Node.js script that you run manually:

```bash
# Backfill for specific user
npm run backfill-user -- --user-id=<uuid>

# Backfill for all users
npm run backfill-all

# Backfill for users with < X profiles
npm run backfill-incomplete -- --threshold=10
```

## Recommended Approach: Option 1

I recommend **Option 1** because:
- ✅ You control exactly which users get profiles
- ✅ Easy to use (just select from dropdown)
- ✅ Safe (process one user at a time)
- ✅ Real-time progress tracking
- ✅ Can pause/resume

## Implementation Steps

### Step 1: Create Admin User Management Service

```typescript
// apps/web/src/services/adminUserService.ts
import { supabase } from '../lib/supabase';

export interface UserWithWineStats {
  id: string;
  email: string;
  full_name?: string;
  total_wines: number;
  wines_with_profiles: number;
  wines_without_profiles: number;
}

export async function getAllUsersWithWineStats(): Promise<UserWithWineStats[]> {
  // Requires admin permissions
  const { data, error } = await supabase.rpc('get_users_with_wine_stats');
  
  if (error) throw error;
  return data;
}

export async function getWinesForUser(userId: string) {
  const { data, error } = await supabase
    .from('wines')
    .select('*')
    .eq('user_id', userId)
    .is('wine_profile', null);
  
  if (error) throw error;
  return data;
}
```

### Step 2: Create Database RPC Function

```sql
-- Create RPC function to get users with wine stats
-- (Admin only - uses service role or admin RLS policy)

CREATE OR REPLACE FUNCTION get_users_with_wine_stats()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  total_wines BIGINT,
  wines_with_profiles BIGINT,
  wines_without_profiles BIGINT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    COUNT(w.id) as total_wines,
    COUNT(w.wine_profile) as wines_with_profiles,
    COUNT(w.id) - COUNT(w.wine_profile) as wines_without_profiles
  FROM profiles p
  LEFT JOIN wines w ON w.user_id = p.id
  GROUP BY p.id, p.email, p.full_name
  HAVING COUNT(w.id) > 0
  ORDER BY total_wines DESC;
END;
$$;

-- Grant execute to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION get_users_with_wine_stats() TO authenticated;
```

### Step 3: Create Enhanced Admin Component

```tsx
// apps/web/src/components/AdminUserWineProfileManager.tsx
import React, { useState, useEffect } from 'react';
import { getAllUsersWithWineStats, getWinesForUser } from '../services/adminUserService';
import { generateWineProfile } from '../services/wineProfileService';

export function AdminUserWineProfileManager() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, failed: 0 });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const data = await getAllUsersWithWineStats();
    setUsers(data);
  }

  async function handleRunBackfill() {
    if (!selectedUserId) return;

    setIsProcessing(true);
    const wines = await getWinesForUser(selectedUserId);
    setProgress({ processed: 0, total: wines.length, failed: 0 });

    // Process in batches of 5
    for (let i = 0; i < wines.length; i += 5) {
      const batch = wines.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(wine => generateWineProfile(wine))
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      setProgress(prev => ({
        processed: prev.processed + batch.length,
        total: prev.total,
        failed: prev.failed + failed,
      }));
    }

    setIsProcessing(false);
    // Refresh user stats
    loadUsers();
  }

  return (
    <div className="admin-section">
      <h3>Admin: User Wine Profile Management</h3>
      
      <select onChange={(e) => {
        setSelectedUserId(e.target.value);
        setSelectedUser(users.find(u => u.id === e.target.value));
      }}>
        <option value="">Select a user...</option>
        {users.map(user => (
          <option key={user.id} value={user.id}>
            {user.email} ({user.wines_without_profiles} need profiles)
          </option>
        ))}
      </select>

      {selectedUser && (
        <div className="user-stats">
          <p>Total wines: {selectedUser.total_wines}</p>
          <p>With profiles: {selectedUser.wines_with_profiles}</p>
          <p>Without profiles: {selectedUser.wines_without_profiles}</p>
        </div>
      )}

      <button 
        onClick={handleRunBackfill}
        disabled={!selectedUserId || isProcessing}
      >
        {isProcessing ? 'Processing...' : 'Run Backfill for This User'}
      </button>

      {isProcessing && (
        <div className="progress">
          <p>Progress: {progress.processed} / {progress.total}</p>
          <div className="progress-bar">
            <div style={{ width: `${(progress.processed / progress.total) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Add to Profile Page (Admin Only)

```tsx
// In ProfilePage.tsx
import { AdminUserWineProfileManager } from '../components/AdminUserWineProfileManager';

// Inside the component, after AdminWineProfileBackfill:
{isAdmin && (
  <>
    <AdminWineProfileBackfill />
    <AdminUserWineProfileManager />  {/* New component */}
  </>
)}
```

## Security Considerations

✅ **Admin-only access**
- RPC function checks `is_admin()` before returning data
- UI component only shown if `isAdmin === true`
- Edge Function validates JWT for all profile generation

✅ **Rate limiting**
- Process in batches (5 at a time)
- Add delays between batches if needed
- Track costs (OpenAI API calls)

✅ **Audit logging**
- Log which admin processed which user
- Track in `profile_backfill_jobs` with `admin_user_id` field

⚠️ **Cost control**
- Each wine profile costs ~$0.01-0.02
- 100 wines = ~$1-2
- Set a reasonable limit (e.g., max 100 wines per run)

## Alternative: Quick CLI Script

If you want something **right now** without UI work:

```typescript
// scripts/backfill-user-wines.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Use service role key!
);

async function backfillUserWines(userId: string) {
  console.log(`Fetching wines for user: ${userId}`);
  
  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .eq('user_id', userId)
    .is('wine_profile', null);

  console.log(`Found ${wines.length} wines without profiles`);

  for (const wine of wines) {
    try {
      // Call your generate-wine-profile Edge Function
      const response = await fetch(
        `${process.env.VITE_SUPABASE_URL}/functions/v1/generate-wine-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            wine_id: wine.id,
            name: wine.wine_name,
            producer: wine.producer,
            region: wine.region,
            country: wine.country,
            grapes: wine.grapes,
            color: wine.color,
            vintage: wine.vintage,
          }),
        }
      );

      const result = await response.json();
      console.log(`✅ Generated profile for: ${wine.wine_name}`);
    } catch (error) {
      console.error(`❌ Failed for: ${wine.wine_name}`, error);
    }
  }

  console.log('Backfill complete!');
}

// Usage: node scripts/backfill-user-wines.ts <user-id>
const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node backfill-user-wines.ts <user-id>');
  process.exit(1);
}

backfillUserWines(userId);
```

**Run it:**
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
npx tsx scripts/backfill-user-wines.ts <user-id>
```

## Next Steps

1. **Choose your approach**:
   - Full UI (Option 1) - Best UX, takes ~2-3 hours to implement
   - Bulk backfill (Option 2) - Simpler, but less control
   - CLI script (Option 3) - Quickest (~30 minutes), but manual

2. **Let me know** which approach you prefer and I'll implement it!

3. **Security reminder**: Never expose the service role key to the frontend. Always use RPC functions or Edge Functions with proper admin checks.

---

**Which approach would you like me to implement?**
