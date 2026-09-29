'use strict'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = 'ivkdfognyiwjcmrhcnwz'

async function endpoint(path, label) {
  try {
    const r = await fetch('https://api.supabase.com' + path, {
      headers: { Authorization: 'Bearer ' + TOKEN }
    })
    const text = await r.text()
    console.log(label + ': HTTP ' + r.status + (r.ok ? ' OK' : ' FAIL') + ' → ' + text.slice(0, 200))
  } catch (e) {
    console.log(label + ': ERROR ' + e.message)
  }
}

async function main() {
  // Basic project info
  await endpoint('/api/v1/projects/' + REF, 'Project info')
  
  // Database query
  await endpoint('/api/v1/projects/' + REF + '/database/query', 'SQL query')
  
  // Migrations list
  await endpoint('/api/v1/projects/' + REF + '/database/migrations', 'Migrations list')
  
  // Migration history
  await endpoint('/api/v1/projects/' + REF + '/database/history', 'Migration history')
  
  // Auth admin users
  await endpoint('/api/v1/projects/' + REF + '/auth/admin/users', 'Auth admin')
  
  // Project roles (check if we have db_admin role)
  await endpoint('/api/v1/projects/' + REF + '/roles', 'Roles')
}

main().catch(e => console.error('FATAL:', e.message))
