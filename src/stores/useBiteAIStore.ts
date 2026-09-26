// ============================================
// Bite Me Baby — Bite AI Store (4-Stage Mascot Service)
// ============================================
// Stage manager:
//   ambient           — idle floating mascot + looping CSS bubble
//   personalization   — upsell pushed when cart is below the free-shipping margin
//   microhook         — scroll-stall engagement on the pre-order grid
//   fullchat          — mascot grows into a full-screen contextual chat
// Frontend/AI prompt layer may ONLY emit `EXECUTE_ADD_TO_CART`; stock balancing
// and financial layers are off-limits to the chat bot (security boundary).

import { create } from 'zustand'

export type BiteStage = 'ambient' | 'personalization' | 'microhook' | 'fullchat'

export type BiteAction = 'EXECUTE_ADD_TO_CART' | 'NONE'

export interface UpsellInfo {
  remaining: number
  message: string
}

interface BiteAIStore {
  stage: BiteStage
  greetingPlayed: boolean
  /** Looping ambient bubble text (CSS animate-bounce). */
  bubble: string | null
  upsell: UpsellInfo | null
  chatOpen: boolean
  fullContext: string

  /** Fire on the user's first click/interaction (enables Web Audio greeting). */
  firstInteraction: () => void
  /** Stage 2 — compute an upsell prompt when cartTotal > 0 AND cartTotal < freeShippingThreshold. */
  evaluateUpsell: (cartTotal: number, freeShippingThreshold: number) => void
  /** Stage 3 — micro-hook fired when the user stalls on the pre-order grid. */
  triggerMicroHook: (quotaLabel: string) => void
  /** Stage 4 — open full-screen chat with a piped UI-context prompt. */
  openChat: (context: string) => void
  closeChat: () => void
  setBubble: (bubble: string | null) => void
  /** The ONLY transactional hook the AI layer may emit. */
  emitAction: () => BiteAction
}

export const useBiteAIStore = create<BiteAIStore>((set) => ({
  stage: 'ambient',
  greetingPlayed: false,
  bubble: 'สวัสดีค่ะ น้อง Bite อยู่นี่แล้ว 🍊 มีอะไรให้ช่วยไหมคะ',
  upsell: null,
  chatOpen: false,
  fullContext: '',

  firstInteraction: () =>
    set((state) => (state.greetingPlayed ? state : { greetingPlayed: true })),

  evaluateUpsell: (cartTotal, freeShippingThreshold) => {
    // Only show upsell when customer has items in cart
    if (cartTotal > 0) {
      if (cartTotal < freeShippingThreshold) {
        const remaining = freeShippingThreshold - cartTotal
        set({
          stage: 'personalization',
          upsell: {
            remaining,
            message: `รับขนมหวานเพิ่มอีก ${remaining} บาท เพื่อรับสิทธิ์ส่งฟรีทันทีไหมคะ? 🍊`,
          },
          bubble: `รับขนมหวานเพิ่มอีก ${remaining} บาท เพื่อรับสิทธิ์ส่งฟรีทันทีไหมคะ? 🍊`,
        })
      } else {
        // Cart meets or exceeds free shipping threshold
        set({
          stage: 'personalization',
          upsell: { remaining: 0, message: 'ได้สิทธิ์ส่งฟรีแล้วค่ะ! 🎉' },
          bubble: 'ได้สิทธิ์ส่งฟรีแล้วค่ะ! 🎉',
        })
      }
    } else {
      // Cart is empty - no upsell
      set({
        stage: 'personalization',
        upsell: null,
        bubble: null,
      })
    }
  },

  triggerMicroHook: (quotaLabel) =>
    set({
      stage: 'microhook',
      bubble: `ออเดอร์รอบนี้ quota เหลือไม่เยอะแล้วนะคะ (${quotaLabel}) รีบกดจองด่วนเลย 🕒`,
    }),

  openChat: (context) =>
    set({
      stage: 'fullchat',
      chatOpen: true,
      fullContext: context,
      bubble: null,
    }),

  closeChat: () =>
    set({ chatOpen: false, stage: 'ambient', bubble: 'กลับมาหา Bite ได้เสมอค่ะ 😊' }),

  setBubble: (bubble) => set({ bubble }),

  emitAction: () => 'EXECUTE_ADD_TO_CART',
}))
