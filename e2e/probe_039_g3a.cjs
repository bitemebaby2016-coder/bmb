'use strict'
const sql = `
BEGIN;
RESET ROLE;
SELECT public.ensure_rounds_for_date((now() AT TIME ZONE 'Asia/Bangkok')::date + 1);
UPDATE public.delivery_rounds SET cutoff_time = '23:59', max_capacity = 50, current_count = 0
 WHERE scheduled_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
UPDATE public.inventory SET current_stock = 999999;
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
 ('eeee5555-5555-5555-5555-555555555555', 'p3b-039-admin@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
 ('ffff6666-6666-6666-6666-666666666666', 'p3b-039-cust@bmb.test', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET role = 'admin' WHERE id = 'eeee5555-5555-5555-5555-555555555555';
SELECT set_config('role','authenticated',false);
SELECT set_config('request.jwt.claims','{"sub":"eeee5555-5555-5555-5555-555555555555","role":"authenticated"}',false);
SELECT public.set_menu_schedule((now() AT TIME ZONE 'Asia/Bangkok')::date + 1, '[{"product_id":"prod-6"},{"product_id":"prod-5"}]'::jsonb);
SELECT public.publish_menu_schedule((now() AT TIME ZONE 'Asia/Bangkok')::date + 1, true);
SELECT set_config('request.jwt.claims','{"sub":"ffff6666-6666-6666-6666-666666666666","role":"authenticated"}',false);
SELECT public.create_order_with_items(
  p_items => '[{"product_id":"prod-6","quantity":1}]'::jsonb,
  p_delivery_round_id => 'round-' || to_char((now() at time zone 'Asia/Bangkok')::date + 1,'YYYYMMDD') || '-morning',
  p_delivery_method => 'self_delivery', p_delivery_address => 'probe',
  p_dropoff_latitude => 10.7050, p_dropoff_longitude => 102.1450,
  p_customer_name => 'PROBE', p_payment_method => 'cash_on_delivery',
  p_order_mode => 'PRE_ORDER', p_scheduled_date => (now() at time zone 'Asia/Bangkok')::date + 1
);
ROLLBACK;`
;(async () => {
  const r = await fetch('https://api.supabase.com/v1/projects/ivkdfognyiwjcmrhcnwz/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  console.log(r.status, (await r.text()).slice(0, 1200))
})()
