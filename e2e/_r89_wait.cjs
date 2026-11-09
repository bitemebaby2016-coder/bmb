// R89 WAIT PROBE — รอ marker ในล็อกสูงสุด 25 วิ (bounded ไม่ใช่ poll) · จบแล้วลบไฟล์นี้ทิ้ง
'use strict'
const fs = require('fs')
const LOG = 'e2e/_r88_final_gates.log'
const END = Date.now() + 25000
function status() {
  if (!fs.existsSync(LOG)) return 'NO_LOG_YET'
  const s = fs.readFileSync(LOG, 'utf8')
  if (s.includes('ALL_GATES_DONE')) return 'DONE'
  if (s.includes('GATE_FAILED_AT')) return 'FAILED'
  const m = s.match(/=== GATE (\w+) START/g)
  return 'RUNNING@' + (m ? m[m.length - 1].replace('=== GATE ', '').replace(' START', '') : '?')
}
;(function loop() {
  const st = status()
  if (st === 'DONE' || st === 'FAILED' || Date.now() > END) {
    console.log('STATUS=' + st)
    if (fs.existsSync(LOG)) {
      const s = fs.readFileSync(LOG, 'utf8')
      console.log(s.split('\n').filter((l) => l.includes('GATE ') || l.includes('EXIT=')).join(' | '))
    }
    process.exit(0)
  }
  setTimeout(loop, 1000)
})()