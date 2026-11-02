// e2e/r55_prod_file.cjs — ดาวน์โหลด /FB logo.webp จาก production แล้วเทียบ hash กับไฟล์ใน public/
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const LOCAL = path.resolve(__dirname, '..', 'public', 'FB logo.webp')
const URLS = [
  'https://biteme-baby.com/FB%20logo.webp',
  'https://biteme-baby.com/Grab%20Food%20Logo.webp',
  'https://biteme-baby.com/line%20logo.webp',
  'https://biteme-baby.com/Messenger%20logo.webp',
]

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)

async function main() {
  const local = fs.readFileSync(LOCAL)
  console.log(`LOCAL FB logo.webp bytes=${local.length} sha=${sha(local)}`)
  for (const u of URLS) {
    try {
      const r = await fetch(u, { cache: 'no-store' })
      const buf = Buffer.from(await r.arrayBuffer())
      console.log(`PROD ${u} -> ${r.status} bytes=${buf.length} sha=${sha(buf)} cf-cache=${r.headers.get('cf-cache-status')}`)
    } catch (e) {
      console.log(`PROD ${u} -> ERR ${e.message}`)
    }
  }
}
main()
