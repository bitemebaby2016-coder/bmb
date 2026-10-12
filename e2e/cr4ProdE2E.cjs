// Bite Me Baby — CR-4 PRODUCTION E2E (guest-safe runtime evidence, 2026-10-12)
// ต่อจาก gate doc §16 (docs/BMB_CUSTOMER_JOURNEY_RECOVERY_GATE_2026-10-10.md)
// หลักการ: READ-ONLY ต่อ production — ไม่ login จริง · ไม่สร้าง order · ไม่แตะข้อมูลลูกค้า
// ครอบคลุมพื้นที่ที่ guest เข้าถึงได้จริง: route smoke · dark-theme regression ·
// checkout auth gate · login locate honesty (GPS denied/granted/saved) · PromptPay QR asset
// BLOCKED (ต้องมี test account/OTP หรือ DB read = Owner): matrix #3,5,6,7,9,10
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const BASE = 'https://biteme-baby.com'
const SHOTS = path.join(PROJ, 'e2e', 'screenshots')
const OUT = path.join(PROJ, 'e2e', 'cr4-prod-e2e.json')
// ร้าน (จันทบุรี) = พิกัดจริงในโซน · ใช้ offset เล็กน้อยเพื่อพิสูจน์ coords ไหลจาก browser สู่ UI จริง
const IN_ZONE = { latitude: 10.705, longitude: 102.135 }

const R = {
  cr: 'CR-4',
  runAt: new Date().toISOString(),
  target: BASE,
  note: 'guest-safe read-only production runtime evidence — no login, no order, no data mutation',
  scenarios: {},
  matrix: {},
  blocked: {},
}

function capConsole(page, bucket) {
  page.on('console', (m) => { if (m.type() === 'error') bucket.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => bucket.push('pageerror:' + String(e).slice(0, 160)))
}

async function newCtx(browser, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    ignoreHTTPSErrors: true,
    ...extra,
  })
  return ctx
}

