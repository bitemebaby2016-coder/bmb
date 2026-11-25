-- ============================================================
-- Contract 201+202 — Theater Carousel + Promotions approval_id
-- ครอบคลุม:
--   201.1 admin_portfolio_items: product_id, is_theater_carousel, theater_caption columns
--   201.2 indexes: idx_admin_portfolio_theater_carousel + idx_admin_portfolio_product_id
--   202.1 promotions.approval_id column + FK to content_approvals
--   202.2 idx_promotions_approval_id index
-- ทุกเคสใน BEGIN ... ROLLBACK เดียว
-- ============================================================
BEGIN;

-- ---------- 201.1 admin_portfolio_items theater columns ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_portfolio_items' AND column_name='product_id') THEN
    RAISE EXCEPTION '201.1 FAIL: product_id column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_portfolio_items' AND column_name='is_theater_carousel') THEN
    RAISE EXCEPTION '201.1 FAIL: is_theater_carousel column missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_portfolio_items' AND column_name='theater_caption') THEN
    RAISE EXCEPTION '201.1 FAIL: theater_caption column missing';
  END IF;

  -- product_id FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='admin_portfolio_items' AND constraint_type='FOREIGN KEY'
      AND constraint_name LIKE '%product_id%'
  ) THEN
    RAISE EXCEPTION '201.1 FAIL: product_id FK missing';
  END IF;

  -- is_theater_carousel default false
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_portfolio_items' AND column_name='is_theater_carousel'
      AND column_default NOT LIKE '%false%'
  ) THEN
    RAISE EXCEPTION '201.1 FAIL: is_theater_carousel default not false';
  END IF;

  RAISE NOTICE '201.1 PASS: admin_portfolio_items theater columns OK';
END $$;

-- ---------- 201.2 indexes ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='admin_portfolio_items' AND indexname='idx_admin_portfolio_theater_carousel'
  ) THEN
    RAISE EXCEPTION '201.2 FAIL: idx_admin_portfolio_theater_carousel missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='admin_portfolio_items' AND indexname='idx_admin_portfolio_product_id'
  ) THEN
    RAISE EXCEPTION '201.2 FAIL: idx_admin_portfolio_product_id missing';
  END IF;

  RAISE NOTICE '201.2 PASS: theater carousel indexes OK';
END $$;

-- ---------- 202.1 promotions.approval_id ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='promotions' AND column_name='approval_id') THEN
    RAISE EXCEPTION '202.1 FAIL: approval_id column missing';
  END IF;

  -- FK to content_approvals
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='promotions' AND constraint_type='FOREIGN KEY'
      AND constraint_name LIKE '%approval_id%'
  ) THEN
    RAISE EXCEPTION '202.1 FAIL: approval_id FK to content_approvals missing';
  END IF;

  RAISE NOTICE '202.1 PASS: promotions.approval_id + FK OK';
END $$;

-- ---------- 202.2 idx_promotions_approval_id ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='promotions' AND indexname='idx_promotions_approval_id'
  ) THEN
    RAISE EXCEPTION '202.2 FAIL: idx_promotions_approval_id missing';
  END IF;

  RAISE NOTICE '202.2 PASS: idx_promotions_approval_id OK';
END $$;

ROLLBACK;