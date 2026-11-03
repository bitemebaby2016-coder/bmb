// §T PRODUCTION TEST PACK — automated portion (Owner order 2026-11-02: "รัน §T ทั้งหมด")
// Runs against https://biteme-baby.com with FRESH browser contexts per section
// (= no cache/cookies → hard-refresh equivalent).
// Covered: T-B1..B3 (announcement cards) · T-A4* cart deep-link (partial) ·
//   T-A5* iOS FB banner (partial) · T-A4b* Android FB intent (partial) ·
//   T-C1..C3 admin AI album + pick + downscale upload (test admin, NO product saved)
// Blocked (recorded in results): T-A1/2/3/6 (Facebook) · T-C4 (optional) ·
//   T-D1..D4 / T-E1..E2 (physical printer)
// Evidence: e2e/tProdProbe_results.json + e2e/screenshots/t*.png
'use strict'
const path = require('path')
const fs = require('fs')

const BASE = 'https://biteme-baby.com'
const SHOTS = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

const results = {
  startedAt: new Date().toISOString(),
  base: BASE,
  note: 'fresh browser context per section = no cache/cookies (hard-refresh equivalent)',
  items: [],
}

const LOG = path.join(__dirname, 'tProdProbe.log')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const OUT_PATH = path.join(__dirname, 'tProdProbe_results' + (onlyArg ? '_' + onlyArg.slice(7).replace(/[^\w-]/g, '-') : '') + '.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --only=T-B,T-A4cart / --skip=T-A4android  →  สไลซ์รันทีละช่วง (แต่ละช่วงต้องจบ < 26s)
function argVal(flag) {
  const hit = process.argv.find((a) => a.startsWith(flag + '='))
  return hit ? hit.slice(flag.length + 1).split(',').map((s) => s.trim()).filter(Boolean) : null
}
const ONLY = argVal('--only')
const SKIP = argVal('--skip')
function want(key) {
  if (ONLY && ONLY.length && !ONLY.includes(key)) return false
  if (SKIP && SKIP.includes(key)) return false
  return true
}

// forensics: รันก่อนหน้าตายเงียบระหว่างทาง = บันทึกสาเหตุลง log เสมอ
process.on('exit', (code) => { try { fs.appendFileSync(LOG, '[..] PROCESS_EXIT code=' + code + '\n') } catch { /* */ } })
process.on('uncaughtException', (e) => {
  try { fs.appendFileSync(LOG, '[..] UNCAUGHT ' + (e && e.stack || e) + '\n') } catch { /* */ }
  process.exit(97)
})
process.on('unhandledRejection', (e) => {
  try { fs.appendFileSync(LOG, '[..] UNHANDLED_REJ ' + (e && e.stack || e) + '\n') } catch { /* */ }
  process.exit(98)
})

function flush() {
  try { fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2)) } catch { /* */ }
}

function mark(section) {
  const line = '[..] SECTION ' + section
  try { fs.appendFileSync(LOG, line + '\n') } catch { /* */ }
}

function rec(id, status, detail, shots) {
  results.items.push({ id, status, detail: String(detail || ''), shots: shots || [] })
  const line = '[' + id + '] ' + status + ' — ' + detail
  console.log(line)
  try { fs.appendFileSync(LOG, line + '\n') } catch { /* console only */ }
  flush() // เขียนทันทีทุกข้อ — เครื่องค้าง/ crash ระหว่างทางก็ไม่เสียหลักฐาน
}

function b64url(s) {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function readSecrets() {
  const out = {}
  for (const p of [path.join(process.cwd(), '.env.local'), path.join(process.cwd(), 'supabase', 'secrets.local.env')]) {
    try {
      for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && m[2] && !line.trim().startsWith('#')) out[m[1]] = m[2]
      }
    } catch { /* optional */ }
  }
  return out
}

const ANON = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const SB = 'https://ivkdfognyiwjcmrhcnwz.supabase.co'

