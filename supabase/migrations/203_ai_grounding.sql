-- R96 Phase 1: AI Grounding data columns for social_events
-- Adds columns to store real-time product data used for AI reply grounding

ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS grounding_data jsonb;
ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS reply_draft text;

COMMENT ON COLUMN public.social_events.grounding_data IS 'R96: Product IDs, prices, schedules used for AI reply grounding';
COMMENT ON COLUMN public.social_events.reply_draft IS 'R96: Full draft text before sending (audit trail)';

-- Index for querying events with grounding data
CREATE INDEX IF NOT EXISTS idx_social_events_grounding_data ON public.social_events USING GIN (grounding_data);