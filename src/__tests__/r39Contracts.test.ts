import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const migSrc = read('supabase/migrations/177_marketing_publish_due.sql')
const feedSrc = read('src/components/home/MarketingFeedSection.tsx')
const libSrc = read('src/lib/adminMarketing.ts')
const mkSrc = read('src/pages/admin/AdminMarketing.tsx')
const flashSrc = read('src/lib/uiFlash.ts')
const cssSrc = read('src/index.css')
const workerSrc = read('supabase/functions/automation-worker/index.ts')
const schedSrc = read('.github/workflows/automation-scheduler.yml')
const imgSrc = read('supabase/functions/image-gen/index.ts')
const r38Src = read('src/__tests__/r38Contracts.test.ts')

describe('R39-1 · ตั้งเวลาโพสต์ไม่ขึ้น — m177 promote ไม่พึ่ง GH cron (หลักฐาน: cron ข้ามรอบ · att=0)', () => {
  it('m177: marketing_publish_due (SECURITY DEFINER · promote scheduled ที่ถึงเวลา) + feed RPC promote ก่อนคืนแถว', () => {
    expect(migSrc).toContain('CREATE OR REPLACE FUNCTION public.marketing_publish_due()')
    expect(migSrc).toContain('SECURITY DEFINER')
    expect(migSrc).toContain("WHERE status = 'scheduled'")
    expect(migSrc).toContain('scheduled_for <= now()')
    expect(migSrc).toContain("SET status = 'published'")
    expect(migSrc).toContain('CREATE OR REPLACE FUNCTION public.marketing_feed_posts(p_limit integer DEFAULT 6)')
    expect(migSrc).toContain('PERFORM public.marketing_publish_due()')
    expect(migSrc).toContain('RETURNS SETOF public.marketing_posts')
  })

  it('m177: grants = anon+authenticated อ่าน feed ได้ · PUBLIC ถูก revoke · pg_cron guarded (ไม่มี extension = ข้ามเงียบ)', () => {
    expect(migSrc).toContain('REVOKE EXECUTE ON FUNCTION public.marketing_publish_due() FROM PUBLIC')
    expect(migSrc).toContain('GRANT EXECUTE ON FUNCTION public.marketing_publish_due() TO anon, authenticated, service_role')
    expect(migSrc).toContain('GRANT EXECUTE ON FUNCTION public.marketing_feed_posts(integer) TO anon, authenticated, service_role')
    expect(migSrc).toContain("cron.schedule('bmb-marketing-publish-due'")
    expect(migSrc).toContain('EXCEPTION WHEN OTHERS THEN')
  })

  it('client: feed ใช้ RPC · admin list promote ก่อนดึงรายการ', () => {
    expect(feedSrc).toContain("supabase.rpc('marketing_feed_posts'")
    expect(libSrc).toContain("await supabase.rpc('marketing_publish_due')")
    expect(r38Src).toContain('marketing_feed_posts') // r38 feed block อัปเดตตาม RPC แล้ว
  })

  it('worker: รับ published-but-unpushed ต่อด้วย (FB ไม่ค้าง) · ห้าม demote แถว published เป็น failed', () => {
    expect(workerSrc).toContain('or=(status.eq.scheduled,and(status.eq.published,provider_post_id.is.null))')
    expect(workerSrc).toContain('select=id,status,approval_id,image_urls,publish_attempts')
    expect(workerSrc).toContain("if (row.status === 'scheduled')")
    // เงื่อนไข demote มี 2 จุด (no approval + approval ไม่ approved) — ทั้งคู่ต้อง gate ด้วย status
    expect(workerSrc.match(/if \(row\.status === 'scheduled'\)/g)!.length).toBeGreaterThanOrEqual(2)
  })

  it('scheduler: marketing ยิงทุกครั้งที่ fire (รวม */5) — ไม่ผูกกับ cron ชั่วโมงเดียวที่ GH ข้ามรอบ', () => {
    expect(schedSrc).toContain('hourly-marketing:')
    expect(schedSrc).toContain("if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'")
    // เงื่อนไข "เก่า" ของ marketing (ผูกกับ cron ชั่วโมงเดียว) ต้องหายไป — job อื่น (low-stock) ไม่เกี่ยว ห้ามแตะ
    expect(schedSrc).not.toContain("github.event.schedule == '7 * * * *' || github.event_name == 'workflow_dispatch' && (github.event.inputs.job == 'marketing'")
    expect(schedSrc).toContain('marketing_publish_enqueue')
    expect(schedSrc).toContain('marketing_publish_dispatch')
  })
})
describe('R39-2 · image-gen — ภาพอ้างอิงทำร่วมเจน + auto brief + attempts ทุกตัว', () => {
  it('EF: reference_image_url → pass with-ref ก่อน · fail หมด = retry text-only', () => {
    expect(imgSrc).toContain('reference_image_url')
    expect(imgSrc).toContain("const passes: Array<'with-ref' | 'text-only'>")
    expect(imgSrc).toContain("{ type: 'image_url', image_url: { url: refUrl } }")
    expect(imgSrc).toContain('break outer')
  })

  it('EF: detail = attempts รวมทุกโมเดล (ไม่ใช่แค่ตัวสุดท้าย — Owner เห็นเหตุจริงทุกชื่อ) + คืน model ที่สำเร็จ', () => {
    expect(imgSrc).toContain('const attempts: string[] = []')
    // R41: attempts แยก 2 ทาง (images API + chat) ทุกโมเดล
    expect(imgSrc).toContain('attempts.push(`${model}:images${ir.status}')
    expect(imgSrc).toContain('attempts.push(`${model}:chat${res.status}')
    expect(imgSrc).toContain("attempts.join(' · ')")
    expect(imgSrc).toContain('model: usedModel')
  })

  it('AdminMarketing: auto subject จากหัวข้อโพสต์ · note จากเนื้อหา · reference = ภาพที่ชี้ล่าสุด', () => {
    expect(mkSrc).toContain('const subject = genSubject.trim() || title.trim()')
    expect(mkSrc).toContain('bodyText.trim().slice(0, 160)')
    expect(mkSrc).toContain('images[images.length - 1]')
    expect(mkSrc).toContain('reference_image_url: reference')
    expect(mkSrc).toContain("flashTo('mk-images-strip')")
  })
})

