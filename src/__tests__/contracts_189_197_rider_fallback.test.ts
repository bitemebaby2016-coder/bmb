// ============================================
// Bite Me Baby — R189/R197 source-contract test
// Migration 189: CLAIM FALLBACK = ACCEPT (ไรเดอร์ "รับงานไม่ได้" → assigned = auto-accept)
// Migration 197: ไรเดอร์ "ปิดลูปแล้วต้องว่าง" (R87) — available เมื่อไม่มีงานค้างจริงของออเดอร์ที่ยังมีชีวิต
// ============================================

import { describe, it, expect } from 'vitest'
import mig189Src from '../../supabase/migrations/189_claim_offer_accept_fallback.sql?raw'
import mig197Src from '../../supabase/migrations/197_rider_available_after_loop.sql?raw'

describe('R189/R197 — Rider Claim Fallback + Available After Loop', () => {
  // ============================================
  // A — Migration 189: Claim Dispatch Offer Fallback
  // ============================================
  describe('Migration 189: Claim Dispatch Offer Fallback (R72)', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig189Src).toContain('BEGIN;')
      expect(mig189Src).toContain('COMMIT;')
    })

    it('มี CREATE OR REPLACE FUNCTION claim_dispatch_offer(text) RETURNS jsonb', () => {
      expect(mig189Src).toContain('CREATE OR REPLACE FUNCTION public.claim_dispatch_offer(')
      expect(mig189Src).toContain('p_order_number text')
      expect(mig189Src).toContain('RETURNS jsonb')
      expect(mig189Src).toContain('LANGUAGE plpgsql')
      expect(mig189Src).toContain('SECURITY DEFINER')
      expect(mig189Src).toContain('SET search_path = public')
    })

    it('validation ครบ: auth, driver, order_status (ready_for_dispatch/dispatched/confirmed/preparing)', () => {
      expect(mig189Src).toContain("v_uid := auth.uid()")
      expect(mig189Src).toContain("IF v_uid IS NULL THEN RAISE EXCEPTION 'ERR_NOT_AUTHENTICATED'")
      expect(mig189Src).toContain("SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid")
      expect(mig189Src).toContain("IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'")
      expect(mig189Src).toContain("SELECT status INTO v_order_status FROM public.orders WHERE order_number = p_order_number")
      expect(mig189Src).toContain("IF v_order_status NOT IN ('ready_for_dispatch', 'dispatched', 'confirmed', 'preparing') THEN")
      expect(mig189Src).toContain("RAISE EXCEPTION 'ERR_ORDER_NOT_DISPATCHABLE'")
    })

    it('Fallback logic: assignment status = assigned ของตัวเอง → auto-accept (update assignment + driver status + order sync)', () => {
      expect(mig189Src).toContain("IF v_asg_status = 'assigned' THEN")
      expect(mig189Src).toContain("UPDATE public.delivery_assignments")
      expect(mig189Src).toContain("SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW()), updated_at = NOW()")
      expect(mig189Src).toContain("WHERE order_number = p_order_number AND driver_id = v_drv.id AND status = 'assigned'")
      expect(mig189Src).toContain("UPDATE public.drivers SET status = 'busy', last_seen_at = NOW(), updated_at = NOW() WHERE id = v_drv.id")
    })

    it('ถ้า order_status = ready_for_dispatch → sync to dispatched + audit log', () => {
      expect(mig189Src).toContain("IF v_order_status_txt = 'ready_for_dispatch' THEN")
      expect(mig189Src).toContain("PERFORM set_config('app.delivery_sync_order', p_order_number, true)")
      expect(mig189Src).toContain("UPDATE public.orders SET status = 'dispatched'")
      expect(mig189Src).toContain("WHERE order_number = p_order_number")
      expect(mig189Src).toContain("PERFORM public.append_audit_log(")
      expect(mig189Src).toContain("p_action := 'order_status_change'")
      expect(mig189Src).toContain("p_description := 'delivery sync ready_for_dispatch -> dispatched (driver ' || v_drv.id || ')'")
      expect(mig189Src).toContain("'source', 'claim_dispatch_offer_assigned_fallback'")
    })

    it('คืน jsonb ok=true, via=assigned_fallback', () => {
      expect(mig189Src).toContain("RETURN jsonb_build_object('ok', true, 'order_number', p_order_number, 'driver_id', v_drv.id, 'status', 'accepted', 'via', 'assigned_fallback')")
    })

