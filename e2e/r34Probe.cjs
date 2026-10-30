// R34 probe — env keys (ชื่อเท่านั้น ไม่พิมพ์ค่า) + จำนวนไฟล์รีวิว + โมเดล OpenRouter ที่เข้าเงื่อนไข
const fs = require('fs')
try {
  const t = fs.readFileSync('.env.local', 'utf8')
  const keys = t.split(/\r?\n/).filter((l) => /^[A-Za-z_]+=/.test(l)).map((l) => l.split('=')[0])
  console.log('ENV_KEYS: ' + keys.join(', '))
  const or = t.split(/\r?\n/).find((l) => l.startsWith('OPENROUTER') || l.includes('OPENROUTER'))
  if (or) {
    const [k, v = ''] = or.split('=')
    console.log(`OR_KEY: ${k} len=${v.trim().length}`)
  } else console.log('OR_KEY: MISSING')
} catch (e) { console.log('ENV_ERR: ' + e.message) }
try {
  const f = fs.readdirSync('public/assets/reviews/small')
  console.log('REVIEW_FILES: ' + f.length)
} catch (e) { console.log('REV_ERR: ' + e.message) }
try {
  const f = fs.readdirSync('public/assets/reviews/small').sort()
  console.log('REVIEW_LIST: ' + f.join(','))
} catch (e) { console.log('REVLIST_ERR: ' + e.message) }
fetch('https://openrouter.ai/api/v1/models')
  .then((r) => r.json())
  .then((j) => {
    // ทุกโมเดลที่ "output รูปได้" + ทุกโมเดลที่มี qwen/seed/bytedance/nano in name
    const imgOut = j.data
      .filter((m) => (m.architecture.output_modalities || []).includes('image'))
      .map((m) => m.id)
    const named = j.data
      .filter((m) => /seed|qwen|nano.?banana|banana|imagen|flux|sdxl|dall|gpt.?image/i.test(m.id))
      .map((m) => `${m.id} [${(m.architecture.output_modalities || []).join('+')}]`)
    console.log('IMAGE_OUTPUT_MODELS (' + imgOut.length + '):\n' + imgOut.join('\n'))
    console.log('NAMED_CANDIDATES:\n' + named.join('\n'))
    fs.writeFileSync('e2e/r34_or_models.txt', '== image output ==\n' + imgOut.join('\n') + '\n== named ==\n' + named.join('\n'))
  })
  .catch((e) => console.log('FETCH_ERR: ' + e.message))
