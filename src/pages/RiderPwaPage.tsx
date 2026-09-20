// ============================================
// Bite Me Baby — Rider PWA page shell
// Demonstrates the RiderPWA delivery-completion flow + the debounced
// DistanceChecker on a single operational screen.
// ============================================

import { useEffect } from 'react'
import { RiderPWA } from '@/components/dashboard/RiderPWA'
import { DistanceChecker } from '@/components/delivery/DistanceChecker'
import { useOrderStateMachine } from '@/stores/useOrderStateMachine'

const SAMPLE_DROP_OFF = { latitude: 12.6102, longitude: 102.1032 }

export function RiderPwaPage() {
  const init = useOrderStateMachine((s) => s.init)

  useEffect(() => {
    init('SAME_DAY', 'BMB-RIDER-DEMO')
  }, [init])

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold text-brand-accent">🧑‍🔧 Rider PWA</h1>
      <DistanceChecker
        origin={{ latitude: 12.6098, longitude: 102.1036 }}
        destination={SAMPLE_DROP_OFF}
      />
      <RiderPWA dropOff={SAMPLE_DROP_OFF} radiusMeters={400} />
    </div>
  )
}
