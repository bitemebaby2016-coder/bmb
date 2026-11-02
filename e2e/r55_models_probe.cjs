// e2e/r55_models_probe.cjs — ค้นโมเดลตามคำสั่ง Owner (2026-11-02):
//  (1) โมเดลภาพ: ByteDance Seed Seedream 5.0 Flash (หลัก) + Qwen Qwen Image 2.1 Pro (รอง)
//  (2) โมเดล vision-text สำหรับอ่านสกรีนช็อตรีวิว (ภาษาที่ยังเพี้ยน)
;(async () => {
  const r = await fetch('https://openrouter.ai/api/v1/models')
  const j = await r.json()
  const all = j.data || []

  const hit = (m, pats) => pats.some((p) => p.test(m.id + ' ' + m.name))
  const imgModels = all.filter((m) => (m.architecture?.output_modalities || []).includes('image'))
  console.log(`IMAGE_OUTPUT(${imgModels.length}):`)
  imgModels.forEach((m) => console.log(`  ${m.id} | ${m.name}`))

  const want = [/seedream/i, /qwen[-/ ]?image/i, /bytedance/i]
  const matches = all.filter((m) => hit(m, want))
  console.log(`OWNER_KEYWORD_MATCH(${matches.length}):`)
  matches.forEach((m) =>
    console.log(
      `  ${m.id} | ${m.name} | out=${(m.architecture?.output_modalities || []).join(',')} | in=${(m.architecture?.input_modalities || []).join(',')}`
    )
  )

  const vision = all.filter(
    (m) =>
      (m.architecture?.input_modalities || []).includes('image') &&
      !(m.architecture?.output_modalities || []).includes('image')
  )
  console.log(`VISION_TEXT_TOP(${Math.min(vision.length, 12)}/${vision.length}):`)
  vision.slice(0, 12).forEach((m) => console.log(`  ${m.id} | ${m.name}`))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
