// e2e/r35_or_diag2.cjs — Owner ยืนยันมี "Qwen Image 3" + "Seedream 5.0 Flash": หาทั่ว catalog + dump image ids
fetch('https://openrouter.ai/api/v1/models')
  .then((r) => r.json())
  .then((d) => {
    const a = Array.isArray(d.data) ? d.data : []
    console.log('total', a.length, 'total_count', d.total_count)
    // image output = modality มี image (field จริงอยู่ที่ architecture.modality)
    const img = a.filter((x) => /image/i.test(x.architecture?.modality || ''))
    console.log(`== image models (${img.length}) ==`)
    for (const m of img) console.log(`${m.id} | ${m.name}`)
    // เงื่อนไขหลวม: ชื่อ/id มี qwen+image, seed+image, seedream, 3, flash image
    const loose = a.filter((x) => /seedream|qwen.*image|image.*qwen|seed.*5|wan/i.test(`${x.id} ${x.name || ''}`))
    console.log('== loose hits ==')
    for (const m of loose) console.log(`${m.id} | ${m.name} | ${(m.architecture?.modality || '')}`)
    if (!loose.length) console.log('NONE')
  })
  .catch((e) => console.log('ERR', e.message))
