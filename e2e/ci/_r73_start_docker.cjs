'use strict'
// _r73_start_docker — เปิด Docker Desktop (exe path มีช่องว่าง — รันผ่าน node เลี่ยงปัญหา quoting ของ cmd)
// ใช้: node e2e\\ci\\_r73_start_docker.cjs   → แล้ว poll `docker info` จน DOCKER_READY
const { spawn, spawnSync } = require('child_process')
const EXE = 'C:\\Users\\HP EliteBook\\AppData\\Local\\Programs\\DockerDesktop\\Docker Desktop.exe'
const ready = () => spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0
if (ready()) { console.log('DOCKER_ALREADY_READY'); process.exit(0) }
try {
  const p = spawn(EXE, [], { detached: true, stdio: 'ignore' })
  p.unref()
  console.log('LAUNCHING_DOCKER_DESKTOP')
} catch (e) {
  console.log('LAUNCH_FAIL ' + String(e).slice(0, 200))
  process.exit(1)
}