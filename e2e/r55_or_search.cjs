// e2e/r55_or_search.cjs — ค้นชื่อโมเดลตามคำสั่ง Owner บนหน้าค้นหา OpenRouter (SSR payload)
// "ByteDance Seed: Seedream 5.0 Flash" + "Qwen: Qwen Image 2.1 Pro"
const QUERIES = ['seedream', 'qwen image', 'bytedance seed']
;(async () => {
  for (const q of QUERIES) {
    const url = `https://openrouter.ai/models?q=${encodeURIComponent(q)}`
    const r = await fetch(url)
    const h = await r.text()
    const hits = new Set()
    // จับรูปแบบ id ทั้งในลิงก์ /models/<id> และใน JSON payload
    for (const m of h.matchAll(/"id"\s*:\s*"([a-z0-9\-]+(?:\/[a-z0-9\.\-:]+))"/gi)) hits.add(m[1])
    for (const m of h.matchAll(/\/models\/([a-z0-9\-]+\/[a-z0-9\.\-:]+)/gi)) hits.add(m[1])
    const qHits = [...hits].filter((x) => /seedream|qwen|bytedance/i.test(x))
    console.log(`Q="${q}" status=${r.status} htmlLen=${h.length} ids=${hits.size}`)
    qHits.forEach((x) => console.log(`   ${x}`))
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
