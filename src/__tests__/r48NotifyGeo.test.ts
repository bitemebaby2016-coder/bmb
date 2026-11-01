// Bite Me Baby — R48 · Notification Hub + Geo autofill + Theater calendar (Owner 2026-11-01)
//   ① Unified Manager: schema (channel_identities/outbox) · RPC · plan failover · ② LINE = flag DISABLED/MOCK
//   ③ dispatcher: builders 3 กลุ่ม + drain (push→messenger→line) + idempotent + cron · ④ GPS → เติมที่อยู่อัตโนมัติ
//   ⑤ Theater pre-order = ป้ายปฏิทินมุมบนขวา (ScheduleDateBadge · วันจาก menu_schedule จริง)
import { describe, it, expect } from 'vitest'
import { buildChannelPlan, normalizeChannelFlags, DEFAULT_CHANNEL_FLAGS } from '../../supabase/functions/_shared/notificationPlan'
import managerSrc from '../lib/notifications/notificationManager.ts?raw'
import dispatcherSrc from '../../supabase/functions/notification-dispatcher/index.ts?raw'
import planSrc from '../../supabase/functions/_shared/notificationPlan.ts?raw'
import migSrc from '../../supabase/migrations/179_notification_hub.sql?raw'
import configSrc from '../../supabase/config.toml?raw'
import applySrc from '../../e2e/r48Apply179.cjs?raw'
import geoSrc from '../lib/googleMaps.ts?raw'
import checkoutSrc from '../pages/CheckoutPage.tsx?raw'
import theaterCardsSrc from '../components/theater/TheaterCards.tsx?raw'
import foodTheaterSrc from '../components/theater/FoodTheater.tsx?raw'

const baseFlags = { ...DEFAULT_CHANNEL_FLAGS }
const fullBindings = { hasPushSub: true, hasMessengerId: true, pushEnabled: true, categoryEnabled: true }

describe('R48-1 · Notification plan = failover web_push → messenger → line (PURE core ที่เดียว)', () => {
  it('มี subscription + PSID = แผน web_push ก่อน messenger (Owner: PWA push ก่อน fallback FB)', () => {
    const plan = buildChannelPlan(baseFlags, fullBindings)
    expect(plan.steps.map((s) => s.channel)).toEqual(['web_push', 'messenger'])
    expect(plan.mockIfNone).toBe(true) // LINE ยังไม่ live = mock fallback เมื่อไม่มีช่องทางส่ง
  })

  it('push ไม่มี/ปิด = เหลือ messenger เดียว · หมวดปิด = แผนว่าง · LINE flag live เท่านั้นเข้าแผน', () => {
    expect(buildChannelPlan(baseFlags, { ...fullBindings, hasPushSub: false }).steps.map((s) => s.channel)).toEqual(['messenger'])
    expect(buildChannelPlan(baseFlags, { ...fullBindings, pushEnabled: false }).steps.map((s) => s.channel)).toEqual(['messenger'])
    expect(buildChannelPlan(baseFlags, { ...fullBindings, categoryEnabled: false }).steps).toEqual([])
    expect(buildChannelPlan(normalizeChannelFlags({ line: false, lineMode: 'mock' }), fullBindings).steps.some((s) => s.channel === 'line')).toBe(false)
    const live = buildChannelPlan(normalizeChannelFlags({ line: true, lineMode: 'live' }), fullBindings)
    expect(live.steps.map((s) => s.channel)).toEqual(['web_push', 'messenger', 'line'])
    expect(live.mockIfNone).toBe(false)
    expect(normalizeChannelFlags(null)).toEqual(DEFAULT_CHANNEL_FLAGS)
    expect(normalizeChannelFlags({ lineMode: 'live' }).line).toBe(true)
  })

  it('plan source มีคำอธิบายสัญญาครบ + m179 schema/RLS ครบ', () => {
    expect(planSrc).toContain("lineMode: 'disabled' | 'mock' | 'live'")
    expect(planSrc).toContain('web_push ก่อน')
    expect(planSrc).toContain('mockIfNone')
    expect(migSrc).toContain('CREATE TABLE IF NOT EXISTS public.channel_identities')
    expect(migSrc).toContain("CHECK (channel IN ('messenger', 'line'))")
    expect(migSrc).toContain('CONSTRAINT uq_channel_identity UNIQUE (channel, external_id)')
    expect(migSrc).toContain('CREATE TABLE IF NOT EXISTS public.notification_outbox')
    expect(migSrc).toContain('TEXT NOT NULL UNIQUE')
    expect(migSrc).toContain("('pending', 'sending', 'sent', 'failed', 'dead', 'mock')")
    expect(migSrc).toContain('channel_ident_deny_anon')
    expect(migSrc).toContain('outbox_deny_all_client')
  })
})
// MARKER_R48B
describe('R48-2 · m179 RPC idempotent + backoff/dead + SKIP LOCKED + flags LINE mock + cron bridge (ไม่มี secret)', () => {
  it('RPC ครบ 4 ตัว + idempotent + backoff/dead + grant เฉพาะทางที่ถูก + config verify_jwt=false', () => {
    expect(migSrc).toContain('public.register_channel_identity')
    expect(migSrc).toContain('public.enqueue_notification')
    expect(migSrc).toContain('ON CONFLICT (event_key) DO NOTHING')
    expect(migSrc).toContain('public.claim_notification_outbox')
    expect(migSrc).toContain('FOR UPDATE SKIP LOCKED')
    expect(migSrc).toContain('public.complete_notification')
    expect(migSrc).toContain("v_att >= 5 OR p_final = 'dead'")
    expect(migSrc).toContain('least(power(2')
    expect(migSrc).toContain('TO authenticated, service_role')
    expect(migSrc).toContain('FROM anon, authenticated')
    expect(migSrc).toContain("'notification_channels'")
    expect(migSrc).toContain('"lineMode": "mock"')
    expect(migSrc).toContain('public.bmb_notify_http')
    expect(migSrc).toContain('EXCEPTION WHEN OTHERS')
    expect(migSrc).toContain('bmb_notify_http(p_token text)')
    expect(configSrc).toContain('[functions.notification-dispatcher]')
    expect(configSrc).toContain('verify_jwt = false')
    expect(applySrc).toContain('bmb-notify')
    expect(applySrc).toContain('.env.local')
    expect(applySrc).toContain('r48Apply179-result.json')
  })
})
// MARKER_TESTS_2 — (cleaned: marker ไม่จำเป็นแล้ว คงไว้เป็น comment ธรรมดา)
describe('R48-3 · dispatcher = builders 3 กลุ่ม + drain ไม่ loop + ไม่แตะ core business', () => {
  it('builders: transactional/reminder/reengagement/points จริง + abandoned cart/peak = skip ซื่อสัตย์ (ZERO-FAKE)', () => {
    expect(dispatcherSrc).toContain('buildFromNotifications')
    expect(dispatcherSrc).toContain('buildPreOrderReminders')
    expect(dispatcherSrc).toContain('buildReengagement')
    expect(dispatcherSrc).toContain('buildPointsEarn')
    expect(dispatcherSrc).toContain('buildAbandonedCart')
    expect(dispatcherSrc).toContain('buildPeakHourPrompt')
    expect(dispatcherSrc).toContain('flag_off')
  })

  it('drain = claim → plan → push-send reuse → graph messenger → complete · ไม่มี loop ไม่รู้จบ · ไม่แก้ business rows', () => {
    expect(dispatcherSrc).toContain('claim_notification_outbox')
    expect(dispatcherSrc).toContain('buildChannelPlan(flags')
    expect(dispatcherSrc).toContain('functions/v1/push-send') // reuse EF เดิม — ไม่เขียน web-push ใหม่
    expect(dispatcherSrc).toContain('graph.facebook.com/v21.0/me/messages')
    expect(dispatcherSrc).toContain('complete_notification')
    expect(dispatcherSrc).toContain("p_final: 'mock'")
    expect(dispatcherSrc).not.toContain('while (') // ไม่มี loop ไม่รู้จบ
    expect(dispatcherSrc).not.toContain('create_order_with_items') // ไม่แตะ core order path
    expect(dispatcherSrc).toContain('x-automation-token')
    expect(dispatcherSrc).toContain('ERR_UNCAUGHT')
  })
})

