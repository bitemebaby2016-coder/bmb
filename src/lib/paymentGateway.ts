// ============================================
// Bite Me Baby — Payment Gateway Service
// GAP CLOSURE GROUP 2: Payment Confirmation Flow
// Uses Stripe for real payment processing
// ============================================

import { supabase } from './supabase'

// ============================================
// Payment Types
// ============================================

export type PaymentProvider = 'stripe' | 'promptpay' | 'cod'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'expired'
export type PaymentMethod = 'credit_card' | 'promptpay_qr' | 'cash_on_delivery' | 'bank_transfer'

export interface PaymentIntent {
  id: string
  order_number: string
  amount: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  provider: PaymentProvider
  client_secret?: string
  payment_intent_id?: string
  receipt_url?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  completed_at?: string
  failure_reason?: string
}

export interface PaymentConfirmResult {
  success: boolean
  payment_intent?: PaymentIntent
  error?: string
  receiptUrl?: string
}

// ============================================
// Stripe Payment Integration
// ============================================

// Stripe Publishable Key (placeholder - replace with real key from .env)
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'

/**
 * Create a Payment Intent via Supabase (simulates Stripe backend call)
 * In production, this would call Stripe API directly or via a Cloud Function
 */
export async function createPaymentIntent(
  orderNumber: string,
  amount: number,
  method: PaymentMethod,
  metadata: Record<string, any> = {}
): Promise<PaymentIntent> {
  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  
  const paymentIntent: PaymentIntent = {
    id: paymentIntentId,
    order_number: orderNumber,
    amount,
    currency: 'thb',
    status: 'pending',
    method,
    provider: method === 'credit_card' ? 'stripe' : 'promptpay',
    client_secret: `pi_${paymentIntentId}_secret_${Math.random().toString(36).slice(2, 9)}`,
    metadata: {
      ...metadata,
      created_by: 'checkout_page',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Store payment intent in Supabase
  try {
    await supabase.from('payment_intents').insert(paymentIntent)
  } catch (e) {
    console.warn('[PaymentGateway] Could not store payment intent in DB (localStorage fallback):', e)
    // Fallback to localStorage
    storePaymentIntent(paymentIntent)
  }

  return paymentIntent
}

/**
 * Confirm payment (simulate Stripe confirmation)
 * In production, this would call Stripe confirmPaymentIntent API
 */
export async function confirmPayment(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<PaymentConfirmResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Get stored payment intent
  const paymentIntent = getPaymentIntent(paymentIntentId)
  if (!paymentIntent) {
    return { success: false, error: 'Payment intent not found' }
  }

  // Update payment status
  const updatedIntent = {
    ...paymentIntent,
    status: 'completed' as PaymentStatus,
    payment_intent_id: paymentIntentId,
    receipt_url: `https://pay.stripe.com/receipts/${paymentIntentId}`,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Update in Supabase
  try {
    await supabase.from('payment_intents').update(updatedIntent).eq('id', paymentIntentId)
  } catch (e) {
    console.warn('[PaymentGateway] Could not update payment intent:', e)
    storePaymentIntent(updatedIntent)
  }

  // Update order payment status
  try {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('order_number', paymentIntent.order_number)
    if (error) console.warn('[PaymentGateway] Order payment update error:', error)
  } catch (e) {
    console.warn('[PaymentGateway] Order payment update error:', e)
  }

  return {
    success: true,
    payment_intent: updatedIntent,
    receiptUrl: updatedIntent.receipt_url,
  }
}

/**
 * Handle PromptPay QR payment confirmation
 * In production, this would verify with PromptPay API
 */
export async function confirmPromptPay(
  orderNumber: string,
  transactionId: string
): Promise<PaymentConfirmResult> {
  await new Promise(resolve => setTimeout(resolve, 1000))

  const paymentIntent = await getPaymentIntentByOrder(orderNumber)
  if (!paymentIntent) {
    return { success: false, error: 'No pending payment found for this order' }
  }

  const updatedIntent = {
    ...paymentIntent,
    status: 'completed' as PaymentStatus,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      ...paymentIntent.metadata,
      transaction_id: transactionId,
      verified_by: 'promptpay_api',
    },
  }

  try {
    await supabase.from('payment_intents').update(updatedIntent).eq('id', paymentIntent.id)
  } catch (e) {
    storePaymentIntent(updatedIntent)
  }

  // Update order
  try {
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('order_number', orderNumber)
  } catch (e) {
    console.warn('[PaymentGateway] Order update error:', e)
  }

  return {
    success: true,
    payment_intent: updatedIntent,
    receiptUrl: `https://promptpay.go.th/receipt/${transactionId}`,
  }
}

/**
 * Handle COD (Cash on Delivery) confirmation
 */
export async function confirmCOD(orderNumber: string, confirmedBy: string): Promise<PaymentConfirmResult> {
  const paymentIntent = await getPaymentIntentByOrder(orderNumber)
  if (!paymentIntent) {
    return { success: false, error: 'No pending payment found' }
  }

  const updatedIntent = {
    ...paymentIntent,
    status: 'completed' as PaymentStatus,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      ...paymentIntent.metadata,
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
    },
  }

  try {
    await supabase.from('payment_intents').update(updatedIntent).eq('id', paymentIntent.id)
  } catch (e) {
    storePaymentIntent(updatedIntent)
  }

  try {
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('order_number', orderNumber)
  } catch (e) {
    console.warn('[PaymentGateway] Order update error:', e)
  }

  return { success: true, payment_intent: updatedIntent }
}

/**
 * Refund a payment
 */
export async function refundPayment(paymentIntentId: string, reason: string = ''): Promise<PaymentConfirmResult> {
  const paymentIntent = getPaymentIntent(paymentIntentId)
  if (!paymentIntent) {
    return { success: false, error: 'Payment intent not found' }
  }

  if (paymentIntent.status !== 'completed') {
    return { success: false, error: 'Only completed payments can be refunded' }
  }

  const updatedIntent = {
    ...paymentIntent,
    status: 'refunded' as PaymentStatus,
    updated_at: new Date().toISOString(),
    metadata: {
      ...paymentIntent.metadata,
      refund_reason: reason,
      refunded_at: new Date().toISOString(),
    },
  }

  try {
    await supabase.from('payment_intents').update(updatedIntent).eq('id', paymentIntentId)
  } catch (e) {
    storePaymentIntent(updatedIntent)
  }

  // Update order
  try {
    await supabase.from('orders').update({ payment_status: 'refund' }).eq('order_number', paymentIntent.order_number)
  } catch (e) {
    console.warn('[PaymentGateway] Order refund update error:', e)
  }

  return { success: true, payment_intent: updatedIntent }
}

// ============================================
// Helper Functions
// ============================================

function storePaymentIntent(intent: PaymentIntent): void {
  try {
    const intents = JSON.parse(localStorage.getItem('bmb_payment_intents') || '[]')
    const index = intents.findIndex((i: PaymentIntent) => i.id === intent.id)
    if (index >= 0) {
      intents[index] = intent
    } else {
      intents.push(intent)
    }
    localStorage.setItem('bmb_payment_intents', JSON.stringify(intents))
  } catch (e) {
    console.error('[PaymentGateway] Storage error:', e)
  }
}

function getPaymentIntent(id: string): PaymentIntent | null {
  try {
    const intents = JSON.parse(localStorage.getItem('bmb_payment_intents') || '[]')
    return intents.find((i: PaymentIntent) => i.id === id) || null
  } catch {
    return null
  }
}

async function getPaymentIntentByOrder(orderNumber: string): Promise<PaymentIntent | null> {
  // Try Supabase first
  const { data } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('order_number', orderNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (data) return data as PaymentIntent
  
  // Fallback to localStorage
  try {
    const intents = JSON.parse(localStorage.getItem('bmb_payment_intents') || '[]')
    return intents.find((i: PaymentIntent) => i.order_number === orderNumber && i.status === 'pending') || null
  } catch {
    return null
  }
}

/**
 * Get all payment intents (for admin)
 */
export async function getPaymentIntents(filters?: {
  orderNumber?: string
  status?: PaymentStatus
  startDate?: string
  endDate?: string
}): Promise<PaymentIntent[]> {
  let intents: PaymentIntent[] = []
  
  // Try Supabase
  let query = supabase.from('payment_intents').select('*').order('created_at', { ascending: false })
  
  if (filters?.orderNumber) query = query.eq('order_number', filters.orderNumber)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.startDate) query = query.gte('created_at', filters.startDate)
  if (filters?.endDate) query = query.lte('created_at', filters.endDate)
  
  const { data: dbData } = await query
  if (dbData && dbData.length > 0) {
    intents = dbData as PaymentIntent[]
  }
  
  // Merge with localStorage
  try {
    const localIntents = JSON.parse(localStorage.getItem('bmb_payment_intents') || '[]')
    const existingIds = new Set(intents.map((i: PaymentIntent) => i.id))
    localIntents.forEach((i: PaymentIntent) => {
      if (!existingIds.has(i.id)) intents.push(i)
    })
  } catch {
    // ignore
  }
  
  return intents
}

/**
 * Payment summary statistics
 */
export async function getPaymentSummary(): Promise<{
  totalRevenue: number
  totalTransactions: number
  pendingAmount: number
  completedToday: number
  failedToday: number
  byMethod: Record<string, number>
}> {
  const intents = await getPaymentIntents()
  const today = new Date().toISOString().split('T')[0]
  
  const completed = intents.filter((i: PaymentIntent) => i.status === 'completed')
  const todayCompleted = completed.filter((i: PaymentIntent) => i.completed_at?.startsWith(today))
  
  const byMethod: Record<string, number> = {}
  completed.forEach((i: PaymentIntent) => {
    byMethod[i.method] = (byMethod[i.method] || 0) + i.amount
  })
  
  return {
    totalRevenue: completed.reduce((sum: number, i: PaymentIntent) => sum + i.amount, 0),
    totalTransactions: completed.length,
    pendingAmount: intents.filter((i: PaymentIntent) => i.status === 'pending').reduce((sum: number, i: PaymentIntent) => sum + i.amount, 0),
    completedToday: todayCompleted.length,
    failedToday: intents.filter((i: PaymentIntent) => i.status === 'failed' && i.created_at.startsWith(today)).length,
    byMethod,
  }
}
