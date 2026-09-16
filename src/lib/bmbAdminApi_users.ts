// ============================================
// Bite Me Baby Admin API - Users & Dashboard
// ============================================

import { storageGet, storageSet, generateId, hashPassword, verifyPassword } from './bmbStorage'
import { getOrders } from './bmbAdminApi_orders'
import { getInventory } from './bmbAdminApi_inventory'
import type { Ingredient } from '@/types'

export interface User {
  id: string
  email: string
  phone: string
  name: string
  password_hash: string
  role: 'customer' | 'admin'
  is_active: boolean
  created_at: string
}

export function getUsers(): User[] {
  return storageGet<User[]>('bmb_users', [])
}

export function getUserByEmail(email: string): User | undefined {
  return getUsers().find(u => u.email === email)
}

export function getUserByPhone(phone: string): User | undefined {
  return getUsers().find(u => u.phone === phone)
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id)
}

/**
 * Create a new user with bcrypt-hashed password
 */
export async function createUser(data: {
  email: string
  phone: string
  name: string
  password: string
  role?: 'customer' | 'admin'
}): Promise<User | null> {
  const users = getUsers()
  
  if (users.find(u => u.email === data.email)) return null
  if (users.find(u => u.phone === data.phone)) return null
  
  const hashedPassword = await hashPassword(data.password)
  
  const user: User = {
    id: generateId('user'),
    email: data.email,
    phone: data.phone,
    name: data.name,
    password_hash: hashedPassword,
    role: data.role || 'customer',
    is_active: true,
    created_at: new Date().toISOString()
  }
  users.push(user)
  storageSet('bmb_users', users)
  return user
}

/**
 * Authenticate user by email with bcrypt verification
 */
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = getUserByEmail(email)
  if (!user) return null
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) return null
  return user
}

/**
 * Authenticate user by phone with bcrypt verification
 */
export async function authenticateUserByPhone(phone: string, password: string): Promise<User | null> {
  const user = getUserByPhone(phone)
  if (!user) return null
  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) return null
  return user
}

export function updateUser(id: string, data: Partial<User>): User | null {
  const users = getUsers()
  const index = users.findIndex(u => u.id === id)
  if (index === -1) return null
  users[index] = { ...users[index], ...data }
  storageSet('bmb_users', users)
  return users[index]
}

/**
 * Initialize admin account with bcrypt-hashed password
 * Called once at app startup
 */
export async function initializeAdmin(): Promise<void> {
  try {
    const existingUsers = getUsers()
    const hasAdmin = existingUsers.find(u => u.email === 'admin@bmb.co.th')
    
    if (hasAdmin) return // Admin already exists
    
    const hashedPassword = await hashPassword('admin123')
    
    const adminUser: User = {
      id: 'admin-001',
      email: 'admin@bmb.co.th',
      phone: '0812345678',
      name: 'Admin Bite Me Baby',
      password_hash: hashedPassword,
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString()
    }
    
    const users = [...existingUsers, adminUser]
    storageSet('bmb_users', users)
    console.log('[BMB] Admin account initialized with bcrypt hash')
  } catch (error) {
    console.error('[BMB] Failed to initialize admin:', error)
  }
}

export interface DashboardStats {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  completionRate: number
  lowStockItems: number
  totalOrders: number
  totalRevenue: number
  totalCustomers: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [orders, inventory] = await Promise.all([getOrders(), getInventory()])
  const users = getUsers()
  
  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter((o: any) => o.created_at.startsWith(today))
  const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + o.total_amount, 0)
  const pendingOrders = todayOrders.filter((o: any) => o.status === 'pending' || o.status === 'confirmed').length
  const deliveredOrders = todayOrders.filter((o: any) => o.status === 'delivered').length
  const completionRate = todayOrders.length > 0 ? Math.round((deliveredOrders / todayOrders.length) * 100) : 0
  const lowStockItems = inventory.filter((i: Ingredient) => i.status === 'low_stock' || i.status === 'out_of_stock').length
  
  return {
    todayOrders: todayOrders.length,
    todayRevenue,
    pendingOrders,
    completionRate,
    lowStockItems,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum: number, o: any) => sum + o.total_amount, 0),
    totalCustomers: users.filter((u: User) => u.role === 'customer').length
  }
}