// ============================================
// Bite Me Baby — R179 source-contract test (Migration 179: Notification Hub)
// ตรวจสอบ migration 179 มี:
// 1. channel_identities table + RLS + unique constraints
// 2. notification_outbox table + RLS + state machine indexes
// 3. RPCs: register_channel_identity, enqueue_notification, claim_notification_outbox, complete_notification
// 4. business_settings.notification_channels feature flags
// 5. bmb_notify_http bridge function
// ============================================

import { describe, it, expect } from 'vitest'
import mig179Src from '../../supabase/migrations/179_notification_hub.sql?raw'

describe('R179 — Migration 179: Notification Hub (channel_identities + notification_outbox + RPCs)', () => {
  // ============================================
  // A — channel_identities table
  // ============================================
  describe('channel_identities — PSID/LINE identity mapping', () => {
    it('มี CREATE TABLE IF NOT EXISTS channel_identities พร้อม column ครบ', () => {
      expect(mig179Src).toContain('CREATE TABLE IF NOT EXISTS public.channel_identities')
      expect(mig179Src).toContain('id          TEXT PRIMARY KEY')
      expect(mig179Src).toContain('customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE')
      expect(mig179Src).toContain("channel     TEXT NOT NULL CHECK (channel IN ('messenger', 'line'))")
      expect(mig179Src).toContain('external_id TEXT NOT NULL')
      expect(mig179Src).toContain("status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'mock'))")
      expect(mig179Src).toContain("source      TEXT NOT NULL DEFAULT 'manual'")
      expect(mig179Src).toContain('created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()')
      expect(mig179Src).toContain('updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    })

    it('มี unique constraints: uq_channel_identity (channel, external_id) + uq_channel_customer (customer_id, channel)', () => {
      expect(mig179Src).toContain('CONSTRAINT uq_channel_identity UNIQUE (channel, external_id)')
      expect(mig179Src).toContain('CONSTRAINT uq_channel_customer UNIQUE (customer_id, channel)')
    })

    it('มี index: channel_identities_customer_idx (customer_id, channel) WHERE status = active', () => {
      expect(mig179Src).toContain('channel_identities_customer_idx')
      expect(mig179Src).toContain('ON public.channel_identities (customer_id, channel) WHERE status = \'active\'')
    })

it('มี RLS policies: deny_anon + own_read + admin_read', () => {
      expect(mig179Src).toContain('ALTER TABLE public.channel_identities ENABLE ROW LEVEL SECURITY')
      expect(mig179Src).toContain("DROP POLICY IF EXISTS channel_ident_deny_anon ON public.channel_identities")
      expect(mig179Src).toContain("CREATE POLICY channel_ident_deny_anon ON public.channel_identities FOR ALL TO anon USING (false)")
      expect(mig179Src).toContain("DROP POLICY IF EXISTS channel_ident_own_read ON public.channel_identities")
      expect(mig179Src).toMatch(/CREATE POLICY channel_ident_own_read ON public\.channel_identities[\s\S]*?FOR SELECT TO authenticated/)
      expect(mig179Src).toMatch(/USING \(customer_id IN \(SELECT id FROM public\.customers WHERE user_id = auth\.uid\(\)\)\)/)
      expect(mig179Src).toContain("DROP POLICY IF EXISTS channel_ident_admin_read ON public.channel_identities")
      expect(mig179Src).toMatch(/CREATE POLICY channel_ident_admin_read ON public\.channel_identities[\s\S]*?FOR SELECT TO authenticated USING \(public\.is_admin\(\)\)/)
    })
  })

  // ============================================
  // B — notification_outbox table
  // ============================================
  describe('notification_outbox — transport queue state machine', () => {
    it('มี CREATE TABLE IF NOT EXISTS notification_outbox พร้อม column ครบ', () => {
      expect(mig179Src).toContain('CREATE TABLE IF NOT EXISTS public.notification_outbox')
      expect(mig179Src).toContain('id              TEXT PRIMARY KEY')
      expect(mig179Src).toContain('event_key       TEXT NOT NULL UNIQUE')
      expect(mig179Src).toContain('customer_id     TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE')
      expect(mig179Src).toContain("category        TEXT NOT NULL DEFAULT 'Transactional'")
      expect(mig179Src).toContain("CHECK (category IN ('Transactional', 'Marketing', 'Bite', 'Operational'))")
      expect(mig179Src).toContain('title           TEXT NOT NULL')
      expect(mig179Src).toContain('body            TEXT NOT NULL DEFAULT \'\'')
      expect(mig179Src).toContain('url             TEXT')
      expect(mig179Src).toContain("status          TEXT NOT NULL DEFAULT 'pending'")
      expect(mig179Src).toContain("CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'dead', 'mock'))")
      expect(mig179Src).toContain('channel         TEXT')
      expect(mig179Src).toContain('attempts        INTEGER NOT NULL DEFAULT 0')
      expect(mig179Src).toContain('next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
      expect(mig179Src).toContain('claimed_at      TIMESTAMPTZ')
      expect(mig179Src).toContain('last_error      TEXT')
      expect(mig179Src).toContain('created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()')
      expect(mig179Src).toContain('updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    })

it('มี index: notification_outbox_due_idx (next_attempt_at WHERE pending/failed) + customer_idx', () => {
      expect(mig179Src).toContain('notification_outbox_due_idx')
      expect(mig179Src).toMatch(/ON public\.notification_outbox \(next_attempt_at\)/)
      expect(mig179Src).toMatch(/WHERE status IN \('pending', 'failed'\)/)
      expect(mig179Src).toContain('notification_outbox_customer_idx')
      expect(mig179Src).toMatch(/ON public\.notification_outbox \(customer_id, created_at DESC\)/)
    })

    it('มี RLS: deny_all_client (anon, authenticated = false) + admin_read', () => {
      expect(mig179Src).toContain('ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY')
      expect(mig179Src).toContain("DROP POLICY IF EXISTS outbox_deny_all_client ON public.notification_outbox")
      expect(mig179Src).toContain("CREATE POLICY outbox_deny_all_client ON public.notification_outbox FOR ALL TO anon, authenticated USING (false)")
      expect(mig179Src).toContain("DROP POLICY IF EXISTS outbox_admin_read ON public.notification_outbox")
      expect(mig179Src).toMatch(/CREATE POLICY outbox_admin_read ON public\.notification_outbox[\s\S]*?FOR SELECT TO authenticated USING \(public\.is_admin\(\)\)/)
    })
  })

  // ============================================
  // C — RPCs: register_channel_identity
  // ============================================
  describe('register_channel_identity — ผูก PSID/LINE userId กับลูกค้า', () => {
    it('มี CREATE OR REPLACE FUNCTION register_channel_identity(text, text, text) RETURNS jsonb', () => {
      expect(mig179Src).toContain('CREATE OR REPLACE FUNCTION public.register_channel_identity(')
      expect(mig179Src).toContain('p_channel     text')
      expect(mig179Src).toContain('p_external_id text')
      expect(mig179Src).toContain("p_source      text DEFAULT 'client'")
      expect(mig179Src).toContain('RETURNS jsonb')
      expect(mig179Src).toContain('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public')
    })

    it('มี validation: ERR_NOT_AUTHENTICATED + ERR_INVALID_CHANNEL + ERR_INVALID_EXTERNAL_ID + ERR_NO_CUSTOMER_PROFILE', () => {
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'")
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_INVALID_CHANNEL'")
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_INVALID_EXTERNAL_ID'")
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_NO_CUSTOMER_PROFILE'")
    })

    it('มี logic: DELETE conflicting identity + INSERT ... ON CONFLICT (customer_id, channel) DO UPDATE', () => {
      expect(mig179Src).toContain('DELETE FROM public.channel_identities')
      expect(mig179Src).toContain('WHERE channel = p_channel AND external_id = trim(p_external_id) AND customer_id <> v_customer')
      expect(mig179Src).toContain('INSERT INTO public.channel_identities (id, customer_id, channel, external_id, status, source)')
      expect(mig179Src).toContain('ON CONFLICT (customer_id, channel) DO UPDATE')
      expect(mig179Src).toContain('SET external_id = EXCLUDED.external_id, status = \'active\', source = EXCLUDED.source, updated_at = NOW()')
    })

    it('มี GRANT: REVOKE FROM PUBLIC + GRANT TO authenticated', () => {
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.register_channel_identity(text, text, text) FROM PUBLIC')
      expect(mig179Src).toContain('GRANT EXECUTE ON FUNCTION public.register_channel_identity(text, text, text) TO authenticated')
    })
  })

  // ============================================
  // D — RPCs: enqueue_notification
  // ============================================
  describe('enqueue_notification — จุดเดียวของการยิง event เข้าคิว (idempotent)', () => {
    it('มี CREATE OR REPLACE FUNCTION enqueue_notification(text, text, text, text, text, text) RETURNS jsonb', () => {
      expect(mig179Src).toContain('CREATE OR REPLACE FUNCTION public.enqueue_notification(')
      expect(mig179Src).toContain('p_event_key   text')
      expect(mig179Src).toContain('p_customer_id text DEFAULT NULL')
      expect(mig179Src).toContain("p_category    text DEFAULT 'Transactional'")
      expect(mig179Src).toContain("p_title       text DEFAULT ''")
      expect(mig179Src).toContain("p_body        text DEFAULT ''")
      expect(mig179Src).toContain('p_url         text DEFAULT NULL')
      expect(mig179Src).toContain('RETURNS jsonb')
    })

    it('มี validation: ERR_INVALID_EVENT_KEY + ERR_INVALID_CATEGORY + ERR_MISSING_TITLE', () => {
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_INVALID_EVENT_KEY'")
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_INVALID_CATEGORY'")
      expect(mig179Src).toContain("RAISE EXCEPTION 'ERR_MISSING_TITLE'")
    })

    it('มี idempotency: ON CONFLICT (event_key) DO NOTHING + RETURN inserted flag', () => {
      expect(mig179Src).toContain('ON CONFLICT (event_key) DO NOTHING')
      expect(mig179Src).toContain('v_inserted := FOUND')
      expect(mig179Src).toContain('RETURN jsonb_build_object(\'ok\', true, \'id\', v_id, \'inserted\', v_inserted)')
    })

    it('มี GRANT: REVOKE FROM PUBLIC + GRANT TO authenticated, service_role', () => {
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.enqueue_notification(text, text, text, text, text, text) FROM PUBLIC')
      expect(mig179Src).toContain('GRANT EXECUTE ON FUNCTION public.enqueue_notification(text, text, text, text, text, text) TO authenticated, service_role')
    })
  })

  // ============================================
  // E — RPCs: claim_notification_outbox
  // ============================================
  describe('claim_notification_outbox — เคลมแถว due แบบ FOR UPDATE SKIP LOCKED', () => {
    it('มี CREATE OR REPLACE FUNCTION claim_notification_outbox(integer) RETURNS SETOF notification_outbox', () => {
      expect(mig179Src).toContain('CREATE OR REPLACE FUNCTION public.claim_notification_outbox(p_limit integer DEFAULT 25)')
      expect(mig179Src).toContain('RETURNS SETOF public.notification_outbox')
    })

    it('มี WHERE clause: pending OR (failed + next_attempt_at <= NOW) OR (sending + claimed_at > 10 min) + LIMIT + FOR UPDATE SKIP LOCKED', () => {
      expect(mig179Src).toContain("i.status = 'pending'")
      expect(mig179Src).toContain("(i.status = 'failed'  AND i.next_attempt_at <= NOW())")
      expect(mig179Src).toContain("(i.status = 'sending' AND i.claimed_at < NOW() - interval '10 minutes')")
      expect(mig179Src).toContain('i.next_attempt_at <= NOW()')
      expect(mig179Src).toContain('i.attempts < 5')
      expect(mig179Src).toContain('ORDER BY i.next_attempt_at')
      expect(mig179Src).toContain('LIMIT greatest(1, least(coalesce(p_limit, 25), 100))')
      expect(mig179Src).toContain('FOR UPDATE SKIP LOCKED')
    })

    it('มี GRANT: REVOKE FROM PUBLIC + REVOKE FROM anon,authenticated + GRANT TO service_role เท่านั้น', () => {
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM PUBLIC')
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.claim_notification_outbox(integer) FROM anon, authenticated')
      expect(mig179Src).toContain('GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(integer) TO service_role')
    })
  })

  // ============================================
  // F — RPCs: complete_notification
  // ============================================
  describe('complete_notification — ปิดสถานะเดียวทุกผลลัพธ์ (ok=sent · fail=backoff · >=5=dead · mock=mock)', () => {
    it('มี CREATE OR REPLACE FUNCTION complete_notification(text, boolean, text, text, text) RETURNS jsonb', () => {
      expect(mig179Src).toContain('CREATE OR REPLACE FUNCTION public.complete_notification(')
      expect(mig179Src).toContain('p_id      text')
      expect(mig179Src).toContain('p_ok      boolean')
      expect(mig179Src).toContain('p_channel text DEFAULT NULL')
      expect(mig179Src).toContain('p_error   text DEFAULT NULL')
      expect(mig179Src).toContain("p_final   text DEFAULT NULL")
    })

    it('มี p_final = mock path: status = mock, channel = line, claimed_at = NULL', () => {
      expect(mig179Src).toContain("IF p_final = 'mock' THEN")
      expect(mig179Src).toContain("SET status = 'mock', channel = coalesce(p_channel, 'line')")
      expect(mig179Src).toContain('claimed_at = NULL')
    })

    it('มี p_ok = true path: status = sent + channel + attempts+1', () => {
      expect(mig179Src).toContain('IF coalesce(p_ok, false) THEN')
      expect(mig179Src).toContain("SET status = 'sent', channel = p_channel, attempts = attempts + 1")
    })

    it('มี fail path: v_att >= 5 OR p_final = dead → status = dead · else backoff 2^attempts min (cap 30)', () => {
      expect(mig179Src).toContain('SELECT attempts + 1 INTO v_att FROM public.notification_outbox WHERE id = p_id')
      expect(mig179Src).toContain('IF v_att >= 5 OR p_final = \'dead\' THEN')
      expect(mig179Src).toContain("SET status = 'dead'")
      expect(mig179Src).toContain('least(power(2, greatest(v_att, 1)), 30) * interval \'1 minute\'')
      expect(mig179Src).toContain("SET status = 'failed'")
    })

    it('มี GRANT: REVOKE FROM PUBLIC + REVOKE FROM anon,authenticated + GRANT TO service_role เท่านั้น', () => {
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.complete_notification(text, boolean, text, text, text) FROM PUBLIC')
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.complete_notification(text, boolean, text, text, text) FROM anon, authenticated')
      expect(mig179Src).toContain('GRANT EXECUTE ON FUNCTION public.complete_notification(text, boolean, text, text, text) TO service_role')
    })
  })

  // ============================================
  // G — Feature flags: business_settings.notification_channels
  // ============================================
  describe('business_settings.notification_channels — feature flags (push/messenger on, line off/mock)', () => {
    it('มี DO block INSERT IF NOT EXISTS notification_channels', () => {
      expect(mig179Src).toContain('DO $$ BEGIN')
      expect(mig179Src).toContain("IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'notification_channels') THEN")
      expect(mig179Src).toContain('INSERT INTO public.business_settings (key, value)')
      expect(mig179Src).toContain('VALUES (\'notification_channels\'')
    })

    it('ค่าเริ่มต้น: push=true, messenger=true, line=false, lineMode=mock', () => {
      expect(mig179Src).toContain('"push": true')
      expect(mig179Src).toContain('"messenger": true')
      expect(mig179Src).toContain('"line": false')
      expect(mig179Src).toContain('"lineMode": "mock"')
    })
  })

  // ============================================
  // H — bmb_notify_http — pg_cron bridge to EF notification-dispatcher
  // ============================================
  describe('bmb_notify_http — pg_cron → EF bridge (mirror m178 pattern)', () => {
    it('มี CREATE OR REPLACE FUNCTION bmb_notify_http(text) RETURNS bigint', () => {
      expect(mig179Src).toContain('CREATE OR REPLACE FUNCTION public.bmb_notify_http(p_token text)')
      expect(mig179Src).toContain('RETURNS bigint')
    })

    it('มี net.http_post ไป notification-dispatcher EF พร้อม x-automation-token header', () => {
      expect(mig179Src).toContain('net.http_post(')
      expect(mig179Src).toContain('notification-dispatcher')
      expect(mig179Src).toContain('x-automation-token')
      expect(mig179Src).toContain('jsonb_build_object(\'job\', \'tick\')')
    })

    it('มี EXCEPTION handler: RAISE NOTICE + RETURN NULL (ไม่ throw)', () => {
      expect(mig179Src).toContain('EXCEPTION WHEN OTHERS THEN')
      expect(mig179Src).toContain('RAISE NOTICE \'bmb_notify_http skipped: %\'')
      expect(mig179Src).toContain('RETURN NULL')
    })

    it('มี GRANT: REVOKE FROM PUBLIC + GRANT TO service_role เท่านั้น', () => {
      expect(mig179Src).toContain('REVOKE ALL ON FUNCTION public.bmb_notify_http(text) FROM PUBLIC')
      expect(mig179Src).toContain('GRANT EXECUTE ON FUNCTION public.bmb_notify_http(text) TO service_role')
    })
  })

  // ============================================
  // I — Additive only / no breaking changes
  // ============================================
  describe('Additive only — ไม่มี DROP TABLE/COLUMN/POLICY ที่ทำลายของเดิม', () => {
    it('ไม่มี DROP TABLE', () => {
      expect(mig179Src).not.toContain('DROP TABLE')
    })

    it('ไม่มี DROP COLUMN', () => {
      expect(mig179Src).not.toContain('DROP COLUMN')
    })

    it('DROP POLICY เฉพาะ IF EXISTS policies ที่จะ CREATE ใหม่ (ไม่ลบ policy ที่ไม่ได้กล่าวถึง)', () => {
      // นับจำนวน DROP POLICY ต้องตรงกับจำนวน CREATE POLICY ในไฟล์นี้
      const dropCount = (mig179Src.match(/DROP POLICY IF EXISTS/g) || []).length
      const createCount = (mig179Src.match(/CREATE POLICY/g) || []).length
      expect(dropCount).toBe(createCount)
    })
  })
})