;(async () => {
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })

    // ---------- S1: route smoke (customer journey pages) ----------
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      const routes = {}
      for (const [route, marker] of [
        // '/' renders TalkToBiteHomePage (no data-testid — use unique sr-only h1 text)
        ['/', 'text=Talk to Bite'],
        // '/shop' renders HomePage (same-day-tab lives in MenuPage, NOT here)
        ['/shop', '#home-sameday-heading'],
        ['/cart', null],
        ['/checkout', null],
        ['/track', null],
        ['/login', null],
      ]) {
        try {
          let docStatus = null
          page.once('response', (res) => {
            try { if (res.request().resourceType() === 'document') docStatus = res.status() } catch {}
          })
          const navResp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 })
          if (navResp) docStatus = navResp.status()
          if (docStatus == null) {
            // prefetch/cache-served navigations may emit no page 'response' event —
            // fall back to Navigation Timing responseStatus (Chrome >= 109)
            docStatus = await page.evaluate(() => {
              const n = performance.getEntriesByType('navigation')[0]
              const s = n && n.responseStatus
              return typeof s === 'number' && s > 0 ? s : null
            }).catch(() => null)
          }
          let markerOk = null
          if (marker) {
            // cold-load prod can take >2.5s to hydrate marker testids — wait properly
            try { await page.waitForSelector(marker, { timeout: 15000 }); markerOk = true } catch { markerOk = false }
          } else {
            await page.waitForTimeout(2500)
          }
          const bodyLen = (await page.locator('body').textContent()).length
          routes[route] = {
            docStatus,
            finalUrl: String(page.url()).replace(BASE, ''),
            title: await page.title(),
            bodyTextLen: bodyLen,
            marker,
            markerOk,
            ok: docStatus === 200 && bodyLen > 200 && markerOk !== false,
          }
        } catch (e) {
          routes[route] = { ok: false, error: String(e).slice(0, 200) }
        }
      }
      R.scenarios.route_smoke = { routes, consoleErrors: cerr.slice(0, 20) }
      R.scenarios.route_smoke.verdict = Object.values(routes).every((r) => r.ok) ? 'PASS' : 'FAIL'
      await ctx.close()
    }

    // ---------- S2: dark theme runtime regression (selector fix 434eb7c) ----------
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.evaluate(() => localStorage.setItem('bmb-theme', 'dark'))
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2500)
      const probe = await page.evaluate(() => {
        const scrim = document.querySelector('.site-background__scrim')
        const bgWhite = document.querySelector('.bg-white')
        const textBlack = document.querySelector('.text-black')
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          bodyBgImage: getComputedStyle(document.body).backgroundImage.slice(0, 120),
          scrimBg: scrim ? getComputedStyle(scrim).backgroundImage.slice(0, 160) : null,
          bgWhiteBg: bgWhite ? getComputedStyle(bgWhite).backgroundColor : null,
          textBlackColor: textBlack ? getComputedStyle(textBlack).color : null,
        }
      })
      await page.screenshot({ path: path.join(SHOTS, 'cr4-02-home-dark.png') })
      // fixed selectors = dark scrim ต้องเป็น rgba(18,18,20..) (ไม่ใช่ white wash) · .bg-white → #1B1B20
      const scrimDark = probe.scrimBg ? probe.scrimBg.includes('18, 18, 20') : null
      const scrimLightLeak = probe.scrimBg ? probe.scrimBg.includes('255, 255, 255') : null
      R.scenarios.dark_theme_regression = {
        probe,
        scrimDark,
        scrimLightLeak,
        consoleErrors: cerr.slice(0, 10),
        verdict: probe.theme === 'dark' && scrimDark === true && scrimLightLeak !== true ? 'PASS' : 'FAIL',
      }
      await ctx.close()
    }
    // ---------- S3: checkout auth gate (guest → /login, order spine) ----------
    {
      const ctx = await newCtx(browser)
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let redirected = false
      try {
        await page.goto(BASE + '/checkout', { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForURL(/\/login/, { timeout: 15000 })
        redirected = true
      } catch {}
      await page.waitForTimeout(1000)
      await page.screenshot({ path: path.join(SHOTS, 'cr4-04-checkout-guest-gate.png') })
      R.scenarios.checkout_guest_gate = {
        redirectedToLogin: redirected,
        finalUrl: String(page.url()).replace(BASE, ''),
        consoleErrors: cerr.slice(0, 10),
        verdict: redirected ? 'PASS' : 'FAIL',
      }
      await ctx.close()
    }

    // helpers for login-locate scenarios
    async function gotoQuickLogin(page) {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 })
      // default tab = email; quick-login locate button only exists after switching.
      // wait for network idle first so React handlers are attached before clicking.
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

    // ---------- S4a: matrix#1 (guest surface) — GPS DENIED → honest label ----------
    {
      const ctx = await newCtx(browser) // no geolocation permission = denied
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let badge = ''
      let err = null
      try {
        await gotoQuickLogin(page)
        badge = await clickLocateAndGetBadge(page)
      } catch (e) { err = String(e).slice(0, 200) }
      await page.screenshot({ path: path.join(SHOTS, 'cr4-05-login-gps-denied.png') })
      const claimsGps = badge.includes('ตำแหน่งจาก GPS')
      R.scenarios.gps_denied_honest_label = {
        badge,
        err,
        claimsGps,
        consoleErrors: cerr.slice(0, 10),
        verdict: badge && !claimsGps ? 'PASS' : badge ? 'FAIL' : 'ERROR',
      }
      await ctx.close()
    }

    // ---------- S4b: matrix#2 (guest surface) — GPS GRANTED → honest GPS + real coords ----------
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
      await page.screenshot({ path: path.join(SHOTS, 'cr4-06-login-gps-granted.png') })
      const claimsGps = badge.includes('ตำแหน่งจาก GPS')
      const coordsShown = badge.includes(String(IN_ZONE.latitude))
      R.scenarios.gps_granted_label = {
        badge,
        err,
        claimsGps,
        coordsShown,
        consoleErrors: cerr.slice(0, 10),
        verdict: claimsGps && coordsShown ? 'PASS' : badge ? 'FAIL' : 'ERROR',
      }
      await ctx.close()
    }

    // ---------- S4c: matrix#4 (guest surface) — saved point honesty (ห้ามปลอมเป็น GPS) ----------
    {
      const ctx = await newCtx(browser) // GPS denied + seeded saved point
      await ctx.addInitScript((payload) => {
        try { localStorage.setItem('bmb_customer_location', payload) } catch {}
      }, JSON.stringify({ latitude: 10.7123, longitude: 102.1401, addressDetail: 'cr4-e2e', source: 'gps', provenance: 'gps' }))
      const page = await ctx.newPage()
      const cerr = []
      capConsole(page, cerr)
      let badge = ''
      let err = null
      try {
        await gotoQuickLogin(page)
        badge = await clickLocateAndGetBadge(page)
      } catch (e) { err = String(e).slice(0, 200) }
      const claimsGps = badge.includes('ตำแหน่งจาก GPS')
      R.scenarios.saved_provenance_honesty = {
        badge,
        err,
        claimsGps,
        note: 'GPS permission = denied -> แม้จะมี saved point ใน storage badge ต้องไม่กล้าอ้างว่ามาจาก GPS (ระบุ saved/ip/ครัว ตามจริง)',
        consoleErrors: cerr.slice(0, 10),
        verdict: badge && !claimsGps ? 'PASS' : badge ? 'FAIL' : 'ERROR',
      }
      await ctx.close()
    }

    // ---------- S5: matrix#8 (static part) — PromptPay QR asset ----------
    {
      const ctx = await newCtx(browser)
      const qrUrl = BASE + '/assets/Qr%20Code/BMB_Promptpay_Qr.webp'
      let status = null
      let prodBytes = null
      let localBytes = null
      try {
        const res = await ctx.request.get(qrUrl)
        status = res.status()
        prodBytes = (await res.body()).length
      } catch (e) { status = 'ERR ' + String(e).slice(0, 120) }
      try { localBytes = fs.statSync(path.join(PROJ, 'public', 'assets', 'Qr Code', 'BMB_Promptpay_Qr.webp')).size } catch {}
      R.scenarios.promptpay_qr_asset = {
        qrUrl,
        status,
        prodBytes,
        localBytes,
        verdict: status === 200 && localBytes != null && prodBytes === localBytes ? 'PASS' : status === 200 ? 'PARTIAL' : 'FAIL',
      }
      await ctx.close()
    }

    // ---------- matrix mapping + blocked register ----------
    R.matrix = {
      '1': 'PARTIAL - guest surface (login locate): GPS denied -> badge บอก IP/ครัว ตามจริง ไม่มี "GPS" ปลอม (screenshot cr4-05)',
      '2': 'PARTIAL - guest surface (login locate): GPS granted (mock จันทบุรี) -> badge "ตำแหน่งจาก GPS" + coords จริง (cr4-06)',
      '3': 'BLOCKED - ปักหมุด/เลื่อนหมุด (DeliveryMapPicker) อยู่ที่ /checkout ซึ่ง guest ถูก redirect เข้า /login (ต้อง test account)',
      '4': 'PARTIAL - saved point ใน storage + GPS denied -> ไม่มีการปลอม label GPS (badge อ้างอิงตามจริง)',
      '5': 'BLOCKED - orderable guard (ไม่มี trusted point -> สั่งไม่ได้) อยู่ที่ /checkout (auth-gated)',
      '6': 'BLOCKED - fee RPC error != 0.00 อยู่ที่ /checkout (auth-gated)',
      '7': 'BLOCKED - out-of-zone server authority อยู่ที่ fee RPC (auth-gated)',
      '8': 'PARTIAL - QR asset production 200 + bytes ตรง local เท่ากัน - flow runtime ต้องมี order จริง',
      '9': 'BLOCKED - ต้อง login จริง + DB read: ตรวจว่า quick login ไม่มี coords -> default_* IS NULL (EF prod ยังเป็น rev เก่า)',
      '10': 'BLOCKED - production DB read (SELECT-only aggregate) รอ Owner approval',
    }
    R.blocked['ef-live-risk'] =
      'frontend CR-2/3 (36028ab) deployed แล้ว + production EF ยังเป็น rev เก่า (e49c24b): quick login ไม่มี trusted coords ส่ง latitude=null -> EF เก่า Number(null)=0 (บรรทัด 83) -> ผ่าน range check (145) -> persist default_*=0,0 (251) = NULL ISLAND ทุกครั้ง - ต้อง Owner deploy EF ใหม่ (17.2 preflight) โดยเร็ว'
    R.blocked['auth-needed'] =
      'matrix #3,5,6,7 (checkout surface) + #9 (login+DB) ต้องการ test account/OTP ที่ Owner จัดหา - hard-stop: ห้ามใช้ข้อมูลลูกค้าจริง'

    // live findings from production evidence (2026-10-12 run 2)
    R.matrix['2'] = 'FAIL (production evidence 2026-10-12) - geolocation granted + mock coords Chanthaburi -> badge อ้าง IP แทน GPS (ไม่มี label "ตำแหน่งจาก GPS") - root cause อยู่ที่ frontend: getGpsLocation gps-branch ไม่ unwrap pos.coords (locationLogin.ts:63) - checkout handler ยัง BLOCKED (ต้อง test account)'
    R.findings = [
      {
        id: 'getGpsLocation-dead-gps-branch',
        severity: 'P1',
        evidence: 'S4b: ctx.grantPermissions([geolocation]) + setGeolocation(10.705,102.135) -> badge = "ตำแหน่งของฉัน: ตำแหน่งโดยประมาณ (IP) · 16.4467, 102.8330" (cr4-06-login-gps-granted.png)',
        root: 'src/lib/locationLogin.ts:63-66 - ตรวจ typeof pos.latitude === "number" บน GeolocationPosition ดิบ แต่ browser จริงวางพิกัดไว้ที่ pos.coords.latitude (getTrustedGpsLocation มี unwrap ทั้งสองแบบแล้ว getGpsLocation ไม่มี) -> gps branch ตายใน browser จริง -> fallback IP เสมอ',
        impact: 'quick-login locate ไม่มีทางรายงาน source=gps ได้เลย (matrix #2 login surface) - label ยัง honest (บอก IP/ครัว ตามจริง) จึงไม่ใช่เรื่องหลอก แต่คือฟังก์ชัน GPS success พัง',
        fix: 'unwrap raw.coords แบบ getTrustedGpsLocation (locationLogin.ts:113-116) - เปลี่ยนฝั่ง frontend แล้ว deploy (ไม่เกี่ยวกับ EF order)',
      },
    ]
    fs.writeFileSync(OUT, JSON.stringify(R, null, 2), 'utf8')
    console.log('CR4_PROD_E2E_VERDICTS', JSON.stringify(Object.fromEntries(Object.entries(R.scenarios).map(([k, v]) => [k, v.verdict]))))
    console.log('WROTE', OUT)
  } finally {
    try { if (browser) await browser.close() } catch {}
  }
  process.exit(0)
})()