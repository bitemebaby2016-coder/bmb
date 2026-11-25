// ============================================
// Bite Me Baby — R201/R202 source-contract test (Migration 201: Theater Carousel, 202: approval_id on promotions)
// ตรวจสอบ migration 201 มี: admin_portfolio_items extends (product_id, is_theater_carousel, theater_caption) + indexes
// ตรวจสอบ migration 202 มี: promotions.approval_id + FK + index
// ============================================

import { describe, it, expect } from 'vitest'
import mig201Src from '../../supabase/migrations/201_theater_carousel_portfolio.sql?raw'
import mig202Src from '../../supabase/migrations/202_add_approval_id_to_promotions.sql?raw'

describe('R201/R202 — Migration 201: Theater Carousel + Migration 202: approval_id on promotions', () => {
  // ============================================
  // A — Migration 201: Theater Carousel
  // ============================================
  describe('Migration 201: Theater Carousel (extends admin_portfolio_items)', () => {
    it('มี ALTER TABLE admin_portfolio_items ADD COLUMN product_id REFERENCES products(id) ON DELETE SET NULL', () => {
      expect(mig201Src).toContain('ALTER TABLE public.admin_portfolio_items')
      expect(mig201Src).toContain('ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL')
    })

    it('มี ALTER TABLE admin_portfolio_items ADD COLUMN is_theater_carousel BOOLEAN NOT NULL DEFAULT false', () => {
      expect(mig201Src).toContain('ADD COLUMN IF NOT EXISTS is_theater_carousel BOOLEAN NOT NULL DEFAULT false')
    })

    it('มี ALTER TABLE admin_portfolio_items ADD COLUMN theater_caption TEXT', () => {
      expect(mig201Src).toContain('ADD COLUMN IF NOT EXISTS theater_caption TEXT')
    })

    it('มี index idx_admin_portfolio_theater_carousel (is_theater_carousel, display_order) WHERE is_theater_carousel = true AND is_active = true', () => {
      expect(mig201Src).toContain('idx_admin_portfolio_theater_carousel')
      expect(mig201Src).toContain('ON public.admin_portfolio_items (is_theater_carousel, display_order)')
      expect(mig201Src).toContain("WHERE is_theater_carousel = true AND is_active = true")
    })

    it('มี index idx_admin_portfolio_product_id (product_id) WHERE product_id IS NOT NULL', () => {
      expect(mig201Src).toContain('idx_admin_portfolio_product_id')
      expect(mig201Src).toContain('ON public.admin_portfolio_items (product_id)')
      expect(mig201Src).toContain('WHERE product_id IS NOT NULL')
    })

    it('มี COMMENT บนคอลัมน์ product_id, is_theater_carousel, theater_caption', () => {
      expect(mig201Src).toContain('COMMENT ON COLUMN public.admin_portfolio_items.product_id')
      expect(mig201Src).toContain('COMMENT ON COLUMN public.admin_portfolio_items.is_theater_carousel')
      expect(mig201Src).toContain('COMMENT ON COLUMN public.admin_portfolio_items.theater_caption')
    })

    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig201Src).toContain('BEGIN;')
      expect(mig201Src).toContain('COMMIT;')
    })
  })

  // ============================================
  // B — Migration 202: approval_id on promotions
  // ============================================
  describe('Migration 202: approval_id on promotions', () => {
    it('มี ALTER TABLE promotions ADD COLUMN approval_id TEXT REFERENCES content_approvals(id) ON DELETE SET NULL', () => {
      expect(mig202Src).toContain('ALTER TABLE public.promotions')
      expect(mig202Src).toContain('ADD COLUMN approval_id TEXT REFERENCES public.content_approvals(id) ON DELETE SET NULL')
    })

    it('มี index idx_promotions_approval_id', () => {
      expect(mig202Src).toContain('CREATE INDEX IF NOT EXISTS idx_promotions_approval_id ON public.promotions(approval_id)')
    })

    it('มี COMMENT ON COLUMN promotions.approval_id', () => {
      expect(mig202Src).toContain("COMMENT ON COLUMN public.promotions.approval_id IS 'Link to content_approvals row for CNT-01 approval workflow'")
    })
  })

  // ============================================
  // C — Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('Migration 201: ไม่มี DROP TABLE', () => {
      expect(mig201Src).not.toContain('DROP TABLE')
    })

    it('Migration 201: ไม่มี DROP COLUMN', () => {
      expect(mig201Src).not.toContain('DROP COLUMN')
    })

    it('Migration 202: ไม่มี DROP TABLE', () => {
      expect(mig202Src).not.toContain('DROP TABLE')
    })

    it('Migration 202: ไม่มี DROP COLUMN', () => {
      expect(mig202Src).not.toContain('DROP COLUMN')
    })
  })
})