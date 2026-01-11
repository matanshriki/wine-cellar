-- Create sommelier_conversations table
-- Stores chat history between users and the Cellar Sommelier AI

CREATE TABLE IF NOT EXISTS sommelier_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Conversation metadata
  title TEXT, -- Optional: Auto-generated or user-defined title
  
  -- Messages stored as JSONB array
  -- Structure: [{ role: 'user' | 'assistant', content: string, timestamp: string, recommendation?: {...} }]
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance (IF NOT EXISTS to make migration idempotent)
CREATE INDEX IF NOT EXISTS idx_sommelier_conversations_user_id ON sommelier_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_sommelier_conversations_last_message ON sommelier_conversations(user_id, last_message_at DESC);

-- RLS (Row Level Security) Policies
ALTER TABLE sommelier_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Users can read own conversations" ON sommelier_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON sommelier_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON sommelier_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON sommelier_conversations;

-- Users can only read their own conversations
CREATE POLICY "Users can read own conversations"
  ON sommelier_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON sommelier_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON sommelier_conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON sommelier_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sommelier_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_sommelier_conversations_updated_at ON sommelier_conversations;

CREATE TRIGGER trigger_update_sommelier_conversations_updated_at
  BEFORE UPDATE ON sommelier_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_sommelier_conversations_updated_at();

-- Add comment for documentation
COMMENT ON TABLE sommelier_conversations IS 'Stores chat conversations between users and the Cellar Sommelier AI assistant';
COMMENT ON COLUMN sommelier_conversations.messages IS 'JSONB array of message objects with role, content, timestamp, and optional recommendation';
COMMENT ON COLUMN sommelier_conversations.last_message_at IS 'Timestamp of the last message in this conversation, used for sorting';

