// e2e/r55_model_ids.cjs — ตรวจว่าโมเดลตามคำสั่ง Owner มีจริงบน OpenRouter หรือไม่
// วิธี: POST /chat/completions max_tokens=1 → 404 = ไม่มี · 402/400/200 = มีจริง
// + ไล่ชื่อโมเดลทั้งแคตตาล็อกที่มีคำว่า image ในชื่อ
const fs = require('fs')
const path = require('path')

function env(file, key) {
  const p = path.join(__dirname, '..', file)
  if (!fs.existsSync(p)) return ''
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(fs.readFileSync(p, 'utf8'))
  return m ? m[1].trim() : ''
}
const KEY = env('supabase/secrets.local.env', 'OPENROUTER_API_KEY')

const CANDIDATES = [
  'bytedance-seed/seedream-5.0-flash',
  'bytedance-seed/seedream-5-0-flash',
  'bytedance/seedream-5.0-flash',
  'bytedance-seed/seedream-5-flash',
  'bytedance-seed/seedream-6-pro',
  'qwen/qwen-image-2.1-pro',
  'qwen/qwen-image-2.1',
  'qwen/qwen-image-3',
]

;(async () => {
  // 1) แคตตาล็อก: ชื่อมี "image" (ไม่สน output_modalities)
  const r = await fetch('https://openrouter.ai/api/v1/models')
  const j = await r.json()
  const named = (j.data || []).filter((m) => /image/i.test(m.name))
  console.log(`CATALOG name~image (${named.length}):`)
  named.forEach((m) => console.log(`  ${m.id} | ${m.name} | out=${(m.architecture?.output_modalities || []).join(',')}`))

  // 2) probe candidate ids (max_tokens=1 — ค่าใช้จ่ายเท่ากับศูนย์)
  console.log('CANDIDATE PROBE:')
  for (const model of CANDIDATES) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
      })
      const txt = await res.text()
      let msg = txt.slice(0, 220).replace(/\s+/g, ' ')
      try {
        const jj = JSON.parse(txt)
        msg = jj.error ? `${jj.error.code || ''} ${jj.error.message}`.slice(0, 220) : 'OK ' + (jj.choices ? 'has-choices' : '')
      } catch {}
      console.log(`  ${model} -> HTTP ${res.status} :: ${msg}`)
    } catch (e) {
      console.log(`  ${model} -> ERR ${e.message}`)
    }
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
