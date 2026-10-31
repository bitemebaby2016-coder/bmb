// R41b — ดึงทะเบียนโมเดล OpenRouter แบบ local (ไม่ truncation): เฉพาะตัวที่ output = image
;(async () => {
  const r = await fetch('https://openrouter.ai/api/v1/models')
  const j = await r.json()
  const out = j.data
    .filter((m) => (m.architecture?.output_modalities || []).includes('image'))
    .map((m) => `${m.id} | ${m.name} | in=${(m.architecture.input_modalities || []).join('+')} | endpoints=${(m.endpoints || []).join(',')}`)
  console.log('IMAGE_OUTPUT_MODELS(' + out.length + '):')
  out.forEach((l) => console.log('  ' + l))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))