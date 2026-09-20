// ============================================
// Bite Me Baby — Reactive Order State Machine Store
// ============================================
// Thin Zustand wrapper around the pure `lib/orderStateMachine` so views can
// subscribe to live status and animate the Customer Timeline.
// Transitions are locked by the pure allow-list — no free typing.

import { create } from 'zustand'
import type { OrderMode } from '@/config/platformConfig'
import {
  canTransition,
  initialStatus,
  SAME_DAY_CHAIN,
  PRE_ORDER_CHAIN,
  type OrderFlowStatus,
} from '@/lib/orderStateMachine'

interface OrderStateMachineStore {
  orderId: string | null
  mode: OrderMode
  status: OrderFlowStatus
  history: OrderFlowStatus[]

  init: (mode: OrderMode, orderId?: string | null) => void
  /** Returns true if the transition was accepted (forward-only allow-list). */
  transition: (target: OrderFlowStatus) => boolean
  /** Convenience: step forward to the next status in the current chain. */
  advance: () => boolean
  reset: () => void
}

function nextStatus(mode: OrderMode, current: OrderFlowStatus): OrderFlowStatus | null {
  const chain = mode === 'SAME_DAY' ? SAME_DAY_CHAIN : PRE_ORDER_CHAIN
  const idx = (chain as readonly string[]).indexOf(current)
  if (idx === -1 || idx >= chain.length - 1) {
    return current === 'Delivered' ? 'Delivered' : null
  }
  return chain[idx + 1] as OrderFlowStatus
}


export const useOrderStateMachine = create<OrderStateMachineStore>((set, get) => ({
  orderId: null,
  mode: 'SAME_DAY',
  status: 'Created',
  history: ['Created'],

  init: (mode, orderId = null) =>
    set({
      mode,
      orderId,
      status: initialStatus(mode),
      history: [initialStatus(mode)],
    }),

  transition: (target) => {
    const { mode, status } = get()
    const res = canTransition(mode, status, target)
    if (!res.ok || !res.next) return false
    set((state) => ({
      status: res.next as OrderFlowStatus,
      history: [...state.history, res.next as OrderFlowStatus],
    }))
    return true
  },

  advance: () => {
    const nxt = nextStatus(get().mode, get().status)
    if (!nxt) return false
    return get().transition(nxt)
  },

  reset: () => set((state) => ({
    mode: state.mode,
    status: initialStatus(state.mode),
    history: [initialStatus(state.mode)],
  })),
}))
