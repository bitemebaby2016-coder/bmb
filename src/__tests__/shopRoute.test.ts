// ============================================
// P0 REGRESSION — /shop route contract
// ============================================
// Production reported: react-vendor `No routes matched location "/shop"`.
// ROOT CAUSE: App renders TWO <Routes> blocks; the SEO block had no /shop, so
// React Router warned (console) even though the page block rendered HomePage.
// This test locks BOTH halves of the contract:
//   1) source: /shop registered in the SEO block AND the page block,
//      page block maps /shop -> HomePage (FoodTheater), / -> TalkToBiteHomePage
//   2) runtime: rendering <App/> at /shop in jsdom mounts the FoodTheater stage
//      and emits ZERO "No routes matched location" messages.
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Read App.tsx source through Vite's ?raw pipeline (no node builtins needed —
// the app tsconfig is browser-typed and must stay that way).
const appSources = import.meta.glob('../App.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function readAppSource(): string {
  const source = Object.values(appSources)[0]
  if (!source) throw new Error('App.tsx source not available via import.meta.glob')
  return source
}

function seoBlock(source: string): string {
  const end = source.indexOf('</Routes>')
  return source.slice(0, end >= 0 ? end : source.length)
}

function pageBlock(source: string): string {
  const first = source.indexOf('</Routes>')
  const rest = source.slice(first + '</Routes>'.length)
  const end = rest.indexOf('</Routes>')
  return rest.slice(0, end >= 0 ? end : rest.length)
}

describe('/shop route contract — source (regression for the production warning)', () => {
  it('registers /shop in the SEO <Routes> block (getShopMeta)', () => {
    const seo = seoBlock(readAppSource())
    expect(seo).toContain('path="/shop"')
    expect(seo).toContain('getShopMeta()')
  })

  it('registers /shop in the page <Routes> block mapped to HomePage', () => {
    const page = pageBlock(readAppSource())
    expect(page).toContain('path="/shop"')
    expect(page).toMatch(/path="\/shop"[\s\S]{0,240}HomePage/)
  })

  it('preserves the intended contract: / -> TalkToBiteHomePage, no duplicate /shop', () => {
    const source = readAppSource()
    const page = pageBlock(source)
    expect(page).toMatch(/path="\/"[\s\S]{0,240}TalkToBiteHomePage/)
    const pageShopRoutes = page.match(/path="\/shop"/g) || []
    expect(pageShopRoutes.length).toBe(1)
    const seoShopRoutes = seoBlock(source).match(/path="\/shop"/g) || []
    expect(seoShopRoutes.length).toBe(1)
  })
})

describe('/shop runtime render (jsdom)', () => {
  beforeAll(() => {
    const g = globalThis as Record<string, any>
    g.IS_REACT_ACT_ENVIRONMENT = true
    g.ResizeObserver =
      g.ResizeObserver ||
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    g.IntersectionObserver =
      g.IntersectionObserver ||
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return [] }
      }
    if (typeof window !== 'undefined' && !window.matchMedia) {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia
    }
    // No network in unit tests — answer every request with a PostgREST-style
    // 500 so supabase-js resolves with an error result (its normal contract)
    // and HomePage's loadData reaches its finally block (loading=false).
    g.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'network disabled in unit test' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
  })

  afterAll(() => {
    document.body.innerHTML = ''
  })

  it('mounts FoodTheater at /shop and logs no "No routes matched location"', async () => {
    const messages: string[] = []
    const origError = console.error
    const origWarn = console.warn
    console.error = (...args: unknown[]) => {
      messages.push(args.map(String).join(' '))
      origError(...args)
    }
    console.warn = (...args: unknown[]) => {
      messages.push(args.map(String).join(' '))
      origWarn(...args)
    }
    try {
      const React = await import('react')
      const { default: App } = await import('@/App')
      const { MemoryRouter } = await import('react-router-dom')
      const { createRoot } = await import('react-dom/client')
      const act = React.act

      const host = document.createElement('div')
      document.body.appendChild(host)
      const root = createRoot(host)

      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/shop'] },
            React.createElement(App),
          ),
        )
      })

      // Flush Suspense/lazy chunks (FoodTheater) + effects with a bounded poll.
      let stage: Element | null = null
      for (let i = 0; i < 40 && !stage; i++) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 100))
        })
        stage = host.querySelector('[data-testid="food-theater"], .theater-stage')
      }

      const html = host.innerHTML
      expect(
        stage,
        `stage missing. len=${html.length} spinner=${html.includes('กำลัง')} ` +
          `theater=${html.includes('theater')} organic=${html.includes('bg-organic')} ` +
          `layout=${html.includes('main-scroll')} tail=${html.slice(-400)} | ` +
          `msgs=${JSON.stringify(messages.slice(0, 10)).slice(0, 700)}`,
      ).not.toBeNull()
      expect(messages.filter((m) => m.includes('No routes matched location'))).toEqual([])

      await act(async () => {
        root.unmount()
      })
      host.remove()
    } finally {
      console.error = origError
      console.warn = origWarn
    }
  }, 20000)
})
