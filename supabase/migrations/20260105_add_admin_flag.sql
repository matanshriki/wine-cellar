-- Add admin flag to users via metadata
-- This stores admin status in Supabase Auth metadata

-- Create a simple admins table to track admin users
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view the admins table
CREATE POLICY "Admins can view admins table"
  ON public.admins
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- Policy: Only admins can insert new admins
CREATE POLICY "Admins can insert new admins"
  ON public.admins
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admins));

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;

-- Make yourself admin (replace with your user ID)
-- Run this separately after getting your user ID:
-- INSERT INTO public.admins (user_id) VALUES ('YOUR_USER_ID_HERE');

