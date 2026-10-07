// ============================================
// Bite Me Baby — Talk to Bite (full screen)
// The "/talk-to-bite" route renders the SAME full-screen Talk to Bite experience
// (landing → conversation) as the Floating Bite and the Homepage — one experience,
// no separate chat engine. Public route: guests get the safe capabilities
// (chat + menu + recommend), while personal actions (order history / order-again)
// prompt auth inside the conversation.
// ============================================

import { TalkToBite } from '@/components/ai/TalkToBite'

export function TalkToBitePage() {
  return <TalkToBite />
}
