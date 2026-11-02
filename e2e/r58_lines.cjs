// r58_lines.cjs <file> <start> <end> — พิมพ์บรรทัด (findstr/powershell โดน cmd ตัดกับไฟล์ UTF-8)
const fs = require('fs')
const [f, a, b] = [process.argv[2], Number(process.argv[3] || 1), Number(process.argv[4] || 1)]
fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(a - 1, b).forEach((s, i) => console.log(a + i + ': ' + s))