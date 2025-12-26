-- Profile UX Enhancement Migration
-- Adds first_name and last_name fields and improves Google OAuth integration

-- Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make display_name NOT NULL (with default for existing rows)
UPDATE public.profiles 
SET display_name = COALESCE(display_name, email, 'User') 
WHERE display_name IS NULL OR display_name = '';

ALTER TABLE public.profiles 
ALTER COLUMN display_name SET NOT NULL;

-- Update the trigger to extract first_name, last_name from Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_display_name TEXT;
  extracted_first_name TEXT;
  extracted_last_name TEXT;
BEGIN
  -- Extract first_name (from Google OAuth or other providers)
  extracted_first_name := COALESCE(
    NEW.raw_user_meta_data->>'given_name',    -- Google OAuth
    NEW.raw_user_meta_data->>'first_name',    -- Other providers
    SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 1)  -- Extract from full name
  );
  
  -- Extract last_name (from Google OAuth or other providers)
  extracted_last_name := COALESCE(
    NEW.raw_user_meta_data->>'family_name',   -- Google OAuth
    NEW.raw_user_meta_data->>'last_name',     -- Other providers
    NULLIF(SPLIT_PART(NEW.raw_user_meta_data->>'full_name', ' ', 2), '')  -- Extract from full name
  );
  
  -- Create display_name (prefer first_name for cleaner display)
  extracted_display_name := COALESCE(
    extracted_first_name,                     -- Preferred: first name only (cleaner)
    NEW.raw_user_meta_data->>'display_name',  -- Explicit display_name
    NEW.raw_user_meta_data->>'full_name',     -- Google/OAuth full_name
    NEW.raw_user_meta_data->>'name',          -- Alternative OAuth field
    CONCAT_WS(' ', extracted_first_name, extracted_last_name),  -- Constructed from first/last
    SPLIT_PART(NEW.email, '@', 1)             -- Fallback: email username
  );
  
  INSERT INTO public.profiles (id, display_name, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    extracted_display_name,
    NEW.email,
    extracted_first_name,
    extracted_last_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

