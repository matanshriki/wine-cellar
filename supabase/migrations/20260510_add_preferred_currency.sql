ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD'
    CHECK (preferred_currency IN ('USD', 'ILS'));
