// R52 — วัดขนาดภาพโลโก้ฟุตเตอร์ 3 ไฟล์ (webp header parse: VP8X/VP8/VP8L)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
function webpSize(buf) {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const fourcc = buf.toString('ascii', 12, 16)
  if (fourcc === 'VP8X') {
    const w = 1 + buf.readUIntLE(24, 3)
    const h = 1 + buf.readUIntLE(27, 3)
    return { w, h, chunk: 'VP8X' }
  }
  if (fourcc === 'VP8 ') {
    // lossy keyframe: 3-byte frame tag + 3-byte sync + 14-bit w/h at offset 26
    const w = buf.readUInt16LE(26) & 0x3fff
    const h = buf.readUInt16LE(28) & 0x3fff
    return { w, h, chunk: 'VP8' }
  }
  if (fourcc === 'VP8L') {
    const b = buf.readUInt8(21)
    if (b !== 0x2f) return null
    const bits = buf.readUInt32LE(22)
    const w = (bits & 0x3fff) + 1
    const h = ((bits >> 14) & 0x3fff) + 1
    return { w, h, chunk: 'VP8L' }
  }
  return { w: 0, h: 0, chunk: fourcc }
}
const out = []
for (const f of ['Facebook Logo.webp', 'Messenger logo.webp', 'line logo.webp']) {
  const p = path.join(ROOT, 'public', f)
  if (!fs.existsSync(p)) { out.push({ file: f, missing: true }); continue }
  const buf = fs.readFileSync(p)
  const s = webpSize(buf)
  out.push({ file: f, bytes: buf.length, ...(s || { error: 'unparsed' }) })
}
console.log(JSON.stringify(out, null, 2))
fs.writeFileSync(path.join(ROOT, 'e2e', 'r52_measure_logos.json'), JSON.stringify(out, null, 2))
