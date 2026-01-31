-- Add opened_quantity column to consumption_history
-- Tracks how many bottles were opened in a single consumption event

-- Add the column with default value of 1 (backwards compatible)
ALTER TABLE public.consumption_history 
ADD COLUMN IF NOT EXISTS opened_quantity INTEGER NOT NULL DEFAULT 1 CHECK (opened_quantity > 0);

-- Add index for potential queries on opened_quantity
CREATE INDEX IF NOT EXISTS consumption_history_opened_quantity_idx 
ON public.consumption_history(opened_quantity);

-- Add comment for documentation
COMMENT ON COLUMN public.consumption_history.opened_quantity IS 
'Number of bottles opened in this consumption event. Default is 1 for backwards compatibility.';
