# Security Definer View - Fix & Prevention Guide

## 🔒 **Security Issue**

**Alert**: `public.bottles_with_wine_info` view detected with SECURITY DEFINER property

**Risk Level**: Medium to High  
**Impact**: Potential bypass of Row Level Security (RLS) policies

---

## ⚠️ **What Is SECURITY DEFINER?**

In PostgreSQL/Supabase, there are two security modes for views and functions:

### **1. SECURITY INVOKER** (Default, Secure ✅)
- Runs with **current user's permissions**
- Respects RLS policies
- Users only see data they have access to
- **Recommended for most cases**

### **2. SECURITY DEFINER** (Elevated, Risky ⚠️)
- Runs with **creator's permissions**
- Bypasses RLS policies
- Users can access data beyond their permissions
- **Use only when absolutely necessary**

---

## 🎯 **Why This Is a Problem**

With `SECURITY DEFINER` on `bottles_with_wine_info`:

```sql
-- BAD: User can potentially see OTHER users' bottles!
SELECT * FROM bottles_with_wine_info;
-- Returns ALL bottles in database, ignoring RLS
```

Without `SECURITY DEFINER` (SECURITY INVOKER):

```sql
-- GOOD: User only sees THEIR OWN bottles
SELECT * FROM bottles_with_wine_info;
-- RLS enforces: WHERE user_id = auth.uid()
```

---

## ✅ **The Fix**

### **Migration Created**: `20251231_fix_security_definer_view.sql`

**What it does:**
1. Drops the existing view
2. Recreates it with `security_invoker = true`
3. Explicitly relies on RLS policies from underlying tables
4. No privilege escalation possible

**Key changes:**
```sql
-- BEFORE (implicit or explicit SECURITY DEFINER)
CREATE VIEW bottles_with_wine_info AS ...;

-- AFTER (explicit SECURITY INVOKER)
CREATE VIEW bottles_with_wine_info
WITH (security_invoker = true)
AS ...;
```

---

## 🚀 **How to Deploy the Fix**

### **Option 1: Supabase Dashboard** (Recommended for this fix)
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20251231_fix_security_definer_view.sql`
3. Paste and run
4. Refresh Security Advisor (alert should disappear)

### **Option 2: Supabase CLI**
```bash
cd /Users/matanshr/Desktop/Projects/Playground/wine
npx supabase db push
```

### **Option 3: Automatic (via Git deployment)**
- If you have automatic migrations enabled
- Push to main branch
- Supabase will auto-apply the migration

---

## 🛡️ **How to Prevent This in the Future**

### **1. Always Use SECURITY INVOKER for Views**

```sql
-- ✅ GOOD: Explicit security invoker
CREATE VIEW my_view
WITH (security_invoker = true)
AS
SELECT * FROM my_table;
```

```sql
-- ❌ BAD: Security definer (bypasses RLS)
CREATE VIEW my_view
WITH (security_definer = true)
AS
SELECT * FROM my_table;
```

### **2. Never Use SECURITY DEFINER Unless Absolutely Necessary**

Only use `SECURITY DEFINER` when:
- You need to perform administrative tasks
- You're implementing a specific security pattern
- You've added explicit security checks inside the function/view

Even then, prefer:
- Service role client for admin tasks
- Stored procedures with explicit checks

### **3. Always Test RLS Policies**

```sql
-- Test as a specific user
SET LOCAL "request.jwt.claims" = '{"sub":"user-id-here"}';
SELECT * FROM bottles_with_wine_info;
-- Should only return that user's bottles
```

### **4. Review Security Advisor Regularly**

- Check Supabase Dashboard → Database → Advisors
- Address any SECURITY DEFINER warnings
- Keep RLS policies enabled on all tables

### **5. Code Review Checklist**

When creating new views or functions:
- [ ] Is `security_invoker = true` explicitly set?
- [ ] Are RLS policies enabled on underlying tables?
- [ ] Does the view/function respect `user_id = auth.uid()`?
- [ ] Have you tested with different user roles?
- [ ] Is `SECURITY DEFINER` absolutely necessary?

---

## 📚 **Additional Resources**

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Supabase Security Advisor](https://supabase.com/docs/guides/database/database-advisors)

---

## ✅ **Verification**

After applying the migration:

1. **Check Security Advisor**:
   - Go to Supabase Dashboard → Database → Advisors
   - `bottles_with_wine_info` warning should be gone

2. **Test RLS**:
   ```sql
   -- Create test user
   INSERT INTO auth.users (id, email) VALUES 
     ('test-user-1', 'test1@example.com');
   
   -- Test as user 1
   SET LOCAL "request.jwt.claims" = '{"sub":"test-user-1"}';
   SELECT * FROM bottles_with_wine_info;
   -- Should only return user 1's bottles
   ```

3. **Verify in App**:
   - Log in as different users
   - Each should only see their own bottles
   - No cross-user data leakage

---

## 🎉 **Summary**

- ✅ **Issue**: `SECURITY DEFINER` view bypassing RLS
- ✅ **Fix**: Migration to use `SECURITY INVOKER`
- ✅ **Prevention**: Always explicit `security_invoker = true`
- ✅ **Monitoring**: Regular Security Advisor checks

**Status**: Ready to deploy  
**Impact**: Improved security, no user-facing changes  
**Risk**: Low (only affects access control, data unchanged)

