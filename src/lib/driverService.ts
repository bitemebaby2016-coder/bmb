// ============================================
// Bite Me Baby — Driver / Delivery assignment service (DEL-02 + F-06 WAVE 2-B)
// Identity = Supabase Auth JWT ONLY (Owner Decision 06).
// All RPCs resolve the driver via auth.uid() → drivers.user_id —
// phone/name/driver_id from the client are NOT trusted (F-06 fix, migr 041).
// ============================================

import { supabase } from './supabase'

export interface DriverRecord {
  id: string
  name: string
  phone: string
  vehicle_label: string
  status: 'available' | 'busy' | 'offline'
  current_latitude: number | null
  current_longitude: number | null
  last_seen_at: string | null
}

export interface MyDeliveryItem {
  product_name: string
  quantity: number
}

export interface MyDeliveryAssignment {
  order_number: string
  assignment_status: 'assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered'
  assigned_at: string
  accepted_at: string | null
  dropoff_detail: string
  dropoff_latitude: number | null
  dropoff_longitude: number | null
  order_status: string
  total_amount: number
  payment_status: string
  payment_method: string
  items: MyDeliveryItem[]
}

/**
 * F-06: JWT-bound driver login. Requires an active Supabase Auth session whose
 * user is linked to a drivers row (admin provisioning). Phone-only login is
 * no longer possible.
 */
export async function driverLogin(): Promise<DriverRecord | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data, error } = await supabase.rpc('driver_login')
  if (error) {
    console.warn('[Driver] driver_login failed:', error.message)
    return null
  }
  return (data as unknown as { driver: DriverRecord }).driver ?? null
}

export async function myDeliveries(): Promise<MyDeliveryAssignment[]> {
  const { data, error } = await supabase.rpc('my_deliveries')
  if (error) {
    console.warn('[Driver] my_deliveries failed:', error.message)
    return []
  }
  return (data as unknown as { assignments: MyDeliveryAssignment[] }).assignments ?? []
}

export async function driverAcceptAssignment(orderNumber: string): Promise<boolean> {
  const { error } = await supabase.rpc('driver_accept_assignment', { p_order_number: orderNumber })
  return !error
}

export async function driverUpdateDeliveryStatus(
  orderNumber: string,
  status: 'picked_up' | 'in_transit' | 'delivered',
  coords?: { latitude: number; longitude: number },
): Promise<boolean> {
  const { error } = await supabase.rpc('driver_update_delivery_status', {
    p_order_number: orderNumber,
    p_status: status,
    p_latitude: coords?.latitude ?? null,
    p_longitude: coords?.longitude ?? null,
  })
  return !error
}

/** Admin: assign an order to a driver (dispatch board). */
export async function assignDriver(orderNumber: string, driverId: string): Promise<boolean> {
  const { error } = await supabase.rpc('assign_driver', { p_order_number: orderNumber, p_driver_id: driverId })
  return !error
}

/**
 * Admin provisioning (Owner Decision 06): link an existing Supabase Auth user
 * to a driver record. The auth user must be created via Supabase Dashboard /
 * Admin API first (no SMS OTP infrastructure — reported gap, Wave 2 report).
 */
export async function linkDriverUser(driverId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('link_driver_user', { p_driver_id: driverId, p_user_id: userId })
  return !error
}

/** Admin: upsert a driver record. */
export async function upsertDriver(name: string, phone: string, vehicleLabel = ''): Promise<string | null> {
  const { data, error } = await supabase.rpc('upsert_driver', { p_name: name, p_phone: phone, p_vehicle_label: vehicleLabel })
  if (error) return null
  return (data as unknown as { driver_id?: string }).driver_id ?? null
}