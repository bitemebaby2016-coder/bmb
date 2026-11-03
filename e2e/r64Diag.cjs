'use strict'
// R64 diagnostics: Hallow image HEAD + socialOrderIntake matcher lines + drivers
const fs = require('fs')
const path = require('path')

;(async () => {
  // 1) banner image existence
  const url = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/storage/v1/object/public/bmb-images/uploads/1793702736595-Hallow.webp'
  try {
    const r = await fetch(url, { method: 'HEAD' })
    console.log('HALLOW_HEAD=' + r.status + ' len=' + (r.headers.get('content-length') || '?'))
  } catch (e) { console.log('HALLOW_ERR ' + e) }

  // 2) socialOrderIntake matcher region (70-239)
  const intake = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/_shared/socialOrderIntake.ts'), 'utf8').split(/\r?\n/)
  console.log('--- socialOrderIntake lines 70-200 ---')
  console.log(intake.slice(69, 200).map((l, i) => (i + 70) + ' ' + l).join('\n'))
})().catch((e) => { console.error(e); process.exit(1) })