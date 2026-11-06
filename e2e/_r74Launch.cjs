// R74 — launch detached: node e2e/_r74Launch.cjs <cmd-file>
// ① normalize .cmd เป็น CRLF ก่อน (cmd.exe อ่านไฟล์ LF เป็นบรรทัดเดียว = ไม่รัน)
// ② detached+unref = process อยู่รอดต่อเมื่อ parent จบ
'use strict'
const fs = require('fs')
const { spawn } = require('child_process')
const target = process.argv[2]
if (!target) { console.log('USAGE: node e2e/_r74Launch.cjs <cmd-file>'); process.exit(1) }
const raw = fs.readFileSync(target, 'utf8')
fs.writeFileSync(target, raw.replace(/\r?\n/g, '\r\n'))
const c = spawn('C:\\Windows\\System32\\cmd.exe', ['/c', target], { detached: true, stdio: 'ignore', windowsHide: true })
c.unref()
console.log('LAUNCHED pid=' + c.pid + ' → ' + target)