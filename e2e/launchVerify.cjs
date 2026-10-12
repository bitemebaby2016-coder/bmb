// Bite Me Baby — LAUNCH POST-DEPLOY VERIFICATION (2026-10-12)
// อ้างอิง: docs/BMB_FINAL_LAUNCH_CLOSURE_HANDOFF.md §13.3 (verify production หลัง CF auto-deploy)
//
// กติกา: READ-ONLY ต่อ production — ไม่ login · ไม่สั่งออเดอร์ · ไม่แก้ข้อมูลใด ๆ
//         ข้อเดียวที่ "ยิงออกไป" คือ chat หนึ่งข้อความ (guest surface ปกติของหน้าแรก)
//         เพื่อวัดว่า deadline 60s ของ aiService ทำงานจริงบน production
//
// ตรวจอะไรบ้าง:
//   L1  /track/:orderNumber  canonical ต้องเป็น URL จริง ห้ามมี literal ':orderNumber'
//   L2  meta ของ /orders /reviews ต้องถูกเสิร์ฟจริง (/notifications = auth-gated -> guest เห็น meta /login)
//   L3  param-page canonical (/reviews/:id -> /reviews, /payment/:n -> /checkout)
//   L4  GPS granted -> badge ต้องขึ้น "ตำแหน่งจาก GPS" (matrix#2 re-run — เคย FAIL)
//   L5  GPS denied  -> badge ห้ามอ้าง GPS (matrix#1 re-run — เคย PASS)
//   L6  chat 一轮 จบภายใน deadline จริง (ไม่ค้าง)
//   L7  deploy marker — bundle production มีโค้ด 5cc693a จริง
//
// รัน: node e2e/launchVerify.cjs   -> e2e/launch-verify.json + e2e/screenshots/launch-*.png
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const BASE = 'https://biteme-baby.com'
const SHOTS = path.join(PROJ, 'e2e', 'screenshots')
const OUT = path.join(PROJ, 'e2e', 'launch-verify.json')
// จุดเทส (mock) = จันทบุรีในโซน — ใช้ offset ผ่าน browser UI เท่านั้น ไม่แตะข้อมูลจริง
const IN_ZONE = { latitude: 10.705, longitude: 102.135 }

const R = {
  run: 'launch-verify',
  runAt: new Date().toISOString(),
  target: BASE,
  note: 'read-only production verification of the 5cc693a deploy — no login, no order, no data mutation',
  checks: {},
  summary: {},
}

function capConsole(page, bucket) {
  page.on('console', (m) => { if (m.type() === 'error') bucket.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => bucket.push('pageerror:' + String(e).slice(0, 160)))
}

async function newCtx(browser, extra = {}) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    ignoreHTTPSErrors: true,
    ...extra,
  })
}

/** head ที่ React 19 hoist ขึ้นจริงแล้ว (รอ canonical แสดงก่อนอ่าน)
 *  หมายเหตุ: <link> ไม่ใช่ visible element -> ต้องรอ state:'attached' (ไม่ใช่ default 'visible') */
async function readHead(page) {
  await page.waitForSelector('link[rel="canonical"]', { timeout: 25000, state: 'attached' })
  return page.evaluate(() => {
    const canon = [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.href)
    return {
      title: document.title,
      canonicals: canon,
      description: (document.querySelector('meta[name="description"]') || {}).content || '',
      headHasLiteralParam: /:orderNumber|:productId/.test(document.head.innerHTML),
    }
  })
}

async function gotoRoute(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  return readHead(page)
}

