-- ============================================
-- Bite Me Baby — Migration 120
-- Customer delivery photo (Owner feature, 2026-10-08):
--   Quick-login form gets a "delivery place photo" button next to the GPS
--   button (house number / storefront photo) so riders can find the dropoff.
--   The photo URL is stored server-side on customers (service-role writes via
--   Edge Function phone-auto-login; customers RLS is read-only for owners).
-- ============================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS delivery_photo_url text,
  ADD COLUMN IF NOT EXISTS delivery_photo_path text;

COMMENT ON COLUMN public.customers.delivery_photo_url IS
  'Public URL of the customer-supplied delivery-place photo (bucket bmb-images).';
COMMENT ON COLUMN public.customers.delivery_photo_path IS
  'Storage object path of the delivery-place photo (bucket bmb-images).';
