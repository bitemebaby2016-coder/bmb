// ============================================
// Bite Me Baby — Talk to Bite (full page)
// The "/talk-to-bite" route renders the SAME TalkToBite UI as the Floating Bite
// and the Homepage — one experience, no separate chat engine. Public route:
// guests get the safe capabilities (chat + menu + recommend), while personal
// actions (order history / order-again) prompt auth inside the conversation.
// ============================================

import { TalkToBite } from '@/components/ai/TalkToBite'

export function TalkToBitePage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <TalkToBite fullPage />
    </div>
  )
}
