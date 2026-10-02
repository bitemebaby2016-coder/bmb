-- ============================================
-- 109: G3 â€” SOCIAL EVENTS FOUNDATION (Owner-authorized 2026-10-02)
-- Owner decisions: D1 G3=Social Events Foundation Â· D2 social_events per
-- design Â§6 + UNIQUE(platform,event_id) + 90-day retention Â· D3 Auto-Post
-- single-brand at launch (NO brand-level authority â€” derive brand from the
-- existing approved brands.is_default configuration boundary).
--
-- Owner hard constraints:
--   HC-1 tenant derivation SERVER-SIDE ONLY (page allowlist/mapping table;
--        never trust caller-supplied tenant_id)
--   HC-2 service_role is NOT a security boundary: webhook boundary =
--        HMAC + fail-closed secret + page allowlist + server-side tenant
--        mapping + strict validation + DB uniqueness
--   HC-3 ingestion/event-state ONLY â€” no order/payment/inventory/kitchen/
--        delivery state (anti second-order-system, design D-14)
--   HC-4 DB-level idempotency UNIQUE(platform,event_id); concurrent-safe
--   HC-5 NULL/empty identifiers DENY
--   HC-6 reuse approved G2/Post-G2 authority model (no redesign)
--
-- Retention: 90-day policy DOCUMENTED (payload raw JSONB); destructive
-- cleanup scheduler NOT part of this gate (Owner D2).
-- ============================================

-- ===== channel_page_bindings: server-side page â†’ tenant mapping (HC-1) =====
CREATE TABLE IF NOT EXISTS public.channel_page_bindings (
  id text PRIMARY KEY DEFAULT ('sev-'::text || gen_random_uuid()::text),
  platform text NOT NULL CHECK (platform IN ('MESSENGER','FACEBOOK','FACEBOOK_GROUP')),
  page_id text NOT NULL CHECK (page_id <> ''),
  tenant_id text NOT NULL REFERENCES public.tenants(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, page_id)
);

ALTER TABLE public.channel_page_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY channel_page_bindings_platform_admin
  ON public.channel_page_bindings
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

REVOKE ALL ON public.channel_page_bindings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_page_bindings TO service_role;
-- ===== social_events: durable ingestion/event state (HC-3) =====
CREATE TABLE IF NOT EXISTS public.social_events (
  id text PRIMARY KEY DEFAULT ('sev-'::text || gen_random_uuid()::text),
  -- ingestion partition
  event_id text NOT NULL CHECK (event_id <> ''),
  platform text NOT NULL CHECK (platform IN ('MESSENGER','FACEBOOK','FACEBOOK_GROUP')),
  page_id text NOT NULL CHECK (page_id <> ''),
  event_type text NOT NULL CHECK (event_type IN ('comment','message','mention')),
  sender_id text,
  sender_name text,
  content text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  tenant_id text NOT NULL REFERENCES public.tenants(id),
  brand_id text REFERENCES public.brands(id),
  -- processing state (status machine ONLY - no business states)
  status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','PROCESSING','SUCCEEDED','FAILED','RETRYABLE','IGNORED','DUPLICATE')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  processed_at timestamptz,
  claimed_at timestamptz,
  -- AI state (non-authoritative; wiring belongs to later gates)
  ai_model text,
  ai_reply_text text,
  ai_validated boolean,
  ai_guardrail_flags jsonb,
  -- action state (order_number = REFERENCE to canonical orders, never a copy)
  action_type text NOT NULL DEFAULT 'none' CHECK (action_type IN ('none','reply','order')),
  order_number text,
  -- reply delivery state
  reply_status text CHECK (reply_status IN ('pending','sent','failed')),
  reply_provider_id text,
  reply_attempted_at timestamptz,
  -- audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- HC-4: DB-level idempotency (concurrency-safe hard constraint)
  CONSTRAINT uq_social_events_platform_event UNIQUE (platform, event_id),
  -- HC-1/HC-3 integrity: brand must belong to event tenant (same boundary as 107)
  CONSTRAINT fk_social_events_brand_tenant
    FOREIGN KEY (tenant_id, brand_id) REFERENCES public.brands (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_social_events_tenant_status
  ON public.social_events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_social_events_received_at
  ON public.social_events (received_at);

ALTER TABLE public.social_events ENABLE ROW LEVEL SECURITY;

-- HC-6: reuse approved authority model - tenant admin reads own; platform
-- reads all explicitly; anon has NO grant (DENY); customers have grant but
-- policy excludes them (proven by tests); ingestion writes via service_role
-- only (no authenticated write path).
CREATE POLICY social_events_tenant_read
  ON public.social_events
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin_of(tenant_id));

CREATE POLICY social_events_platform_read
  ON public.social_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.social_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.social_events TO authenticated;
GRANT ALL ON public.social_events TO service_role;

-- ===== ingestion RPC: server-side tenant derivation + concurrency-safe dedupe =====
-- SECURITY DEFINER with explicit search_path (HC-7); EXECUTE for service_role
-- ONLY (webhook path); anon + authenticated DENY by grant.
CREATE OR REPLACE FUNCTION public.ingest_social_event(
  p_platform text,
  p_event_id text,
  p_page_id text,
  p_event_type text,
  p_sender_id text,
  p_sender_name text,
  p_content text,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $fn$
DECLARE
  v_tenant text;
  v_brand text;
  v_inserted boolean;
BEGIN
  -- HC-5: NULL/empty deny
  IF p_platform IS NULL OR p_platform = ''
     OR p_event_id IS NULL OR p_event_id = ''
     OR p_page_id IS NULL OR p_page_id = '' THEN
    RETURN 'REJECTED';
  END IF;
  IF p_platform NOT IN ('MESSENGER','FACEBOOK','FACEBOOK_GROUP')
     OR p_event_type NOT IN ('comment','message','mention') THEN
    RETURN 'REJECTED';
  END IF;

  -- HC-1: server-side tenant derivation from verified page mapping ONLY.
  SELECT b.tenant_id INTO v_tenant
    FROM public.channel_page_bindings b
    WHERE b.platform = p_platform AND b.page_id = p_page_id AND b.is_active
    LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN 'UNBOUND_PAGE';
  END IF;

  -- D3: single-brand launch - brand derived from approved config boundary
  -- (tenant default brand), never caller-supplied, never hard-coded.
  SELECT id INTO v_brand
    FROM public.brands
    WHERE tenant_id = v_tenant AND is_default
    LIMIT 1;

  -- HC-4: DB-level idempotency; concurrent duplicates lose via ON CONFLICT.
  INSERT INTO public.social_events
    (event_id, platform, page_id, event_type, sender_id, sender_name,
     content, payload, tenant_id, brand_id, status)
  VALUES
    (p_event_id, p_platform, p_page_id, p_event_type, p_sender_id,
     p_sender_name, p_content, p_payload, v_tenant, v_brand, 'RECEIVED')
  ON CONFLICT (platform, event_id) DO NOTHING;
  v_inserted := FOUND;

  IF NOT v_inserted THEN
    -- duplicate ingestion: mark existing row DUPLICATE, never reprocess
    UPDATE public.social_events
      SET status = 'DUPLICATE', updated_at = now()
      WHERE platform = p_platform AND event_id = p_event_id
        AND status NOT IN ('SUCCEEDED','IGNORED','DUPLICATE');
    RETURN 'DUPLICATE';
  END IF;

  RETURN 'INSERTED';
END;
$fn$;

REVOKE ALL ON FUNCTION public.ingest_social_event(text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_social_event(text,text,text,text,text,text,text,jsonb) TO service_role;


