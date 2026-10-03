// G7-S4-D — production auth negative tests (NO real credentials printed)
const URL = 'https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/social-post-worker'
const PUBLISHABLE = 'sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH'
const BODY = JSON.stringify({ task: 'social_post_draft', brief: 'g7-s4 negative probe' })
async function call(name, headers) {
  const r = await fetch(URL, { method: 'POST', headers, body: BODY, signal: AbortSignal.timeout(30000) })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t.slice(0, 120) }
  console.log(name + ' STATUS=' + r.status + ' ERR=' + ((j && j.error) || (j && j.message) || (typeof j === 'string' ? j : '')))
}
;(async () => {
  await call('D1_publishable_no_automation_token', { apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE })
  await call('D2_invalid_automation_token        ', { apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE, 'x-automation-token': 'g7s4-invalid-negative-probe-token' })
  await call('D3_blank_automation_token           ', { apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE, 'x-automation-token': '   ' })
  await call('D4a_anon_bearer_no_apikey           ', { Authorization: 'Bearer anonymous-client-probe' })
  await call('D4b_basic_auth                      ', { Authorization: 'Basic YW5vbjpwcm92ZQ==' })
})().catch((e) => { console.error('FATAL ' + String(e).slice(0, 300)); process.exit(1) })
