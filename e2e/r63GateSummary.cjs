'use strict'
// extract gate summaries from r63 final logs
const fs = require('fs')
const path = require('path')
const pick = (f, keys) => {
  const p = path.join(process.cwd(), 'e2e', f)
  if (!fs.existsSync(p)) return { file: f, missing: true }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  const hits = lines.filter((l) => keys.some((k) => l.includes(k)))
  return { file: f, tail: lines.filter(Boolean).slice(-4), hits: hits.slice(-8) }
}
console.log(JSON.stringify({
  vitest: pick('r63_vitest_full.log', ['Test Files', 'Tests ', 'VITEST_EXIT']),
  build: pick('r63_build.log', ['BUILD_EXIT', 'built in', 'precache', '✓ built']),
}, null, 1))