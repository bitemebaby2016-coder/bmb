// ============================================
// R61 — dynamic probe ฟีเจอร์ใหม่ /admin/promotions บน production จริง
//   ① เปิดฟอร์มสร้าง → ตรวจ controls (ภาพจากเครื่อง/คลังภาพ · มาสคอต 4 ท่า/เครื่อง/คลัง · พรีวิวประกอบ)
//   ② เลือกรูปจากคลังภาพ + เลือกมาสคอตมาตรฐาน → สร้างโปรโมชั่นจริง
//   ③ ตรวจ DB: banner_image + banner_mascot ถูกบันทึก → ④ ล้าง (ลบโปรโมชั่นทดสอบ)
// evidence → e2e/r61PromoUi-result.json + e2e/screenshots/tPromo_*.png
// ============================================
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SHOTS = path.join(ROOT, 'e2e', 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })
const OUT = path.join(ROOT, 'e2e', 'r61PromoUi-result.json')
const BASE = 'https://biteme-baby.com'
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const LOG = path.join(ROOT, 'e2e', 'r61PromoUi.log')

function readSecrets() {
  const out = {}
  for (const p of [path.join(ROOT, '.env.local'), path.join(ROOT, 'supabase', 'secrets.local.env')]) {
    try {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && m[2] && !line.trim().startsWith('#')) out[m[1]] = m[2]
      }
    } catch { /* */ }
  }
  return out
}

function note(s) { try { fs.appendFileSync(LOG, s + '\n') } catch { /* */ } console.log(s) }

function finish(out, pass, noteText) {
  out.ALL_PASS = pass
  out.note = noteText
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
  note('R61_PROMO_UI ALL_PASS=' + pass + ' — ' + noteText)
  process.exit(pass ? 0 : 1)
}

