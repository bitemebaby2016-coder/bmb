// check line 236 state
const fs = require('fs')
const t = fs.readFileSync('supabase/functions/channel-webhook/index.ts', 'utf8')
const l = t.split('\n')[235]
console.log(JSON.stringify(l))
console.log('HAS_QUESTION_RUN=' + l.includes('??????????'))
const th = [...l].filter((c) => c.codePointAt(0) >= 0x0e00 && c.codePointAt(0) <= 0x0e7f).length
const lat = [...l].filter((c) => c.codePointAt(0) >= 0xc0 && c.codePointAt(0) <= 0xff).length
console.log('THAI_CHARS=' + th + ' LATIN1_CHARS=' + lat)