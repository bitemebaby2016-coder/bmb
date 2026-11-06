// R74 — vitest full wrapper (detached context: console หาย → spawnSync จับ output แล้วเขียนไฟล์เอง)
'use strict'
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const r = spawnSync(process.execPath, [require.resolve('vitest/vitest.mjs'), 'run'], {
  cwd: ROOT, encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 128 * 1024 * 1024,
})
const out = (r.stdout || '') + (r.stderr || '') + '\nVIT_FULL_EXIT=' + r.status + (r.error ? ' err=' + String(r.error).slice(0, 200) : '') + '\n'
fs.writeFileSync(path.join(__dirname, '_r74_vit_full.log'), out)
console.log('VIT_FULL_WRITTEN exit=' + r.status)