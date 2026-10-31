// e2e/r35_or_web.cjs — Owner ยืนยันมี "Qwen Image 3" + "Seedream 5.0 Flash" แต่ /api/v1/models ไม่เจอ
// → เช็คหน้าค้นหาเว็บ (SSR payload) เผื่อโมเดลใหม่อยู่ใน index คนละชุดกับ API
fetch('https://openrouter.ai/models?q=seedream')
  .then((r) => r.text())
  .then((h) => {
    const hits = new Set()
    for (const m of h.matchAll(/(bytedance[a-z0-9/\-]*seedream[a-z0-9.\-]*)/gi)) hits.add(m[1])
    console.log('seedream page:', [...hits].join(' ; ') || 'NONE', '| htmlLen', h.length)
  })
  .then(() => fetch('https://openrouter.ai/models?q=qwen+image'))
  .then((r) => r.text())
  .then((h) => {
    const hits = new Set()
    for (const m of h.matchAll(/(qwen[a-z0-9/\-]*image[a-z0-9.\-]*)/gi)) hits.add(m[1])
    console.log('qwen image page:', [...hits].join(' ; ') || 'NONE', '| htmlLen', h.length)
  })
  .catch((e) => console.log('ERR', e.message))
