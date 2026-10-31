// R41g — schedule bmb-tick (รอบแรกพลาด: dollar-quote ซ้อนใน SQL → parse error) + ตั้ง tick token ใหม่ให้ตรง
// ไม่ยิง HTTP worker (ยาว) — cron จะ firing เองทุก 5 นาที · ของจริงดู cron.job_run_details/queue/poll
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')
const AT = (/^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')) || [])[1]
const REF = 'ivkdfognyiwjcmrhcnwz'
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + AT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.text()
}
;(async () => {
  const token = crypto.randomBytes(18).toString('hex')
  try {
    execSync(`npx supabase secrets set BMB_TICK_TOKEN=${token} --project-ref ${REF}`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: AT }, encoding: 'utf8', cwd: ROOT, maxBuffer: 4 * 1024 * 1024,
    })
    console.log('SECRET_SET_OK')
  } catch (e) { console.log('SECRET_FAIL ' + String(e.stdout || e.message).slice(0, 300)); process.exit(1) }
  // format(%L) = ไม่มี $$ ซ้อน — parse ปลอดภัย
  const sql = [
    "DO $$ BEGIN PERFORM cron.unschedule('bmb-tick'); EXCEPTION WHEN OTHERS THEN NULL; END $$;",
    `DO $$ BEGIN PERFORM cron.schedule('bmb-tick', '*/5 * * * *', format('SELECT public.bmb_tick_http(%L)', '${token}')); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bmb-tick skip: %', SQLERRM; END $$;`,
  ].join('\n')
  console.log('SCHEDULE=' + await q(sql))
  console.log('CRON=' + await q("SELECT jobname, schedule, active FROM cron.job ORDER BY jobname"))
  // พิสูจน์ EF ตอบ (token ผิด = 401 ภายในไม่กี่วินาที — ไม่ยิง worker)
  const r = await fetch(`https://${REF}.supabase.co/functions/v1/cron-tick`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tick-token': 'wrong' },
    body: JSON.stringify({ job: 'marketing_publish' }),
    signal: AbortSignal.timeout(8000),
  })
  console.log('GATE_401_EXPECT=http ' + r.status + ' body=' + (await r.text()).slice(0, 120))
  fs.writeFileSync(path.join(__dirname, 'r41g_schedule_tick.json'), JSON.stringify({ at: new Date().toISOString(), schedule: '*/5 * * * *', gate: r.status }, null, 2))
  console.log('DONE')
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 400)))