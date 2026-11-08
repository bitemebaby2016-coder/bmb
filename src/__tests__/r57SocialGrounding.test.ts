// ============================================
// Bite Me Baby — R57 (Owner 2026-11-02):
//  ① ตอบข้อมูลจริงตามโพสต์และตามเว็บ (ฉีดโพสต์ต้นทาง + กติกา grounding + สรุปตรงระบบ)
//  ② สรุปออเดอร์แนบลิงก์ตะกร้าทุกเคส (เช็คเอาท์/เพิ่มเมนูต่อจากที่สรุป ไม่ต้องจิ้มใหม่)
//  ③ กดลิงก์จาก Facebook = บังคับเบราว์เซอร์ภายนอก (ห้ามใช้เบราว์เซอร์ของเฟซ)
//  ④ /shop?cart= = retry เติมตะกร้า 700ms (เคสเปิดก่อน hydration ทัน)
// ============================================
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { extractSourcePostId, fetchPostMessage } from '../../supabase/functions/_shared/socialPostContext.ts'
import { externalBrowserIntentUrl } from '@/components/layout/InAppBrowserNotice'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const workerSrc = read('supabase/functions/social-ai-worker/index.ts')
const intakeSrc = read('supabase/functions/_shared/socialOrderIntake.ts')
const noticeSrc = read('src/components/layout/InAppBrowserNotice.tsx')
const layoutSrc = read('src/components/layout/Layout.tsx')

