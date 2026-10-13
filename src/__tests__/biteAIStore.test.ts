// ============================================
// Bite Me Baby — Bite AI 4-Stage Store tests
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import { useBiteAIStore } from '@/stores/useBiteAIStore'

beforeEach(() => {
  // Reset to a pristine stage for each test.
  useBiteAIStore.setState({
    stage: 'ambient',
    greetingPlayed: false,
    bubble: null,
    upsell: null,
    chatOpen: false,
    fullContext: '',
  })
})

describe('useBiteAIStore — 4-Stage Mascot Service', () => {
  it('starts in the ambient stage, not greeted', () => {
    const s = useBiteAIStore.getState()
    expect(s.stage).toBe('ambient')
    expect(s.greetingPlayed).toBe(false)
  })

  it('Stage 1: firstInteraction enables the greeting flag once', () => {
    useBiteAIStore.getState().firstInteraction()
    expect(useBiteAIStore.getState().greetingPlayed).toBe(true)
    useBiteAIStore.getState().firstInteraction()
    expect(useBiteAIStore.getState().greetingPlayed).toBe(true)
  })

  it('Stage 2: pushes an upsell prompt when below the free-shipping margin', () => {
    useBiteAIStore.getState().evaluateUpsell(250, 300)
    const s = useBiteAIStore.getState()
    expect(s.stage).toBe('personalization')
    expect(s.upsell?.remaining).toBe(50)
    expect(s.bubble).toContain('50')
  })

  it('Stage 2: congrats when the cart already meets the free-shipping margin', () => {
    useBiteAIStore.getState().evaluateUpsell(300, 300)
    const s = useBiteAIStore.getState()
    expect(s.upsell?.remaining).toBe(0)
    expect(s.bubble).toContain('ส่งฟรี')
  })

  it('Stage 3: triggerMicroHook switches stage and sets a quota warning bubble', () => {
    useBiteAIStore.getState().triggerMicroHook('เหลือ 2 กล่อง')
    const s = useBiteAIStore.getState()
    expect(s.stage).toBe('microhook')
    expect(s.bubble).toContain('เหลือ 2 กล่อง')
  })

  it('Stage 4: openChat enters full-screen mode and pipes the UI context', () => {
    const context = 'ลูกค้าชื่อคุณเอ มีข้าวคลุกพริกเกลือในตะกร้า 1 กล่อง'
    useBiteAIStore.getState().openChat(context)
    const s = useBiteAIStore.getState()
    expect(s.stage).toBe('fullchat')
    expect(s.chatOpen).toBe(true)
    expect(s.fullContext).toBe(context)
  })

  it('closeChat returns to ambient with a friendly bubble', () => {
    useBiteAIStore.getState().openChat('ctx')
    useBiteAIStore.getState().closeChat()
    const s = useBiteAIStore.getState()
    expect(s.chatOpen).toBe(false)
    expect(s.stage).toBe('ambient')
    expect(s.bubble).toContain('Bite')
  })

  it('Security boundary: the ONLY transactional hook is EXECUTE_ADD_TO_CART', () => {
    expect(useBiteAIStore.getState().emitAction()).toBe('EXECUTE_ADD_TO_CART')
  })
})