it('Atomic claim: UPDATE dispatch_offers status = claimed WHERE offered RETURNING id', () => {
      expect(mig189Src).toMatch(/UPDATE public\.dispatch_offers[\s\S]*?SET status = 'claimed'/)
      expect(mig189Src).toContain("WHERE order_number = p_order_number AND status = 'offered'")
      expect(mig189Src).toContain("RETURNING id INTO v_offer_id")
      expect(mig189Src).toMatch(/IF NOT FOUND THEN[\s\S]*?RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE'/)
    })

    it('Guard: assignment active ของคนอื่น (assigned/accepted/picked_up/in_transit) → ERR_OFFER_NOT_AVAILABLE', () => {
      expect(mig189Src).toContain("SELECT status INTO v_asg_status FROM public.delivery_assignments WHERE order_number = p_order_number")
      expect(mig189Src).toContain("IF v_asg_status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN")
      expect(mig189Src).toContain("RAISE EXCEPTION 'ERR_OFFER_NOT_AVAILABLE'")
    })

    it('Create assignment: INSERT ON CONFLICT (order_number) DO UPDATE (re-run safe)', () => {
      expect(mig189Src).toMatch(/INSERT INTO public\.delivery_assignments[\s\S]*?\(id, order_number, driver_id, status, branch_id, assigned_at, accepted_at, notes, created_at, updated_at\)/)
      expect(mig189Src).toContain("ON CONFLICT (order_number) DO UPDATE")
      expect(mig189Src).toMatch(/SET driver_id = EXCLUDED\.driver_id, status = 'accepted', branch_id = EXCLUDED\.branch_id/)
      expect(mig189Src).toContain("assigned_at = NOW(), accepted_at = NOW()")
      expect(mig189Src).toContain("picked_up_at = NULL, in_transit_at = NULL, delivered_at = NULL")
      expect(mig189Src).toContain("proof_of_delivery_url = NULL, proof_of_delivery_path = NULL")
    })

    it('GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated, service_role', () => {
      expect(mig189Src).toContain("REVOKE ALL ON FUNCTION public.claim_dispatch_offer(text) FROM PUBLIC, anon")
      expect(mig189Src).toContain("GRANT EXECUTE ON FUNCTION public.claim_dispatch_offer(text) TO authenticated, service_role")
    })
  })

  // ============================================
  // B — Migration 197: Rider Available After Loop (R87)
  // ============================================
  describe('Migration 197: Rider Available After Loop (R87)', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig197Src).toContain('BEGIN;')
      expect(mig197Src).toContain('COMMIT;')
    })

    it('CREATE OR REPLACE FUNCTION driver_update_delivery_status(text, text, text, numeric, numeric) RETURNS jsonb', () => {
      expect(mig197Src).toContain('CREATE OR REPLACE FUNCTION public.driver_update_delivery_status(')
      expect(mig197Src).toContain('p_order_number text')
      expect(mig197Src).toContain('p_driver_phone text')
      expect(mig197Src).toContain('p_status text')
      expect(mig197Src).toContain('p_latitude numeric DEFAULT NULL')
      expect(mig197Src).toContain('p_longitude numeric DEFAULT NULL')
      expect(mig197Src).toContain('RETURNS jsonb')
    })

    it('Validation: p_status IN (picked_up, in_transit, delivered), p_order_number required', () => {
      expect(mig197Src).toContain("IF p_status NOT IN ('picked_up', 'in_transit', 'delivered') THEN")
      expect(mig197Src).toContain("RAISE EXCEPTION 'ERR_INVALID_DELIVERY_STATUS'")
      expect(mig197Src).toContain("IF p_order_number IS NULL OR trim(p_order_number) = '' THEN")
      expect(mig197Src).toContain("RAISE EXCEPTION 'ERR_MISSING_DRIVER_INFO'")
    })

    it('Identity = JWT ONLY (p_driver_phone ignored — spoof-safe)', () => {
      expect(mig197Src).toContain("v_uid := auth.uid()")
      expect(mig197Src).toContain("SELECT * INTO v_drv FROM public.drivers WHERE user_id = v_uid")
      expect(mig197Src).toContain("IF NOT FOUND THEN RAISE EXCEPTION 'ERR_NOT_A_DRIVER'")
    })

    it('Assignment checks: FOUND, not delivered, not closed (declined/cancelled)', () => {
      expect(mig197Src).toMatch(/SELECT status, proof_of_delivery_path INTO v_cur, v_pod_path[\s\S]*?FROM public\.delivery_assignments[\s\S]*?WHERE order_number = p_order_number AND driver_id = v_drv\.id/)
      expect(mig197Src).toContain("IF NOT FOUND THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_NOT_FOUND'")
      expect(mig197Src).toContain("IF v_cur = 'delivered' THEN RAISE EXCEPTION 'ERR_ALREADY_DELIVERED'")
      expect(mig197Src).toContain("IF v_cur IN ('declined', 'cancelled') THEN RAISE EXCEPTION 'ERR_ASSIGNMENT_CLOSED'")
    })

    it('POD required ก่อน delivered + geofence 0.3 km (เมื่อมีพิกัดทั้งสองฝั่ง)', () => {
      expect(mig197Src).toMatch(/IF p_status = 'delivered' AND v_pod_path IS NULL THEN[\s\S]*?RAISE EXCEPTION 'ERR_POD_REQUIRED'/)
      expect(mig197Src).toContain("IF p_status = 'delivered' AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN")
      expect(mig197Src).toContain("v_dist_km := public.haversine_km(")
      expect(mig197Src).toMatch(/IF v_dist_km > 0\.3 THEN[\s\S]*?RAISE EXCEPTION 'ERR_GEOFENCE: % km from dropoff \(max 0\.3\)'/)
    })

    it('Sync canonical orders.status (forward-only, allow-list): picked_up→dispatched, in_transit→in_transit, delivered→delivered', () => {
      expect(mig197Src).toContain("v_target := CASE p_status")
      expect(mig197Src).toContain("WHEN 'picked_up'  THEN 'dispatched'")
      expect(mig197Src).toContain("WHEN 'in_transit' THEN 'in_transit'")
      expect(mig197Src).toContain("WHEN 'delivered'  THEN 'delivered'")
    })

    it('WHILE loop hop chain: ready_for_dispatch→dispatched→in_transit→arrived→delivered + order_transition_allowed guard', () => {
      expect(mig197Src).toContain("WHILE v_hop_from <> v_target LOOP")
      expect(mig197Src).toContain("v_hop_to := CASE v_hop_from")
      expect(mig197Src).toContain("WHEN 'ready_for_dispatch' THEN 'dispatched'")
      expect(mig197Src).toContain("WHEN 'dispatched'         THEN 'in_transit'")
      expect(mig197Src).toContain("WHEN 'in_transit'         THEN 'arrived'")
      expect(mig197Src).toContain("WHEN 'arrived'            THEN 'delivered'")
      expect(mig197Src).toMatch(/IF v_hop_to IS NULL[\s\S]*?OR NOT public\.order_transition_allowed\(v_hop_from, v_hop_to, true, false\) THEN/)
      expect(mig197Src).toContain("RAISE EXCEPTION 'ERR_DELIVERY_SYNC_BLOCKED: order % cannot advance % -> % (target %)'")
    })

