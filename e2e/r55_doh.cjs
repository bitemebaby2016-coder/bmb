// e2e/r55_doh.cjs — resolve โดเมนร้านผ่าน DoH (DNS ท้องถิ่น resolve ไม่ได้)
const domain = process.argv[2] || 'bite-me-baby.com'
const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`
fetch(url)
  .then((r) => r.json())
  .then((j) => {
    console.log('Status:', j.Status, 'Answers:', JSON.stringify((j.Answer || []).map((a) => a.data)))
  })
  .catch((e) => console.log('ERR', e.message))
