-- Migration: 20260515_add_kosher_enrichment_usage.sql
-- Tracks daily call counts for external Kosher enrichment providers.
-- Used exclusively by Edge Functions (service_role) for cost-control guardrails.
-- Regular users never read or write this table directly.

CREATE TABLE IF NOT EXISTS public.kosher_enrichment_usage (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date  date        NOT NULL,
  provider    text        NOT NULL CHECK (provider IN ('perplexity', 'openai')),
  call_count  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usage_date, provider)
);

COMMENT ON TABLE  public.kosher_enrichment_usage IS
  'Daily call counter for external Kosher enrichment APIs. Used for cost-control guardrails in Edge Functions.';
COMMENT ON COLUMN public.kosher_enrichment_usage.usage_date  IS 'Calendar date (UTC) of the counted calls.';
COMMENT ON COLUMN public.kosher_enrichment_usage.provider    IS 'API provider: perplexity | openai.';
COMMENT ON COLUMN public.kosher_enrichment_usage.call_count  IS 'Number of API calls made to this provider on this date.';

-- Only the service role (Edge Functions) may read or write this table.
-- No RLS policy is created for authenticated users intentionally.
ALTER TABLE public.kosher_enrichment_usage ENABLE ROW LEVEL SECURITY;
