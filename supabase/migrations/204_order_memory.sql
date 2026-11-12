-- R97: Order memory for AI to reference across conversations
-- Adds columns for customer order lookup, history, and modification support

ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS customer_id text;
ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS last_order_id text;
ALTER TABLE public.social_events ADD COLUMN IF NOT EXISTS order_history jsonb;

COMMENT ON COLUMN public.social_events.customer_id IS 'R97: Facebook/Messenger user ID for order lookup';
COMMENT ON COLUMN public.social_events.last_order_id IS 'R97: Most recent order ID for quick reference';
COMMENT ON COLUMN public.social_events.order_history IS 'R97: Last 10 orders with summary (menu, total, status)';

-- Index for querying orders by customer
CREATE INDEX IF NOT EXISTS idx_social_events_customer_id ON public.social_events (customer_id);
CREATE INDEX IF NOT EXISTS idx_social_events_last_order_id ON public.social_events (last_order_id);