it('R16 + R87 guard: delivered → available เฉพาะเมื่อไม่มีงานค้างจริงของออเดอร์ที่ยังมีชีวิต', () => {
      expect(mig197Src).toMatch(/UPDATE public\.drivers[\s\S]*?SET status = CASE WHEN p_status = 'delivered' THEN 'available' ELSE 'busy' END/)
      expect(mig197Src).toContain("WHERE id = v_drv.id")
      expect(mig197Src).toContain("p_status <> 'delivered'")
      expect(mig197Src).toContain("OR NOT EXISTS (")
      expect(mig197Src).toMatch(/SELECT 1 FROM public\.delivery_assignments da[\s\S]*?WHERE da\.driver_id = v_drv\.id/)
      expect(mig197Src).toContain("AND da.order_number <> p_order_number")
      expect(mig197Src).toContain("AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')")
      expect(mig197Src).toMatch(/AND EXISTS \([\s\S]*?SELECT 1 FROM public\.orders o[\s\S]*?WHERE o\.order_number = da\.order_number[\s\S]*?AND o\.status NOT IN \('cancelled', 'failed', 'delivered'\)/)
    })

    it('Backfill ②: ปิด assignment ของออเดอร์ตาย/หาย (cancelled/failed/delivered) → cancelled', () => {
      expect(mig197Src).toMatch(/UPDATE public\.delivery_assignments da[\s\S]*?SET status = 'cancelled'/)
      expect(mig197Src).toContain("WHERE da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')")
      expect(mig197Src).toContain("AND NOT EXISTS (")
      expect(mig197Src).toMatch(/SELECT 1 FROM public\.orders o[\s\S]*?WHERE o\.order_number = da\.order_number[\s\S]*?AND o\.status NOT IN \('cancelled', 'failed', 'delivered'\)/)
    })

    it('Backfill ③: คืน available ให้ไรเดอร์ที่ busy โดยไม่มีงานจริง', () => {
      expect(mig197Src).toMatch(/UPDATE public\.drivers d[\s\S]*?SET status = 'available'/)
      expect(mig197Src).toContain("WHERE d.status = 'busy'")
      expect(mig197Src).toContain("AND NOT EXISTS (")
      expect(mig197Src).toMatch(/SELECT 1 FROM public\.delivery_assignments da[\s\S]*?WHERE da\.driver_id = d\.id/)
      expect(mig197Src).toContain("AND da.status IN ('assigned', 'accepted', 'picked_up', 'in_transit', 'arrived')")
      expect(mig197Src).toMatch(/AND EXISTS \([\s\S]*?SELECT 1 FROM public\.orders o[\s\S]*?WHERE o\.order_number = da\.order_number[\s\S]*?AND o\.status NOT IN \('cancelled', 'failed', 'delivered'\)/)
    })

    it('GRANT: REVOKE FROM PUBLIC, anon + GRANT TO authenticated', () => {
      expect(mig197Src).toContain("REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM PUBLIC")
      expect(mig197Src).toContain("REVOKE EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) FROM anon")
      expect(mig197Src).toContain("GRANT EXECUTE ON FUNCTION public.driver_update_delivery_status(text, text, text, numeric, numeric) TO authenticated")
    })
  })

  // ============================================
  // C — Additive/Idempotent checks
  // ============================================
  describe('Additive/Idempotent — ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ', () => {
    it('Migration 189: ไม่มี DROP TABLE/COLUMN ในโค้ดจริง, CREATE OR REPLACE ฟังก์ชันครบ', () => {
      const codeSection = mig189Src.substring(mig189Src.indexOf('BEGIN;'))
      expect(codeSection).not.toContain('DROP TABLE')
      expect(codeSection).not.toContain('DROP COLUMN')
      expect(mig189Src).toContain('CREATE OR REPLACE FUNCTION public.claim_dispatch_offer')
    })

    it('Migration 197: ไม่มี DROP TABLE/COLUMN ในโค้ดจริง, CREATE OR REPLACE ฟังก์ชันครบ', () => {
      const codeSection = mig197Src.substring(mig197Src.indexOf('BEGIN;'))
      expect(codeSection).not.toContain('DROP TABLE')
      expect(codeSection).not.toContain('DROP COLUMN')
      expect(mig197Src).toContain('CREATE OR REPLACE FUNCTION public.driver_update_delivery_status')
    })
  })
})