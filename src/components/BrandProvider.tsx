

// ============================================
// Bite Me Baby — Brand Provider (TEN-05: Customer/Public Routing Foundation)
// ✅ Wires brandResolver → brandContextStore → CSS/theme/dynamic metadata
// ✅ Feature flag controlled via FEATURE_BRAND_ROUTING (RD-07)
// 
// Usage: <BrandProvider><App /></BrandProvider>
// 
// On mount:
//   1. Extract ?brand=<slug> from URL
//   2. Call resolveBrand(urlParams={brandSlug})
//   3. Set resolved brand in brandContextStore
//   4. Set active_context in cartStore (clears incompatible cart)
//   5. Apply theme_tokens to CSS custom properties
//   6. Update document.title, OG tags, favicon
// ============================================

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { resolveBrand } from '@/lib/brandResolver'
import { getRuntimeAssetUrl } from '@/lib/bmbAdminApi_media'
import { useBrandContextStore } from '@/store/resolvedBrandStore'
import { useCartStore } from '@/store/cartStore'

// Feature flag — set to true only when Owner authorizes rollout
const FEATURE_BRAND_ROUTING = import.meta.env.VITE_FEATURE_BRAND_ROUTING === 'true'

/** Derive CSS variable declarations from brand theme_tokens Record<string, any> */
function applyThemeToRoot(tokens: Record<string, any>): void {
  if (!tokens || typeof tokens !== 'object') return
  
  const obj = tokens as Record<string, string>
  const root = document.documentElement
  const vars: Record<string, string> = {
    '--bmb-primary': obj.primary_color || '#FF5E1E',
    '--bmb-secondary': obj.secondary_color || '#FBBF24',
    '--bmb-accent': obj.accent_color || '#92400E',
    '--bmb-bg-base': obj.bg_base || '#FFF7ED',
    '--bmb-surface': obj.surface_color || '#FFFFFF',
    '--bmb-text': obj.text_base || '#1C1917',
    '--bmb-font-display': obj.font_display || 'Nunito',
    '--bmb-font-body': obj.font_body || 'Quicksand',
  }
  
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

/** Apply dynamic page metadata from resolved brand */
function applyDynamicMetadata(brand: { display_name: string; tagline: string }): void {
  // Title — derive from brand instead of hardcoded BMB
  if (brand.display_name) {
    document.title = brand.display_name
  }
  
  // OG title
  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
  if (ogTitle) ogTitle.content = brand.display_name
  
  // Site name
  const ogSite = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')
  if (ogSite) ogSite.content = brand.display_name
  
  // Description
  const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (desc && brand.tagline) desc.content = brand.tagline
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams()
  const { setResolved } = useBrandContextStore()
  const { setContextAndClearIfIncompatible } = useCartStore()
  
  useEffect(() => {
    if (!FEATURE_BRAND_ROUTING) return // OFF → no resolution, existing behavior preserved
    
    async function boot() {
      try {
        const brandSlug = searchParams.get('brand')?.trim() || undefined
        const result = await resolveBrand({ urlParams: brandSlug ? { brandSlug } : undefined })
        
        if (!result.brand) {
          console.warn('[BrandProvider] Fallback used — no active brand found.')
          // Even fallback is a valid brand for single-tenant BMB
        }
        
        // Set resolved brand in context store
        setResolved(result)
        
        // Set active context AND clear incompatible cart (RD-03)
        if (result.tenant_id && result.brand_id) {
          setContextAndClearIfIncompatible(result.tenant_id, result.brand_id)
        }
        
        // Apply brand presentation
        if (result.brand) {
          applyThemeToRoot(result.brand.theme_tokens)
          applyDynamicMetadata(result.brand)
          
          // G2-RV first runtime consumer (Owner Decision D3): brand logo/icon comes
          // from the canonical asset registry via getRuntimeAssetUrl(). Selection
          // policy: active approved > active mock > null. Missing/inactive asset →
          // deterministic fallback to brands.logo_url_icon (never hardcoded assets).
          let logoHref = result.brand.logo_url_icon
          try {
            const runtimeLogo = await getRuntimeAssetUrl(`brand.logo.${result.brand.id}`)
            if (runtimeLogo) logoHref = runtimeLogo
          } catch {
            // registry unavailable → keep brands.logo_url_icon fallback
          }
          
          // Dynamic favicon/logo injection
          if (logoHref) {
            let linkEl = document.querySelector<HTMLLinkElement>('link[rel*="icon"]')
            if (!linkEl) {
              linkEl = document.createElement('link')
              linkEl.rel = 'icon'
              document.head.appendChild(linkEl)
            }
            linkEl.href = logoHref
          }
        }
      } catch (err) {
        console.error('[BrandProvider] Resolution failed:', err)
        // Graceful degradation: no brand context → cart may be unusable but app stays alive
      }
    }
    
    void boot()
  }, [searchParams, setResolved, setContextAndClearIfIncompatible])
  
  return <>{children}</>
}