;(async () => {
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })

    // ---------- L1: /track/:orderNumber — canonical จริง ไม่มี placeholder ----------
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let head = null
      let err = null
      try { head = await gotoRoute(page, '/track/LV-20261012-01') } catch (e) { err = String(e).slice(0, 200) }
      await page.screenshot({ path: path.join(SHOTS, 'launch-01-track-canonical.png') })
      const canonical = (head && head.canonicals[0]) || ''
      const ok =
        canonical === BASE + '/track/LV-20261012-01' &&
        head.headHasLiteralParam === false &&
        head.title.includes('LV-20261012-01')
      R.checks.L1_track_param_canonical = {
        route: '/track/LV-20261012-01',
        expectedCanonical: BASE + '/track/LV-20261012-01',
        canonical,
        canonicalCount: head ? head.canonicals.length : 0,
        title: head ? head.title : null,
        headHasLiteralParam: head ? head.headHasLiteralParam : null,
        consoleErrors: cerr.slice(0, 8),
        err,
        verdict: head ? (ok ? 'PASS' : 'FAIL') : 'ERROR',
        note: 'regression ที่เคยยิง https://biteme-baby.com/track/:orderNumber ขึ้น Google จริง',
      }
      await ctx.close()

      // L1b — guest ต้องเจอ phone gate (migration 050 ปิด anon read แล้วใช้ RPC)
      // console 42501 จาก [getOrder] = expected control flow (fallback ไป phone gate)
      const ctx2 = await newCtx(browser)
      const page2 = await ctx2.newPage()
      let guestPhoneGate = false
      let gateErr = null
      try {
        await page2.goto(BASE + '/track/LV-20261012-01', { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page2.waitForLoadState('networkidle').catch(() => {})
        guestPhoneGate = await page2.getByTestId('track-phone-input')
          .waitFor({ state: 'visible', timeout: 20000 })
          .then(() => true)
          .catch(() => false)
      } catch (e) { gateErr = String(e).slice(0, 200) }
      await page2.screenshot({ path: path.join(SHOTS, 'launch-01b-track-guest-gate.png') })
      R.checks.L1b_track_guest_phone_gate = {
        guestPhoneGate,
        err: gateErr,
        verdict: guestPhoneGate ? 'PASS' : 'FAIL',
        note: 'หน้า /track ของ guest ต้องแสดงช่องกรอกเบอร์ (secure RPC track_order) ไม่ใช่หน้าว่าง/พัง',
      }
      await ctx2.close()
    }

    // ---------- L2: meta ของ /orders /notifications /reviews ต้องถูกเสิร์ฟจริง ----------
    // หมายเหตุ /notifications = ProtectedRoute → guest ถูก redirect ไป /login
    //   ดังนั้น canonical ที่ถูกต้องสำหรับ guest คือ /login (ไม่ใช่ fake /notifications)
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const routes = {}
      for (const [route, expect] of [
        // /orders เป็น ProtectedRoute (P1/SF-08) -> guest ถูก redirect ไป /login
        // จึงต้องเสิร์ฟ meta ของ /login ให้ guest (ไม่ใช่ fake /orders canonical)
        ['/orders', BASE + '/login'],
        ['/reviews', BASE + '/reviews'],
        ['/notifications', BASE + '/login'],
      ]) {
        let head = null
        let err = null
        try { head = await gotoRoute(page, route) } catch (e) { err = String(e).slice(0, 200) }
        const canonical = (head && head.canonicals[0]) || ''
        const ok =
          !!head &&
          head.title.trim().length > 0 &&
          head.description.trim().length > 0 &&
          canonical === expect &&
          head.headHasLiteralParam === false
        routes[route] = {
          expectedCanonical: expect,
          title: head ? head.title : null,
          descriptionLen: head ? head.description.length : 0,
          canonical,
          err,
          verdict: head ? (ok ? 'PASS' : 'FAIL') : 'ERROR',
        }
      }
      await page.screenshot({ path: path.join(SHOTS, 'launch-02-reviews-meta.png') })
      R.checks.L2_new_route_meta = {
        routes,
        verdict: Object.values(routes).every((r) => r.verdict === 'PASS') ? 'PASS' : 'FAIL',
        note: 'ก่อน 5cc693a /orders /notifications /reviews ไม่มี SeoHelmet entry เลย · /orders และ /notifications เป็น auth-gated จึงเสิร์ฟ meta ของ /login ให้ guest',
      }
      await ctx.close()
    }

    // ---------- L3: param-page canonical policy ----------
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const cases = {}
      for (const [route, expect] of [
        ['/reviews/LVPROD-1', BASE + '/reviews'],
        ['/payment/LV-20261012-01', BASE + '/checkout'],
      ]) {
        let head = null
        let err = null
        try { head = await gotoRoute(page, route) } catch (e) { err = String(e).slice(0, 200) }
        const canonical = (head && head.canonicals[0]) || ''
        cases[route] = {
          expectedCanonical: expect,
          canonical,
          title: head ? head.title : null,
          headHasLiteralParam: head ? head.headHasLiteralParam : null,
          err,
          verdict: head ? (canonical === expect && head.headHasLiteralParam === false ? 'PASS' : 'FAIL') : 'ERROR',
        }
      }
      R.checks.L3_param_canonical_policy = {
        cases,
        verdict: Object.values(cases).every((c) => c.verdict === 'PASS') ? 'PASS' : 'FAIL',
        note: 'thin param page ชี้หน้า list ตาม precedent — ห้ามมี ":productId"/":orderNumber" ใน head',
      }
      await ctx.close()
    }

    // helpers หน้า login locate (หยิบจาก CR-4 harness ให้ผลเทียบเคียงกันได้)
    async function gotoQuickLogin(page) {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.getByRole('button', { name: /เข้าสู่ระบบด่วน/ }).click()
      await page.getByRole('button', { name: /ตำแหน่งของฉัน/ }).waitFor({ state: 'visible', timeout: 20000 })
    }
    async function clickLocateAndGetBadge(page) {
      await page.getByRole('button', { name: /ตำแหน่งของฉัน/ }).click()
      await page.waitForFunction(
        () => (document.body.innerText || '').includes('ตำแหน่งของฉัน: '),
        null,
        { timeout: 45000 }
      )
      return page.evaluate(() => {
        const el = [...document.querySelectorAll('span')].find((s) =>
          (s.textContent || '').includes('ตำแหน่งของฉัน: ')
        )
        return el ? el.textContent.trim() : ''
      })
    }

    // ---------- L4: matrix#2 re-run — GPS GRANTED ต้องบอก "ตำแหน่งจาก GPS" ----------
    {
      const ctx = await newCtx(browser)
      await ctx.grantPermissions(['geolocation'])
      await ctx.setGeolocation(IN_ZONE)
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let badge = ''
      let err = null
      try {
        await gotoQuickLogin(page)
        badge = await clickLocateAndGetBadge(page)
      } catch (e) { err = String(e).slice(0, 200) }
      await page.screenshot({ path: path.join(SHOTS, 'launch-03-gps-granted.png') })
      const claimsGps = badge.includes('ตำแหน่งจาก GPS')
      const coordsShown = badge.includes(String(IN_ZONE.latitude))
      R.checks.L4_gps_granted = {
        badge,
        err,
        claimsGps,
        coordsShown,
        consoleErrors: cerr.slice(0, 8),
        verdict: claimsGps && coordsShown ? 'PASS' : badge ? 'FAIL' : 'ERROR',
        note: 'CR-4 S4b เคย FAIL (badge อ้าง IP ทั้งที่ permission granted) — gps-branch แก้แล้วใน 5cc693a',
      }
      await ctx.close()
    }

    // ---------- L5: matrix#1 re-run — GPS DENIED ห้ามอ้าง GPS ----------
    {
      const ctx = await newCtx(browser) // ไม่ grant permission = denied
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let badge = ''
      let err = null
      try {
        await gotoQuickLogin(page)
        badge = await clickLocateAndGetBadge(page)
      } catch (e) { err = String(e).slice(0, 200) }
      await page.screenshot({ path: path.join(SHOTS, 'launch-04-gps-denied.png') })
      const claimsGps = badge.includes('ตำแหน่งจาก GPS')
      R.checks.L5_gps_denied_honest = {
        badge,
        err,
        claimsGps,
        consoleErrors: cerr.slice(0, 8),
        verdict: badge && !claimsGps ? 'PASS' : badge ? 'FAIL' : 'ERROR',
        note: 'badge ต้องบอกแหล่งที่มาจริง (IP/ครัว) — ห้ามมีคำว่า GPS เมื่อ permission ถูกปฏิเสธ',
      }
      await ctx.close()
    }

    // ---------- L6: chat deadline จริงบน production ----------
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let rec = { err: null }
      try {
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.getByTestId('ttb-talk').click()
        // โหมดเสียงปิดใน headless -> ถ้าไม่มีช่องพิมพ์ให้สลับโหมดพิมพ์
        const hasInput = await page.getByTestId('ttb-input').isVisible().catch(() => false)
        if (!hasInput) {
          const typing = page.getByTestId('ttb-typing')
          if (await typing.isVisible().catch(() => false)) await typing.click()
        }
        await page.getByTestId('ttb-input').waitFor({ state: 'visible', timeout: 20000 })
        // ให้ greeting/ข้อความแรก render ก่อน เพื่อไม่ให้นับเป็นคำตอบของเรา
        await page.waitForTimeout(4000)
        const before = await page.locator('[role="log"] > *').count()
        const mine = 'มีเมนูแนะนำไหมครับ'
        await page.getByTestId('ttb-input').fill(mine)
        const t0 = Date.now()
        await page.getByTestId('ttb-send').click()
        // รอแบบวนรอบ (มี diagnostic) แทน waitForFunction — ต้องเห็นข้อความใหม่ที่ "ไม่ใช่ของเรา"
        // และ "ไม่ใช่ indicator 'Bite กำลัง…'" (TalkToBite.tsx:805-811) กันนับผิดเป็นคำตอบปลอม
        const isIndicator = (t) => t.includes('Bite กำลัง')
        const CHAT_BUDGET_MS = 75000
        let addedTexts = []
        let replyText = ''
        let sawTypingIndicator = false
        while (Date.now() - t0 < CHAT_BUDGET_MS && !replyText) {
          await page.waitForTimeout(2000)
          const snap = await page.evaluate(() => {
            const log = document.querySelector('[role="log"]')
            const kids = log ? [...log.children] : []
            return kids.map((k) => (k.innerText || '').trim())
          })
          addedTexts = snap.slice(before).filter(Boolean)
          if (addedTexts.some(isIndicator)) sawTypingIndicator = true
          const bot = addedTexts.filter((t) => t !== mine && !isIndicator(t))
          if (bot.length) replyText = bot[bot.length - 1]
        }
        const elapsedMs = Date.now() - t0
        const lastText = replyText.slice(0, 300)
        await page.screenshot({ path: path.join(SHOTS, 'launch-05-chat-deadline.png') })
        rec = {
          elapsedMs,
          elapsedSec: Math.round(elapsedMs / 100) / 10,
          replyChars: lastText.length,
          replyPreview: lastText.slice(0, 120),
          addedBlocks: addedTexts.length,
          sawTypingIndicator,
          isThaiFallback: lastText.includes('เกิดข้อผิดพลาดในการเชื่อมต่อ'),
          budgetMs: 60000,
          consoleErrors: cerr.slice(0, 8),
          err: null,
          // งบรวม 60s + เวลา render เล็กน้อย = ไม่ใช่ "ค้าง" + ต้องมีข้อความตอบกลับจริง
          verdict: elapsedMs <= 65000 && lastText.length > 0 ? 'PASS' : 'FAIL',
          note: 'วัดจากกดส่งจนมีข้อความตอบของ Bite — ก่อนแก้ไม่มี timeout เลย = ค้างถาวร',
        }
      } catch (e) {
        rec.err = String(e).slice(0, 240)
        rec.verdict = 'ERROR'
        rec.consoleErrors = cerr.slice(0, 8)
        await page.screenshot({ path: path.join(SHOTS, 'launch-05-chat-deadline.png') }).catch(() => {})
      }
      R.checks.L6_chat_deadline = rec
      await ctx.close()
    }

    // ---------- L7: deploy marker — bundle production ต้องมีโค้ด 5cc693a ----------
    {
      try {
        const html = await (await fetch(BASE + '/')).text()
        const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/)
        const bundleUrl = m ? BASE + m[1] : null
        const bundle = bundleUrl ? await (await fetch(bundleUrl)).text() : ''
        // ERR_TIMEOUT = สตริงใหม่ที่เข้ามาใน 5cc693a เท่านั้น (ไม่มีใน 255e677)
        const marker = bundle.includes('ERR_TIMEOUT')
        R.checks.L7_deploy_marker = {
          bundleUrl,
          bundleBytes: bundle.length,
          markerERR_TIMEOUT: marker,
          verdict: marker ? 'PASS' : 'FAIL',
          note: 'ยืนยันว่า production เสิร์ฟ build ที่มี 5cc693a (login timeout + GPS unwrap + SEO fix) แล้วจริง',
        }
      } catch (e) {
        R.checks.L7_deploy_marker = { err: String(e).slice(0, 200), verdict: 'ERROR' }
      }
    }

    await browser.close()
  } catch (e) {
    R.fatal = String(e).slice(0, 300)
    try { if (browser) await browser.close() } catch { /* noop */ }
  }

  const verdicts = Object.values(R.checks).map((c) => c.verdict)
  R.summary = {
    total: verdicts.length,
    pass: verdicts.filter((v) => v === 'PASS').length,
    fail: verdicts.filter((v) => v === 'FAIL').length,
    error: verdicts.filter((v) => v === 'ERROR').length,
  }
  fs.writeFileSync(OUT, JSON.stringify(R, null, 2), 'utf8')
  console.log(JSON.stringify({
    out: OUT,
    summary: R.summary,
    checks: Object.fromEntries(Object.entries(R.checks).map(([k, v]) => [k, v.verdict])),
  }, null, 2))
})()

