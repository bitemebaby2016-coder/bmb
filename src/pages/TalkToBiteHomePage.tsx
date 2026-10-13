// ============================================
// Bite Me Baby — Talk to Bite Home (the app Home "/")
// Full-screen "Talk to Bite Home" Landing — one unified AI-waiter experience
// (Landing → Conversation). No store panels below: entering the store is via
// "เข้าสู่ร้าน" (→ /shop) or the quick actions. Leaving the conversation returns
// to this landing; the Floating Bite + BottomNav reappear on the store pages.
// ============================================

import { TalkToBite } from '@/components/ai/TalkToBite'

export function TalkToBiteHomePage() {
  return (
    <>
      <h1 className="sr-only">Bite Me Baby — Talk to Bite ผู้ช่วยเสิร์ฟ AI · สั่งอาหารเมืองจันทบุรี</h1>
      <TalkToBite mode="home" landingClose={false} />
    </>
  )
}