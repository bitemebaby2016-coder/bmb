// ============================================
// Bite Me Baby — shared short notification beep (WebAudio, no asset files)
// ============================================
// R10: เดิมอยู่ใน NotificationDropdown — R70 ย้ายมาที่นี่เพื่อใช้ร่วมกับ
// OrderChatPanel (แจ้งเตือนข้อความใหม่) โดยไม่ duplicate logic

/** เสียงแจ้งเตือนสั้น 2 โน้ต (WebAudio — ไม่ต้องโหลดไฟล์) · เงียบไว้ถ้า audio ไม่พร้อม */
export function playNotifBeep(): void {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.07
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12)
    osc.stop(ctx.currentTime + 0.28)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio ไม่พร้อม (เบราว์เซอร์/policy) — เงียบไว้ */
  }
}
