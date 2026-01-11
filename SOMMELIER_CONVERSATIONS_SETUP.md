# Sommelier Conversation Persistence - Setup Guide

## ✅ What Was Implemented

Conversation persistence allows users to:
- **Auto-save** all Sommelier chats
- **Resume** conversations across page refreshes
- **Start new** conversations anytime
- **Review** past recommendations

## 📋 REQUIRED: Run Database Migration

You MUST run the SQL migration to create the `sommelier_conversations` table.

### Option 1: Supabase Dashboard (Recommended)

1. **Go to** [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select** your project
3. **Navigate** to SQL Editor (left sidebar)
4. **Click** "New Query"
5. **Copy** the entire contents of:
   ```
   supabase/migrations/20260112_add_sommelier_conversations.sql
   ```
6. **Paste** into the SQL editor
7. **Click** "Run" (or press `Cmd/Ctrl + Enter`)
8. **Verify**: You should see "Success. No rows returned" ✅

### Option 2: Supabase CLI (Advanced)

```bash
# If you have Supabase CLI installed
npx supabase db push
```

## 🔍 Verify Migration

After running the migration, verify it worked:

```sql
-- Run this in SQL Editor
SELECT * FROM sommelier_conversations LIMIT 1;
```

Expected result: Empty table (no errors) ✅

## 🚀 How It Works

### Auto-Save Flow

1. User sends a message
2. AI responds with recommendation
3. **Conversation automatically saved** to database
4. No manual action required

### Resume Flow

1. User opens Sommelier page
2. **Most recent conversation loads automatically**
3. User can continue where they left off

### New Conversation

1. User clicks **"+ New Conversation"** button in header
2. Messages clear
3. Next message creates a new conversation

## 📊 Database Schema

```sql
sommelier_conversations
├── id (uuid, primary key)
├── user_id (uuid, foreign key to profiles)
├── title (text, nullable)
├── messages (jsonb array)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── last_message_at (timestamptz)
```

### Message Structure (JSONB)

```json
{
  "role": "user" | "assistant",
  "content": "string",
  "timestamp": "ISO string",
  "recommendation": {
    "bottleId": "string",
    "reason": "string",
    "serveTemp": "string (optional)",
    "decant": "string (optional)"
  }
}
```

## 🔒 Security (RLS Policies)

- ✅ Users can ONLY read their own conversations
- ✅ Users can ONLY create/update/delete their own conversations
- ✅ All policies enforce `auth.uid() = user_id`
- ✅ No admin bypass (privacy-focused)

## 🎯 Features Added

### Frontend (`AgentPageWorking.tsx`)

- **Auto-load** most recent conversation on mount
- **Auto-save** after each message exchange
- **New conversation** button in header
- **Silent failures** (don't disrupt UX)

### Service Layer (`sommelierConversationService.ts`)

```typescript
listConversations()        // Get all user's conversations
getConversation(id)        // Get specific conversation
createConversation(...)    // Create new conversation
updateConversation(...)    // Update existing conversation
deleteConversation(id)     // Delete conversation
generateConversationTitle(messages)  // Auto-generate title
```

### Database Types (`supabase.ts`)

```typescript
sommelier_conversations: {
  Row: { ... },
  Insert: { ... },
  Update: { ... }
}
```

## 📱 User Experience

### Before
❌ Conversations lost on page refresh
❌ No history
❌ Start from scratch every time

### After
✅ Conversations persist indefinitely
✅ Auto-resume on page load
✅ Quick access to past recommendations
✅ Clean, seamless experience

## 🧪 Testing Checklist

After running the migration, test:

1. ✅ **Create conversation**: Send first message, verify it saves
2. ✅ **Auto-resume**: Refresh page, verify conversation loads
3. ✅ **Continue**: Send more messages, verify they save
4. ✅ **New conversation**: Click "+", verify messages clear
5. ✅ **RLS**: Create second user, verify they can't see first user's conversations

## 🛠️ Troubleshooting

### Error: "Failed to fetch conversations"

**Solution**: Migration not run or RLS policies blocking access
- Re-run migration SQL
- Check Supabase logs for RLS errors

### Conversations not saving

**Solution**: Check browser console for errors
- Verify user is authenticated
- Check `sommelier_conversations` table exists
- Verify RLS policies are enabled

### Conversations don't load on page refresh

**Solution**: Check if table has data
```sql
SELECT COUNT(*) FROM sommelier_conversations WHERE user_id = 'YOUR_USER_ID';
```

## 🎉 What's Next (Future Enhancements)

Possible future features:
- **Conversations sidebar**: Browse all past chats
- **Search conversations**: Find specific recommendations
- **Share conversations**: Export to PDF or share link
- **Conversation analytics**: Track preferences over time
- **Auto-cleanup**: Delete conversations older than 90 days

## 📝 Notes

- Conversations are **never automatically deleted** (manual delete only)
- Each conversation stores **all messages** (no message limit)
- **JSONB format** allows flexible message structure
- **Indexed by** `last_message_at` for fast sorting

---

**Status**: ✅ CODE DEPLOYED TO PRODUCTION
**Next Step**: 🔧 RUN SQL MIGRATION IN SUPABASE DASHBOARD

