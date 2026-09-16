// ============================================
// Bite Me Baby — Review System (Supabase-backed)
// GAP CLOSURE P1-1: Migrated from localStorage to Supabase
// ============================================

import { supabase } from './supabase'

export interface ReviewForm {
  id?: string
  product_id: string
  customer_id: string
  customer_name: string
  rating: number // 1-5
  comment: string
  is_verified?: boolean
}

export interface Review {
  id: string
  product_id: string
  customer_id: string
  customer_name: string
  rating: number
  comment: string
  created_at: string
  is_verified: boolean
}

// Get reviews for a specific product from Supabase
export async function getReviews(productId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('[getReviews] Error:', error)
    return []
  }
  return (data || []) as Review[]
}

// Get average rating for a product
export async function getAverageRating(productId: string): Promise<number> {
  const reviews = await getReviews(productId)
  if (reviews.length === 0) return 0
  
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

// Create a review in Supabase
export async function createReview(data: Omit<ReviewForm, 'id'>): Promise<Review | null> {
  const reviewData = {
    product_id: data.product_id,
    customer_id: data.customer_id,
    customer_name: data.customer_name,
    rating: data.rating,
    comment: data.comment,
    is_verified: data.is_verified ?? false,
    created_at: new Date().toISOString()
  }

  const { data: result, error } = await supabase
    .from('reviews')
    .insert(reviewData)
    .select()
    .single()

  if (error) {
    console.error('[createReview] Error:', error)
    return null
  }
  return result as Review
}

// Update a review in Supabase
export async function updateReview(id: string, data: Partial<Pick<ReviewForm, 'rating' | 'comment'>>): Promise<Review | null> {
  const { data: result, error } = await supabase
    .from('reviews')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[updateReview] Error:', error)
    return null
  }
  return result as Review
}

// Delete a review from Supabase
export async function deleteReview(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteReview] Error:', error)
    return false
  }
  return true
}

// Get all reviews for a user
export async function getUserReviews(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getUserReviews] Error:', error)
    return []
  }
  return (data || []) as Review[]
}

// Count reviews for a product
export async function getReviewCount(productId: string): Promise<number> {
  const { count, error } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)

  if (error) {
    console.error('[getReviewCount] Error:', error)
    return 0
  }
  return count || 0
}

// Get all reviews with pagination (for admin)
export async function getAllReviews(page: number = 1, limit: number = 50): Promise<{ reviews: Review[]; total: number }> {
  const start = (page - 1) * limit
  const end = start + limit

  const { data, error, count } = await supabase
    .from('reviews')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, end - 1)

  if (error) {
    console.error('[getAllReviews] Error:', error)
    return { reviews: [], total: 0 }
  }

  return {
    reviews: (data || []) as Review[],
    total: count || 0
  }
}
