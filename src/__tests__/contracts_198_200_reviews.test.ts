// ============================================
// Bite Me Baby — R198/R199/R200 source-contract test
// Migration 198: verified review = delivered + 1 order/1 review per menu
// Migration 199: review moderation (pending/approved/rejected) + RLS + RPCs
// Migration 200: reviews.id default = rev-<ms>-<suffix6>
// ============================================

import { describe, it, expect } from 'vitest'
import mig198Src from '../../supabase/migrations/198_review_verified_rules.sql?raw'
import mig199Src from '../../supabase/migrations/199_review_moderation.sql?raw'
import mig200Src from '../../supabase/migrations/200_reviews_id_default.sql?raw'

describe('R198/R199/R200 — Review Verified + Moderation + ID Default', () => {
  // ============================================
  // A — Migration 198: Verified Review Rules (R87)
  // ============================================
  describe('Migration 198: Verified Review = Delivered + Dedupe (R87)', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig198Src).toContain('BEGIN;')
      expect(mig198Src).toContain('COMMIT;')
    })

    it('CREATE OR REPLACE FUNCTION submit_verified_review(text, text, integer, text, text) RETURNS TABLE', () => {
      expect(mig198Src).toContain('CREATE OR REPLACE FUNCTION public.submit_verified_review(')
      expect(mig198Src).toContain('p_order_number text')
      expect(mig198Src).toContain('p_product_id text')
      expect(mig198Src).toContain('p_rating integer')
      expect(mig198Src).toContain('p_comment text')
      expect(mig198Src).toContain('p_branch_id text DEFAULT NULL')
      expect(mig198Src).toContain('RETURNS TABLE (review_id text)')
      expect(mig198Src).toContain('LANGUAGE plpgsql')
      expect(mig198Src).toContain('SECURITY DEFINER')
      expect(mig198Src).toContain('SET search_path = public')
    })

    it('validation: auth, rating bounds 1-5, order ownership', () => {
      expect(mig198Src).toContain("v_customer := auth.uid()::text")
      expect(mig198Src).toContain("ERR_NOT_LOGGED_IN")
      expect(mig198Src).toContain("ERR_INVALID_RATING")
      expect(mig198Src).toContain("public.orders o")
      expect(mig198Src).toContain("o.order_number = p_order_number")
      expect(mig198Src).toContain("o.customer_id = v_customer")
      expect(mig198Src).toContain("ERR_ORDER_NOT_FOUND")
    })

    it('R87: verified = delivered — ออเดอร์ยังไม่ส่งมอบรีวิวไม่ได้', () => {
      expect(mig198Src).toContain("R87: verified = ได้รับของแล้วจริง")
      expect(mig198Src).toContain("AND o.status = 'delivered'")
      expect(mig198Src).toContain("RAISE EXCEPTION 'ERR_REVIEW_ORDER_NOT_DELIVERED'")
    })

    it('R87: 1 order = 1 review per product (dedupe)', () => {
      expect(mig198Src).toContain("R87: 1 ออเดอร์ = 1 รีวิวต่อเมนู")
      expect(mig198Src).toContain("public.reviews r")
      expect(mig198Src).toContain("order_number = p_order_number")
      expect(mig198Src).toContain("product_id = p_product_id")
      expect(mig198Src).toContain("RAISE EXCEPTION 'ERR_REVIEW_ALREADY_EXISTS'")
    })

    it('INSERT reviews: is_verified = true + customer_name from order', () => {
      expect(mig198Src).toContain("INSERT INTO public.reviews")
      expect(mig198Src).toContain("is_verified")
      expect(mig198Src).toContain("true")
      expect(mig198Src).toContain("customer_name")
      expect(mig198Src).toContain("customer_name INTO v_customer_name")
      expect(mig198Src).toContain("public.orders WHERE order_number = p_order_number LIMIT 1")
    })

    it('ACL: REVOKE PUBLIC, anon + GRANT TO authenticated', () => {
      expect(mig198Src).toContain("REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM PUBLIC")
      expect(mig198Src).toContain("REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM anon")
      expect(mig198Src).toContain("GRANT EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) TO authenticated")
    })
  })

  // ============================================
  // B — Migration 199: Review Moderation (R88)
  // ============================================
  describe('Migration 199: Review Moderation + RLS + RPCs (R88)', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig199Src).toContain('BEGIN;')
      expect(mig199Src).toContain('COMMIT;')
    })

    it('คอลัมน์ที่ m093 สั่งแต่หาย: order_number, branch_id, product_name_display', () => {
      expect(mig199Src).toContain("ADD COLUMN IF NOT EXISTS order_number TEXT")
      expect(mig199Src).toContain("ADD COLUMN IF NOT EXISTS branch_id TEXT")
      expect(mig199Src).toContain("ADD COLUMN IF NOT EXISTS product_name_display TEXT")
    })

    it('moderation columns: status (pending/approved/rejected), reply, replied_at', () => {
      expect(mig199Src).toContain("ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'")
      expect(mig199Src).toContain("ADD COLUMN IF NOT EXISTS reply TEXT")
      expect(mig199Src).toContain("ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ")
      expect(mig199Src).toContain("CHECK (status IN ('pending', 'approved', 'rejected'))")
    })

    it('unique index: 1 order = 1 review per product (idx_reviews_order_product)', () => {
      expect(mig199Src).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_order_product")
      expect(mig199Src).toContain("ON public.reviews (order_number, product_id)")
      expect(mig199Src).toContain("WHERE order_number IS NOT NULL")
    })

    it('RLS cleanup: DROP legacy policies (reviews_anon_read, reviews_public_read, reviews_own_update, reviews_own_insert)', () => {
      expect(mig199Src).toContain("DROP POLICY IF EXISTS reviews_anon_read ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS reviews_public_read ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS reviews_own_update ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS reviews_own_insert ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS public_read_verified_reviews ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS users_read_own_reviews ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS customers_update_own_review ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS customers_insert_own_review ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS public_read_approved_reviews ON public.reviews")
      expect(mig199Src).toContain("DROP POLICY IF EXISTS customers_read_own_reviews ON public.reviews")
    })

    it('RLS new: public_read_approved_reviews (status=approved) + customers_read_own_reviews (owner)', () => {
      expect(mig199Src).toContain("public_read_approved_reviews")
      expect(mig199Src).toContain("status = 'approved'")
      expect(mig199Src).toContain("customers_read_own_reviews")
      expect(mig199Src).toContain("customer_id = (auth.uid())::text")
    })

    it('INSERT policy: customers_insert_own_review (customer_id = auth.uid() + status = pending)', () => {
      expect(mig199Src).toContain("customers_insert_own_review")
      expect(mig199Src).toContain("FOR INSERT TO authenticated")
      expect(mig199Src).toContain("WITH CHECK (customer_id = (auth.uid())::text AND status = 'pending')")
    })

    it('get_verified_reviews_batch: เฉพาะ is_verified=true + status=approved', () => {
      expect(mig199Src).toContain("CREATE OR REPLACE FUNCTION public.get_verified_reviews_batch(")
      expect(mig199Src).toContain("p_product_ids text[]")
      expect(mig199Src).toContain("RETURNS TABLE")
      expect(mig199Src).toContain("is_verified boolean")
      expect(mig199Src).toContain("order_number text")
      expect(mig199Src).toContain("product_name_display text")
      expect(mig199Src).toContain("WHERE r.is_verified = true")
      expect(mig199Src).toContain("AND r.status = 'approved'")
      expect(mig199Src).toContain("ORDER BY r.rating DESC, r.created_at DESC")
      expect(mig199Src).toContain("LIMIT GREATEST(COALESCE(p_limit, 100), 1)")
      expect(mig199Src).toContain("REVOKE EXECUTE ON FUNCTION public.get_verified_reviews_batch(text[], integer) FROM PUBLIC")
      expect(mig199Src).toContain("GRANT EXECUTE ON FUNCTION public.get_verified_reviews_batch(text[], integer) TO anon, authenticated")
    })

    it('submit_verified_review v2: status=pending + product_name_display + รวมกติกา m198', () => {
      expect(mig199Src).toContain("CREATE OR REPLACE FUNCTION public.submit_verified_review(")
      expect(mig199Src).toContain("AND o.status = 'delivered'")
      expect(mig199Src).toContain("RAISE EXCEPTION 'ERR_REVIEW_ORDER_NOT_DELIVERED'")
      expect(mig199Src).toContain("RAISE EXCEPTION 'ERR_REVIEW_ALREADY_EXISTS'")
      expect(mig199Src).toContain("SELECT name INTO v_product_name FROM public.products WHERE id::text = p_product_id LIMIT 1")
      expect(mig199Src).toContain("INSERT INTO public.reviews")
      expect(mig199Src).toContain("order_number, branch_id, product_name_display, status")
      expect(mig199Src).toContain("'pending'")
      expect(mig199Src).toContain("REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM PUBLIC")
      expect(mig199Src).toContain("REVOKE EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) FROM anon")
      expect(mig199Src).toContain("GRANT EXECUTE ON FUNCTION public.submit_verified_review(text, text, integer, text, text) TO authenticated")
    })

    it('Verification DO block: columns + moderation policy + legacy policies removed', () => {
      expect(mig199Src).toContain("DO $$")
      expect(mig199Src).toContain("information_schema.columns")
      expect(mig199Src).toContain("column_name = 'order_number'")
      expect(mig199Src).toContain("column_name = 'status'")
      expect(mig199Src).toContain("column_name = 'reply'")
      expect(mig199Src).toContain("public_read_approved_reviews")
      expect(mig199Src).toContain("ERR_R88_MODERATION_POLICY_MISSING")
      expect(mig199Src).toContain("reviews_anon_read")
      expect(mig199Src).toContain("reviews_public_read")
      expect(mig199Src).toContain("reviews_own_update")
      expect(mig199Src).toContain("reviews_own_insert")
      expect(mig199Src).toContain("ERR_R88_LEGACY_POLICY_STILL_PRESENT")
      expect(mig199Src).toContain("RAISE NOTICE 'R88 review moderation ready")
    })
  })

  // ============================================
  // C — Migration 200: reviews.id default (D9 fix)
  // ============================================
  describe('Migration 200: reviews.id default = rev-<ms>-<suffix6> (D9)', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig200Src).toContain('BEGIN;')
      expect(mig200Src).toContain('COMMIT;')
    })

    it('ALTER TABLE reviews ALTER COLUMN id SET DEFAULT rev-<ms>-<suffix6>', () => {
      expect(mig200Src).toContain("ALTER TABLE public.reviews")
      expect(mig200Src).toContain("ALTER COLUMN id SET DEFAULT")
      expect(mig200Src).toContain("'rev-' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint")
      expect(mig200Src).toContain("|| '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6)")
    })

    it('Verification DO block: id column_default EXISTS + is_nullable = NO', () => {
      expect(mig200Src).toContain("DO $$")
      expect(mig200Src).toContain("information_schema.columns")
      expect(mig200Src).toContain("table_name = 'reviews'")
      expect(mig200Src).toContain("column_name = 'id'")
      expect(mig200Src).toContain("column_default IS NOT NULL")
      expect(mig200Src).toContain("is_nullable = 'NO'")
      expect(mig200Src).toContain("RAISE EXCEPTION 'ERR_R88_REVIEW_ID_DEFAULT_MISSING'")
      expect(mig200Src).toContain("RAISE NOTICE 'R88 D9 fixed: reviews.id default")
    })
  })

  // ============================================
  // D — Additive/Idempotent checks
  // ============================================
  describe('Additive/Idempotent — ไม่มี DROP TABLE/COLUMN', () => {
    it('Migration 198: ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ', () => {
      expect(mig198Src).not.toContain('DROP TABLE')
      expect(mig198Src).not.toContain('DROP COLUMN')
      expect(mig198Src).toContain('CREATE OR REPLACE FUNCTION public.submit_verified_review')
    })

    it('Migration 199: ไม่มี DROP TABLE/COLUMN, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE ครบ 2 RPCs', () => {
      expect(mig199Src).not.toContain('DROP TABLE')
      expect(mig199Src).not.toContain('DROP COLUMN')
      expect(mig199Src).toContain('ADD COLUMN IF NOT EXISTS')
      expect(mig199Src).toContain('CREATE OR REPLACE FUNCTION public.get_verified_reviews_batch')
      expect(mig199Src).toContain('CREATE OR REPLACE FUNCTION public.submit_verified_review')
      // DROP POLICY เฉพาะ IF EXISTS policies ที่จะ CREATE ใหม่ (legacy cleanup = more drops than creates)
      const drops = (mig199Src.match(/DROP POLICY IF EXISTS/g) || []).length
      const creates = (mig199Src.match(/CREATE POLICY/g) || []).length
      expect(drops).toBeGreaterThanOrEqual(creates)
    })

    it('Migration 200: ไม่มี DROP TABLE/COLUMN, ALTER COLUMN SET DEFAULT', () => {
      expect(mig200Src).not.toContain('DROP TABLE')
      expect(mig200Src).not.toContain('DROP COLUMN')
      expect(mig200Src).toContain("ALTER COLUMN id SET DEFAULT")
    })
  })
})