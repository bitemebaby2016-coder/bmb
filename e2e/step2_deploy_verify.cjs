'use strict'
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const PROJ = 'D:/A PROJECT/Bite Me Baby'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const REF = 'ivkdfognyiwjcmrhcnwz'
const OUT = path.join(PROJ, 'e2e', 'step2-deploy-evidence.json')

const files = {
  'create-checkout': 'supabase/functions/create-checkout/index.ts',
  'stripe-webhook': 'supabase/functions/stripe-webhook/index.ts',
  'stripe-refund': 'supabase/functions/stripe-refund/index.ts',
}

async function main() {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, { headers: { Authorization: 'Bearer ' + TOKEN } })
  const all = await r.json()
  const result = { step: 'STEP2 EF DEPLOY VERIFY', timestamp: new Date().toISOString(), project: REF, funcs: {} }
  for (const [name, rel] of Object.entries(files)) {
    const src = fs.readFileSync(path.join(PROJ, rel), 'utf8')
    const localSha = crypto.createHash('sha256').update(src).digest('hex')
    const lfNormalized = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const localLfSha = crypto.createHash('sha256').update(lfNormalized).digest('hex')
    const dep = (all.find((f) => f.slug === name) || {})
    result.funcs[name] = {
      version: dep.version,
      verify_jwt: dep.verify_jwt,
      entrypoint_path: (dep.entrypoint_path || '').includes(name),
      local_sha256: localSha,
      local_lf_sha256: localLfSha,
      deployed_ezbr: dep.ezbr_sha256 || '',
      hash_match_raw: localSha === (dep.ezbr_sha256 || ''),
      hash_match_lf: localLfSha === (dep.ezbr_sha256 || ''),
      deployed: !!dep.version,
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8')
  for (const [k, v] of Object.entries(result.funcs)) {
    console.log(`FUNC ${k} version=${v.version} verify_jwt=${v.verify_jwt} deployed=${v.deployed} hash_raw=${v.hash_match_raw} hash_lf=${v.hash_match_lf}`)
  }
  console.log('EVIDENCE -> ' + OUT)
}
main().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1) })