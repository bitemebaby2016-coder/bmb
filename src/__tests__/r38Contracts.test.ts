import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { googleMapsDirUrl, openMapsUrl, planMultiStopRoute, type PlanStop } from '@/lib/deliveryPlan'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const riderSrc = read('src/pages/RiderPwaPage.tsx')
const marketingSrc = read('src/pages/admin/AdminMarketing.tsx')
const feedSrc = read('src/components/home/MarketingFeedSection.tsx')
const homeSrc = read('src/pages/HomePage.tsx')
const migSrc = read('supabase/migrations/176_marketing_posts_anon_read.sql')

const O = { latitude: 13.75, longitude: 100.5 }
const stops: PlanStop[] = [
  { order_number: 'PO-1', latitude: 13.76, longitude: 100.51 },
  { order_number: 'PO-2', latitude: 13.77, longitude: 100.52 },
]

describe('R38 · openMapsUrl — ปุ่มนำทางไรเดอร์ต้องเรียกแอปแผนที่ (ไม่ใช่หน้าติดตั้งแอป)', () => {
  it('Android = intent URL ชี้ package Google Maps + fallback กลับ URL เดิม', () => {
    const url = googleMapsDirUrl(O, planMultiStopRoute(O, stops).stops)!
    const intent = openMapsUrl(url, 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')!
    expect(intent.startsWith('intent://')).toBe(true)
    expect(intent).toContain('package=com.google.android.apps.maps')
    expect(intent).toContain('scheme=https')
    expect(intent).toContain('S.browser_fallback_url=')
    // URL นำทางจริงถูกฝังใน intent ( decode ได้ครบ origin/waypoints/travelmode )
    const decoded = decodeURIComponent(intent)
    expect(decoded).toContain('travelmode=driving')
    expect(decoded).toContain('waypoints=')
    // fallback ต้องเป็น https เดิม ( URL-encode แล้ว )
    expect(intent).toContain(encodeURIComponent(url))
  })

  it('ไม่ใช่ Android (iOS/desktop) = คืน URL เดิม · null/empty = null', () => {
    const url = googleMapsDirUrl(O, stops)!
    expect(openMapsUrl(url, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(url)
    expect(openMapsUrl(url, 'Mozilla/5.0 (Windows NT 10.0)')).toBe(url)
    expect(openMapsUrl(null, 'Android')).toBeNull()
    expect(openMapsUrl('', 'Android')).toBeNull()
  })

  it('RiderPwaPage ใช้ openMapsUrl ครบทุกปุ่มนำทาง 3 จุด', () => {
    expect(riderSrc).toContain('href={openMapsUrl(dirUrl) ?? undefined}')
    expect(riderSrc.match(/openMapsUrl\(/g)!.length).toBeGreaterThanOrEqual(3)
    expect(riderSrc).toContain('rider-open-gmaps')
    expect(riderSrc).toContain('rider-nav-stop-')
    expect(riderSrc).toContain('rider-nav-active')
  })
})

describe('R38 · ไรเดอร์: ส่งสำเร็จโชว์ 3 ล่าสุด + อัลบั้มประวัติ', () => {
  it('source: เรียง delivered ใหม่สุดก่อน · ตัด 3 ล่าสุดเข้ารายการหลัก · overflow ไปอัลบั้ม', () => {
    expect(riderSrc).toContain("filter((x) => x.assignment_status === 'delivered')")
    expect(riderSrc).toContain('slice(0, 3)')
    expect(riderSrc).toContain('slice(3)')
    expect(riderSrc).toContain('pod_captured_at')
    expect(riderSrc).toContain('rider-history-toggle')
    expect(riderSrc).toContain('rider-history-album')
    expect(riderSrc).toContain('อัลบั้มประวัติ')
    expect(riderSrc).toContain('const [showHistory, setShowHistory] = useState(false)')
  })
})

describe('R38 · AI Studio: browse ไฟล์รูปเมนู → ชุดภาพเดียวกับ AI/แคตตาลอก', () => {
  it('source: ปุ่ม + input file + upload bmb-images + ต่อเข้า images state', () => {
    expect(marketingSrc).toContain('mk-browse-image')
    expect(marketingSrc).toContain('mk-browse-input')
    expect(marketingSrc).toContain('async function handleBrowseImage')
    expect(marketingSrc).toContain("storage.from('bmb-images').upload(path, file")
    expect(marketingSrc).toContain('setImages((prev) => [...prev, url])')
    expect(marketingSrc).toContain('type="file"')
    expect(marketingSrc).toContain('accept="image/*"')
  })
})

describe('R38 · ดึงเข้าเว็บ: feed โพสต์เผยแพร่แล้วบนหน้าแรก + m176', () => {
  it('feed = marketing_feed_posts RPC (m177: promote due + คืนแถว published) · ซ่อนตัวเงียบเมื่อว่าง/อ่านไม่ได้', () => {
    expect(feedSrc).toContain("supabase.rpc('marketing_feed_posts'")
    expect(feedSrc).toContain('p_limit')
    expect(feedSrc).toContain('if (!ready || posts.length === 0) return null')
    expect(feedSrc).toContain('marketing-feed')
    // ไม่เหลือ query เก่าที่พึ่ง status=published ตรง ๆ ( scheduled ที่ถึงเวลาต้อง promote ก่อน )
    expect(feedSrc).not.toContain(".eq('status', 'published')")
  })

  it('HomePage mount <MarketingFeedSection /> ข้างรีวิวอัลบั้ม', () => {
    expect(homeSrc).toContain('<MarketingFeedSection />')
    expect(homeSrc).toContain("from '@/components/home/MarketingFeedSection'")
  })

  it('m176: GRANT anon + policy เฉพาะ published (แทน deny_anon เดิม) — ไม่เปิดทั้งตาราง', () => {
    expect(migSrc).toContain('GRANT SELECT ON public.marketing_posts TO anon')
    expect(migSrc).toContain('DROP POLICY IF EXISTS marketing_posts_deny_anon')
    expect(migSrc).toContain('CREATE POLICY marketing_posts_anon_published')
    expect(migSrc).toContain("USING (status = 'published')")
  })
})