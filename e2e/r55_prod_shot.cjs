// e2e/r55_prod_shot.cjs — screenshot footer social row + review badge บน production จริง
// (ดูตามที่ Owner เห็น — ใช้ตัดสินใจ normalize ไม่ต้องเดา)
const path = require('path')
const { chromium } = require('playwright')

const OUT = (n) => path.resolve(__dirname, `r55_prod_${n}.png`)

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 })
  await page.goto('https://biteme-baby.com/shop', { waitUntil: 'networkidle', timeout: 60000 })

  // 1) footer social row — clip รอบ bbox รวมของโลโก้ 3 ตัว (ซูม 6x ให้อ่านง่าย)
  const fImgs = page.locator('footer img')
  const fc = await fImgs.count()
  const boxes = []
  for (let i = 0; i < fc; i++) {
    const el = fImgs.nth(i)
    await el.scrollIntoViewIfNeeded()
    const b = await el.boundingBox()
    if (b) boxes.push(b)
  }
  await page.waitForTimeout(600)
  if (boxes.length) {
    const x0 = Math.min(...boxes.map((b) => b.x)) - 16
    const y0 = Math.min(...boxes.map((b) => b.y)) - 16
    const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + 16
    const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + 16
    await page.screenshot({
      path: OUT('social_row'),
      clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
      scale: 'device',
    })
    console.log('social clip:', Math.round(x1 - x0) + 'x' + Math.round(y1 - y0), 'boxes', boxes.length)
  }

  // 2) review card badge (เลื่อนไปเซกชั่นรีวิว)
  const badge = page.locator('.review-source-logo').first()
  if (await badge.count()) {
    await badge.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    const card = page.locator('.review-card-glass').first()
    await card.screenshot({ path: OUT('review_card') })
    // 3) แถวโลโก้รีวิวทั้งหมดเรียงกัน
    const badges = page.locator('.review-source-logo')
    const n = await badges.count()
    console.log('review badges found:', n)
    for (let i = 0; i < Math.min(n, 6); i++) {
      const src = await badges.nth(i).getAttribute('src')
      const box = await badges.nth(i).boundingBox()
      console.log(`badge[${i}] src=${src} box=${box ? Math.round(box.width) + 'x' + Math.round(box.height) : 'null'}`)
    }
  } else {
    console.log('no review badges found')
  }

  // 4) footer img boxes
  const imgs = page.locator('footer img')
  const c = await imgs.count()
  console.log('footer imgs:', c)
  for (let i = 0; i < c; i++) {
    const src = await imgs.nth(i).getAttribute('src')
    const box = await imgs.nth(i).boundingBox()
    const cls = await imgs.nth(i).getAttribute('class')
    if (src && /logo|FB|Grab|line|Messenger/i.test(src))
      console.log(`fimg[${i}] src=${src} box=${box ? Math.round(box.width) + 'x' + Math.round(box.height) : 'null'} cls=${cls}`)
  }

  await browser.close()
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e)
  process.exit(1)
})
