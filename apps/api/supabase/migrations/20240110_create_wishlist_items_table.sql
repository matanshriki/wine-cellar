-- Migration: Create wishlist_items table for production storage
-- Date: 2024-01-10
-- Description: Replaces localStorage with proper database storage for wishlist items

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS wishlist_items (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Wine information (extracted from label or manually entered)
  producer TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  vintage INTEGER,
  region TEXT,
  country TEXT,
  grapes TEXT, -- Comma-separated grape varieties
  color TEXT CHECK (color IN ('red', 'white', 'rose', 'sparkling')),
  
  -- Wishlist-specific fields
  restaurant_name TEXT, -- Where the user tried this wine
  note TEXT, -- Personal notes about why they want to buy it
  
  -- Media
  image_url TEXT, -- Label photo URL in Supabase Storage
  
  -- External links
  vivino_url TEXT,
  
  -- Metadata
  source TEXT DEFAULT 'wishlist-photo', -- How this item was added: 'wishlist-photo', 'manual', etc.
  
  -- Confidence scores from AI extraction (stored as JSONB for flexibility)
  extraction_confidence JSONB,
  
  -- Constraints
  CONSTRAINT valid_vintage CHECK (vintage IS NULL OR (vintage >= 1900 AND vintage <= 2099))
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_items_created_at ON wishlist_items(created_at DESC);
CREATE INDEX idx_wishlist_items_user_created ON wishlist_items(user_id, created_at DESC);

-- Step 3: Enable Row Level Security
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies (users can only access their own wishlist items)

-- Policy: Users can view their own wishlist items
CREATE POLICY "Users can view their own wishlist items"
ON wishlist_items
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own wishlist items
CREATE POLICY "Users can insert their own wishlist items"
ON wishlist_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own wishlist items
CREATE POLICY "Users can update their own wishlist items"
ON wishlist_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own wishlist items
CREATE POLICY "Users can delete their own wishlist items"
ON wishlist_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Step 5: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_wishlist_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wishlist_items_updated_at
BEFORE UPDATE ON wishlist_items
FOR EACH ROW
EXECUTE FUNCTION update_wishlist_items_updated_at();

-- Step 6: Add helpful comments
COMMENT ON TABLE wishlist_items IS 
'Stores wines that users want to purchase. Replaces localStorage-based storage for production.';

COMMENT ON COLUMN wishlist_items.user_id IS 
'References auth.users.id. Cascades on delete to clean up wishlist when user is deleted.';

COMMENT ON COLUMN wishlist_items.restaurant_name IS 
'Optional: Where the user tried this wine (e.g., restaurant name).';

COMMENT ON COLUMN wishlist_items.note IS 
'Optional: Personal notes about why the user wants to buy this wine.';

COMMENT ON COLUMN wishlist_items.extraction_confidence IS 
'JSONB object storing AI extraction confidence scores: {overall: "high", producer: "medium", wine_name: "high", vintage: "low"}';

-- Verification queries (run manually in Supabase SQL editor):
-- SELECT * FROM wishlist_items LIMIT 10;
-- SELECT user_id, COUNT(*) as item_count FROM wishlist_items GROUP BY user_id;

