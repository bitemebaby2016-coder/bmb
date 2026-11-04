'use strict'
// _r67_reap — kill ONLY leaked `vite preview` children spawned by my own E2E/probe
// runs (process.exit() skipped the finally/taskkill). Filter strictly by command
// line: must contain "vite.js preview" — never touch unrelated node processes.
const { execSync } = require('child_process')

let out = ''
try {
  out = execSync('wmic process get ProcessId,CommandLine /format:csv', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch (e) {
  console.log('WMIC_FAIL ' + String(e).slice(0, 120))
  process.exit(1)
}
const targets = []
for (const line of out.split(/\r?\n/)) {
  if (!line.includes('vite.js preview')) continue
  const parts = line.trim().split(',')
  const pid = parts[parts.length - 1]
  if (/^\d+$/.test(pid)) targets.push({ pid, cmd: line.trim().slice(0, 120) })
}
console.log('leaked previews found=' + targets.length)
for (const t of targets) {
  console.log('KILL pid=' + t.pid + ' :: ' + t.cmd)
  try { execSync('taskkill /pid ' + t.pid + ' /t /f', { stdio: 'ignore' }) ; console.log('  killed') } catch (e) { console.log('  kill fail: ' + String(e).slice(0, 80)) }
}
console.log('REAP_DONE')
