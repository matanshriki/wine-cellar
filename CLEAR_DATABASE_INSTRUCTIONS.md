# 🗑️ Clear Database - Instructions

## ⚠️ **WARNING**

This will **permanently delete** all wine, bottle, history, and recommendation data.  
**Users and profiles will be preserved.**  
**This action cannot be undone!**

---

## 📋 **What Will Be Deleted**

- ❌ **All wines** (wine catalog)
- ❌ **All bottles** (your cellar inventory)
- ❌ **All consumption history** (opened bottles)
- ❌ **All recommendations** (recommendation runs)
- ❌ **All label images** (optional)

## ✅ **What Will Be Preserved**

- ✅ **Users** (`auth.users` table)
- ✅ **Profiles** (`profiles` table)
- ✅ **Avatar images** (user profile pictures)
- ✅ **Database schema** (tables, RLS policies, triggers)

---

## 🚀 **How to Run**

### **Method 1: Supabase SQL Editor (Recommended)**

1. **Open Supabase SQL Editor**:
   ```
   https://supabase.com/dashboard/project/pktelrzyllbwrmcfgocx/editor
   ```

2. **Copy the SQL** from `clear_database.sql` (located in this folder)

3. **Paste into SQL Editor**

4. **Review the commands** carefully

5. **Click "Run"** to execute

6. **Verify** the result:
   - You should see: `Success. No rows returned`
   - Or: `4 statements executed successfully`

### **Method 2: Supabase CLI**

If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd /Users/matanshr/Desktop/Projects/Playground/wine

# Run the SQL file
supabase db execute --file clear_database.sql
```

---

## 🔍 **Verification**

After running, **verify the data is cleared**:

### **1. Check Row Counts**

Run this query in SQL Editor:

```sql
SELECT 
  (SELECT COUNT(*) FROM public.wines) as wines_count,
  (SELECT COUNT(*) FROM public.bottles) as bottles_count,
  (SELECT COUNT(*) FROM public.consumption_history) as history_count,
  (SELECT COUNT(*) FROM public.recommendation_runs) as recommendations_count,
  (SELECT COUNT(*) FROM public.profiles) as profiles_count;
```

**Expected result**:
```
wines_count: 0
bottles_count: 0
history_count: 0
recommendations_count: 0
profiles_count: [your user count] ✅ (should NOT be 0)
```

### **2. Check in the App**

1. Go to https://wine-cellar-brain.vercel.app/
2. Log in
3. Go to **Cellar** page → Should show empty state
4. Go to **History** page → Should show "No bottles opened yet"
5. Profile should still work (avatar, name, etc.)

---

## 🔄 **Order of Deletion**

The SQL script deletes in this specific order to respect foreign key constraints:

1. **consumption_history** (references bottles)
2. **recommendation_runs** (references bottles)
3. **bottles** (references wines)
4. **wines** (no dependencies)

**Important**: Do NOT change the order!

---

## 🖼️ **Optional: Clear Label Images**

The SQL script **does NOT** delete label images by default.

If you also want to clear the `labels` storage bucket:

```sql
-- List all label images
SELECT * FROM storage.objects WHERE bucket_id = 'labels';

-- Delete all label images
DELETE FROM storage.objects WHERE bucket_id = 'labels';
```

**Note**: Avatar images (`avatars` bucket) are **NOT** affected.

---

## ⚙️ **Optional: Reset Auto-Increment IDs**

If you want new entries to start from ID 1 again:

```sql
ALTER SEQUENCE IF EXISTS wines_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bottles_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS consumption_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS recommendation_runs_id_seq RESTART WITH 1;
```

---

## 🔐 **Safety Notes**

### **This Operation**:
- ✅ **Respects RLS** - Only deletes data you own
- ✅ **Preserves users** - No auth data is touched
- ✅ **Preserves schema** - Tables and policies remain
- ❌ **Cannot be undone** - Make backups if needed

### **Before Running**:
- [ ] Backup your data if needed (export CSV)
- [ ] Understand this is permanent
- [ ] Verify you're in the correct database
- [ ] Confirm you want to delete ALL wine data

---

## 🆘 **Troubleshooting**

### **Error: "permission denied"**

**Cause**: Not using admin/service role key  
**Fix**: Run in Supabase SQL Editor (has admin permissions)

### **Error: "foreign key constraint"**

**Cause**: Deletion order is wrong  
**Fix**: Use the provided SQL (correct order already)

### **Error: "relation does not exist"**

**Cause**: Table name is wrong or doesn't exist  
**Fix**: Check table names in Supabase Table Editor

### **Profiles are deleted too**

**Cause**: You ran `DELETE FROM profiles;` (not in the provided SQL)  
**Fix**: The provided SQL does NOT delete profiles - they're safe

---

## 📊 **What Happens in the App**

After clearing the database:

### **Cellar Page**
- Shows empty state: "Your cellar is empty"
- "Add Bottle" and "Import CSV" buttons still work

### **History Page**
- Shows: "No bottles opened yet"
- Stats show all zeros

### **Recommendations Page**
- Will work but show: "No bottles in your cellar"

### **Profile Page**
- ✅ **Still works** - Your profile is intact
- ✅ Avatar still shows
- ✅ Name and email still there

---

## ✅ **After Clearing**

Your database is now **clean and empty**, ready for:
- Fresh start
- New data import
- Testing
- Demo purposes

All users can log in and start adding bottles from scratch! 🍷

---

## 🔙 **Undo?**

**There is NO undo!**

If you need your data back:
- Restore from a backup (if you made one)
- Re-import from CSV
- Manually re-add bottles

**Recommendation**: Export to CSV before clearing if you might need the data later.

---

## 📞 **Need Help?**

If something goes wrong:
1. Check Supabase logs (SQL Editor → History)
2. Check app console for errors
3. Verify RLS policies are still enabled
4. Test login (should still work)

**Users and profiles are safe!** Only wine data is deleted. ✅



