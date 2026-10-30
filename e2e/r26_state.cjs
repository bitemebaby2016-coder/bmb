// R26 state — อ่าน 3 ฟังก์ชันหลักของ printService แบบ locate-by-name (ไม่พึ่งบรรทัดที่จำ) · ใช้แล้วลบ
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(ROOT, 'src/lib/printService.ts'), 'utf8')
const lines = src.split(/\r?\n/)
function seg(name, maxLines = 70) {
  const i = lines.findIndex((l) => l.includes(name))
  console.log('===== ' + name + ' @line ' + (i + 1) + ' =====')
  if (i < 0) return console.log('NOT FOUND')
  for (let j = i; j < Math.min(i + maxLines, lines.length); j++) console.log(String(j + 1).padStart(4) + '| ' + lines[j])
}
console.log('TOTAL=' + lines.length + ' | bare16_19=' + JSON.stringify(lines.slice(15, 19)))
seg('export function printHtmlInHiddenFrame', 35)
seg('export async function runAutoPrint', 30)
seg('export async function printOrderTicket', 45)