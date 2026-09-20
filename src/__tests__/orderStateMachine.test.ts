// ============================================
// Bite Me Baby — Three-Party Order State Machine tests
// ============================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  canTransition,
  transitionIsAllowed,
  initialStatus,
  SAME_DAY_CHAIN,
  PRE_ORDER_CHAIN,
  type OrderFlowStatus,
} from '@/lib/orderStateMachine'
import { useOrderStateMachine } from '@/stores/useOrderStateMachine'

describe('orderStateMachine — pure transition allow-list', () => {
  it('walks the full Same-Day chain forward', () => {
    // Forward adjacency
    expect(transitionIsAllowed('SAME_DAY', 'Created', 'Accepted')).toBe(true)
    expect(transitionIsAllowed('SAME_DAY', 'Accepted', 'Preparing')).toBe(true)
    expect(transitionIsAllowed('SAME_DAY', 'Preparing', 'Ready for Pickup')).toBe(true)
    expect(transitionIsAllowed('SAME_DAY', 'Ready for Pickup', 'Dispatched')).toBe(true)
    expect(transitionIsAllowed('SAME_DAY', 'Dispatched', 'Delivered')).toBe(true)

    // Chained via the pure function
    let cur: OrderFlowStatus = 'Created'
    for (const next of ['Accepted', 'Preparing', 'Ready for Pickup', 'Dispatched', 'Delivered'] as OrderFlowStatus[]) {
      expect(canTransition('SAME_DAY', cur, next).ok).toBe(true)
      cur = next
    }
  })

  it('walks the full Pre-Order chain forward', () => {
    let cur: OrderFlowStatus = 'Booked'
    for (const next of ['Allocated', 'Batch Production', 'Ready for Pickup', 'Dispatched', 'Delivered'] as OrderFlowStatus[]) {
      expect(canTransition('PRE_ORDER', cur, next).ok).toBe(true)
      cur = next
    }
  })

  it('denies skip-state jumps (Created → Delivered)', () => {
    expect(canTransition('SAME_DAY', 'Created', 'Delivered').ok).toBe(false)
  })

  it('denies backward transitions (Accepted → Created)', () => {
    expect(canTransition('SAME_DAY', 'Accepted', 'Created').ok).toBe(false)
  })

  it('denies passing a Same-Day state into the Pre-Order chain', () => {
    expect(canTransition('PRE_ORDER', 'Booked', 'Accepted').ok).toBe(false)
  })

  it('blocks transition from a terminal state', () => {
    expect(canTransition('SAME_DAY', 'Delivered', 'Accepted').ok).toBe(false)
    expect(canTransition('SAME_DAY', 'Cancelled', 'Preparing').ok).toBe(false)
  })

  it('allows admin cancel from a live state and failure only from Dispatched', () => {
    expect(canTransition('SAME_DAY', 'Preparing', 'Cancelled').ok).toBe(true)
    expect(canTransition('SAME_DAY', 'Dispatched', 'Failed').ok).toBe(true)
    expect(canTransition('SAME_DAY', 'Preparing', 'Failed').ok).toBe(false)
  })

  it('returns the correct initial status per mode', () => {
    expect(initialStatus('SAME_DAY')).toBe('Created')
    expect(initialStatus('PRE_ORDER')).toBe('Booked')
  })
})

describe('useOrderStateMachine — reactive store', () => {
  beforeEach(() => {
    useOrderStateMachine.getState().init('SAME_DAY')
  })

  it('advances through the chain and records history', () => {
    const store = useOrderStateMachine.getState()
    expect(store.status).toBe('Created')
    expect(store.advance()).toBe(true)
    expect(useOrderStateMachine.getState().status).toBe('Accepted')
    expect(useOrderStateMachine.getState().history).toEqual(['Created', 'Accepted'])
  })

  it('rejects an illegal jump', () => {
    expect(useOrderStateMachine.getState().transition('Delivered')).toBe(false)
    expect(useOrderStateMachine.getState().status).toBe('Created')
  })
})