async function toastText(page) {
  try {
    const t = await page.locator('.toast').allInnerTexts()
    return t.join(' | ')
  } catch { return '' }
}

async function waitForToast(page, re, ms) {
  const t0 = Date.now()
  let last = ''
  while (Date.now() - t0 < ms) {
    last = await toastText(page)
    if (re.test(last)) return last
    await page.waitForTimeout(400)
  }
  return last
}

/** evaluate ที่มี deadline กันค้าง (headless กับ intent:// ทำให้ renderer บางครั้งแขวน) */
async function evalTO(page, fn, arg, ms) {
  return Promise.race([
    Promise.resolve().then(() => page.evaluate(fn, arg)),
    sleep(ms || 8000).then(() => 'EVAL_TIMEOUT'),
  ])
}

;(async () => {
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    // ============ T-B — การ์ดประกาศหน้าแรก (/shop) ============
    mark('T-B')
    if (want('T-B')) try {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
      const page = await ctx.newPage()
      const consoleErrs = []
      page.on('pageerror', (e) => consoleErrs.push('pageerror: ' + e.message))
      await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(6000) // รอ promo/album fetch
      const hasWrap = await page.locator('[data-testid="floating-ad-banners"]').count()
      const cards = page.locator('[data-testid="floating-ad-banner"]')
      const n = await cards.count()
      const shotFull = path.join(SHOTS, 'tB1_shop.png')
      await page.screenshot({ path: shotFull, fullPage: false })

      if (n === 0) {
        rec('T-B1', 'FAIL', 'ไม่พบ floating-ad-banner บน ' + BASE + '/shop (wrap=' + hasWrap + ') consoleErr=' + consoleErrs.join(' / ').slice(0, 300), [shotFull])
        rec('T-B2', 'BLOCKED', 'ไม่มีการ์ดให้วัดมาสคอต', [])
        rec('T-B3', hasWrap > 0 ? 'OBSERVED' : 'FAIL', hasWrap > 0 ? 'wrap มีแต่ไม่มีการ์ด (ไม่ใช่ fallback มาสคอต)' : 'ไม่พบบล็อกการ์ดเลย', [shotFull])
      } else {
        const cardInfo = []
        for (let i = 0; i < Math.min(n, 2); i++) {
          const card = cards.nth(i)
          const shot = path.join(SHOTS, 'tB2_card' + (i + 1) + '.png')
          await card.screenshot({ path: shot }).catch(() => {})
          const media = card.locator('.flad-media img').first()
          const mediaCount = await media.count()
          const mediaSrc = mediaCount ? await media.getAttribute('src') : ''
          const mediaNat = mediaCount
            ? await media.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight })).catch(() => null)
            : null
          const mascot = card.locator('[data-testid="floating-ad-mascot"]')
          const fbMascot = card.locator('.flad-fallback-mascot')
          let m = null
          if (await mascot.count()) {
            m = await mascot.evaluate((el) => {
              const parent = el.parentElement
              return {
                src: el.getAttribute('src'),
                cls: el.className,
                hPct: parent ? Math.round((el.getBoundingClientRect().height / parent.getBoundingClientRect().height) * 100) : null,
              }
            }).catch(() => null)
          } else if (await fbMascot.count()) {
            m = { src: await fbMascot.getAttribute('src'), cls: 'flad-fallback-mascot', hPct: null }
          }
          const titleLoc = card.locator('.flad-title')
          const title = (await titleLoc.count()) ? await titleLoc.first().innerText() : ''
          const mediaWrap = card.locator('.flad-media').first()
          const wrapCls = (await mediaWrap.count()) ? ((await mediaWrap.getAttribute('class')) || '') : ''
          cardInfo.push({ card: i + 1, title: title.slice(0, 80), mediaSrc, mediaNat, mascot: m, wrapCls, shot })
        }
        const isFallbackCard = (c) =>
          (c.wrapCls && c.wrapCls.includes('flad-media-fallback')) ||
          (c.mascot && c.mascot.cls.includes('flad-fallback-mascot')) ||
          /\/assets\/mascot\//.test(c.mediaSrc || '')
        const marketingCards = cardInfo.filter((c) => !isFallbackCard(c) && c.mediaNat && c.mediaNat.w > 0)
        const allFallback = cardInfo.length > 0 && cardInfo.every(isFallbackCard)
        // T-B1: ต้องโชว์ภาพจริง (ภาพโพส → โฆษณาลอย → อัลบั้ม ai-generated/{promo,festival})
        if (marketingCards.length > 0) {
          rec('T-B1', 'PASS', 'การ์ด ' + n + ' ใบ · ภาพโปรโมตจริง ' + marketingCards.length + ' ใบ · src[0]=' + marketingCards[0].mediaSrc, [shotFull])
        } else {
          rec('T-B1', 'DATA-MISSING', 'การ์ด ' + n + ' ใบ ไม่มีภาพโปรโมตจากโพส/โฆษณาลอย/อัลบั้ม ai-generated/{promo,festival} → ตกเคส fallback (ดู T-B3) · src[0]=' + (cardInfo[0] && cardInfo[0].mediaSrc || '(none)'), [shotFull])
        }
        const mascots = cardInfo.map((c) => c.mascot).filter(Boolean)
        const withOverlay = mascots.filter((m) => m.cls.includes('flad-mascot-composed'))
        if (withOverlay.length >= 2) {
          const corners = new Set(withOverlay.map((m) => (m.cls.match(/flad-mascot-pos-\d/) || [''])[0]))
          const srcs = new Set(withOverlay.map((m) => m.src))
          const sizes = withOverlay.map((m) => m.hPct)
          const ok = corners.size >= 2 && srcs.size >= 2 && sizes.every((h) => h !== null && h <= 55)
          rec('T-B2', ok ? 'PASS' : 'FAIL',
            'overlay mascot ' + withOverlay.length + ' ใบ · มุม=' + [...corners].join(',') +
            ' · รูป=' + [...srcs].map((s) => (s || '').split('/').pop()).join(',') +
            ' · ส่วนสูง=' + sizes.join('%,') + '% (เป้า 46%)',
            cardInfo.map((c) => c.shot))
        } else if (allFallback) {
          const srcs = new Set(mascots.map((m) => m.src))
          rec('T-B2', 'N/A(fallback)',
            'ไม่มีภาพโปรโมต → ไม่มี overlay มุมรูปให้วัด · fallback pose ไม่ซ้ำ=' + (srcs.size >= 2) +
            ' (' + [...srcs].map((s) => (s || '').split('/').pop()).join(',') + ') — ข้อ overlay 46%/คนละมุม ทดสอบไม่ได้ในรอบนี้ (รอภาพโปรโมตในระบบ)',
            cardInfo.map((c) => c.shot))
        } else {
          const wmOnly = cardInfo.every((c) => /\/wm-/.test(c.mediaSrc || ''))
          rec('T-B2', wmOnly ? 'N/A(wm-*)' : 'FAIL',
            (wmOnly
              ? 'ภาพเป็น wm-* (มีน้อง Bite ในไฟล์อยู่แล้ว → ข้าม overlay ตาม design) — ข้อ "ตัวเล็ก 46% มุมรูป" จึงวัดไม่ได้กับภาพนี้'
              : 'มาสคอต overlay ไม่ครบ 2 ใบ') +
            ' · src=' + cardInfo.map((c) => (c.mediaSrc || '').split('/').pop()).join(','),
            cardInfo.map((c) => c.shot))
        }
        // T-B3: ไม่มีภาพเจนในระบบ → fallback = มาสคอตคนละท่าตามลำดับ ไม่ใช่บล็อกว่าง
        if (allFallback) {
          const srcs = new Set(mascots.map((m) => m.src))
          const emptyBlock = cardInfo.every((c) => !c.mediaNat || c.mediaNat.w === 0)
          const ok = mascots.length === cardInfo.length && srcs.size >= 2 && !emptyBlock
          rec('T-B3', ok ? 'PASS(fallback)' : 'FAIL',
            'fallback mode: มาสคอต ' + mascots.length + '/' + cardInfo.length + ' ใบ · ท่าไม่ซ้ำ ' + srcs.size + ' ท่า · มีรูปแสดง (ไม่บล็อกว่าง)=' + !emptyBlock,
            cardInfo.map((c) => c.shot))
        } else {
          rec('T-B3', 'N/A(มีภาพโปรโมต)', 'ไม่เข้าเคส fallback', [])
        }
        if (consoleErrs.length) rec('T-B-console', 'WARN', consoleErrs.join(' / ').slice(0, 500), [])
      }
      await ctx.close()
    } catch (e) {
      rec('T-B1', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
    }

    // ============ T-A4* — /shop?cart= deep-link เติมตะกร้า (partial: device handoff ทดสอบในเครื่องนี้ไม่ได้) ============
    mark('T-A4cart')
    if (want('T-A4cart')) try {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
      // ดัก toast ทุกใบทันทีที่ dispatch (toast หายใน 3s — อ่านทีหลังจะพลาด)
      await ctx.addInitScript(() => {
        window.__search0 = location.search
        window.__toasts = []
        window.addEventListener('toast', (e) => { try { window.__toasts.push(JSON.stringify(e.data)) } catch { /* */ } })
      })
      const page = await ctx.newPage()
      const restStatus = []
      const pageErrs = []
      page.on('response', (r) => { if (r.url().includes('/rest/v1/products')) restStatus.push(r.status()) })
      page.on('pageerror', (e) => pageErrs.push(e.message))
      await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded', timeout: 60000 })
      const prod = await evalTO(page, async (args) => {
        const r = await fetch(args.sb + '/rest/v1/products?select=id,name&is_available=eq.true&limit=1', {
          headers: { apikey: args.anon, Authorization: 'Bearer ' + args.anon },
        })
        const j = await r.json()
        return Array.isArray(j) && j.length ? j[0] : null
      }, { sb: SB, anon: ANON }, 15000)
      if (!prod || prod === 'EVAL_TIMEOUT') throw new Error('ดึงสินค้า from REST ไม่ได้: ' + JSON.stringify(prod))
      const enc = b64url(JSON.stringify({ v: 1, items: [{ id: prod.id, q: 1 }] }))
      const shot = path.join(SHOTS, 'tA4_cartlink.png')
      await page.goto(BASE + '/shop?cart=' + enc, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(9000) // hydration + catalog + retry 700ms
      const stored = await evalTO(page, () => localStorage.getItem('bmb-cart-v1') || '', null, 8000)
      const seenToasts = await evalTO(page, () => (window.__toasts || []).join(' || '), null, 8000)
      const toast = await toastText(page)
      const urlStripped = !page.url().includes('cart=')
      const filled = typeof stored === 'string' && stored.includes(prod.id)
      await page.screenshot({ path: shot }).catch(() => {})
      let diag = ''
      if (!filled) {
        const d = await evalTO(page, () => {
          const raw = new URLSearchParams(window.__search0 || window.location.search).get('cart')
          let dec = 'NULL', err = ''
          try {
            const pad = raw ? (raw.replace(/-/g, '+').replace(/_/g, '/')) : ''
            const p2 = pad.length % 4 === 0 ? pad : pad + '='.repeat(4 - (pad.length % 4))
            dec = atob(p2)
          } catch (e) { err = e.message }
          return { search0: window.__search0, searchNow: window.location.search, raw: raw, dec: dec, err: err }
        }, null, 8000)
        diag = ' · DIAG=' + JSON.stringify(d).slice(0, 500)
      }
      rec('T-A4(cart)', filled ? 'PARTIAL' : 'FAIL',
        filled
          ? 'ตะกร้าเต็มจากลิงก์จริง: ' + prod.name + ' (' + prod.id + ') · toastLive="' + seenToasts + '" · URL strip แล้ว=' + urlStripped + ' · ⚠️ กระโดด Chrome จากแอป FB = ต้องทดสอบบนมือถือจริง (device)'
          : 'ตะกร้าว่าง! prod=' + JSON.stringify(prod) + ' · stored=' + String(stored).slice(0, 220) + ' · toastLive="' + seenToasts + '" · urlStripped=' + urlStripped +
            ' · products REST status=' + restStatus.join(',') + ' · pageErr=' + pageErrs.join(' / ').slice(0, 300) + diag,
        [shot])
      await Promise.race([ctx.close(), sleep(6000)])
    } catch (e) {
      rec('T-A4(cart)', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
    }

    // ============ T-A5* — iOS Facebook in-app: แถบบังคับ Safari (partial: UA spoof ระดับ render) ============
    mark('T-A5')
    if (want('T-A5')) try {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.29.106;FBBV/200000000;FBMB/iPhone;FBDV/iPhone15,2;FBMD/iPhone;FBSV/17.5;FBSS/3;FBOP/8]',
      })
      const page = await ctx.newPage()
      const shot = path.join(SHOTS, 'tA5_ios_inapp.png')
      await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(3500)
      const notice = page.locator('[data-testid="inapp-browser-notice"]')
      const noticeVisible = (await notice.count()) > 0 && await notice.isVisible()
      const body = await page.locator('body').innerText()
      const hasStay = body.includes('อยู่ที่นี่ต่อ')
      const hasOpenExt = (await page.locator('[data-testid="inapp-open-external"]').count()) > 0
      await page.screenshot({ path: shot })
      rec('T-A5', noticeVisible && !hasStay && hasOpenExt ? 'PARTIAL' : 'FAIL',
        'notice แสดง=' + noticeVisible + ' · ปุ่มเปิดนอก=' + hasOpenExt + ' · ปุ่ม "อยู่ที่นี่ต่อ"=' + hasStay + ' (ต้อง=false) · ⚠️ บังคับ Safari จริงบน iPhone = ต้องทดสอบบนเครื่องจริง (device)',
        [shot])
      await ctx.close()
    } catch (e) {
      rec('T-A5', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
    }

    // ============ T-C — เพิ่มเมนู: เลือกรูปจากภาพเจน + ย่ออัตโนมัติ (test admin · ไม่กด Save) ============
    mark('T-C')
    if (want('T-C1') || want('T-C2') || want('T-C3')) try {
      const S = readSecrets()
      const EMAIL = S.BMB_TEST_ADMIN_EMAIL
      const PASSWORD = S.BMB_TEST_ADMIN_PASSWORD
      if (!EMAIL || !PASSWORD) throw new Error('ไม่พบ BMB_TEST_ADMIN_* ใน secrets')
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
      const page = await ctx.newPage()

      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForSelector('input[type="email"]', { timeout: 20000 })
      await page.fill('input[type="email"]', EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      let loggedIn = false
      for (let i = 0; i < 20 && !loggedIn; i++) {
        await page.waitForTimeout(400)
        loggedIn = !page.url().includes('/login')
      }
      if (!loggedIn) {
        await page.screenshot({ path: path.join(SHOTS, 'tC_login_fail.png') }).catch(() => {})
        const bodyTxt = await page.locator('body').innerText().catch(() => '')
        throw new Error('login ไม่ผ่าน → ' + page.url() + ' · toast="' + (await toastText(page)) +
          '" · body="' + bodyTxt.replace(/\s+/g, ' ').slice(0, 300) + '"')
      }

      await page.goto(BASE + '/admin/products', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.getByRole('button', { name: /เพิ่มเมนู/ }).first().click({ timeout: 15000 })
      await page.waitForSelector('[data-testid="product-form-frame"]', { timeout: 15000 })
      await page.waitForTimeout(500)

      const openAlbum = async () => {
        const panelVisible = await page.locator('[data-testid="product-ai-album"]').count()
        if (!panelVisible) {
          await page.click('[data-testid="product-ai-browse"]')
          await page.waitForSelector('[data-testid="product-ai-album"]', { timeout: 20000 })
          await page.waitForTimeout(900)
        }
        return page.locator('[data-testid^="product-ai-pick-"]').count()
      }

      // --- T-C1: ปุ่ม 🖼 เลือกจากรูปที่เจน (AI) → เปิดพาเนล + เลื่อนไปพาเนล (rule 12.3) ---
      if (want('T-C1')) try {
        const shot1 = path.join(SHOTS, 'tC1_ai_album.png')
        const scrollBefore = await page.evaluate(() => window.scrollY)
        await page.click('[data-testid="product-ai-browse"]')
        await page.waitForSelector('[data-testid="product-ai-album"]', { timeout: 20000 })
        await page.waitForTimeout(1000)
        const scrollAfter = await page.evaluate(() => window.scrollY)
        const panelBox = await page.locator('[data-testid="product-ai-album"]').boundingBox()
        const vp = page.viewportSize()
        const inView = !!panelBox && panelBox.y >= 0 && panelBox.y + Math.min(panelBox.height, 200) <= vp.height
        const picks = await page.locator('[data-testid^="product-ai-pick-"]').count()
        const panelText = await page.locator('[data-testid="product-ai-album"]').innerText().catch(() => '')
        await page.screenshot({ path: shot1 })
        rec('T-C1', picks > 0 ? 'PASS' : 'FAIL',
          'พาเนลเปิด=1 · ใน viewport=' + inView + ' · scrollY ' + scrollBefore + '→' + scrollAfter +
          ' · รูปในคลัง=' + picks + ' · panelText="' + panelText.slice(0, 160).replace(/\n/g, ' ') + '"',
          [shot1])
      } catch (e) {
        rec('T-C1', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
      }

      // --- T-C2: กดเลือกรูปสักใบ → toast ย่ออัตโนมัติ + พรีวิวขึ้น (ยังไม่ Save) ---
      if (want('T-C2')) try {
        const shot2 = path.join(SHOTS, 'tC2_pick_downscale.png')
        const picks2 = await openAlbum()
        let toast2 = ''
        let pickedName = ''
        if (picks2 > 0) {
          pickedName = (await page.locator('[data-testid^="product-ai-pick-"]').first().getAttribute('title')) || ''
          await page.locator('[data-testid^="product-ai-pick-"]').first().click()
          toast2 = await waitForToast(page, /ลดขนาดอัตโนมัติ|เลือกรูป|ไม่สำเร็จ|ไม่ผ่าน/, 20000)
          await page.waitForTimeout(1000)
        }
        const preview = await page.locator('img[alt="Preview"]').count()
        const urlVal = await page.locator('input[placeholder^="Image URL"]').inputValue().catch(() => '')
        await page.screenshot({ path: shot2 })
        rec('T-C2', /ลดขนาดอัตโนมัติ/.test(toast2) && preview > 0 ? 'PASS' : 'FAIL',
          'file="' + pickedName + '" · toast="' + toast2 + '" · preview img=' + preview + ' · image_url=' + urlVal.slice(0, 140),
          [shot2])
      } catch (e) {
        rec('T-C2', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
      }

      // --- T-C3: อัปโหลดไฟล์ใหญ่ (>5MB PNG) → ย่อก่อน validate = ไม่โดน error 5MB ---
      if (want('T-C3')) try {
        const bigPath = path.join(__dirname, 'tmp_tC3_big.png')
        const big = await evalTO(page, () => {
          const c = document.createElement('canvas'); c.width = 1600; c.height = 1600
          const g = c.getContext('2d')
          const img = g.createImageData(1600, 1600)
          for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = (Math.random() * 256) | 0
            img.data[i + 1] = (Math.random() * 256) | 0
            img.data[i + 2] = (Math.random() * 256) | 0
            img.data[i + 3] = 255
          }
          g.putImageData(img, 0, 0)
          return c.toDataURL('image/png')
        }, null, 15000)
        if (typeof big !== 'string') throw new Error('สร้างไฟล์ทดสอบไม่สำเร็จ: ' + big)
        fs.writeFileSync(bigPath, Buffer.from(big.split(',')[1], 'base64'))
        const bigSize = fs.statSync(bigPath).size
        const shot3 = path.join(SHOTS, 'tC3_file_upload.png')
        await page.setInputFiles('[data-testid="product-image-file"]', bigPath)
        const toast3 = await waitForToast(page, /ลดขนาดรูปอัตโนมัติ|รูปไม่ผ่านเงื่อนไข|อัปโหลดไม่สำเร็จ/, 20000)
        await page.waitForTimeout(800)
        const preview3 = await page.locator('img[alt="Preview"]').count()
        await page.screenshot({ path: shot3 })
        rec('T-C3', /ลดขนาดรูปอัตโนมัติ/.test(toast3) && !/รูปไม่ผ่านเงื่อนไข/.test(toast3) && preview3 > 0 ? 'PASS' : 'FAIL',
          'ไฟล์ทดสอบ ' + (bigSize / 1024 / 1024).toFixed(1) + 'MB 1600×1600 PNG · toast="' + toast3 +
          '" · preview=' + preview3 + ' · ไม่โดน error 5MB=' + !/รูปไม่ผ่านเงื่อนไข/.test(toast3),
          [shot3])
      } catch (e) {
        rec('T-C3', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
      }

      if (want('T-C1')) {
        rec('T-C4', 'SKIPPED', 'ข้อ (ทางเลือก) = เจนรูปที่ AI Studio ก่อนกลับมา T-C1 — งดทำโดยไม่สั่ง (SKIPPED ≠ PASS)', [])
        rec('T-C-note', 'INFO', 'ไม่ได้กด "บันทึกเมนู" → products ไม่ถูกแก้ · แต่มีไฟล์ใหม่ใน storage จากการทดสอบ (downscale ของรูปเจน + ไฟล์ทดสอบ)', [])
      }
      await ctx.close()
    } catch (e) {
      const isCreds = e.message.includes('login ไม่ผ่าน')
      rec('T-C', isCreds ? 'BLOCKED(creds)' : 'ERROR',
        e.message + (isCreds
          ? ' · ยืนยันตรงกับ GoTrue password grant = HTTP 400 invalid_credentials (e2e/tmp_adminlogin.cjs) — รหัสผ่าน test admin ใน supabase/secrets.local.env ใช้กับ production ไม่ได้แล้ว → ต้องให้ Owner รีเซ็ตก่อนรัน T-C1..C3 ได้'
          : ''), [])
    }
    // ============ T-A4b* — Android Facebook in-app: auto intent:// (partial) ============
    // NOTE: headless Chromium ค้างได้ตอน location.replace('intent://') → วางไว้ท้ายสุด + ครอบด้วย deadline
    mark('T-A4android')
    if (want('T-A4android')) try {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.29.106;FBBV/200000000;FBMB/Moto G (4);FBDV/sargo;]',
      })
      const page = await ctx.newPage()
      const shot = path.join(SHOTS, 'tA4_android_inapp.png')
      let flag = 'NOT_RUN', stillHere = null, notice = null
      await Promise.race([
        (async () => {
          await page.goto(BASE + '/shop', { waitUntil: 'domcontentloaded', timeout: 45000 })
          await page.waitForTimeout(4000)
          flag = await evalTO(page, () => {
            try { return sessionStorage.getItem('bmb:inapp-ext-redirected') } catch { return 'ERR' }
          }, null, 8000)
          stillHere = page.url().startsWith(BASE)
          notice = await Promise.race([
            page.locator('[data-testid="inapp-browser-notice"]').count().catch(() => -1),
            sleep(8000).then(() => -2),
          ])
          await page.screenshot({ path: shot }).catch(() => {})
        })(),
        sleep(65000).then(() => { flag = 'SECTION_TIMEOUT' }),
      ])
      rec('T-A4(android)', flag === '1' ? 'PARTIAL' : 'FAIL',
        'sessionStorage bmb:inapp-ext-redirected=' + JSON.stringify(flag) + ' (1 = ยิง intent:// อัตโนมัติแล้ว) · ยังอยู่หน้าเดิม=' + stillHere + ' · banner fallback=' + notice + ' · ⚠️ เปิด Chrome จริงจากแอป FB = ต้องทดสอบบนมือถือจริง (device)',
        [shot])
      await Promise.race([ctx.close(), sleep(6000)])
    } catch (e) {
      rec('T-A4(android)', 'ERROR', 'probe ล้มเหลว: ' + e.message, [])
    }
  } finally {
    await Promise.race([browser.close(), sleep(10000)])
  }


  // ---- BLOCKED items (ไม่มีบัญชี FB/อุปกรณ์/เครื่องพิมพ์จากเครื่องนี้ — ห้ามนับเป็น PASS) ----
  rec('T-A1', 'BLOCKED', 'ต้องคอมเมนต์ใต้โพส FB จริง + รอ bot ตอบ — ไม่มีบัญชี Facebook ในเครื่องนี้', [])
  rec('T-A2', 'BLOCKED', 'ต้องถามพรีออเดอร์ใน FB จริง + เทียบวันกับ /menu — ไม่มีบัญชี Facebook', [])
  rec('T-A3', 'BLOCKED', 'ต้องถามเมนูยังไม่ลงปฎิทินใน FB จริง — ไม่มีบัญชี Facebook', [])
  rec('T-A6', 'BLOCKED', 'ต้องดูโพสที่ bot สร้าง/ตอบล่าสุดใน FB — ไม่มีบัญชี Facebook', [])
  rec('T-D1', 'BLOCKED', 'ต้องพิมพ์จริงทาง QZ dialog — ไม่มีเครื่องพิมพ์ (render-level วัดแล้วใน e2e/r59_sticker_fit.json)', [])
  rec('T-D2', 'BLOCKED', 'ต้องพิมพ์จริงทาง Bluetooth (Niimbot) — ไม่มีอุปกรณ์', [])
  rec('T-D3', 'BLOCKED', 'ต้องดู stroke บนใบจริง — render-level มีใน r59_sticker_fit.json (ไม่ใช่ใบจริง)', [])
  rec('T-D4', 'BLOCKED', 'ต้องพิมพ์จริง 1 ใบ — ไม่มีเครื่องพิมพ์', [])
  rec('T-E1', 'BLOCKED', 'ต้องดูใบเสร็จ/ใบครัวใบจริง (Date/TIME ตอนพิมพ์ + ติ๊ก ●) — ไม่มีเครื่องพิมพ์', [])
  rec('T-E2', 'BLOCKED', 'ต้องออเดอร์จ่ายบัตรเครดิต + ใบจริง — ไม่มีเครื่องพิมพ์/ไม่สร้างออเดอร์จริง', [])

  results.finishedAt = new Date().toISOString()
  const outPath = path.join(__dirname, 'tProdProbe_results.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  const tally = {}
  for (const it of results.items) tally[it.status] = (tally[it.status] || 0) + 1
  const tail = 'WROTE ' + outPath + '\nTALLY ' + JSON.stringify(tally) + '\n'
  try { fs.appendFileSync(LOG, tail) } catch { /* */ }
  console.log(tail)
  process.exit(0) // กัน handle ค้างจาก browser ที่ close ไม่เสร็จ
})().catch((e) => {
  const msg = 'PROBE_FAIL ' + (e && e.stack || e)
  console.error(msg)
  try { fs.appendFileSync(LOG, msg + '\n') } catch { /* */ }
  flush()
  process.exit(1)
})

