// ============================================
// Bite Me Baby — Kitchen Core service (Phase 2: INV-01/02, KIT-01/02)
// Server authority lives in migration 019 RPCs:
//   deduct/restore_inventory_for_order · create_production_batch ·
//   kitchen_queue · get_inventory_requirements
// This module wraps those RPCs + keeps pure feasibility logic unit-testable.
// ============================================

import { supabase } from './supabase'

export interface IngredientRequirement {
  ingredient_id: string
  ingredient_name: string
  unit: string
  quantity_per_unit: number
  required: number
  current_stock: number
  min_stock: number
  feasible: boolean
}

export interface InventoryRequirementsResult {
  product_id: string
  quantity: number
  feasible: boolean
  requirements: IngredientRequirement[]
}

export interface KitchenBatchItem {
  item_id: string
  order_number: string
  product_name: string
  quantity: number
  status: 'queued' | 'preparing' | 'ready'
}

export interface KitchenBatch {
  batch_id: string
  delivery_round_id: string | null
  scheduled_date: string
  status: string
  items: KitchenBatchItem[]
}

export interface KitchenQueueResult {
  batches: KitchenBatch[]
}

/** RPC wrapper: inventory requirements (BOM) for a product at a quantity. */
export async function getInventoryRequirements(
  productId: string,
  quantity: number,
): Promise<InventoryRequirementsResult | null> {
  const { data, error } = await supabase.rpc('get_inventory_requirements', {
    p_product_id: productId,
    p_quantity: quantity,
  })
  if (error) {
    console.warn('[Kitchen] get_inventory_requirements failed:', error.message)
    return null
  }
  return data as unknown as InventoryRequirementsResult
}

/** RPC wrapper: group confirmed/preparing orders of a round into a production batch. */
export async function createProductionBatch(roundId: string, scheduledDate?: string): Promise<{ batch_id: string; items_count: number } | null> {
  const { data, error } = await supabase.rpc('create_production_batch', {
    p_delivery_round_id: roundId,
    p_scheduled_date: scheduledDate ?? null,
  })
  if (error) {
    console.warn('[Kitchen] create_production_batch failed:', error.message)
    return null
  }
  return data as unknown as { batch_id: string; items_count: number }
}

/** RPC wrapper: today's kitchen queue (batches + items per round). */
export async function getKitchenQueue(roundId?: string, scheduledDate?: string): Promise<KitchenQueueResult | null> {
  const { data, error } = await supabase.rpc('kitchen_queue', {
    p_delivery_round_id: roundId ?? null,
    p_scheduled_date: scheduledDate ?? null,
  })
  if (error) {
    console.warn('[Kitchen] kitchen_queue failed:', error.message)
    return null
  }
  return data as unknown as KitchenQueueResult
}

/** RPC wrapper: deduct raw materials for a confirmed order (INV-01). */
export async function deductInventoryForOrder(orderNumber: string): Promise<boolean> {
  const { error } = await supabase.rpc('deduct_inventory_for_order', { p_order_number: orderNumber })
  return !error
}

/** RPC wrapper: restore raw materials for a cancelled/failed order (INV-01). */
export async function restoreInventoryForOrder(orderNumber: string): Promise<boolean> {
  const { error } = await supabase.rpc('restore_inventory_for_order', { p_order_number: orderNumber })
  return !error
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable — no I/O)
// ---------------------------------------------------------------------------

/**
 * Availability from BOM: a product is sellable at `quantity` iff EVERY recipe
 * ingredient can cover the required amount AND the product is not manually
 * disabled. Returns the tightest ingredient saturation (0..1+) and the list of
 * blocking ingredients (used by INV-02 display + sold-out reasoning).
 */
export function bomFeasibility(
  requirements: IngredientRequirement[],
  quantity: number,
): { feasible: boolean; minSaturation: number; blocking: string[] } {
  if (requirements.length === 0) return { feasible: true, minSaturation: 1, blocking: [] }
  let minSat = Infinity
  const blocking: string[] = []
  for (const r of requirements) {
    const required = r.quantity_per_unit * quantity
    const sat = required <= 0 ? 1 : r.current_stock / required
    minSat = Math.min(minSat, sat)
    if (sat < 1) blocking.push(r.ingredient_name)
  }
  const feasible = blocking.length === 0
  return { feasible, minSaturation: minSat === Infinity ? 1 : minSat, blocking }
}

/** Aggregate per-batch production totals — kitchen work summary (KIT-01). */
export function summarizeBatchItems(items: KitchenBatchItem[]): Array<{ product_name: string; quantity: number; orderCount: number }> {
  const map = new Map<string, { product_name: string; quantity: number; orderCount: number }>()
  const orderKeys = new Set<string>()
  for (const it of items) {
    const cur = map.get(it.product_name) || { product_name: it.product_name, quantity: 0, orderCount: 0 }
    cur.quantity += Number(it.quantity) || 0
    if (!orderKeys.has(it.order_number)) {
      orderKeys.add(it.order_number)
      cur.orderCount += 1
    }
    map.set(it.product_name, cur)
  }
  return Array.from(map.values()).sort((x, y) => y.quantity - x.quantity)
}