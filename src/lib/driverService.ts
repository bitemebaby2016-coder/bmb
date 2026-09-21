// ============================================
// Bite Me Baby — Driver / Delivery assignment service (DEL-02)
// Wraps migration 020 RPCs (drivers + delivery_assignments) — replaces MOCK.
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

export async function driverLogin(phone: string, name: string): Promise<DriverRecord | null> {
  const { data, error } = await supabase.rpc('driver_login', { p_phone: phone, p_name: name })
  if (error) {
    console.warn('[Driver] driver_login failed:', error.message)
    return null
  }
  return (data as unknown as { driver: DriverRecord }).driver ?? null
}

export async function myDeliveries(phone: string): Promise<MyDeliveryAssignment[]> {
  const { data, error } = await supabase.rpc('my_deliveries', { p_driver_phone: phone })
  if (error) {
    console.warn('[Driver] my_deliveries failed:', error.message)
    return []
  }
  return (data as unknown as { assignments: MyDeliveryAssignment[] }).assignments ?? []
}

export async function driverAcceptAssignment(orderNumber: string, phone: string): Promise<boolean> {
  const { error } = await supabase.rpc('driver_accept_assignment', { p_order_number: orderNumber, p_driver_phone: phone })
  return !error
}

export async function driverUpdateDeliveryStatus(
  orderNumber: string,
  phone: string,
  status: 'picked_up' | 'in_transit' | 'delivered',
  coords?: { latitude: number; longitude: number },
): Promise<boolean> {
  const { error } = await supabase.rpc('driver_update_delivery_status', {
    p_order_number: orderNumber,
    p_driver_phone: phone,
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

/** Admin: upsert a driver record. */
export async function upsertDriver(name: string, phone: string, vehicleLabel = ''): Promise<string | null> {
  const { data, error } = await supabase.rpc('upsert_driver', { p_name: name, p_phone: phone, p_vehicle_label: vehicleLabel })
  if (error) return null
  return (data as unknown as { driver_id?: string }).driver_id ?? null
}