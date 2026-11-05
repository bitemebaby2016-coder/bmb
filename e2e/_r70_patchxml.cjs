// one-shot: patch the schtasks-exported UTF-16 template into a gates task
// (schtasks /xml rejects hand-written encodings — reuse its own export format)
// usage: node e2e/_r70_patchxml.cjs [launcher.cmd] [taskName]
'use strict'
const fs = require('fs')
const LAUNCHER = process.argv[2] || 'r70gates.cmd'
const TASK = process.argv[3] || 'BMB_R70_GATES'
const T = 'C:/Users/HPELIT~1/tmpl.xml'
const O = 'C:/Users/HPELIT~1/r70task.xml'
let x = fs.readFileSync(T, 'latin1')
if (!x.includes('<Command>notepad.exe</Command>')) { console.error('TEMPLATE_UNEXPECTED'); process.exit(1) }
x = x.replace('<Command>notepad.exe</Command>', '<Command>cmd.exe</Command>\r\n      <Arguments>/c C:\\Users\\HPELIT~1\\' + LAUNCHER + '</Arguments>')
x = x.replace('<DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries>', '<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>')
x = x.replace('<StopIfGoingOnBatteries>true</StopIfGoingOnBatteries>', '<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>')
fs.writeFileSync(O, '\uFEFF' + x, 'utf16le')
console.log('WROTE', O, fs.statSync(O).size, 'args_ok=' + x.includes(LAUNCHER), 'task=' + TASK)
