// R59 — วัดขนาดฟอนต์ใหญ่สุดของเทมเพลตสติกเกอร์ 40×60 (evidence) → e2e/r59_sticker_fit.json
'use strict'
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Tahoma', 'Leelawadee UI', sans-serif; font-size: 7.5px; color: #000; line-height: 1.16; }
.sheet { width: 38.4mm; height: 58.4mm; overflow: hidden; display: flex; flex-direction: column; }
.brand { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: .3px; margin: 0; flex: 0 0 auto; }
.tag { text-align: center; font-family: Georgia, serif; font-style: italic; font-size: 6.6px; letter-spacing: 1px; margin: 1px 0 1.5px; flex: 0 0 auto; }
hr.rule { border: 0; border-top: 1.6px solid #000; margin: 1.2px 0; flex: 0 0 auto; }
.dtrow { display: flex; justify-content: space-between; margin: .4px 0; font-size: 7.8px; flex: 0 0 auto; }
.opts { display: flex; justify-content: center; gap: 5px; margin: .4px 0; white-space: nowrap; flex: 0 0 auto; }
.opts.mode { font-size: 7.8px; }
.opts.svc { font-size: 5.4px; }
.f { display: flex; margin: .3px 0; font-size: 7.5px; flex: 0 0 auto; }
.f b { font-weight: 700; }
.f.col b { flex: 0 0 15.5mm; display: flex; justify-content: space-between; }
.f.col b i { font-style: normal; }
.f > span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; }
.f.nat b { flex: 0 0 auto; margin-right: 2px; }
.sec { font-size: 8px; font-weight: 700; margin: .8px 0 .4px; flex: 0 0 auto; }
.paid { display: flex; margin: .3px 0; font-size: 6px; white-space: nowrap; flex: 0 0 auto; }
.paid b { font-weight: 700; margin-right: 3px; }
.paid span { margin-right: 5px; }
.qrwrap { display: flex; gap: 1.2mm; align-items: center; margin-top: auto; padding-top: 1.5px; flex: 0 0 auto; }
.qrwrap .ph { width: 12mm; height: 12mm; border: 1px dashed #000; }
.qrtext { flex: 1; text-align: center; min-width: 0; }
.scan { font-weight: 800; font-size: 8.4px; letter-spacing: .1px; white-space: nowrap; }
.ty { font-family: 'Brush Script MT', Georgia, cursive; font-style: italic; font-size: 7px; margin-top: 1.5px; }
.sheet, .sheet * { -webkit-text-stroke: 0.35px #000; paint-order: stroke fill; }`

const BODY = `
<div class="sheet" id="sheet">
  <p class="brand">BITE ME BABY</p>
  <p class="tag">" More Than Dellicious "</p>
  <hr class="rule">
  <div class="dtrow"><span><b>Date :</b> 2/11/2569</span><span><b>TIME :</b> 22:30</span></div>
  <div class="opts mode" id="mode"><span>○ Pre-Order</span><span>○ Same Day</span></div>
  <div class="opts svc" id="svc"><span>○ ทานที่ร้าน</span><span>○ สั่งกลับบ้าน</span><span>○ รับที่ร้าน</span></div>
  <div class="f col"><b>ORDER ID<i>:</i></b><span>BMB-20261102-0042</span></div>
  <div class="f col"><b>ORDER LIST<i>:</i></b><span>ข้าวมันไก่ x2 · น้ำชา x2</span></div>
  <div class="f col cont"><b>:</b><span>ไม่หวาน</span></div>
  <div class="f col"><b>NOTICE<i>:</i></b><span>ไม่ใส่ถุง</span></div>
  <hr class="rule">
  <div class="sec">[ DELIVERY / CUSTOMER ]</div>
  <div class="f nat"><b>Attn :</b><span>สมชาย ใจดี (0819998888)</span></div>
  <div class="f nat"><b>Add :</b><span>123 ถ.จันทบุรี ต.ตลาด อ.เมือง จ.จันทบุรี</span></div>
  <hr class="rule">
  <div class="f nat"><b>[ TOTAL NET ] :</b><span>1,234.50 THB</span></div>
  <div class="paid" id="paid"><b>[PAID] :</b><span>○ B/T</span><span>○ QR PROMPTPAY</span><span>○ COD</span></div>
  <div class="qrwrap"><div class="ph"></div><div class="qrtext"><div class="scan">SCAN FOR MORE</div><div class="ty">Thank You for love !</div></div></div>
</div>`

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 3 })
  await page.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${BODY}</body></html>`)
  const out = await page.evaluate(() => {
    const sheet = document.getElementById('sheet')
    const rowW = (el) => {
      const gapRaw = parseFloat(getComputedStyle(el).columnGap)
      const gap = Number.isFinite(gapRaw) ? gapRaw : 0
      const spans = [...el.children]
      const w = spans.reduce((s, sp) => {
        const mr = parseFloat(getComputedStyle(sp).marginRight)
        return s + sp.getBoundingClientRect().width + (Number.isFinite(mr) ? mr : 0)
      }, 0) + gap * Math.max(0, spans.length - 1)
      return Math.round(w * 100) / 100
    }
    const measure = () => ({
      sheetW: Math.round(sheet.clientWidth * 100) / 100,
      sheetH: Math.round(sheet.clientHeight * 100) / 100,
      sheetScrollH: sheet.scrollHeight,
      svc: rowW(document.getElementById('svc')),
      mode: rowW(document.getElementById('mode')),
      paid: rowW(document.getElementById('paid')),
      svcFont: getComputedStyle(document.getElementById('svc')).fontSize,
      modeFont: getComputedStyle(document.getElementById('mode')).fontSize,
      paidFont: getComputedStyle(document.getElementById('paid')).fontSize,
    })
    const base = measure()
    const trySizes = (sel, sizes) => {
      const res = {}
      for (const s of sizes) {
        document.querySelectorAll(sel).forEach((el) => { el.style.fontSize = s + 'px' })
        res[s] = measure()
      }
      document.querySelectorAll(sel).forEach((el) => { el.style.fontSize = '' })
      return res
    }
    const svcTight = {}
    for (const [gap, ls] of [[5, '0'], [3, '0'], [2, '-0.2px'], [1, '-0.3px'], [0, '-0.4px']]) {
      const el = document.getElementById('svc')
      el.style.fontSize = '7.8px'
      el.style.columnGap = gap + 'px'
      el.style.letterSpacing = ls
      svcTight['gap' + gap + '_ls' + ls] = measure()
      el.style.cssText = ''
    }
    const combined = (() => {
      document.querySelectorAll('.opts.mode, .opts.svc').forEach((el) => { el.style.fontSize = '9px' })
      document.getElementById('paid').style.fontSize = '7px'
      const m = measure()
      document.querySelectorAll('.opts.mode, .opts.svc, .paid').forEach((el) => { el.style.fontSize = '' })
      return m
    })()
    return {
      base,
      svcModeSizes: trySizes('.opts.mode, .opts.svc', [7.8, 8.2, 8.6, 9.0]),
      paidSizes: trySizes('.paid', [6.2, 6.4, 6.6, 7.0, 7.8]),
      svcTight,
      combined,
    }
  })

  out.png = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    const m = (text, size, weight) => {
      ctx.font = (weight ? weight + ' ' : '') + size + 'px Tahoma, sans-serif'
      return Math.round(ctx.measureText(text).width * 100) / 100
    }
    const SVC = '○ ทานที่ร้าน   ○ สั่งกลับบ้าน   ○ รับที่ร้าน'
    const SVC2 = '○ ทานที่ร้าน ○ สั่งกลับบ้าน ○ รับที่ร้าน'
    const MODE = '○ Pre-Order   ○ Same Day'
    const PAID = '[PAID] : ○ B/T   ○ QR PROMPTPAY   ○ COD'
    const t = {}
    for (const s of [16, 20, 24, 25, 26, 27]) {
      t['svc_sp3@' + s] = m(SVC, s)
      t['svc_tight@' + s] = m(SVC2, s)
      t['mode@' + s] = m(MODE, s)
      t['paid@' + s] = m(PAID, s, '700')
    }
    return { avail: 472 - 2 * 16, widths: t }
  })
  await browser.close()
  fs.writeFileSync(path.resolve(__dirname, 'r59_sticker_fit.json'), JSON.stringify(out, null, 2))
  console.log('WROTE e2e/r59_sticker_fit.json')
  console.log('HTML base: sheetW=' + out.base.sheetW + ' svc=' + out.base.svc + '(' + out.base.svcFont + ') mode=' + out.base.mode + '(' + out.base.modeFont + ') paid=' + out.base.paid + '(' + out.base.paidFont + ') scrollH=' + out.base.sheetScrollH + '/' + out.base.sheetH)
  console.log('PNG avail=' + out.png.avail)
})().catch((e) => { console.error('FIT_FAIL ' + e.message); process.exit(1) })