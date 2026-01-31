-- Add Multi-Bottle Import Beta Feature Flag
-- Date: 2026-01-31
-- Purpose: Add can_multi_bottle_import flag to profiles table for beta feature gating

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'can_multi_bottle_import'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN can_multi_bottle_import BOOLEAN NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN public.profiles.can_multi_bottle_import IS 
    'Beta feature flag: Enables multi-bottle import functionality for specific users';
  END IF;
END $$;

-- Add can_share_cellar if it doesn't exist (for completeness)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'can_share_cellar'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN can_share_cellar BOOLEAN NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN public.profiles.can_share_cellar IS 
    'Beta feature flag: Enables cellar sharing functionality for specific users';
  END IF;
END $$;

-- Create index for faster beta feature lookups
CREATE INDEX IF NOT EXISTS profiles_can_multi_bottle_import_idx 
ON public.profiles(can_multi_bottle_import) 
WHERE can_multi_bottle_import = true;

CREATE INDEX IF NOT EXISTS profiles_can_share_cellar_idx 
ON public.profiles(can_share_cellar) 
WHERE can_share_cellar = true;
