'use strict'
// ============================================================
// e2e/ttbFlow.cjs — Talk to Bite waiter-flow probe (R73g · Playwright)
//   ตามแบบ tProdProbe (R60): fresh context ต่อ run · หลักฐาน JSON + screenshots
//   เป้าหมาย: ① landing render ② เปิดแชทผ่าน quick action + เมนูจริงขึ้น
//   ③ contextual help ตอบตรง (deterministic — ไม่ผ่าน LLM = ไม่เสียค่า API)
// รัน: node e2e\ttbFlow.cjs [--base=https://biteme-baby.com] [--only=1,2]
// ผล: e2e/ttbFlow_results.json + e2e/screenshots/ttb_*.png
// ============================================================
const { chromium } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='))
  return hit ? hit.split('=').slice(1).join('=') : dflt
}
const BASE = arg('base', 'https://biteme-baby.com').replace(/\/$/, '')
const ONLY = arg('only', '').split(',').filter(Boolean).map(Number)
const OUT = path.join(__dirname, 'ttbFlow_results.json')
const SHOTS = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

// รองรับรันแบบสไลซ์ (--only=1,2) โดย merge ผลกับรอบก่อนหน้า (แก้ปัญหา tool ตัดที่ 30s)
const prev = (() => {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')) } catch { return null }
})()
const results = { at: new Date().toISOString(), base: BASE, steps: [], pass: false }

// แชทเปิดในโหมดเสียง (voice-first) — ทุก step ที่ต้องพิมพ์ต้องสลับเป็น "โหมดพิมพ์" เอง
// (สไลซ์ --only รันคนละ browser = setup ซ้ำได้ ไม่พึ่ง step ก่อนหน้า)
async function openChatTyping(page) {
  await page.waitForSelector('[data-testid=ttb-menu]', { timeout: 8000 })
  await page.click('[data-testid=ttb-menu]', { timeout: 8000 })
  await page.click('button[aria-label="โหมดพิมพ์"]', { timeout: 8000 })
  await page.waitForSelector('[data-testid=ttb-input]', { timeout: 8000 })
}

async function step(page, n, name, fn) {
  if (ONLY.length && !ONLY.includes(n)) return // ไม่บันทึก step ที่ข้าม — กัน false green ตอน merge
  const t0 = Date.now()
  try {
    const detail = (await fn()) || ''
    results.steps.push({ n, name, ok: true, ms: Date.now() - t0, detail: String(detail).slice(0, 300) })
    console.log(`STEP ${n} PASS ${name}`)
  } catch (e) {
    results.steps.push({ n, name, ok: false, ms: Date.now() - t0, error: String(e && e.message ? e.message : e).slice(0, 400) })
    console.log(`STEP ${n} FAIL ${name}: ${String(e).slice(0, 200)}`)
  }
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  // ทุก action/wait ต้องจบใน ~10s — tool shell ตัดที่ 30s (ปัญหาเดียวกับ tProdProbe)
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(20000)
  page.on('pageerror', (err) => console.log('PAGEERROR:', String(err).slice(0, 150)))

  // ทุกสไลซ์ต้องเริ่มที่หน้าจริง — goto ห้ามอยู่ใน step (ตอน --only จะถูกข้าม)
  await page.goto(BASE + '/talk-to-bite', { waitUntil: 'domcontentloaded', timeout: 20000 })

  await step(page, 1, 'landing /talk-to-bite renders (greeting + CTA)', async () => {
    await page.waitForSelector('[data-testid=ttb-greeting]', { timeout: 12000 })
    await page.waitForSelector('[data-testid=ttb-menu]', { timeout: 8000 })
    await page.screenshot({ path: path.join(SHOTS, 'ttb_landing.png'), fullPage: false })
    const g = await page.textContent('[data-testid=ttb-greeting]')
    return 'greeting=' + String(g || '').trim().slice(0, 60)
  })

  await step(page, 2, 'quick action เปิดแชท + เมนูทำงาน (ttb-products หรือ fallback ว่าง)', async () => {
    await openChatTyping(page)
    await page.waitForFunction(
      () => !!document.querySelector('[data-testid=ttb-products]') || (document.body.innerText || '').includes('ยังไม่มีเมนู'),
      undefined,
      { timeout: 8000 },
    )
    await page.screenshot({ path: path.join(SHOTS, 'ttb_chat_menu.png') })
    const hasProducts = await page.evaluate(() => !!document.querySelector('[data-testid=ttb-products]'))
    return hasProducts ? 'menu cards visible' : 'chat opened · menu empty at run time (fallback copy shown)'
  })

  await step(page, 3, 'help: "สั่งยังไงครับ" ตอบตรง (deterministic · ไม่ผ่าน LLM)', async () => {
    await openChatTyping(page)
    await page.fill('[data-testid=ttb-input]', 'สั่งยังไงครับ')
    await page.click('[data-testid=ttb-send]')
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('วิธีสั่งครับ'),
      undefined,
      { timeout: 20000 },
    )
    await page.screenshot({ path: path.join(SHOTS, 'ttb_help_order.png') })
    return 'help answer: วิธีสั่งครับ'
  })

  await step(page, 4, 'help: "ติดตามออเดอร์หน่อย" ชี้ทาง /track จริง', async () => {
    await openChatTyping(page)
    await page.fill('[data-testid=ttb-input]', 'ติดตามออเดอร์หน่อย')
    await page.click('[data-testid=ttb-send]')
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('/track'),
      undefined,
      { timeout: 20000 },
    )
    await page.screenshot({ path: path.join(SHOTS, 'ttb_help_track.png') })
    return 'help answer mentions /track'
  })

  await step(page, 5, 'help: "คูปองใช้ยังไง" ตอบเรื่องโค้ดส่วนลด (ไม่โปรยโปรโมชันปลอม)', async () => {
    await openChatTyping(page)
    await page.fill('[data-testid=ttb-input]', 'คูปองใช้ยังไง')
    await page.click('[data-testid=ttb-send]')
    await page.waitForFunction(
      () => (document.body.innerText || '').includes('โค้ดส่วนลด'),
      undefined,
      { timeout: 20000 },
    )
    const body = await page.evaluate(() => document.body.innerText || '')
    if (/ฟรี|ลด\s*\d+%/.test(body)) throw new Error('fake promo text detected')
    await page.screenshot({ path: path.join(SHOTS, 'ttb_help_coupon.png') })
    return 'coupon help ok · no fake promo'
  })

  await browser.close()
  if (prev && Array.isArray(prev.steps)) {
    for (const s of prev.steps) {
      if (s && s.ok !== null && s.ok !== undefined && !results.steps.some((m) => m.n === s.n)) results.steps.push(s)
    }
  }
  results.steps.sort((a, b) => a.n - b.n)
  results.pass = results.steps.length > 0 && results.steps.every((s) => s.ok === true)
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2))
  console.log('TTB_FLOW_PASS =', results.pass, '| steps =', results.steps.length)
  process.exit(results.pass ? 0 : 1)
})().catch((e) => {
  results.fatal = String(e && e.message ? e.message : e).slice(0, 500)
  try { fs.writeFileSync(OUT, JSON.stringify(results, null, 2)) } catch { /* keep */ }
  console.error('TTB_FLOW_FATAL', results.fatal)
  process.exit(1)
})
