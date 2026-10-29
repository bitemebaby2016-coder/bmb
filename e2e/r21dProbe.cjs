// R21d backlog probe — หา anchor (load/catch/empty-state) ของ 12 หน้าค้าง LoadErrorBanner
// Usage: node e2e/r21dProbe.cjs
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const files = [
  'src/pages/admin/DeliveryManagement.tsx',
  'src/pages/admin/AdminRounds.tsx',
  'src/pages/admin/InventoryPage.tsx',
  'src/pages/admin/AuditLogPage.tsx',
  'src/pages/admin/AdminPaymentExceptions.tsx',
  'src/pages/admin/AdminRecipes.tsx',
  'src/pages/admin/AdminBrands.tsx',
  'src/pages/admin/AdminAssetAudit.tsx',
  'src/pages/admin/AdminPortfolio.tsx',
  'src/pages/admin/AdminTenants.tsx',
  'src/pages/VotePage.tsx',
  'src/pages/ReviewPage.tsx',
]
const RE = /(catch\s*\(|setLoading\(true\)|setLoading\(false\)|const \[loading|loadError|LoadErrorBanner|loading\s*&&|!loading|\.length\s*===\s*0|ยังไม่มี|ไม่พบ|ยังว่าง|empty)/
for (const f of files) {
  const abs = path.join(ROOT, f)
  if (!fs.existsSync(abs)) { console.log('MISSING ' + f); continue }
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/)
  console.log('=== ' + f + ' (' + lines.length + ' lines)')
  lines.forEach((l, i) => { if (RE.test(l)) console.log('  ' + (i + 1) + ': ' + l.trim().slice(0, 160)) })
}
