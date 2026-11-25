// ============================================
// Bite Me Baby — R192/R193 source-contract test
// Migration 192: CRM automation (win-back/birthday/segments) + menu_sales_stats
// Migration 193: customers.crm_consent + CRM scan ส่งเฉพาะคนยินยอม
// ============================================

import { describe, it, expect } from 'vitest'
import mig192Src from '../../supabase/migrations/192_crm_automation_and_sales_stats.sql?raw'
import mig193Src from '../../supabase/migrations/193_customers_crm_consent.sql?raw'

describe('R192/R193 — CRM Automation + Consent (R73)', () => {
  // ============================================
  // A — Migration 192: CRM Automation
  // ============================================
  describe('Migration 192: CRM Automation + menu_sales_stats', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig192Src).toContain('BEGIN;')
      expect(mig192Src).toContain('COMMIT;')
    })

    it('ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE', () => {
      expect(mig192Src).toContain('ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday DATE')
    })

    it('menu_sales_stats(integer) RETURNS TABLE (product_id, sold_count)', () => {
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.menu_sales_stats(p_days integer DEFAULT 30)')
      expect(mig192Src).toContain('RETURNS TABLE (product_id text, sold_count bigint)')
      expect(mig192Src).toContain('LANGUAGE sql')
      expect(mig192Src).toContain('STABLE')
      expect(mig192Src).toContain('SECURITY DEFINER')
      expect(mig192Src).toContain('SET search_path = public')
    })

    it('menu_sales_stats: query orders + order_items (status <> cancelled, window N days, GROUP BY product_id)', () => {
      expect(mig192Src).toContain('FROM public.orders o')
      expect(mig192Src).toContain('JOIN public.order_items oi ON oi.order_id = o.id')
      expect(mig192Src).toContain("WHERE o.status <> 'cancelled'")
      expect(mig192Src).toContain('AND o.created_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 90))')
      expect(mig192Src).toContain('GROUP BY oi.product_id')
      expect(mig192Src).toContain('ORDER BY 2 DESC')
    })

    it('menu_sales_stats GRANT: REVOKE PUBLIC + GRANT TO anon, authenticated, service_role', () => {
      expect(mig192Src).toContain('REVOKE EXECUTE ON FUNCTION public.menu_sales_stats(integer) FROM PUBLIC')
      expect(mig192Src).toContain('GRANT EXECUTE ON FUNCTION public.menu_sales_stats(integer) TO anon, authenticated, service_role')
    })

    it('crm_segment_summary(integer) RETURNS jsonb (admin/service_role only)', () => {
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.crm_segment_summary(p_inactive_days integer DEFAULT 45)')
      expect(mig192Src).toContain('RETURNS jsonb')
      expect(mig192Src).toContain('LANGUAGE plpgsql')
      expect(mig192Src).toContain('STABLE')
      expect(mig192Src).toContain('SECURITY DEFINER')
    })

    it('crm_segment_summary: v_now = BKK date, counts active/inactive/lapsed/birthday', () => {
      expect(mig192Src).toContain("v_now date := (now() AT TIME ZONE 'Asia/Bangkok')::date")
      expect(mig192Src).toContain("SELECT COUNT(*) INTO v_total FROM public.customers")
      expect(mig192Src).toMatch(/COUNT\(\*\) FILTER \(WHERE last_order_at >= now\(\) - make_interval\(days => 30\)\)/)
      expect(mig192Src).toMatch(/COUNT\(\*\) FILTER \(WHERE last_order_at < now\(\) - make_interval\(days => 30\)[\s\S]*?AND last_order_at >= now\(\) - make_interval\(days => 90\)\)/)
      expect(mig192Src).toMatch(/COUNT\(\*\) FILTER \(WHERE last_order_at < now\(\) - make_interval\(days => 90\)\)/)
      expect(mig192Src).toMatch(/SELECT COUNT\(\*\) INTO v_birthday[\s\S]*?FROM public\.customers/)
      expect(mig192Src).toContain("date_part('month', birthday) = date_part('month', v_now)")
      expect(mig192Src).toContain("date_part('day', birthday) = date_part('day', v_now)")
    })

    it('crm_segment_summary GRANT: REVOKE PUBLIC, anon, authenticated + GRANT TO postgres, service_role', () => {
      expect(mig192Src).toContain('REVOKE EXECUTE ON FUNCTION public.crm_segment_summary(integer) FROM PUBLIC, anon, authenticated')
      expect(mig192Src).toContain('GRANT EXECUTE ON FUNCTION public.crm_segment_summary(integer) TO postgres, service_role')
    })

    it('crm_winback_scan: kill-switch crm_automation.enabled, weekly dedup by ISO week', () => {
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.crm_winback_scan(p_inactive_days integer DEFAULT 45, p_max integer DEFAULT 50)')
      expect(mig192Src).toMatch(/SELECT CASE WHEN jsonb_typeof\(value -> 'enabled'\) = 'boolean'[\s\S]*?THEN \(value ->> 'enabled'\)::boolean ELSE true END/)
      expect(mig192Src).toContain("FROM public.business_settings WHERE key = 'crm_automation' AND branch_id IS NULL LIMIT 1")
      expect(mig192Src).toMatch(/IF v_enabled IS NOT NULL AND v_enabled = false THEN[\s\S]*?RETURN jsonb_build_object\('ok', true, 'skipped', 'disabled_by_settings'/)
      expect(mig192Src).toContain("v_week text := to_char((now() AT TIME ZONE 'Asia/Bangkok')::date, 'IYYY') || '-W'")
      expect(mig192Src).toContain("to_char((now() AT TIME ZONE 'Asia/Bangkok')::date, 'IW')")
      expect(mig192Src).toContain("ON CONFLICT (id) DO NOTHING")
      expect(mig192Src).toContain("IF FOUND THEN v_created := v_created + 1; ELSE v_dup := v_dup + 1; END IF")
    })

    it('crm_winback_scan: INSERT notifications category=Marketing type=crm_winback, audit log', () => {
      expect(mig192Src).toMatch(/INSERT INTO public\.notifications[\s\S]*?id, customer_id, title, message, is_read, notification_type, category/)
      expect(mig192Src).toContain("'crm-winback-' || v_row.customer_id || '-' || v_week")
      expect(mig192Src).toContain("'คิดถึงคุณครับ 🧡'")
      expect(mig192Src).toContain("'Marketing'")
      expect(mig192Src).toContain("INSERT INTO public.audit_logs (id, action, entity_type, entity_id, description, metadata)")
      expect(mig192Src).toContain("ON CONFLICT (id) DO NOTHING")
    })

    it('crm_birthday_scan: BKK date, yearly dedup by YYYYMMDD, audit log', () => {
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.crm_birthday_scan(p_max integer DEFAULT 50)')
      expect(mig192Src).toContain("v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date")
      expect(mig192Src).toContain("WHERE birthday IS NOT NULL")
      expect(mig192Src).toContain("date_part('month', birthday) = date_part('month', v_today)")
      expect(mig192Src).toContain("date_part('day', birthday) = date_part('day', v_today)")
      expect(mig192Src).toContain("'crm-birthday-' || v_row.customer_id || '-' || to_char(v_today, 'YYYYMMDD')")
      expect(mig192Src).toContain("'สุขสันต์วันเกิดครับ 🎂'")
      expect(mig192Src).toContain("INSERT INTO public.audit_logs")
      expect(mig192Src).toContain("ON CONFLICT (id) DO NOTHING")
    })

    it('crm_birthday_scan GRANT: REVOKE PUBLIC, anon, authenticated + GRANT TO postgres, service_role', () => {
      expect(mig192Src).toContain('REVOKE EXECUTE ON FUNCTION public.crm_birthday_scan(integer) FROM PUBLIC, anon, authenticated')
      expect(mig192Src).toContain('GRANT EXECUTE ON FUNCTION public.crm_birthday_scan(integer) TO postgres, service_role')
    })

    it('pg_cron schedules: winback 02:00 UTC (09:00 ICT), birthday 17:05 UTC (00:05 ICT)', () => {
      expect(mig192Src).toContain("cron.unschedule('bmb-crm-winback')")
      expect(mig192Src).toContain("cron.schedule('bmb-crm-winback', '0 2 * * *', 'SELECT public.crm_winback_scan()')")
      expect(mig192Src).toContain("cron.unschedule('bmb-crm-birthday')")
      expect(mig192Src).toContain("cron.schedule('bmb-crm-birthday', '5 17 * * *', 'SELECT public.crm_birthday_scan()')")
      expect(mig192Src).toContain("EXCEPTION WHEN OTHERS THEN RAISE NOTICE")
    })
  })

  // ============================================
  // B — Migration 193: CRM Consent
  // ============================================
  describe('Migration 193: CRM Consent + Scan Filter', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig193Src).toContain('BEGIN;')
      expect(mig193Src).toContain('COMMIT;')
    })

    it('ALTER TABLE customers ADD COLUMN crm_consent boolean NOT NULL DEFAULT false', () => {
      expect(mig193Src).toContain('ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS crm_consent boolean NOT NULL DEFAULT false')
    })

    it('crm_winback_scan v2: เติมเงื่อนไข c.crm_consent = true', () => {
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_winback_scan(p_inactive_days integer DEFAULT 45, p_max integer DEFAULT 50)')
      expect(mig193Src).toContain("AND c.crm_consent = true")
    })

    it('crm_birthday_scan v2: เติมเงื่อนไข crm_consent = true', () => {
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_birthday_scan(p_max integer DEFAULT 50)')
      expect(mig193Src).toContain("AND crm_consent = true")
    })

    it('crm_birthday_scan: birthday + crm_consent = true', () => {
      expect(mig193Src).toContain("WHERE birthday IS NOT NULL")
      expect(mig193Src).toContain("AND crm_consent = true")
      expect(mig193Src).toContain("date_part('month', birthday) = date_part('month', v_today)")
      expect(mig193Src).toContain("date_part('day', birthday) = date_part('day', v_today)")
    })

    it('GRANT: crm_birthday_scan REVOKE/GRANT เป็นของ m192 (m193 มีแต่ fn definition)', () => {
      // m193 เปลี่ยนแค่ fn body + ADD COLUMN crm_consent · GRANT อยู่ใน m192
      expect(mig193Src).toContain('crm_birthday_scan')
      expect(mig193Src).toContain('crm_consent = true')
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_birthday_scan')
      expect(mig193Src).not.toContain('REVOKE EXECUTE')
      expect(mig193Src).not.toContain('GRANT EXECUTE')
    })

    it('Additive/Idempotent: ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ 2 fn', () => {
      const codeSection = mig193Src.substring(mig193Src.indexOf('BEGIN;'))
      expect(codeSection).not.toContain('DROP TABLE')
      expect(codeSection).not.toContain('DROP COLUMN')
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_winback_scan')
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_birthday_scan')
    })
  })

  // ============================================
  // C — Additive/Idempotent checks
  // ============================================
  describe('Additive/Idempotent — ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ', () => {
    it('Migration 192: ไม่มี DROP TABLE/COLUMN ในโค้ดจริง, CREATE OR REPLACE ฟังก์ชันครบ 4 fn', () => {
      const codeSection = mig192Src.substring(mig192Src.indexOf('BEGIN;'))
      expect(codeSection).not.toContain('DROP TABLE')
      expect(codeSection).not.toContain('DROP COLUMN')
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.menu_sales_stats')
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.crm_segment_summary')
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.crm_winback_scan')
      expect(mig192Src).toContain('CREATE OR REPLACE FUNCTION public.crm_birthday_scan')
    })

    it('Migration 193: ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ 2 fn', () => {
      const codeSection = mig193Src.substring(mig193Src.indexOf('BEGIN;'))
      expect(codeSection).not.toContain('DROP TABLE')
      expect(codeSection).not.toContain('DROP COLUMN')
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_winback_scan')
      expect(mig193Src).toContain('CREATE OR REPLACE FUNCTION public.crm_birthday_scan')
    })
  })
})