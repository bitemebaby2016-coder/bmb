'use strict'
// R64 gate summaries
const fs = require('fs')
const path = require('path')
const pick = (f, keys) => {
  const p = path.join(process.cwd(), 'e2e', f)
  if (!fs.existsSync(p)) return { file: f, missing: true }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  return {
    file: f,
    tail: lines.filter(Boolean).slice(-6).map((l) => l.replace(/\u001b\[\d+m/g, '')),
    hits: lines.filter((l) => keys.some((k) => l.includes(k))).slice(-5).map((l) => l.replace(/\u001b\[\d+m/g, '')),
  }
}
console.log(JSON.stringify({
  vitest: pick('r64_vitest_full.log', ['Test Files', 'Tests ', 'VITEST_EXIT', 'FAIL']),
  build: pick('r64_build.log', ['BUILD_EXIT', 'built in', 'precache']),
}, null, 1))