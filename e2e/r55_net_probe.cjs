// e2e/r55_net_probe.cjs — เช็ค connectivity ก่อนถ่าย production (DNS ในเครื่อง resolve ไม่ได้?)
const targets = ['https://api.github.com/ratelimit', 'https://biteme-baby.com/', 'https://openrouter.ai/api/v1/models']
Promise.all(
  targets.map((u) =>
    fetch(u, { redirect: 'manual' })
      .then((r) => `${u} -> ${r.status}`)
      .catch((e) => `${u} -> ERR ${e.message}`)
  )
).then((a) => console.log(a.join('\n')))
