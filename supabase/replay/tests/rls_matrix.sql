-- ============================================
-- S1-prime-A / G2-RV: RLS Option 3 policy matrix test (ISOLATED LOCAL ONLY)
-- Any assertion failure RAISEs EXCEPTION (nonzero exit).
-- ============================================

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 (NULL,'11111111-1111-1111-1111-111111111111','authenticated','authenticated','e2e-admin-a@bmb.local',crypt('x',gen_random_uuid()::text),now(),'{}','{}',now(),now()),
 (NULL,'22222222-2222-2222-2222-222222222222','authenticated','authenticated','e2e-admin-b@bmb.local',crypt('x',gen_random_uuid()::text),now(),'{}','{}',now(),now()),
 (NULL,'33333333-3333-3333-3333-333333333333','authenticated','authenticated','e2e-cust-a@bmb.local',crypt('x',gen_random_uuid()::text),now(),'{}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, name, slug, status) VALUES
 ('tenant-a','Tenant A','tenant-a','active'),
 ('tenant-b','Tenant B','tenant-b','active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.brands (id, tenant_id, name, slug, status, is_default, is_published, display_name) VALUES
 ('brand-a1','tenant-a','Brand A1','brand-a1','active',true,true,'Brand A1'),
 ('brand-a2','tenant-a','Brand A2','brand-a2','active',false,true,'Brand A2'),
 ('brand-b1','tenant-b','Brand B1','brand-b1','active',true,true,'Brand B1')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role='admin', tenant_id='tenant-a' WHERE id='11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET role='admin', tenant_id='tenant-b' WHERE id='22222222-2222-2222-2222-222222222222';
UPDATE public.profiles SET role='customer', tenant_id='tenant-a' WHERE id='33333333-3333-3333-3333-333333333333';

INSERT INTO public.media_assets (id, url, alt, kind, asset_key, category, tenant_id, brand_id, is_active, is_mock) VALUES
 ('m-a1-logo','https://isolated.local/A1-logo.webp','A1 logo','image','A1-logo','brand','tenant-a','brand-a1',true,false),
 ('m-a2-logo','https://isolated.local/A2-logo.webp','A2 logo','image','A2-logo','brand','tenant-a','brand-a2',true,false),
 ('m-b1-logo','https://isolated.local/B1-logo.webp','B1 logo','image','B1-logo','brand','tenant-b','brand-b1',true,false),
 ('m-a1-inactive','https://isolated.local/A1-old.webp','A1 old','image','A1-logo-old','brand','tenant-a','brand-a1',false,false),
 ('m-a1-mock','https://isolated.local/A1-mock.webp','A1 mock','image','A1-mock','brand','tenant-a','brand-a1',true,true)
ON CONFLICT (id) DO NOTHING;
-- T1: Anonymous ACL contract (POST-106): anon has SELECT on media_assets ONLY
-- (public read boundary, is_active=true enforced by media_assets_public_read);
-- every other table stays anon-DENIED (no grants). Assert both sides.
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.orders LIMIT 1;
    RAISE EXCEPTION 'FAIL T1: anon queried orders (ACL LEAK - anon must have no grant on sensitive tables)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS T1a anon denied on orders (ACL contract preserved)';
  END;
  IF (SELECT count(*) FROM public.media_assets WHERE is_active) = 0 THEN
    RAISE EXCEPTION 'FAIL T1b: anon public read on media_assets missing (106 GRANT regression)';
  END IF;
  IF (SELECT count(*) FROM public.media_assets WHERE NOT is_active) <> 0 THEN
    RAISE EXCEPTION 'FAIL T1c: anon read inactive asset (public-read policy leak)';
  END IF;
  RAISE NOTICE 'PASS T1 anon: media_assets public read ONLY (active rows), others denied';
END $$;
RESET ROLE;

-- T2: Customer (tenant-a) sees active public assets
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_assets WHERE id='m-b1-logo') <> 1 THEN
    RAISE EXCEPTION 'FAIL T2: customer should see active public asset';
  END IF;
  RAISE NOTICE 'PASS T2 customer-public-read';
END $$;
RESET ROLE;

-- T3: Tenant A Admin public read of active asset
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_assets WHERE id='m-b1-logo') <> 1 THEN
    RAISE EXCEPTION 'FAIL T3: admin-a should see active public asset';
  END IF;
  RAISE NOTICE 'PASS T3 admin-a public read active';
