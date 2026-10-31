// Bite Me Baby — uiFlash · R39 (Owner 2026-10-31: "จิ้มปุ่มแล้วมันทำงานจุดอีลีเม้นไหนให้เด้งไปจุดนั้น")
// scroll นุ่มไปที่ element ที่ "เพิ่งถูกผล" หลัง load() แล้ว + กระพริบไฮไลต์รอบ ๆ ให้ตาเห็นทันที
// เทสต์ = data-testid ของจุดหมาย · retry สั้น ๆ กัน re-render ยังไม่ทัน (หน้า reload ข้อมูล async)
export function flashTo(testid: string, tries = 0): void {
  const el = document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null
  if (!el) {
    if (tries < 12) setTimeout(() => flashTo(testid, tries + 1), 120) // ~1.4s รอรายการโหลด/สวิตช์แท็บ
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('bmb-flash')
  void el.offsetWidth // reflow = restart animation ได้แม้กดซ้ำ
  el.classList.add('bmb-flash')
  setTimeout(() => el.classList.remove('bmb-flash'), 2400)
}