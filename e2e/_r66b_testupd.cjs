// R66-B: extend TYPED_FORM_KEYS expectations (+store_master_open) — line-assert → overwrite whole file
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

function patch(rel, edits) {
  const p = path.join(ROOT, rel)
  const raw = fs.readFileSync(p, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const L = raw.split(/\r?\n/)
  for (const e of edits) {
    const line = L[e.n - 1]
    if (!line || !line.includes(e.mustContain)) {
      console.error(`ASSERT_FAIL ${rel} line ${e.n}: expected "${e.mustContain}" got ${JSON.stringify(line)}`)
      process.exit(1)
    }
    L[e.n - 1] = e.next
  }
  fs.writeFileSync(p, L.join(eol))
  console.log('OK ' + rel + ' lines=' + L.length)
}

const KEYLINE_TOCOUNTAIN = "const TYPED_FORM_KEYS = new Set<string>([SOCIAL_LINKS_SETTING_KEY, SEO_SETTINGS_KEY, STORE_STATUS_COPY_KEY, 'order_policy'])"
const KEYLINE_NEW = "const TYPED_FORM_KEYS = new Set<string>([SOCIAL_LINKS_SETTING_KEY, SEO_SETTINGS_KEY, STORE_STATUS_COPY_KEY, 'order_policy', 'store_master_open'])"

patch('src/__tests__/adminSettingsTypedKeys.test.ts', [
  { n: 10, mustContain: '+ order_policy และ filter', next: "  it('มี TYPED_FORM_KEYS = social_links + seo + store_status_copy + order_policy + store_master_open และ filter ทั้งตอน render/save/save-all', () => {" },
  { n: 11, mustContain: KEYLINE_TOCOUNTAIN, next: '    expect(adminSettingsSrc).toContain("' + KEYLINE_NEW + '")' },
])

patch('src/__tests__/r12SeoAdminCopy.test.ts', [
  { n: 46, mustContain: KEYLINE_TOCOUNTAIN, next: '    expect(adminSettingsSrc).toContain("' + KEYLINE_NEW + '")' },
])

patch('src/__tests__/socialAiContinuity.test.ts', [
  { n: 142, mustContain: '+ order_policy เหลือทางบันทึกเดียว', next: "  it('D-02/R2.1: ห้าม key ซ้ำสองที่ — social_links + seo + store_status_copy + order_policy + store_master_open เหลือทางบันทึกเดียว (ฟอร์มเฉพาะทาง)', () => {" },
  { n: 151, mustContain: "TYPED_FORM_KEYS = new Set<string>", next: String.raw`    expect(adminSettingsSrc).toMatch(/TYPED_FORM_KEYS = new Set<string>\(\[SOCIAL_LINKS_SETTING_KEY, SEO_SETTINGS_KEY, STORE_STATUS_COPY_KEY, 'order_policy', 'store_master_open'\]\)/)` },
])

console.log('ALL_OK')