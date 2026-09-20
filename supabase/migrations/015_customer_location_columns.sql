-- ============================================
-- Bite Me Baby — Migration 015: Customer location columns (login by name+phone+location)
-- Date: 2026-09-19
--
-- The new "quick login" flow (Edge Function phone-auto-login) lets customers
-- sign in with ONLY name + phone + GPS location. This migration gives the
-- customers table real columns to persist the customer's location so the app
-- can compute distance, plan routes and price delivery fees against it.
--
-- ROLE: applied via supabase db push (CLI — dev has access).
-- Idempotent: safe to re-run.
-- ============================================

BEGIN;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS default_latitude NUMERIC(10, 7);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS default_longitude NUMERIC(10, 7);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS default_address_detail TEXT;

-- deterministic key for the EF phone upsert (id = cust-<digits>); no unique(user_id)
-- index required (keep user_id nullable/non-unique to match existing app behaviour).
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

COMMIT;

-- ============================================
-- END OF MIGRATION 015
-- ============================================