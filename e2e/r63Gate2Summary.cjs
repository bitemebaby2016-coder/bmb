'use strict'
// extract gate2 summaries
const fs = require('fs')
const path = require('path')
const pick = (f, keys) => {
  const p = path.join(process.cwd(), 'e2e', f)
  if (!fs.existsSync(p)) return { file: f, missing: true }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  return {
    file: f,
    tail: lines.filter(Boolean).slice(-6).map((l) => l.replace(/\u001b\[\d+m/g, '')),
    hits: lines.filter((l) => keys.some((k) => l.includes(k))).slice(-6).map((l) => l.replace(/\u001b\[\d+m/g, '')),
  }
}
console.log(JSON.stringify({
  lint2: pick('r63_lint_final2.log', ['brandNameGuard', 'languageSanity', 'LINT_EXIT']),
  vitest2: pick('r63_vitest_full2.log', ['Test Files', 'Tests ', 'VITEST_EXIT']),
}, null, 1))