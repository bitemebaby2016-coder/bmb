// เช็คสตริงต้องห้ามในไฟล์ (findstr บอดกับ UTF-8)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const checks = [
  ['supabase/migrations/178_cron_publish_tick.sql', ['BMB_TICK_TOKEN']],
  ['supabase/functions/image-gen/index.ts', ['qwen/qwen-image-3', 'seedream-5-0-flash']],
]
for (const [f, needles] of checks) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8')
  for (const n of needles) {
    const i = s.indexOf(n)
    if (i >= 0) {
      const line = s.slice(0, i).split('\n').length
      console.log(`FOUND ${f}:${line} => ${n}`)
    }
  }
}
console.log('SCAN_DONE')