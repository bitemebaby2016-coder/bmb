// ============================================
// Bite Me Baby — Product Cache (R96 Phase 3)
// ============================================
// Session-based product cache with explicit invalidation
// Used for real-time product data freshness in AI responses
// ============================================

import type { Product } from '@/types'

// Simple session-based cache with explicit invalidate
let cachedProducts: Product[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 7 * 60 * 1000 // 7 minutes (same as dbContext in aiService)

/**
 * Get products from cache or fetch fresh from API
 * Called by chatWithAI and other AI entry points for real-time data
 */
export async function getCachedProducts(): Promise<Product[]> {
  const now = Date.now()
  if (cachedProducts && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProducts
  }
  const { getProducts } = await import('@/lib/bmbAdminApi_products')
  cachedProducts = await getProducts()
  cacheTimestamp = now
  return cachedProducts
}

/**
 * Invalidate the product cache — call after product/promotion updates
 * Used in admin pages after save/delete operations
 */
export function invalidateProductCache(): void {
  cachedProducts = null
  cacheTimestamp = 0
}

/**
 * Check if cache is fresh
 */
export function isProductCacheFresh(): boolean {
  return cachedProducts !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS
}

/**
 * Get cache timestamp for debugging
 */
export function getProductCacheTimestamp(): number {
  return cacheTimestamp
}