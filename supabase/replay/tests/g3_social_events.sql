-- ============================================
-- G3 SOCIAL EVENTS FOUNDATION â€” contract test matrix (ISOLATED LOCAL ONLY)
-- Runs AFTER migrations 106,108,109 + patches/g3_align.sql.
-- Reuses rls_matrix/remediation_matrix fixtures (tenant-a/b, brand a1/a2/b1,
-- admin-a/b, customer-a, platform, admin-nullt).
-- Any failure RAISEs EXCEPTION (nonzero exit).
-- ============================================


-- self-clean fixtures (test reruns on same isolated DB)
DELETE FROM public.social_events;
DELETE FROM public.channel_page_bindings;
-- Fixture: bind pages to tenants (server-side mapping, HC-1)
INSERT INTO public.channel_page_bindings (platform, page_id, tenant_id) VALUES
 ('MESSENGER','page-a1','tenant-a'),
 ('FACEBOOK','page-b1','tenant-b')
ON CONFLICT (platform, page_id) DO NOTHING;

-- ===== S1: service_role ingest works (webhook path) =====
SET ROLE service_role;
DO $$ BEGIN
  IF public.ingest_social_event('MESSENGER','evt-001','page-a1','message','snd-1','Sender One','hello', '{"k":1}'::jsonb) <> 'INSERTED' THEN
    RAISE EXCEPTION 'FAIL S1: first ingest not INSERTED';
  END IF;
  RAISE NOTICE 'PASS S1 ingest INSERTED (service_role)';
END $$;

-- S2: duplicate ingest -> DUPLICATE, single row, never reprocessed
DO $$ BEGIN
  IF public.ingest_social_event('MESSENGER','evt-001','page-a1','message','snd-1','Sender One','hello again', '{"k":2}'::jsonb) <> 'DUPLICATE' THEN
    RAISE EXCEPTION 'FAIL S2: duplicate ingest not marked DUPLICATE';
  END IF;
  IF (SELECT count(*) FROM public.social_events WHERE platform='MESSENGER' AND event_id='evt-001') <> 1 THEN
    RAISE EXCEPTION 'FAIL S2: duplicate created a second row (UNIQUE broken)';
  END IF;
  IF (SELECT status FROM public.social_events WHERE platform='MESSENGER' AND event_id='evt-001') <> 'DUPLICATE' THEN
    RAISE EXCEPTION 'FAIL S2: existing row not marked DUPLICATE';
  END IF;
  RAISE NOTICE 'PASS S2 idempotency: UNIQUE(platform,event_id) + DUPLICATE marking';
END $$;

-- S3: NULL/empty identifiers DENY (HC-5)
DO $$ BEGIN
  IF public.ingest_social_event('MESSENGER',NULL,'page-a1','message',NULL,NULL,NULL,NULL) <> 'REJECTED' THEN
    RAISE EXCEPTION 'FAIL S3: NULL event_id accepted';
  END IF;
  IF public.ingest_social_event('MESSENGER','evt-x','','message',NULL,NULL,NULL,NULL) <> 'REJECTED' THEN
    RAISE EXCEPTION 'FAIL S3: empty page_id accepted';
  END IF;
  RAISE NOTICE 'PASS S3 NULL/empty identifiers REJECTED';
END $$;

-- S4: page allowlist â€” unbound page DENIED server-side (HC-1)
DO $$ BEGIN
  IF public.ingest_social_event('MESSENGER','evt-rogue','page-unknown','comment','s','n','x',NULL) <> 'UNBOUND_PAGE' THEN
    RAISE EXCEPTION 'FAIL S4: unbound page accepted (TENANT DERIVATION LEAK)';
  END IF;
  RAISE NOTICE 'PASS S4 unbound page DENIED (server-side allowlist)';
END $$;

-- S5: server-side tenant derivation â€” event landed in mapping tenant + default brand
DO $$ DECLARE r record; BEGIN
  SELECT tenant_id, brand_id INTO r FROM public.social_events WHERE platform='MESSENGER' AND event_id='evt-001';
  IF r.tenant_id <> 'tenant-a' THEN
    RAISE EXCEPTION 'FAIL S5: tenant not derived from page binding (got %)', r.tenant_id;
  END IF;
  IF r.brand_id <> 'brand-a1' THEN
    RAISE EXCEPTION 'FAIL S5: brand not derived from is_default config (got %)', r.brand_id;
  END IF;
  RAISE NOTICE 'PASS S5 tenant+brand derived server-side (binding + is_default)';
