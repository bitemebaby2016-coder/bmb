// ============================================
// Bite Me Baby — R191 source-contract test (Migration 191: Kitchen BKK Date Gate)
// ตรวจสอบ migration 191 มี:
// 1. create_production_batch: default scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
// 2. kitchen_queue: default scheduled_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
// 3. get_kitchen_summary: default p_date = (now() AT TIME ZONE 'Asia/Bangkok')::date
// 4. ALTER TABLE delivery_rounds.scheduled_date DEFAULT (BKK)
// 5. ALTER TABLE production_batches.scheduled_date DEFAULT (BKK)
// 6. ไม่มี CURRENT_DATE ใน function bodies
// ============================================

import { describe, it, expect } from 'vitest'
import mig191Src from '../../supabase/migrations/191_kitchen_date_bkk.sql?raw'

describe('R191 — Migration 191: Kitchen BKK Date Gate (R73)', () => {
  it('มี BEGIN/COMMIT transaction wrapper', () => {
    expect(mig191Src).toContain('BEGIN;')
    expect(mig191Src).toContain('COMMIT;')
  })

  it('create_production_batch: default p_scheduled_date = BKK date', () => {
    expect(mig191Src).toContain('CREATE OR REPLACE FUNCTION public.create_production_batch(')
    expect(mig191Src).toMatch(/p_scheduled_date date DEFAULT \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
    expect(mig191Src).toContain('RETURNS jsonb')
    expect(mig191Src).toContain('LANGUAGE plpgsql')
    expect(mig191Src).toContain('SECURITY DEFINER')
    expect(mig191Src).toContain('SET search_path = public')
  })

  it('create_production_batch: validation ครบ (auth, admin/kitchen, round_id, order_mode, round exists)', () => {
    expect(mig191Src).toContain("v_uid := auth.uid()")
    expect(mig191Src).toContain("IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'")
    expect(mig191Src).toContain("IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'")
    expect(mig191Src).toMatch(/IF p_delivery_round_id IS NULL OR trim\(p_delivery_round_id\) = '' THEN[\s\S]*?RAISE EXCEPTION 'ERR_MISSING_ROUND'/)
    expect(mig191Src).toMatch(/IF p_order_mode IS NOT NULL AND p_order_mode NOT IN \('SAME_DAY', 'PRE_ORDER'\) THEN[\s\S]*?RAISE EXCEPTION 'ERR_INVALID_ORDER_MODE'/)
    expect(mig191Src).toMatch(/IF NOT EXISTS \(SELECT 1 FROM public\.delivery_rounds WHERE id = p_delivery_round_id\) THEN[\s\S]*?RAISE EXCEPTION 'ERR_ROUND_NOT_FOUND'/)
  })

  it('create_production_batch: batch_id = batch-<epoch_ms>-<random6> (R14 fix: bigint::text)', () => {
    expect(mig191Src).toContain("v_batch_id := 'batch-' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint::text")
    expect(mig191Src).toContain("|| '-' || substr(md5(random()::text), 1, 6)")
  })

  it('create_production_batch: INSERT production_batches + production_batch_items (dedup NOT EXISTS)', () => {
    expect(mig191Src).toContain("INSERT INTO public.production_batches (id, delivery_round_id, scheduled_date, status, created_by, created_at, updated_at)")
    expect(mig191Src).toMatch(/INSERT INTO public\.production_batch_items \([\s\S]*?id, batch_id, order_id, order_number, product_id, product_name, quantity, order_mode, status, created_at[\s\S]*?\)/)
    expect(mig191Src).toMatch(/NOT EXISTS \([\s\S]*?SELECT 1 FROM public\.production_batch_items pbi[\s\S]*?JOIN public\.production_batches pb2 ON pb2\.id = pbi\.batch_id[\s\S]*?WHERE pbi\.order_id = o\.id/)
  })

  it('create_production_batch: audit log batch_created', () => {
    expect(mig191Src).toContain("PERFORM public.append_audit_log(")
    expect(mig191Src).toContain("p_action := 'batch_created'")
    expect(mig191Src).toContain("p_entity_type := 'production_batch'")
  })

  it('kitchen_queue: default p_scheduled_date = BKK date', () => {
    expect(mig191Src).toContain('CREATE OR REPLACE FUNCTION public.kitchen_queue(')
    expect(mig191Src).toMatch(/p_scheduled_date date DEFAULT \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
    expect(mig191Src).toContain("WHERE pb.scheduled_date = COALESCE(p_scheduled_date, (now() AT TIME ZONE 'Asia/Bangkok')::date)")
  })

  it('get_kitchen_summary: default p_date = BKK date', () => {
    expect(mig191Src).toContain('CREATE OR REPLACE FUNCTION public.get_kitchen_summary(')
    expect(mig191Src).toMatch(/p_date date DEFAULT \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
    expect(mig191Src).toContain("WHERE pb.scheduled_date = p_date")
  })

  it('ALTER TABLE: delivery_rounds.scheduled_date DEFAULT (BKK)', () => {
    expect(mig191Src).toContain("ALTER TABLE public.delivery_rounds ALTER COLUMN scheduled_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date)")
  })

  it('ALTER TABLE: production_batches.scheduled_date DEFAULT (BKK)', () => {
    expect(mig191Src).toContain("ALTER TABLE public.production_batches ALTER COLUMN scheduled_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Bangkok')::date)")
  })

  it('ไม่มี CURRENT_DATE ใน function bodies (ต้องใช้ BKK date ทุกที่)', () => {
    const createBatchMatch = mig191Src.match(/CREATE OR REPLACE FUNCTION public\.create_production_batch\([\s\S]*?\$\$/)
    const kitchenQueueMatch = mig191Src.match(/CREATE OR REPLACE FUNCTION public\.kitchen_queue\([\s\S]*?\$\$/)
    const getSummaryMatch = mig191Src.match(/CREATE OR REPLACE FUNCTION public\.get_kitchen_summary\([\s\S]*?\$\$/)
    
    expect(createBatchMatch).not.toBeNull()
    expect(kitchenQueueMatch).not.toBeNull()
    expect(getSummaryMatch).not.toBeNull()
    
    if (createBatchMatch && kitchenQueueMatch && getSummaryMatch) {
      expect(createBatchMatch[0]).not.toContain('CURRENT_DATE')
      expect(kitchenQueueMatch[0]).not.toContain('CURRENT_DATE')
      expect(getSummaryMatch[0]).not.toContain('CURRENT_DATE')
    }
  })

  it('GRANT/SECURITY: SECURITY DEFINER + auth/kitchen checks', () => {
    expect(mig191Src).toContain('SECURITY DEFINER')
    expect(mig191Src).toContain("IF NOT (public.is_admin() OR public.is_kitchen()) THEN RAISE EXCEPTION 'ERR_FORBIDDEN'")
  })

  it('Additive/Idempotent: ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ 3 fn', () => {
    const codeSection = mig191Src.substring(mig191Src.indexOf('BEGIN;'))
    expect(codeSection).not.toContain('DROP TABLE')
    expect(codeSection).not.toContain('DROP COLUMN')
    expect(mig191Src).toContain('CREATE OR REPLACE FUNCTION public.create_production_batch')
    expect(mig191Src).toContain('CREATE OR REPLACE FUNCTION public.kitchen_queue')
    expect(mig191Src).toContain('CREATE OR REPLACE FUNCTION public.get_kitchen_summary')
  })
})