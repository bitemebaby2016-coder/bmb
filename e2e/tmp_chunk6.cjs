'use strict'
// tmp_chunk6 — verify SINGLE react copy after resolve.dedupe fix
const fs = require('fs')
const path = require('path')
const dir = 'dist/assets'
const file = fs.readdirSync(dir).find((f) => f.startsWith('react-vendor-') && f.endsWith('.js'))
if (!file) { console.error('FAIL: react-vendor chunk missing'); process.exit(1) }
const t = fs.readFileSync(path.join(dir, file), 'utf8')
function count(pat) { return t.split(pat).length - 1 }
const internals = count('H:null')
const hookDefs = count('.useCallback=function')
const clientInt = count('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE')
console.log('chunk=' + file)
console.log('H:null (react internals literals) =' + internals + '  [expect 1]')
console.log('.useCallback=function (hook def sites) =' + hookDefs + '  [expect 1]')
console.log('CLIENT_INTERNALS markers =' + clientInt)
if (internals === 1 && hookDefs === 1) console.log('RESULT=SINGLE_REACT_OK')
else console.log('RESULT=STILL_DUPLICATED')
console.log('DONE')
