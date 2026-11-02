// e2e/r55_vision_reviews.cjs — อ่านสกรีนช็อตรีวิวต้นฉบับด้วยโมเดล vision (OpenRouter)
// เหตุผล: อ่านภาพในเครื่องโดยตรงไม่ได้รอบนี้ (session image limit) → ส่งภาพให้โมเดลอ่านแทน
// ผล: ชื่อผู้รีวิว + ข้อความจริง (ไทย) + คะแนน + วันที่ ของทุกสกรีนช็อต → เทียบกับ socialProofReviews.ts
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
const DIR = path.join(ROOT, 'public', 'assets', 'reviews')

// โมเดล vision ที่ถูก (รายการโปรด → ใช้ตัวแรกที่แคตตาล็อกยืนยันว่ารับ image input)
const PREF = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'openai/gpt-5-mini',
  'openai/gpt-4.1-mini',
  'anthropic/claude-3.5-haiku',
]

async function pickVisionModel() {
  const r = await fetch('https://openrouter.ai/api/v1/models')
  const j = await r.json()
  for (const id of PREF) {
    const m = (j.data || []).find((x) => x.id === id)
    if (m && (m.architecture?.input_modalities || []).includes('image')) return id
  }
  // fallback: ตัวแรกที่รับ image input + output เป็น text
  const alt = (j.data || []).find(
    (m) => (m.architecture?.input_modalities || []).includes('image') && !(m.architecture?.output_modalities || []).includes('image')
  )
  return alt ? alt.id : ''
}

async function transcribe(model, file) {
  const b64 = fs.readFileSync(file).toString('base64')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'อ่านภาพสกรีนช็อตนี้ ถ้ามีรีวิว/คะแนนของลูกค้า ให้ตอบเป็น JSON เดียวตาม schema: ' +
                '{"hasReview":true,"reviewer":"ชื่อผู้รีวิวตามที่เห็นเป๊ะ","comment":"ข้อความรีวิวภาษาไทยเป๊ะทุกตัวอักษร","rating":5,"date":"วันที่ตามที่เห็น"} ' +
                'ถ้าไม่มีรีวิวเลย ตอบ {"hasReview":false} เท่านั้น ห้ามแปล ห้ามแก้ไขข้อความ',
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
    }),
  })
  const txt = await res.text()
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2500)) // rate limit ชั่วคราว = ลองซ้ำ 1 ครั้ง
    const retry = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'อ่านภาพสกรีนช็อตนี้ ถ้ามีรีวิว/คะแนนของลูกค้า ให้ตอบเป็น JSON เเดียวตาม schema: ' +
                  '{"hasReview":true,"reviewer":"ชื่อผู้รีวิวตามที่เห็นเป๊ะ","comment":"ข้อความรีวิวภาษาไทยเป๊ะทุกตัวอักษร","rating":5,"date":"วันที่ตามที่เห็น"} ' +
                  'ถ้าไม่มีรีวิวเลย ตอบ {"hasReview":false} เท่านั้น ห้ามแปล ห้ามแก้ไขข้อความ',
              },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
            ],
          },
        ],
      }),
    })
    const t2 = await retry.text()
    if (!retry.ok) return { file: path.basename(file), error: `HTTP ${retry.status} (after retry) ${t2.slice(0, 140)}` }
    return finalize(path.basename(file), t2)
  }
  if (!res.ok) return { file: path.basename(file), error: `HTTP ${res.status} ${txt.slice(0, 160)}` }
  return finalize(path.basename(file), txt)
}

function finalize(name, txt) {
  let content = ''
  try {
    const j = JSON.parse(txt)
    content = j.choices?.[0]?.message?.content || ''
  } catch {
    return { file: name, error: 'parse-fail ' + txt.slice(0, 160) }
  }
  const m = /\{[\s\S]*\}/.exec(content)
  let parsed = null
  try { parsed = m ? JSON.parse(m[0]) : null } catch { parsed = null }
  return { file: name, parsed, raw: parsed ? '' : content.slice(0, 300) }
}

;(async () => {
  if (!KEY) { console.log('NO_KEY'); return }
  const model = await pickVisionModel()
  if (!model) { console.log('NO_VISION_MODEL'); return }
  console.log('MODEL', model)
  const pat = (process.argv[4] || '^Screenshot_2026-09-17-.*\\.jpg$').replace(/^"|"$/g, '') // cmd ส่งเครื่องหมายคำพูดมาด้วย
  console.log('ARGV', JSON.stringify(process.argv.slice(2)), 'PAT', pat)
  const subDir = (process.argv[5] || '').replace(/^"|"$/g, '') // argv[5] = โฟลเดอร์ย่อย (เช่น small)
  const dir = subDir ? path.join(DIR, subDir) : DIR
  const files = fs.readdirSync(dir).filter((f) => new RegExp(pat).test(f)).sort()
  const start = Number(process.argv[2] || 0)
  const count = Number(process.argv[3] || files.length)
  const batch = files.slice(start, start + count)
  console.log('FILES', files.length, '| batch', start, '..', start + batch.length - 1)
  for (const f of batch) {
    const out = await transcribe(model, path.join(dir, f))
    if (out.error) console.log(`${out.file} :: ERR ${out.error}`)
    else if (!out.parsed) console.log(`${out.file} :: RAW ${out.raw}`)
    else if (out.parsed.hasReview === false) console.log(`${out.file} :: no-review`)
    else
      console.log(
        `${out.file} :: [${out.parsed.rating}★ ${out.parsed.date}] ${out.parsed.reviewer} — ${out.parsed.comment}`
      )
    await new Promise((r) => setTimeout(r, 50))
  }
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))
