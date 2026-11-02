// e2e/r55_model_smoke.cjs — R55: ทดสอบโมเดล image-gen จริง (คีย์ dev) ผ่านทางเดียวกับ EF
//   (A) /api/v1/images/generations → (B) chat/completions modalities image
//   รายงาน: โมเดลไหนสำเร็จ + ขนาดภาพ (เฝ้าดู 4:3 สำหรับเมนู) + บันทึกไฟล์ให้ดู
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
function env(file, key) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) return ''
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(fs.readFileSync(p, 'utf8'))
  return m ? m[1].trim() : ''
}
const KEY = env('supabase/secrets.local.env', 'OPENROUTER_API_KEY')
const MODELS = ['bytedance-seed/seedream-5-0-flash', 'qwen/qwen-image-2.1-pro']
const PROMPT =
  'ภาพเมนูอาหาร "สปาเกตตี้ผัดพริกแห้งกุ้ง" สำหรับร้านของหวาน Bite Me Baby — ภาพเมนูน่ากิน มุม 45 องศา แสงธรรมชาตินุ่ม พื้นหลังสะอาด อัตราส่วนภาพ 4:3 เต็มกรอบ'

function pickImage(j) {
  const d0 = Array.isArray(j?.data) ? j.data[0] : null
  if (d0?.b64_json) return `data:image/png;base64,${d0.b64_json}`
  if (d0?.url) return d0.url
  const msg = j?.choices?.[0]?.message
  for (const im of msg?.images || []) {
    const u = im?.image?.url || im?.image_url?.url || (typeof im?.image_url === 'string' ? im.image_url : '') || im?.url
    if (u) return u
  }
  return ''
}

async function dims(u) {
  try {
    const buf = Buffer.from(
      u.startsWith('data:') ? u.split(',')[1] : Buffer.from(await (await fetch(u)).arrayBuffer()).toString('base64'),
      'base64'
    )
    // PNG header
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`
    // JPEG SOF
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue }
      const m = buf[i + 1]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`
      i += 2 + buf.readUInt16BE(i + 2)
    }
    return 'unknown'
  } catch { return 'err' }
}

;(async () => {
  if (!KEY) { console.log('NO_KEY'); return }
  const LOG = path.join(__dirname, 'r55_smoke.log')
  const say = (s) => { try { fs.appendFileSync(LOG, s + '\n') } catch {} ; console.log(s) }
  const only = process.argv[2] != null ? Number(process.argv[2]) : null
  const list = only == null ? MODELS : [MODELS[only]]
  for (const model of list) {
    const attempts = []
    // (A) images API
    try {
      const r = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: PROMPT, n: 1 }),
      })
      const t = await r.text()
      let j = null
      try { j = JSON.parse(t) } catch {}
      const u = r.ok ? pickImage(j) : ''
      if (u) {
        const d = await dims(u)
        const out = path.join(__dirname, `r55_smoke_${model.replace(/[^a-z0-9]+/gi, '_')}.png`)
        fs.writeFileSync(out, Buffer.from(u.split(',')[1] || '', 'base64'))
        say(`OK images-api ${model} dims=${d} saved=${path.basename(out)}`)
        continue
      }
      attempts.push(`images:${r.status} ${(j?.error?.message || t).slice(0, 120)}`)
    } catch (e) { attempts.push('images_ex ' + e.message) }
    // (B) chat
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, modalities: ['image', 'text'], messages: [{ role: 'user', content: PROMPT }] }),
      })
      const t = await r.text()
      let j = null
      try { j = JSON.parse(t) } catch {}
      const u = r.ok ? pickImage(j) : ''
      if (u) {
        const d = await dims(u)
        const out = path.join(__dirname, `r55_smoke_${model.replace(/[^a-z0-9]+/gi, '_')}.png`)
        if (u.startsWith('data:')) fs.writeFileSync(out, Buffer.from(u.split(',')[1], 'base64'))
        say(`OK chat ${model} dims=${d} saved=${path.basename(out)}`)
        continue
      }
      attempts.push(`chat:${r.status} ${(j?.error?.message || t).slice(0, 120)}`)
    } catch (e) { attempts.push('chat_ex ' + e.message) }
    say(`FAIL ${model} :: ${attempts.join(' | ')}`)
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
