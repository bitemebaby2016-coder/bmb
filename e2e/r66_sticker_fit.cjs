// R66 — วัด fit เทมเพลตสติกเกอร์ 40×60 → e2e/r66_sticker_fit.json (pattern r59_sticker_fit.cjs)
'use strict'
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Tahoma', 'Leelawadee UI', sans-serif; font-size: 7.5px; color: #000; line-height: 1.1; }
  .sheet { width: 38.8mm; height: 58.8mm; padding-bottom: 2.2mm; overflow: hidden; display: flex; flex-direction: column; }
  .brand { text-align: center; font-size: 11.5px; font-weight: 800; letter-spacing: .3px; margin: 0; flex: 0 0 auto; }
  .tag { text-align: center; font-family: Georgia, serif; font-style: italic; font-size: 6.6px; letter-spacing: 1px; margin: .3px 0 .5px; flex: 0 0 auto; }
  hr.rule { border: 0; border-top: 1.4px solid #000; margin: .7px 0; flex: 0 0 auto; }
  .dtrow { display: flex; justify-content: space-between; margin: .4px 0; font-size: 7.8px; flex: 0 0 auto; }
  .opts { display: flex; justify-content: center; gap: 5px; margin: .4px 0; white-space: nowrap; flex: 0 0 auto; }
  .opts.mode { font-size: 9px; }
  .opts.svc { font-size: 9px; }
  .f { display: flex; margin: .4px 0; font-size: 7.5px; flex: 0 0 auto; }
  .f b { font-weight: 700; }
  .f.col b { flex: 0 0 15.5mm; display: flex; justify-content: space-between; }
  .f.col b i { font-style: normal; }
  .f > span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; }
  .f.nat b { flex: 0 0 auto; margin-right: 2px; }
  .f.olblank { flex: 1 1 auto; min-height: 3px; margin: 0; }
  .sec { font-size: 8px; font-weight: 700; margin: .4px 0; flex: 0 0 auto; }
  .paid { display: flex; margin: .4px 0; font-size: 7px; white-space: nowrap; flex: 0 0 auto; }
  .paid b { font-weight: 700; margin-right: 3px; }
  .paid span { margin-right: 5px; }
  .qrwrap { display: flex; gap: 1.2mm; align-items: center; margin-top: .6px; padding-top: .4px; flex: 0 0 auto; }
  .qrwrap .ph { width: 12mm; height: 12mm; border: 1px dashed #000; display: flex; align-items: center; justify-content: center; font-size: 5px; text-align: center; word-break: break-all; }
  .qrtext { flex: 1; text-align: center; min-width: 0; }
  .scan { font-weight: 800; font-size: 8.4px; white-space: nowrap; }
  .ty { font-family: Georgia, cursive; font-style: italic; font-size: 7px; margin-top: 1.5px; }
  .sheet *:not(.brand):not(.sec):not(.scan) { -webkit-text-stroke: 0.35px #000; paint-order: stroke fill; }`

const BODY = `
<div class="sheet" id="sheet">
  <p class="brand">BITE ME BABY</p>
  <p class="tag">" More Than Dellicious "</p>
  <hr class="rule">
  <div class="dtrow"><span><b>Date :</b> 4/11/2569</span><span><b>TIME :</b> 16:30</span></div>
  <div class="opts mode" id="mode"><span>○ Pre-Order</span><span>● Same Day</span></div>
  <div class="opts svc" id="svc"><span>○ ทานที่ร้าน</span><span>● สั่งกลับบ้าน</span><span>○ รับที่ร้าน</span></div>
  <div class="f col"><b>ORDER ID<i>:</i></b><span>BMB-20261104-0007</span></div>
  <div class="f col"><b>ORDER LIST<i>:</i></b><span>ข้าวมันไก่ x2 · น้ำเปล่า</span></div>
  <div class="f col cont"><b>:</b><span>x1 (ไม่ใส่น้ำแข็ง)</span></div>
  <div class="f col cont olblank"><b>&nbsp;</b><span>&nbsp;</span></div>
  <div class="f col cont olblank"><b>&nbsp;</b><span>&nbsp;</span></div>
  <div class="f col"><b>NOTICE<i>:</i></b><span>ไม่เผ็ด</span></div>
  <hr class="rule">
  <div class="sec">[ DELIVERY / CUSTOMER ]</div>
  <div class="f nat"><b>Attn :</b><span>ลูกค้าทดสอบ (0812345678)</span></div>
  <div class="f nat"><b>Add :</b><span>99 ถ.มหาราช อ.เมือง จ.จันทบุรี</span></div>
  <hr class="rule">
  <div class="f nat"><b>[ TOTAL NET ] :</b><span>110.00 THB</span></div>
  <div class="paid" id="paid"><b>[PAID] :</b><span>○ B/T</span><span>● QR PROMPTPAY</span><span>○ COD</span></div>
  <div class="qrwrap" id="qrwrap"><div class="ph"></div><div class="qrtext"><div class="scan">SCAN FOR MORE</div><div class="ty">Thank You for love !</div></div></div>
</div>`

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${BODY}</body></html>`)
  const out = await page.evaluate(() => {
    const sheet = document.getElementById('sheet')
    const qr = document.getElementById('qrwrap')
    const blanks = [...document.querySelectorAll('.olblank')].map((el) => Math.round(el.getBoundingClientRect().height * 100) / 100)
    // แถวเนื้อหา (ยกเว้น .olblank = flex spacer margin 0 ตามดีไซน์) ต้อง margin เท่ากันทุกแถว
    const rows = [...document.querySelectorAll('.dtrow, .opts, .f:not(.olblank), .sec, .paid')]
    const sb = sheet.getBoundingClientRect()
    const qb = qr.getBoundingClientRect()
    return {
      sheetH: Math.round(sheet.clientHeight * 100) / 100,
      sheetScrollH: sheet.scrollHeight,
      overflow: sheet.scrollHeight > sheet.clientHeight,
      blankRowHeights: blanks,
      qrBottomGapPx: Math.round((sb.bottom - qb.bottom) * 100) / 100,
      equalMargins: rows.every((el) => getComputedStyle(el).marginTop === '0.4px' && getComputedStyle(el).marginBottom === '0.4px'),
    }
  })
  out.pass = {
    noOverflow: !out.overflow,
    blanksReserved: out.blankRowHeights.length === 2 && out.blankRowHeights.every((h) => h > 2),
    equalMargins: out.equalMargins,
    bottomGapGe2mm: out.qrBottomGapPx >= 7.5,
  }
  out.allPass = Object.values(out.pass).every(Boolean)
  await browser.close()
  fs.writeFileSync(path.resolve(__dirname, 'r66_sticker_fit.json'), JSON.stringify(out, null, 2))
  console.log('R66_FIT allPass=' + out.allPass + ' ' + JSON.stringify(out.pass))
  console.log('scrollH=' + out.sheetScrollH + '/' + out.sheetH + ' blanks=' + JSON.stringify(out.blankRowHeights) + ' bottomGapPx=' + out.qrBottomGapPx)
  if (!out.allPass) process.exit(1)
})().catch((e) => { console.error('FIT_FAIL ' + e.message); process.exit(1) })