describe('R48-4 · client manager = abstraction บาง ๆ (emit/register/flags · push ใช้ของเดิม ไม่เขียนซ้ำ)', () => {
  it('manager: emitNotification → enqueue_notification · registerChannelIdentity → RPC · flags อ่าน business_settings', () => {
    expect(managerSrc).toContain("rpc('enqueue_notification'")
    expect(managerSrc).toContain("rpc('register_channel_identity'")
    expect(managerSrc).toContain("eq('key', 'notification_channels')")
    expect(managerSrc).toContain("from '@/lib/pushService'") // import เดิม ไม่ duplicate transport
    expect(managerSrc).toContain('export { enablePush, getPushPermissionState')
    expect(managerSrc).not.toContain('new Notification(') // ไม่เขียน push client ใหม่เอง
  })
})

describe('R48-5 · GPS → เติมที่อยู่อัตโนมัติ (Google first · Nominatim fallback) + checkout ใช้จริง', () => {
  it('reverseGeocode: fallback nominatim เมื่อ Google fail · handleUseGps เติม detail ถ้ายังว่าง', () => {
    expect(geoSrc).toContain('nominatim.openstreetmap.org/reverse')
    expect(geoSrc).toContain('accept-language=th')
    expect(checkoutSrc).toContain('const geo = await reverseGeocode(loc.latitude, loc.longitude)')
    expect(checkoutSrc).toContain('hadDetail')
    expect(checkoutSrc).toContain('เติมที่อยู่อัตโนมัติ')
  })
})

describe('R48-6 · Theater pre-order = ป้ายปฏิทินมุมบนขวา (ScheduleDateBadge · วันจาก schedule จริง)', () => {
  it('RecommendationCard + TheaterHeroCard มี badge + FoodTheater ส่ง schedule[p.id] เท่านั้น', () => {
    expect(theaterCardsSrc).toContain('ScheduleDateBadge')
    expect(theaterCardsSrc).toContain('data-testid="theater-rec-cal"')
    expect(theaterCardsSrc).toContain('data-testid="theater-hero-cal"')
    expect(theaterCardsSrc).toContain('scheduledDate?: string')
    expect(foodTheaterSrc).toContain('scheduledDate={schedule[p.id]}')
  })
})