END $$;
-- T4: admin-a cross-tenant UPDATE (deactivate) denied
DO $$ BEGIN
  UPDATE public.media_assets SET is_active=false WHERE id='m-b1-logo';
  IF NOT (SELECT is_active FROM public.media_assets WHERE id='m-b1-logo') THEN
    RAISE EXCEPTION 'FAIL T4: admin-a deactivated tenant-b asset (CROSS-TENANT WRITE LEAK)';
  END IF;
  RAISE NOTICE 'PASS T4 admin-a cross-tenant UPDATE denied';
END $$;

-- T5: admin-a cross-tenant DELETE denied
DO $$ BEGIN
  DELETE FROM public.media_assets WHERE id='m-b1-logo';
  IF NOT EXISTS (SELECT 1 FROM public.media_assets WHERE id='m-b1-logo') THEN
    RAISE EXCEPTION 'FAIL T5: admin-a deleted tenant-b asset (CROSS-TENANT DELETE LEAK)';
  END IF;
  RAISE NOTICE 'PASS T5 admin-a cross-tenant DELETE denied';
END $$;

-- T6: admin-a cross-tenant INSERT denied
DO $$ BEGIN
  INSERT INTO public.media_assets (id,url,alt,kind,category,tenant_id,brand_id)
  VALUES ('m-leak','https://isolated.local/leak.webp','leak','image','brand','tenant-b','brand-b1');
  RAISE EXCEPTION 'FAIL T6: admin-a inserted tenant-b asset (CROSS-TENANT INSERT LEAK)';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  RAISE NOTICE 'PASS T6 admin-a cross-tenant INSERT denied';
END $$;

-- T7: admin-a own-tenant CRUD + activate/deactivate
DO $$ BEGIN
  INSERT INTO public.media_assets (id,url,alt,kind,category,tenant_id,brand_id,is_active)
  VALUES ('m-a1-new','https://isolated.local/A1-new.webp','A1 new','image','brand','tenant-a','brand-a1',true);
  UPDATE public.media_assets SET is_active=false WHERE id='m-a1-new';
  IF (SELECT is_active FROM public.media_assets WHERE id='m-a1-new') THEN
    RAISE EXCEPTION 'FAIL T7: deactivate own asset failed';
  END IF;
  UPDATE public.media_assets SET is_active=true WHERE id='m-a1-new';
  IF NOT (SELECT is_active FROM public.media_assets WHERE id='m-a1-new') THEN
    RAISE EXCEPTION 'FAIL T7: activate own asset failed';
  END IF;
  DELETE FROM public.media_assets WHERE id='m-a1-new';
  RAISE NOTICE 'PASS T7 admin-a own-tenant CRUD+activate/deactivate';
END $$;

-- T8: tenant admin cannot create GLOBAL (NULL scope) asset
DO $$ BEGIN
  INSERT INTO public.media_assets (id,url,alt,kind,category,tenant_id)
  VALUES ('m-global-leak','https://isolated.local/g.webp','g','image','global',NULL);
  RAISE EXCEPTION 'FAIL T8: tenant admin created global asset (NULL-SCOPE BYPASS)';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  RAISE NOTICE 'PASS T8 tenant-admin global INSERT denied';
END $$;
RESET ROLE;
-- T9: Platform admin cross-tenant + global
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.media_assets WHERE id='m-a1-inactive') <> 1 THEN
    RAISE EXCEPTION 'FAIL T9: platform admin cannot read inactive asset';
  END IF;
  UPDATE public.media_assets SET is_active=false WHERE id='m-b1-logo';
  UPDATE public.media_assets SET is_active=true WHERE id='m-b1-logo';
  INSERT INTO public.media_assets (id,url,alt,kind,category,tenant_id)
  VALUES ('m-global-ok','https://isolated.local/g.webp','g','image','global',NULL);
  DELETE FROM public.media_assets WHERE id='m-global-ok';
  RAISE NOTICE 'PASS T9 platform admin cross-tenant + global';
END $$;
RESET ROLE;

-- T10: Tenant B Admin cross-tenant UPDATE denied
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
DO $$ BEGIN
  UPDATE public.media_assets SET is_active=false WHERE id='m-a1-logo';
  IF NOT (SELECT is_active FROM public.media_assets WHERE id='m-a1-logo') THEN
    RAISE EXCEPTION 'FAIL T10: admin-b modified tenant-a asset (CROSS-TENANT LEAK)';
  END IF;
  RAISE NOTICE 'PASS T10 admin-b cross-tenant UPDATE denied';
END $$;
RESET ROLE;

SELECT 'ALL RLS MATRIX TESTS PASSED' AS result;