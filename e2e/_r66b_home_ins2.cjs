// R66-B v2: thread masterOpen into HomePage (whole-file read → line-assert → splice → whole-file write)
// ใช้ parseStoreMasterOpen — รองรับทั้ง boolean และ object form {open:boolean} จาก migration seed
const fs = require('fs')
const p = 'src/pages/HomePage.tsx'
const raw = fs.readFileSync(p, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const L = raw.split(/\r?\n/)

function assert(i, sub) {
  const line = L[i - 1]
  if (!line || !line.includes(sub)) {
    console.error(`ASSERT_FAIL line ${i}: expected "${sub}", got: ${JSON.stringify(line)}`)
    process.exit(1)
  }
}

// 1) import (line 56 = hoursToMs import)
assert(56, 'hoursToMs')
L.splice(56, 0, "import { parseStoreMasterOpen } from '@/lib/storeMaster'")
// 2) state หลัง operatingHours (93+1=94)
assert(94, 'const [operatingHours')
L.splice(94, 0, '  const [masterOpen, setMasterOpen] = useState<boolean | null>(null)')
// 3) setter หลัง setOperatingHours (135+2=137)
assert(137, 'setOperatingHours(')
L.splice(137, 0, '            setMasterOpen(parseStoreMasterOpen(settings?.store_master_open))')
// 4) opts หลัง hoursClose (200+3=203)
assert(203, 'hoursClose: shopHours?.close,')
L.splice(203, 0, '    masterOpen,')

fs.writeFileSync(p, L.join(eol))
console.log('OK lines:', L.length)