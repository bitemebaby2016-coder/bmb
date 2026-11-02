// R52 — ตรวจอักขระในไฟล์ strip/test (กัน languageSanity: scooter emoji ถูกแทนด้วยอักขระจีน)
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const files = [
  'src/components/home/StoreStatusStrip.tsx',
  'src/lib/homeProviders.ts',
  'src/__tests__/r44StatusStrip.test.ts',
  'src/lib/storeStatusCopy.ts',
  'src/__tests__/storeStatusWindow.test.ts',
  'src/__tests__/r13RiderLoopClose.test.ts',
]
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8')
  console.log(
    f,
    '| Chinese-char:', s.includes('\u7535\u52a8\u8f66'),
    '| scooter emoji:', s.includes('\u{1F6F5}'),
  )
}