describe('R57 ① — ตอบข้อมูลจริงตามโพสต์ต้นทาง + ตามเว็บ (social-ai-worker)', () => {
  it('ดึง post_id จาก payload (poll/webhook) แล้วใส่ "โพสต์ต้นทาง (DATA)" เป็นบริบทหลักของคำตอบ', () => {
    expect(workerSrc).toContain("from '../_shared/socialPostContext.ts'")
    expect(workerSrc).toContain('extractSourcePostId(ev.payload)')
    expect(workerSrc).toContain('fetchPostMessage(sourcePostId, META_PAGE)')
    expect(workerSrc).toContain('โพสต์ต้นทาง (DATA — บริบทหลักของคอมเมนต์นี้)')
    // payload ต้องถูก select มาด้วย (เดิมไม่มี → หา post_id ไม่ได้)
    expect(workerSrc).toMatch(/select=id,event_id,platform,event_type,sender_id,sender_name,page_id,content,payload,attempts/g)
  })

  it('กติกา REPLY_GROUNDING_RULES ถูกฉีดเข้า draftSystem (ตามโพส/ตามเว็บ · ห้ามจำเมนูเก่า · สรุปเป๊ะ)', () => {
    expect(workerSrc).toContain('const REPLY_GROUNDING_RULES')
    expect(workerSrc).toContain('ห้ามจำเมนูจากโพสต์ก่อนหน้า')
    expect(workerSrc).toContain('ห้ามแต่งชื่อเมนูใหม่ ห้ามเดาราคา ห้ามจำจากโพสเก่า')
    expect(workerSrc).toContain('ให้สรุปชื่อเมนูและจำนวนตามนั้นเป๊ะ ๆ ห้ามแก้')
    expect(workerSrc).toContain('ห้ามสร้าง/เดารายการสั่งซื้อเอง')
    // ผูกเข้า system prompt ชุดเดียวกับ persona + continuity + shopCtx (ของเดิม)
    expect(workerSrc).toMatch(/REPLY_CONTINUITY_RULES \+ '\\n\\n' \+ REPLY_GROUNDING_RULES/)
    expect(workerSrc).toContain('ข้อมูลร้านจริง (DATA — ตอบจากนี้เท่านั้น ห้ามมโน)')
  })

  it('semanticDraft บังคับชื่อเมนูจริงจากระบบปรากฏครบ (summary_mismatch) + retry 1 ครั้ง + ไม่เงียบถ้ามี footer', () => {
    expect(workerSrc).toContain('requiredPhrases: string[] = []')
    expect(workerSrc).toContain("'summary_mismatch:' + phrase.slice(0, 40)")
    // retry: ส่งเหตุผลกลับให้โมเดลแก้ 1 ครั้ง (attempt <= 2)
    expect(workerSrc).toContain('for (let attempt = 1; attempt <= 2; attempt++)')
    expect(workerSrc).toContain('คำตอบก่อนหน้าไม่ผ่าน')
    // ยังไม่ผ่าน = fallback ส่ง footer ระบบ (intakeFooter) ทั้งตอน parse และ semantic fail
    expect(workerSrc).toMatch(/if \(!draftParsed\.ok\) \{\s*\n\s*if \(intakeFooter\) return fallbackIntakeReply/)
    expect(workerSrc).toMatch(/if \(!draftSem\.ok\) \{\s*\n\s*if \(intakeFooter\) return fallbackIntakeReply/)
    // intake ไม่ได้สรุป → note ห้ามให้โมเดลเดาสรุปเอง
    expect(workerSrc).toContain('ระบบยังสรุปรายการให้ไม่ได้ในตอนนี้')
  })
})

describe('R57 ② — สรุปออเดอร์แนบลิงก์ตะกร้าทุกเคส (ระบบเขียน)', () => {
  it('runOrderIntake คืน summaryNames + footer แนบ cartFooter ทั้งตอนบันทึกสำเร็จ/ไม่สำเร็จ', () => {
    expect(workerSrc).toContain('summaryNames: matchedNames')
    // เดิม: res.ok = line.text อย่างเดียว (ไม่มีลิงก์) → R57 แนบลิงก์เสมอ
    expect(workerSrc).toContain("footer: line.text + (cartFooter ? '\\n' + cartFooter : '')")
    // note ของเคสสำเร็จบอกให้กล่าวถึงลิงก์ตะกร้าด้วย
    expect(workerSrc).toContain('ลิงก์ตะกร้าท้ายข้อความช่วยเปิดดูรายการ/เพิ่มเมนูต่อได้เอง')
    // ลิงก์สรุปเดิมคงอยู่ (ระบบเขียน — ไม่ใช่คำแต่ง AI)
    expect(intakeSrc).toContain('export function buildCartSummaryFooter')
    expect(intakeSrc).toContain('shop?cart=')
    expect(intakeSrc).toContain('เช็คเอาท์ หรือเพิ่มเมนูต่อได้เลย')
  })

  it('Layout: /shop?cart= retry เติมซ้ำ 700ms เมื่อยังไม่มีรายการถูกเพิ่ม (กัน FB in-app เปิดก่อนทัน)', () => {
    expect(layoutSrc).toContain('const cartRetryTimer = setTimeout(')
    expect(layoutSrc).toContain('if (!cancelled && addedTotal === 0) void runAdd(true)')
    expect(layoutSrc).toContain('}, 700)')
    expect(layoutSrc).toContain('clearTimeout(cartRetryTimer)')
    // toast กันซ้ำตอน retry
    expect(layoutSrc).toContain('let toasted = false')
    // decode-fail = ห้ามเงียบ (ของเดิม R43 คงไว้)
    expect(layoutSrc).toContain('ลิงก์รายการในแชทไม่สมบูรณ์')
  })
})

describe('R57 ④ — socialPostContext (pure): post_id จาก payload + ข้อความโพสต์จริง', () => {
  it('extractSourcePostId: poll (post_id ตรง ๆ) + webhook (changes[].value.post_id) + ขยะ = ""', () => {
    expect(extractSourcePostId({ post_id: '8629_123456', source: 'poll' })).toBe('8629_123456')
    expect(extractSourcePostId({ changes: [{ field: 'feed', value: { post_id: '111_222', item: 'post' } }] })).toBe('111_222')
    expect(extractSourcePostId({ changes: [{ value: { comment_id: '999' } }] })).toBe('')
    expect(extractSourcePostId(null)).toBe('')
    expect(extractSourcePostId('x')).toBe('')
    expect(extractSourcePostId({ post_id: 'nounderscore' })).toBe('') // ไม่ใช่รูปแบบ pageid_postid
  })

  it('fetchPostMessage: คืน message trim/ตัด 1200 · ล้มเหลว/ไม่มี token = "" (ไม่ throw)', async () => {
    const okFetch = (async () => ({ ok: true, json: async () => ({ message: '  เปิดเมนูใหม่ อร่อยจัด  ' }) })) as unknown as typeof fetch
    expect(await fetchPostMessage('1_2', 'tok', { fetchImpl: okFetch })).toBe('เปิดเมนูใหม่ อร่อยจัด')
    const badFetch = (async () => { throw new Error('net') }) as unknown as typeof fetch
    expect(await fetchPostMessage('1_2', 'tok', { fetchImpl: badFetch })).toBe('')
    expect(await fetchPostMessage('', 'tok')).toBe('')
    expect(await fetchPostMessage('1_2', '', { fetchImpl: okFetch })).toBe('')
  })
})

describe('R57 ③ — ลิงก์จาก Facebook = บังคับเบราว์เซอร์ภายนอก (ห้ามเบราว์เซอร์ของเฟซ)', () => {
  it('externalBrowserIntentUrl: https → intent:// ชี้ Chrome + fallback เดิม · http/พัง = null', () => {
    const intent = externalBrowserIntentUrl('https://biteme-baby.com/shop?cart=abc#x')
    expect(intent).not.toBeNull()
    expect(intent!.startsWith('intent://biteme-baby.com/shop?cart=abc')).toBe(true)
    expect(intent).toContain('package=com.android.chrome')
    expect(intent).toContain('scheme=https')
    expect(intent!.endsWith(';end')).toBe(true)
    // fallback = URL เดิม (encode) — ไม่มี Chrome = กลับมาแล้วโชว์แถบ ไม่ใช่ค้างมืด
    expect(intent).toContain('s.browser_fallback_url=' + encodeURIComponent('https://biteme-baby.com/shop?cart=abc#x'))
    expect(externalBrowserIntentUrl('http://biteme-baby.com/')).toBeNull()
    expect(externalBrowserIntentUrl('ไม่ใช่ url')).toBeNull()
  })

  it('notice: ปุ่มเปิดภายนอก = <a href={intent}> เฟรมเดียว + ปุ่มปิดป๊อปอัพ (R77) + ไม่มีปุ่มอยู่ที่นี่ต่อ', () => {
    expect(noticeSrc).toContain('sessionStorage.getItem(NOTICE_DISMISS_KEY)')
    expect(noticeSrc).toContain("sessionStorage.setItem(NOTICE_DISMISS_KEY, '1')")
    expect(noticeSrc).toContain('r81Platform(navigator.userAgent)')
    // R76/R77: ห้ามนำทางหน้าปัจจุบันไป intent:// และห้าม window.open(intent) (หน้า error/ไม่เด้ง)
    expect(noticeSrc).not.toContain('window.location.replace(intent)')
    expect(noticeSrc).not.toContain('window.open(intent')
    // R81: ปุ่ม intent ถูกลบหมด — ไม่มี href={intentUrl} บน UI อีกแล้ว
    expect(noticeSrc).not.toContain('href={intentUrl}')
    // ปุ่ม "อยู่ที่นี่ต่อ" ยังไม่มี (Owner ห้ามใช้เบราว์เซอร์ของเฟซ) — ปุ่มปิด R77 = คนละอัน
    expect(noticeSrc).not.toContain('data-testid="inapp-stay"')
    expect(noticeSrc).toContain('data-testid="inapp-close"')
    expect(noticeSrc).toContain('ห้ามเปิดในเบราว์เซอร์ของ Facebook')
  })
})