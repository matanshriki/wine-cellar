-- Add Hebrew (and future) translations for wine data
-- Stores AI-generated or manually-provided translations for wine_name, producer,
-- region, country, appellation, and grapes per locale.
--
-- Structure example:
-- {
--   "he": {
--     "wine_name": "שאטו מרגו",
--     "producer": "שאטו מרגו",
--     "region": "בורדו",
--     "country": "צרפת",
--     "appellation": "מרגו",
--     "grapes": ["קברנה סוביניון", "מרלו"]
--   }
-- }

ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT NULL;

COMMENT ON COLUMN public.wines.translations
  IS 'Per-locale translations of wine display data (wine_name, producer, region, country, grapes). Keyed by ISO 639-1 language code.';
