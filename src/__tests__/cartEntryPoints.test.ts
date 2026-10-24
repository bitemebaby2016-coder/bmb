// ============================================
// Bite Me Baby — P0 WS3/WS4/WS5: customer catalog freshness + cart entry points
// ============================================
// Contract: (1) every cart entry point handles the AddToCartResult it receives;
// (2) customer catalog pages refetch live data when the tab becomes visible
// again (multi-tab/session behavior), so Admin menu changes show up without a
// code deployment; (3) Checkout revalidates the cart against the live catalog
// before ordering.

import { describe, expect, it } from 'vitest'
import talkToBiteSrc from '../components/ai/TalkToBite.tsx?raw'
import menuPageSrc from '../pages/MenuPage.tsx?raw'
import homePageSrc from '../pages/HomePage.tsx?raw'
import checkoutSrc from '../pages/CheckoutPage.tsx?raw'

describe('TalkToBite.tsx — confirmDraft handles every AddToCartResult', () => {
  const block = talkToBiteSrc.slice(
    talkToBiteSrc.indexOf('function confirmDraft'),
    talkToBiteSrc.indexOf('function goLogin'),
  )

  it('captures the result per line and never reports success for failed lines', () => {
    expect(block).toContain('const res = useCartStore.getState().addItem(')
    expect(block).toContain("if (res === 'added') addedCount += 1")
    expect(block).toContain('failedNames.push(p.name)')
  })

  it('failure path reports honestly and returns before the success message', () => {
    const failAt = block.indexOf('if (failedNames.length > 0)')
    expect(failAt).toBeGreaterThan(-1)
    // the success assistant line must come AFTER the failure gate
    expect(block.indexOf('setBiteState(\'SUCCESS\')')).toBeGreaterThan(failAt)
  })
})

describe('customer catalog freshness (multi-tab/session behavior)', () => {
  it('MenuPage refetches the catalog when its tab becomes visible again', () => {
    expect(menuPageSrc).toContain("document.addEventListener('visibilitychange', onVisible)")
    expect(menuPageSrc).toContain("document.removeEventListener('visibilitychange', onVisible)")
    expect(menuPageSrc).toContain("document.visibilityState === 'visible'")
  })

  it('HomePage refetches the catalog when its tab becomes visible again', () => {
    expect(homePageSrc).toContain("document.addEventListener('visibilitychange', onVisible)")
    expect(homePageSrc).toContain("document.removeEventListener('visibilitychange', onVisible)")
    expect(homePageSrc).toContain("document.visibilityState === 'visible'")
  })
})

describe('CheckoutPage.tsx — cart revalidation before ordering', () => {
  it('rebuilds the cart against the live catalog and reports drops to the user', () => {
    expect(checkoutSrc).toContain('const report = revalidateWithCatalog(products)')
    expect(checkoutSrc).toContain('reportToToastMessage(report, \'checkout\')')
  })

  it('keeps double-submit protection: 124 submit-key ring + processing lock (R5c: split engine removed)', () => {
    expect(checkoutSrc).toContain('const submitKeysRef = useRef(new SubmitKeyRing())')
    expect(checkoutSrc).toContain('client_submit_key: submitKeysRef.current.keyFor(submitFp)')
    // R5c: M1 split engine is gone — one cart = one order
    expect(checkoutSrc).not.toContain('submitSplitOrders')
    expect(checkoutSrc).not.toContain('planSplitCheckout')
  })
})