describe('R39-3 · จิ้มปุ่มแล้วเด้งไปจุดที่ทำงาน (Owner) — flashTo + data-testid ครบทุกจุด', () => {
  it('uiFlash: retry รอ re-render + scrollIntoView + .bmb-flash (CSS มี keyframes จริง)', () => {
    expect(flashSrc).toContain('scrollIntoView')
    expect(flashSrc).toContain("classList.add('bmb-flash')")
    expect(flashSrc).toContain('tries < 12')
    expect(cssSrc).toContain('.bmb-flash {')
    expect(cssSrc).toContain('@keyframes bmbFlash')
  })

  it('AdminMarketing: ทุก action หลัง load() เรียก flashTo ไปที่แถว/การ์ด/สตรีมที่เพิ่งเปลี่ยน', () => {
    expect(mkSrc).toContain("setTab('approval')")
    expect(mkSrc).toContain("flashTo('mk-approval-list')")
    expect(mkSrc.match(/flashTo\(`mk-aprow-\$\{id\}`\)/g)!.length).toBeGreaterThanOrEqual(2)
    expect(mkSrc).toContain('flashTo(`mk-row-${id}`)')
    expect(mkSrc).toContain('flashTo(`mk-row-${res.plan[0].id}`)')
    expect(mkSrc).toContain('data-testid={`mk-row-${p.id}`}')
    expect(mkSrc).toContain('data-testid={`mk-aprow-${a.id}`}')
    expect(mkSrc).toContain('data-testid="mk-approval-list"')
    expect(mkSrc).toContain('data-testid="mk-images-strip"')
    expect(mkSrc.match(/flashTo\('mk-images-strip'\)/g)!.length).toBeGreaterThanOrEqual(2)
  })
})