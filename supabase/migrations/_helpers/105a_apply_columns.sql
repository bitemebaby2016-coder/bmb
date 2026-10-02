-- G2-A apply helper (subset of migration 105 — run via supabase db query -f)
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS brand_id text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS is_mock boolean NOT NULL DEFAULT false;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS updated_by uuid;