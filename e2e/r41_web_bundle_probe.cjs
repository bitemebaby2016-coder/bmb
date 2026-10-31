// R41a — เช็คว่า bundle ที่เว็บจริงเสิร์ฟอยู่มี RPC ใหม่ไหม (marketing_feed_posts = frontend deploy แล้วหรือยัง)
;(async () => {
  const html = await (await fetch('https://biteme-baby.com/')).text()
  const m = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((x) => x[1])
  console.log('ASSETS=' + JSON.stringify(m.slice(0, 12)))
  let hitFeed = 0
  let hitWizard = 0
  let hitGen = 0
  let checked = 0
  for (const a of m) {
    const js = await (await fetch('https://biteme-baby.com' + a)).text()
    checked++
    if (js.includes('marketing_feed_posts')) hitFeed++
    if (js.includes('sticker-wizard')) hitWizard++
    if (js.includes('ai-generated')) hitGen++
  }
  console.log('CHECKED=' + checked + ' HAS_feed_rpc=' + hitFeed + ' HAS_wizard=' + hitWizard + ' HAS_ai_album=' + hitGen)
  if (m.length === 0) console.log('NO_ASSETS_FOUND html_head=' + html.slice(0, 300))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))