// ============================================
// Bite Me Baby — Review System (localStorage-based)
// ============================================

import { storageGet, storageSet, generateId } from './bmbStorage'

export interface Review {
  id: string
  product_id: string
  customer_id: string
  customer_name: string
  rating: number // 1-5
  comment: string
  created_at: string
  is_verified: boolean // true if from actual order
}

export function getReviews(productId: string): Review[] {
  const allReviews = storageGet<Review[]>('bmb_reviews', [])
  return allReviews.filter(r => r.product_id === productId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getAverageRating(productId: string): number {
  const reviews = getReviews(productId)
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

export function createReview(data: Omit<Review, 'id' | 'created_at'>): Review {
  const reviews = storageGet<Review[]>('bmb_reviews', [])
  const review: Review = {
    ...data,
    id: generateId('rev'),
    created_at: new Date().toISOString()
  }
  reviews.push(review)
  storageSet('bmb_reviews', reviews)
  return review
}

export function updateReview(id: string, data: Partial<Review>): Review | null {
  const reviews = storageGet<Review[]>('bmb_reviews', [])
  const index = reviews.findIndex(r => r.id === id)
  if (index === -1) return null
  reviews[index] = { ...reviews[index], ...data }
  storageSet('bmb_reviews', reviews)
  return reviews[index]
}

export function deleteReview(id: string): boolean {
  const reviews = storageGet<Review[]>('bmb_reviews', [])
  const filtered = reviews.filter(r => r.id !== id)
  if (filtered.length === reviews.length) return false
  storageSet('bmb_reviews', filtered)
  return true
}

// Get all reviews for a user
export function getUserReviews(userId: string): Review[] {
  const allReviews = storageGet<Review[]>('bmb_reviews', [])
  return allReviews.filter(r => r.customer_id === userId)
}

// Count reviews for a product
export function getReviewCount(productId: string): number {
  return getReviews(productId).length
}