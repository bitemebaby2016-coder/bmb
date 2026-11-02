// e2e/r55_badchar.cjs — หาอักขระนอกชุด (Arabic/CJK/BOM/U+FFFD) ในไฟล์ที่ languageSanity จับ
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const targets = process.argv.slice(2)
for (const rel of targets) {
  const p = path.join(ROOT, rel)
  const txt = fs.readFileSync(p, 'utf8')
  const lines = txt.split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const ch of line) {
      const c = ch.codePointAt(0)
      const isThai = c >= 0x0e00 && c <= 0x0e7f
      const isAscii = c >= 0x20 && c <= 0x7e
      const isEmojiPunct = [0x2018, 0x2019, 0x201c, 0x201d, 0x2013, 0x2014, 0x2026, 0x00d7, 0x00f7].includes(c)
      const allowed = isThai || isAscii || isEmojiPunct || c === 0x0a || c === 0x0d || c === 0x09
      // ข้าม emoji + ช่องว่าง unicode typical
      const isMisc = (c >= 0x2600 && c <= 0x27bf) || (c >= 0x1f000 && c <= 0x1faff) || (c >= 0x2190 && c <= 0x21ff) || (c >= 0x2b00 && c <= 0x2bff) || c === 0x00a0 || c === 0xfe0f
      if (!allowed && !isMisc) {
        console.log(`${rel}:${i + 1} U+${c.toString(16).toUpperCase()} '${ch}' :: ${line.trim().slice(0, 90)}`)
      }
    }
  })
}
console.log('SCAN_DONE')
