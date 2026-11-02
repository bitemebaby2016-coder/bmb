// e2e/r55_procs.cjs — ตรวจ/จบเฉพาะโพรเซสที่เป็นสคริปต์ r55 ของเรา (ตามกติกา: ห้าม kill แบบเหมา)
const { execSync } = require('child_process')
const mine = process.argv[2] || 'r55_vision'
const out = execSync(
  `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"`,
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
)
let rows = []
try { rows = JSON.parse(out) } catch { console.log('parse-fail', out.slice(0, 200)); process.exit(0) }
if (!Array.isArray(rows)) rows = rows ? [rows] : []
const hits = rows.filter((r) => (r.CommandLine || '').includes(mine) && Number(r.ProcessId) !== process.pid)
console.log(`matching=${hits.length}`)
hits.forEach((h) => {
  console.log(`  pid=${h.ProcessId} ${String(h.CommandLine).slice(0, 120)}`)
  if (process.argv[3] === '--kill') {
    try { execSync(`taskkill /PID ${h.ProcessId} /T /F`); console.log(`  killed ${h.ProcessId}`) } catch (e) { console.log(`  kill-fail ${h.ProcessId}`) }
  }
})
