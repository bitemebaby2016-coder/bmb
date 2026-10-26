// W-2 — ตรวจ guest (ไม่ล็อกอิน) บน production จริงแบบ read-only: โหลด /menu แล้วดู
//   1) สถานะ call /rest/v1/* 2) จำนวนการ์ดเมนูที่แสดงจริง 3) console error
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const rest = [];
  const errs = [];
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/rest/v1/')) rest.push(`${r.status()} ${u.split('/rest/v1/')[1].slice(0, 90)}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await page.goto('https://biteme-baby.com/menu', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);
  const imgs = await page.locator('img').count();
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600);
  console.log('=== /rest/v1 calls (status path) ===');
  console.log(rest.join('\n') || '(none)');
  console.log('=== console errors ===');
  console.log(errs.join('\n') || '(none)');
  console.log('=== img count:', imgs);
  console.log('=== body:', body);
  await browser.close();
})().catch((e) => { console.error('PW_FAIL', e.message); process.exit(1); });