END $$;
RESET ROLE;
-- ===== S6: RLS / grant boundary =====
-- S6a: anon has NO grant
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.social_events LIMIT 1;
    RAISE EXCEPTION 'FAIL S6a: anon queried social_events (ANON ACCESS LEAK)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS S6a anon: no access (ACL deny)';
  END;
END $$;
RESET ROLE;

-- S6b: ordinary customer: grant exists but policy excludes -> zero rows, no write
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.social_events) <> 0 THEN
    RAISE EXCEPTION 'FAIL S6b: customer sees social events (READ LEAK)';
  END IF;
  BEGIN
    INSERT INTO public.social_events (event_id,platform,page_id,event_type,tenant_id)
    VALUES ('evt-cust','MESSENGER','page-a1','message','tenant-a');
    RAISE EXCEPTION 'FAIL S6b: customer inserted social event';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS S6b customer: no read + no write';
  END;
END $$;
RESET ROLE;

-- S6c: tenant admin reads OWN only; no authenticated write path
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.social_events WHERE platform='MESSENGER' AND event_id='evt-001') <> 1 THEN
    RAISE EXCEPTION 'FAIL S6c: admin-a cannot read own tenant event';
  END IF;
  IF (SELECT count(*) FROM public.social_events WHERE tenant_id='tenant-b') <> 0 THEN
    RAISE EXCEPTION 'FAIL S6c: admin-a sees tenant-b events (CROSS-TENANT READ LEAK)';
  END IF;
  BEGIN
    UPDATE public.social_events SET status='SUCCEEDED' WHERE event_id='evt-001';
    RAISE EXCEPTION 'FAIL S6c: admin-a mutated event (no authenticated write path by design)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS S6c admin-a: own read ALLOW, cross read DENY, write DENY';
  END;
END $$;
RESET ROLE;

-- S6d prep: ingest tenant-b event as service_role
SET ROLE service_role;
DO $$ BEGIN
  IF public.ingest_social_event('FACEBOOK','evt-b1','page-b1','comment','s2','n2','fb post',NULL) <> 'INSERTED' THEN
    RAISE EXCEPTION 'FAIL S6d-prep: tenant-b ingest failed';
  END IF;
END $$;
RESET ROLE;

-- S6d: tenant-b admin symmetric
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.social_events WHERE tenant_id='tenant-b') <> 1 THEN
    RAISE EXCEPTION 'FAIL S6d: admin-b cannot read own tenant event';
  END IF;
  IF (SELECT count(*) FROM public.social_events WHERE tenant_id='tenant-a') <> 0 THEN
    RAISE EXCEPTION 'FAIL S6d: admin-b sees tenant-a events (CROSS-TENANT READ LEAK)';
  END IF;
  RAISE NOTICE 'PASS S6d admin-b symmetric own/cross';
END $$;
RESET ROLE;

-- S6e: platform admin reads ALL tenants explicitly
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"dddf4b57-405f-4852-a985-76d8d52b1b72"}';
DO $$ BEGIN
  IF (SELECT count(DISTINCT tenant_id) FROM public.social_events) <> 2 THEN
    RAISE EXCEPTION 'FAIL S6e: platform admin cannot read all tenants';
  END IF;
  RAISE NOTICE 'PASS S6e platform authority explicit read-all';
END $$;
RESET ROLE;

-- ===== S7: channel_page_bindings platform-only =====
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$ BEGIN
  BEGIN
    IF (SELECT count(*) FROM public.channel_page_bindings) <> 0 THEN
      RAISE EXCEPTION 'FAIL S7: tenant admin sees page bindings (PLATFORM-ONLY CONFIG LEAK)';
    END IF;
    RAISE NOTICE 'PASS S7 page bindings hidden (RLS: zero rows)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS S7 page bindings hidden (ACL deny)';
  END;
END $$;
RESET ROLE;

-- ===== S8: ingestion-only boundary (HC-3) =====
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_events' AND column_name IN ('price','payment_status','inventory_qty','delivery_status','kitchen_state')) THEN
    RAISE EXCEPTION 'FAIL S8: social_events contains business state columns';
  END IF;
  RAISE NOTICE 'PASS S8 social_events holds NO business state columns';
END $$;

SELECT 'ALL G3 SOCIAL EVENTS TESTS PASSED' AS result;




