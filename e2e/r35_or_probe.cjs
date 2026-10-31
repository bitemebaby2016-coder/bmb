// e2e/r35_or_probe.cjs — Owner 2026-10-31: "Qwen Image 3 + ByteDance Seedream 5.0 Flash มีใน OpenRouter"
// เช็ค ID จริงจากแคตตาล็อกสาธารณะ (ไม่ใช้ key) → ผลเขียนให้แฮนออฟรอบหน้าใส่ IMAGE_MODEL_CANDIDATES
fetch('https://openrouter.ai/api/v1/models')
  .then((r) => r.json())
  .then((d) => {
    const hit = d.data.filter((x) => /seedream|qwen.*image|image.*qwen/i.test(`${x.id || ''} ${x.name || ''}`))
    console.log('== match (seedream/qwen image) ==')
    for (const m of hit) console.log(`${m.id} | ${m.name} | out=${(m.output_modalities || []).join(',')}`)
    if (!hit.length) console.log('NONE')
    const img = d.data.filter((x) => (x.output_modalities || []).includes('image'))
    console.log(`== all image-output models (${img.length}) ==`)
    for (const m of img) console.log(m.id)
  })
  .catch((e) => { console.error('ERR', e.message); process.exit(1) })
