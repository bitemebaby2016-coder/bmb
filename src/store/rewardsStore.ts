import { create } from "zustand"
import type { LoyaltyPoint, RewardRedemption, ViralActivityProgress } from "@/types"

interface RewardsStore {
  loyaltyPoints: number
  totalEarned: number
  totalRedeemed: number
  pointsHistory: LoyaltyPoint[]
  redemptions: RewardRedemption[]
  activityProgress: ViralActivityProgress[]
  badges: string[]
  streakDays: number
  lastActiveDate: string

  // Actions
  addPoints: (points: number, source: string, metadata?: Record<string, any>) => void
  redeemPoints: (points: number, rewardType: string, rewardValue: string) => boolean
  updateActivityProgress: (activityId: string, progress: number) => void
  completeActivity: (activityId: string) => void
  addBadge: (badge: string) => void
  updateStreak: (currentDate: string) => void
  resetStreak: () => void

  // Calculations
  getPointsByType: (type: 'earned' | 'redeemed' | 'expired') => LoyaltyPoint[]
  getUpcomingRedemptions: () => RewardRedemption[]
  getCompletedActivities: () => ViralActivityProgress[]
  getPendingActivities: () => ViralActivityProgress[]
  calculateDaysSinceLastOrder: () => number
}

export const useRewardsStore = create<RewardsStore>((set, get) => ({
  loyaltyPoints: 0,
  totalEarned: 0,
  totalRedeemed: 0,
  pointsHistory: [],
  redemptions: [],
  activityProgress: [],
  badges: [],
  streakDays: 0,
  lastActiveDate: '',

  addPoints: (points, source, metadata = {}) => {
    const now = new Date().toISOString()
    const point: LoyaltyPoint = {
      id: `point-${Date.now()}`,
      user_id: '', // would be set from auth
      points,
      points_type: source === 'redeemed' ? 'redeemed' : 'earned',
      source,
      created_at: now,
      is_used: source !== 'redeemed',
      ...metadata
    }

    set((state) => ({
      loyaltyPoints: state.loyaltyPoints + (source === 'redeemed' ? -points : points),
      totalEarned: source === 'redeemed' ? state.totalEarned : state.totalEarned + points,
      totalRedeemed: source === 'redeemed' ? state.totalRedeemed + points : state.totalRedeemed,
      pointsHistory: [point, ...state.pointsHistory]
    }))
  },

  redeemPoints: (points, rewardType, rewardValue) => {
    const state = get()
    if (state.loyaltyPoints < points) return false

    const redemption: RewardRedemption = {
      id: `redemption-${Date.now()}`,
      user_id: '',
      points_used: points,
      reward_type: rewardType,
      reward_value: rewardValue,
      redeemed_at: new Date().toISOString(),
      status: 'pending'
    }

    set((state) => ({
      loyaltyPoints: state.loyaltyPoints - points,
      totalRedeemed: state.totalRedeemed + points,
      redemptions: [redemption, ...state.redemptions]
    }))

    return true
  },

  updateActivityProgress: (activityId, progress) => {
    set((state) => ({
      activityProgress: state.activityProgress.map(ap =>
        ap.activity_id === activityId
          ? { ...ap, progress, completed: progress >= ap.target }
          : ap
      )
    }))
  },

  completeActivity: (activityId) => {
    set((state) => ({
      activityProgress: state.activityProgress.map(ap =>
        ap.activity_id === activityId
          ? { ...ap, completed: true, completed_at: new Date().toISOString() }
          : ap
      )
    }))
  },

  addBadge: (badge) => set((state) => ({
    badges: state.badges.includes(badge) ? state.badges : [...state.badges, badge]
  })),

  updateStreak: (currentDate) => {
    const state = get()
    const lastDate = new Date(state.lastActiveDate)
    const today = new Date(currentDate)
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      set({ streakDays: state.streakDays + 1, lastActiveDate: currentDate })
    } else if (diffDays === 0) {
      set({ lastActiveDate: currentDate })
    } else {
      set({ streakDays: 1, lastActiveDate: currentDate })
    }
  },

  resetStreak: () => set({ streakDays: 0, lastActiveDate: '' }),

  getPointsByType: (type) => get().pointsHistory.filter(p => p.points_type === type),

  getUpcomingRedemptions: () => get().redemptions.filter(r => r.status === 'pending'),

  getCompletedActivities: () => get().activityProgress.filter(ap => ap.completed),

  getPendingActivities: () => get().activityProgress.filter(ap => !ap.completed),

  calculateDaysSinceLastOrder: () => {
    const state = get()
    if (!state.lastActiveDate) return 999
    const lastOrder = new Date(state.lastActiveDate)
    const today = new Date()
    return Math.floor((today.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24))
  }
}))