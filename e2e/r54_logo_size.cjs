// e2e/r54_logo_size.cjs — อ่าน dimensions โลโก้ทุกไฟล์ใน public/ (webp header: VP8/VP8L/VP8X)
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'public')
function dim(b) {
  if (b.length < 30 || b.slice(0, 4).toString('ascii') !== 'RIFF' || b.slice(8, 12).toString('ascii') !== 'WEBP') return null
  const t = b.slice(12, 16).toString('ascii')
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff, 'lossy']
  if (t === 'VP8L') {
    const w = 1 + (b[21] | ((b[22] & 0x3f) << 8))
    const h = 1 + (((b[22] & 0xc0) >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10))
    return [w, h, 'lossless']
  }
  if (t === 'VP8X') {
    const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16))
    const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16))
    return [w, h, 'extended']
  }
  return [null, null, t]
}
const files = fs.readdirSync(dir).filter((f) => /\.webp$/i.test(f)).sort()
for (const f of files) {
  const d = dim(fs.readFileSync(path.join(dir, f)))
  if (!d) { console.log(f, '-> UNREADABLE'); continue }
  const [w, h, kind] = d
  const ratio = w && h ? (w / h).toFixed(3) : '?'
  console.log(`${f} -> ${w}x${h} (${kind}) ratio=${ratio} ${w !== h ? '<= NON-SQUARE' : ''}`)
}
