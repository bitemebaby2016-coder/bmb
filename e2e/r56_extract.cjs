// R56 — ดึง HTML จาก dump ของ vitest ออกมาเป็นไฟล์ (วัด layout จริงในเบราว์เซอร์)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const log = fs.readFileSync(path.join(ROOT, 'e2e', 'r56_dump.log'), 'utf8')

const grab = (a, b) => {
  const i = log.indexOf(a)
  const j = log.indexOf(b)
  if (i < 0 || j < 0 || j < i) return null
  return log.slice(i + a.length, j).trim()
}

const one = grab('DUMP_BEGIN_ONE', 'DUMP_END_ONE')
const many = grab('DUMP_BEGIN_MANY', 'DUMP_END_MANY')
if (!one || !many) { console.error('EXTRACT_FAILED', !!one, !!many); process.exit(1) }
fs.writeFileSync(path.join(ROOT, 'e2e', 'r56_sticker_one.html'), one)
fs.writeFileSync(path.join(ROOT, 'e2e', 'r56_sticker_many.html'), many)
console.log('EXTRACT_OK one=' + one.length + ' many=' + many.length)
