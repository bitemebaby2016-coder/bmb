// e46: dump StoreStatusStrip ทั้งไฟล์ + homeProviders 150-300 (copy สถานะหน้าแรก)
const fs = require('fs')
const path = require('path')
const ROOT = 'D:\\A PROJECT\\Bite Me Baby'
const dumpRange = (rel, a, b) => {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/)
  console.log('===== ' + rel + ' [' + a + '-' + b + '/' + lines.length + '] =====')
  for (let i = a - 1; i < b && i < lines.length; i++) console.log(String(i + 1).padStart(4) + ' | ' + lines[i])
}
dumpRange('src/components/home/StoreStatusStrip.tsx', 1, 200)
dumpRange('src/lib/homeProviders.ts', 150, 300)