// temp: is bg tsc alive? (DELETE at session end)
const fs = require('fs')
const { execSync } = require('child_process')
const ROOT = 'D:/A PROJECT/Bite Me Baby'
const code = ROOT + '/zz_gate_tsc.code'
console.log('code exists:', fs.existsSync(code))
if (fs.existsSync(code)) console.log('code:', fs.readFileSync(code, 'utf8').trim())
try {
  const st = fs.statSync(ROOT + '/e2e/bg_tsc.log')
  console.log('log size:', st.size, 'mtime:', st.mtime.toISOString())
} catch { console.log('log missing') }
const out = execSync('tasklist', { encoding: 'utf8' })
for (const l of out.split(/\r?\n/)) {
  if (/node|npx|tsc|cmd\.exe/i.test(l)) console.log(l.trim())
}
