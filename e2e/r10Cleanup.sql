-- R10 cleanup (Owner 2026-10-27): "ยังมีตัวอย่างเก่าสองอันที่ยังไม่รับมอบหมายลบด้วย" +
-- "ออเดอร์เก่า 405 ลบทิ้งเลย" — delete the 3 stale sample orders with ALL children.
-- One transaction (explicit BEGIN..ROLLBACK-proof via single query call), idempotent.
BEGIN;
CREATE TEMP TABLE _r10_doomed AS
  SELECT id, order_number FROM public.orders
   WHERE order_number IN ('BMB-20261019-405', 'BMB-20261022-205', 'BMB-20261020-337');

DELETE FROM public.dispatch_offer_declines
 WHERE offer_id IN (SELECT id FROM public.dispatch_offers WHERE order_number IN (SELECT order_number FROM _r10_doomed));
DELETE FROM public.dispatch_offers WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.delivery_assignments WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.driver_location_history WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM _r10_doomed);
DELETE FROM public.order_status_history WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.affiliate_attributions WHERE order_id IN (SELECT id FROM _r10_doomed);
DELETE FROM public.points_ledger WHERE order_id IN (SELECT id FROM _r10_doomed);
DELETE FROM public.provider_orders WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.referral_attributions WHERE order_id IN (SELECT id FROM _r10_doomed);
DELETE FROM public.payment_intents WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.order_submissions WHERE order_number IN (SELECT order_number FROM _r10_doomed);
DELETE FROM public.orders WHERE order_number IN (SELECT order_number FROM _r10_doomed);

SELECT count(*) AS orders_deleted FROM _r10_doomed;
DROP TABLE _r10_doomed;
COMMIT;
