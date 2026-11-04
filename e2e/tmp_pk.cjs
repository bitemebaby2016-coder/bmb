'use strict'
// tmp_pk: find where business_settings is created / PK defined across migrations
const fs = require('fs')
const dir = 'supabase/migrations'
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.sql')) continue
  const t = fs.readFileSync(dir + '/' + f, 'utf8')
  if (/business_settings/i.test(t) && /(CREATE TABLE|PRIMARY KEY|ADD CONSTRAINT|UNIQUE)/i.test(t)) {
    t.split(/\r?\n/).forEach((l, i) => {
      if (/business_settings/i.test(l) && /(CREATE TABLE|PRIMARY KEY|CONSTRAINT|UNIQUE|ALTER TABLE)/i.test(l)) {
        console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 160))
      }
    })
  }
}
console.log('DONE')
