BEGIN;
UPDATE public.profiles SET role='admin' WHERE id='dddf4b57-405f-4852-a985-76d8d52b1b72';
INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('210a1790-0000-4000-8000-000000000001','fixture-c179-1@bmb.test','x',now(),now(),'{}','{}','authenticated','authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.customers (id, user_id, full_name) VALUES ('cust-c179-1', '210a1790-0000-4000-8000-000000000001', 'Contract 179 Customer')
ON CONFLICT (id) DO NOTHING;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub','210a1790-0000-4000-8000-000000000001','role','authenticated')::text, true);
SELECT public.register_channel_identity('messenger','psid-c179-1','test') AS r1;
SELECT public.register_channel_identity('messenger','psid-c179-1-updated','test') AS r2;
SELECT customer_id, channel, external_id, status, source FROM public.channel_identities;
ROLLBACK;
