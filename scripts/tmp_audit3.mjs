import { readFileSync, writeFileSync } from 'node:fs'
const R = 'D:/A PROJECT/Bite Me Baby/'
const out = []
// 1) is_verified column definition on reviews
const m001 = readFileSync(R + 'supabase/migrations/001_initial_schema.sql', 'utf8')
const ri = m001.indexOf('CREATE TABLE IF NOT EXISTS reviews')
const rblk = ri >= 0 ? m001.slice(ri, ri + 800) : '(reviews CREATE TABLE not found in 001)'
out.push('--- reviews schema (001) ---')
out.push(rblk)
// 2) encoding of migration files 096-098
const u8 = new TextDecoder('utf-8', { fatal: true })
for (const f of ['096_repair_thai_text_encoding.sql', '097_public_read_grants.sql', '098_reviews_public_read.sql']) {
  const b = readFileSync(R + 'supabase/migrations/' + f)
  const bom = b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF
  let valid = true
  try { u8.decode(b) } catch { valid = false }
  const t = Buffer.from(b).toString('utf8')
  const bareIf = /^\s*IF\b/m.test(t.replace(/^--.*$/gm, '')) && !/DO\s*\$\$/m.test(t)
  out.push(`${f}: bom=${bom} utf8=${valid} bareTopLevelIF=${bareIf}`)
}
// 3) confirm 098 DO-block structure matches proven M093 pattern
const m98 = readFileSync(R + 'supabase/migrations/098_reviews_public_read.sql', 'utf8')
out.push('098: DO-blocks=' + (m98.match(/DO \$\$/g) || []).length + ' bareIF-lines=' + (m98.split('\n').filter(l => /^\s*IF /.test(l) && !/DO/.test(l)).length))
writeFileSync('D:/A PROJECT/audit8.txt', out.join('\n'))
console.log('done')