;(async () => {
  const { chromium } = require('playwright')
  const S = readSecrets()
  const out = { at: new Date().toISOString(), steps: [] }
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()

    // login
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForSelector('input[type="email"]', { timeout: 20000 })
    await page.fill('input[type="email"]', S.BMB_TEST_ADMIN_EMAIL)
    await page.fill('input[type="password"]', S.BMB_TEST_ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    let ok = false
    for (let i = 0; i < 25 && !ok; i++) { await page.waitForTimeout(400); ok = !page.url().includes('/login') }
    if (!ok) { out.error = 'login failed'; await browser.close(); return finish(out, false, 'login failed') }

    // เปิดฟอร์มสร้าง
    await page.goto(BASE + '/admin/promotions', { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.getByRole('button', { name: /สร้างโปรโมชั่นใหม่/ }).first().click({ timeout: 15000 })
    await page.waitForSelector('[data-testid="promo-attach-panel"]', { timeout: 15000 })
    const controls = {}
    for (const id of ['promo-banner-album', 'promo-mascot-album', 'promo-mascot-file', 'promo-compose-preview']) {
      controls[id] = (await page.locator('[data-testid="' + id + '"]').count()) > 0
    }
    for (let i = 0; i < 4; i++) controls['promo-mascot-std-' + i] = (await page.locator('[data-testid="promo-mascot-std-' + i + '"]').count()) > 0
    controls['banner_file_input'] = (await page.locator('input[aria-label="เลือกรูปแบนเนอร์จากเครื่อง"]').count()) > 0
    out.controls = controls
    out.steps.push({ step: 'controls', ok: Object.values(controls).every(Boolean) })
    await page.screenshot({ path: path.join(SHOTS, 'tPromo_form.png') })
    if (!Object.values(controls).every(Boolean)) { await browser.close(); return finish(out, false, 'controls missing: ' + JSON.stringify(controls)) }

    // เลือกรูปจากคลังภาพ
    await page.fill('[data-testid="promo-banner-image-url"]', '')
    await page.click('[data-testid="promo-banner-album"]')
    await page.waitForSelector('[data-testid="promo-album-pick-0"]', { timeout: 15000 })
    const albumCount = await page.locator('[data-testid^="promo-album-pick-"]').count()
    await page.click('[data-testid="promo-album-pick-0"]')
    await page.waitForTimeout(500)
    const bannerVal = await page.locator('[data-testid="promo-banner-image-url"]').inputValue()
    out.steps.push({ step: 'pick_from_album', albumCount, bannerVal: String(bannerVal).slice(0, 140) })

    // เลือกมาสคอตมาตรฐานท่า 2
    await page.click('[data-testid="promo-mascot-std-1"]')
    await page.waitForTimeout(300)
    const composedImgs = await page.locator('[data-testid="promo-compose-preview"] img').count()
    out.steps.push({ step: 'compose_preview', imgs: composedImgs })
    await page.screenshot({ path: path.join(SHOTS, 'tPromo_composed.png') })

    // กรอก + บันทึกจริง (test data — ล้างเองท้ายขั้นตอน) · เปิดเป็นแบนเนอร์หน้าแรกเพื่อตรวจฝั่งลูกค้าด้วย
    const NAME = 'TEST-R61 โปรโมชั่นทดสอบ (ล้างอัตโนมัติ)'
    await page.fill('input[placeholder="ชื่อโปรโมชั่น *"]', NAME)
    const bannerCb = page.locator('label', { hasText: 'แสดงเป็นแบนเนอร์หน้าแรก' }).locator('input[type="checkbox"]')
    if (await bannerCb.count()) await bannerCb.first().check()
    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: /บันทึก/ }).first().click()
    await page.waitForTimeout(3000)
    out.steps.push({ step: 'saved', formClosed: (await page.locator('input[placeholder="ชื่อโปรโมชั่น *"]').count()) === 0 })
    await page.screenshot({ path: path.join(SHOTS, 'tPromo_saved.png') })

    // ตรวจ DB: banner_image + banner_mascot ถูกบันทึกจริง (ใช้ S ตัวเดียวกับตอน login)
    const rows = await (await fetch(SB + '/rest/v1/promotions?select=id,name,banner_image,banner_mascot,is_banner&name=eq.' + encodeURIComponent(NAME), {
      headers: { apikey: S.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + S.SUPABASE_SERVICE_ROLE_KEY },
    })).json().catch(() => [])
    const row = Array.isArray(rows) ? rows[0] : null
    out.dbRow = row || null
    const dbOk = !!(row && row.banner_image && row.banner_mascot && row.banner_mascot.includes('/assets/mascot/'))

    // ลิงก์ฝั่งลูกค้า (dynamic): เปิด /shop → การ์ดลอยต้องใช้ "ภาพ + มาสคอต" ที่เพิ่งประกอบ
    // (การ์ดสูงสุด 2/รอบ + dismissed เก็บใน sessionStorage → ปิดการ์ดอื่นแล้ว reload ซ้ำจนการ์ดทดสอบขึ้น)
    if (row) {
      const page2 = await ctx.newPage()
      await page2.goto(BASE + '/shop', { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page2.waitForTimeout(8000) // รอ loadData (products/rounds/promos) + RPC ประกาศ
      // diag: โปรโมชั่น is_banner ที่ client อ่านได้จริง (anon RLS) + การ์ดที่โชว์แต่ละรอบ
      out.homeDiag = { bannerPromos: await page2.evaluate(async () => {
        const r = await fetch('https://ivkdfognyiwjcmrhcnwz.supabase.co/rest/v1/promotions?select=id,name,is_banner,is_active,created_at&is_banner=eq.true&order=created_at.asc', {
          headers: { apikey: 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH' },
        })
        return (await r.json()).map((x) => ({ id: x.id, name: String(x.name).slice(0, 40), active: x.is_active, created: x.created_at }))
      }).catch((e) => 'ERR ' + e.message), roundTitles: [] }
      let hasBanner = false
      let mediaSrc = ''
      let mascotSrc = ''
      // สำคัญ: เช็ค "ก่อน" กดปิดทุกครั้ง + ปิดทีละใบ (ไล่คิว) — เคสพลาดคือกดปิดทีละหลายใบจนการ์ดทดสอบโดนปิดทิ้งไปด้วย
      for (let round = 0; round < 6 && !hasBanner; round++) {
        if (round > 0) {
          const closeBtn = page2.locator('[data-testid="floating-ad-close"]').first()
          if (await closeBtn.count()) {
            await closeBtn.click().catch(() => {})
            await page2.waitForTimeout(2000)
          } else {
            await page2.waitForTimeout(2000)
          }
        }
        const titles = await page2.locator('[data-testid="floating-ad-banner"] .flad-title').allInnerTexts().catch(() => [])
        out.homeDiag.roundTitles.push(titles.map((t) => t.slice(0, 40)))
        const cardLoc = page2.locator('[data-testid="floating-ad-banner"]', { hasText: 'TEST-R61' })
        hasBanner = (await cardLoc.count()) > 0
        if (hasBanner) {
          mediaSrc = (await cardLoc.first().locator('.flad-media > img').first().getAttribute('src').catch(() => '')) || ''
          mascotSrc = (await cardLoc.first().locator('[data-testid="floating-ad-mascot"]').getAttribute('src').catch(() => '')) || ''
        }
      }
      await page2.screenshot({ path: path.join(SHOTS, 'tPromo_home.png') }).catch(() => {})
      out.homeRender = { hasBanner, mediaSrc: String(mediaSrc).slice(0, 140), mascotSrc }
      out.steps.push({ step: 'home_render', hasBanner, mascotSrc: out.homeRender.mascotSrc })
      await page2.close()
    }

    // ล้าง: ลบผ่าน UI (พิสูจน์ปุ่มลบ) + กวาดซ้ำด้วย REST ให้หมด (รวมแถวที่ค้างจากรันก่อน)
    const card = page.locator('.card', { hasText: NAME })
    if (await card.count()) {
      await card.getByRole('button', { name: /ลบ/ }).first().click()
      await page.waitForTimeout(1500)
    }
    const delRes = await fetch(SB + '/rest/v1/promotions?name=eq.' + encodeURIComponent(NAME), {
      method: 'DELETE',
      headers: { apikey: S.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + S.SUPABASE_SERVICE_ROLE_KEY },
    })
    out.cleanupHttp = delRes.status
    const rows2 = await (await fetch(SB + '/rest/v1/promotions?select=id&name=eq.' + encodeURIComponent(NAME), {
      headers: { apikey: S.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + S.SUPABASE_SERVICE_ROLE_KEY },
    })).json().catch(() => [])
    out.cleanupDeleted = Array.isArray(rows2) && rows2.length === 0
    out.steps.push({ step: 'cleanup', deleted: out.cleanupDeleted, http: delRes.status, remaining: Array.isArray(rows2) ? rows2.length : -1 })

    await browser.close()
    const homeOk = !!(out.homeRender && out.homeRender.hasBanner &&
      String(out.homeRender.mascotSrc || '').includes('bite_pointing'))
    const pass = Object.values(controls).every(Boolean) && String(bannerVal).includes('/storage/') &&
      composedImgs >= 2 && dbOk && out.cleanupDeleted === true && homeOk
    return finish(out, pass, 'controls=' + Object.values(controls).filter(Boolean).length + '/9 · db=' + dbOk +
      ' · home=' + homeOk + ' · cleanup=' + out.cleanupDeleted)
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 400)
    try { await browser.close() } catch { /* */ }
    return finish(out, false, 'ERROR ' + out.error)
  }
})().catch((e) => { note('PROMO_UI_FATAL ' + String(e).slice(0, 300)); process.exit(1) })

