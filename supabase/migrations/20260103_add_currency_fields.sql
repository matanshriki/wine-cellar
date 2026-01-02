-- Add currency fields to bottles table
-- This allows us to store which currency was used when entering the price
-- and convert it when displaying in different languages

-- Add purchase_price_currency column
ALTER TABLE public.bottles
ADD COLUMN IF NOT EXISTS purchase_price_currency VARCHAR(3) DEFAULT 'USD';

-- Add comment
COMMENT ON COLUMN public.bottles.purchase_price_currency IS 'Currency code used when purchase_price was entered (USD or ILS)';

-- Update existing rows to have USD as default currency
UPDATE public.bottles
SET purchase_price_currency = 'USD'
WHERE purchase_price_currency IS NULL;

